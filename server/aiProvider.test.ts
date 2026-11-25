import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AiProviderError,
  isNonRetriableError,
  isPodcastAvailable,
  isTextAiAvailable,
  isTimeoutOrAbortError,
  normalizeAndConvertAudio,
  normalizeAndValidateAudio,
  resolveAiConfigFromEnv,
  wrapPcm16ToWav,
} from './aiProvider.ts';
import {
  GEMINI_DEFAULTS,
  getPublicAiSettingsPayload,
  OPENAI_DEFAULTS,
  resetStoredSettingsForActiveProvider,
  resolveEffectiveAiConfig,
  sanitizeStoredAiSettings,
  updateStoredSettingsForActiveProvider,
  validateTtsParameters,
} from './aiSettings.ts';
import { getAudioExtensionFromMime } from '../src/utils/formatting.ts';

function withTempSettingsFile(run: (filePath: string) => void | Promise<void>): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmw-ai-settings-'));
  const filePath = path.join(dir, 'ai-settings.json');
  return Promise.resolve()
    .then(() => run(filePath))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

test('Gemini ha precedenza assoluta e usa i default economici senza TEXT_MODEL/AUDIO_MODEL', () => {
  const cfg = resolveAiConfigFromEnv({
    GEMINI_API_KEY: 'gem-key',
    OPENAI_API_KEY: 'oa-key',
    OPENAI_BASE_URL: 'https://custom.invalid/v1',
  });

  assert.ok(cfg);
  assert.equal(cfg.kind, 'gemini');
  assert.equal(cfg.geminiApiKey, 'gem-key');
  assert.equal(cfg.openaiApiKey, '');
  assert.equal(cfg.baseUrl, '');
  assert.equal(cfg.textModel, GEMINI_DEFAULTS.textModel);
  assert.equal(cfg.audioModel, GEMINI_DEFAULTS.audioModel);
  assert.equal(cfg.voice, GEMINI_DEFAULTS.voice);
  assert.equal(cfg.audioFormat, 'wav');
});

test('OpenAI-compatible usa default OpenRouter ed economici senza OPENAI_BASE_URL/modelli', () => {
  const cfg = resolveAiConfigFromEnv({
    GEMINI_API_KEY: '   ',
    OPENAI_API_KEY: 'or-key',
  });

  assert.ok(cfg);
  assert.equal(cfg.kind, 'openai');
  assert.equal(cfg.openaiApiKey, 'or-key');
  assert.equal(cfg.baseUrl, OPENAI_DEFAULTS.baseUrl);
  assert.equal(cfg.textModel, OPENAI_DEFAULTS.textModel);
  assert.equal(cfg.audioModel, OPENAI_DEFAULTS.audioModel);
  assert.equal(cfg.voice, OPENAI_DEFAULTS.voice);
  assert.equal(cfg.audioFormat, OPENAI_DEFAULTS.audioFormat);
});

test('isTextAiAvailable e isPodcastAvailable si attivano con la sola chiave provider', () => {
  const envOpenAi = { OPENAI_API_KEY: 'or-key' };
  assert.equal(isTextAiAvailable(envOpenAi), true);
  assert.equal(isPodcastAvailable(envOpenAi), true);

  assert.equal(isTextAiAvailable({}), false);
  assert.equal(isPodcastAvailable({}), false);
});

test('getPublicAiSettingsPayload non espone mai le chiavi API', async () => {
  await withTempSettingsFile(async (filePath) => {
    const payload = await getPublicAiSettingsPayload(
      { GEMINI_API_KEY: 'SECRET_GEMINI_123', OPENAI_API_KEY: 'SECRET_OPENAI_456' },
      filePath,
    );
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes('SECRET_GEMINI_123'), false);
    assert.equal(serialized.includes('SECRET_OPENAI_456'), false);
    assert.equal(payload.providerKind, 'gemini');
    assert.equal(payload.effective?.textModel, GEMINI_DEFAULTS.textModel);
  });
});

test('Persistenza per campo, cambio provider preservato e reset selettivo per provider attivo', async () => {
  await withTempSettingsFile((filePath) => {
    const gemEnv = { GEMINI_API_KEY: 'g-key' };
    const oaEnv = { OPENAI_API_KEY: 'o-key' };

    updateStoredSettingsForActiveProvider(
      { textModel: 'gemini-4-hydrogen', voice: 'Zephyr' },
      gemEnv,
      filePath,
    );

    const savedOa = updateStoredSettingsForActiveProvider(
      {
        audioModel: 'google/gemini-3.8-flash-lite-tts',
        voice: 'Kore',
        audioFormat: 'wav',
      },
      oaEnv,
      filePath,
    );

    assert.equal(savedOa.gemini.textModel, 'gemini-4-hydrogen');
    assert.deepEqual(savedOa.gemini.customizedFields, ['textModel', 'voice']);
    assert.equal(savedOa.openai.audioModel, 'google/gemini-3.8-flash-lite-tts');
    assert.equal(savedOa.openai.textModel, OPENAI_DEFAULTS.textModel);

    // Le variabili env sovrascrivono i campi non personalizzati ma rispettano quelli personalizzati
    const effOa = resolveEffectiveAiConfig(
      { ...oaEnv, TEXT_MODEL: 'openai/gpt-4o-mini', AUDIO_MODEL: 'tts-1' },
      savedOa,
    );
    assert.equal(effOa?.textModel, 'openai/gpt-4o-mini');
    assert.equal(effOa?.audioModel, 'google/gemini-3.8-flash-lite-tts');

    // Reset selettivo ripristina solo il provider attivo (openai) lasciando intatto gemini
    const afterReset = resetStoredSettingsForActiveProvider(oaEnv, filePath);
    assert.deepEqual(afterReset.openai.customizedFields, []);
    assert.equal(afterReset.openai.audioModel, OPENAI_DEFAULTS.audioModel);
    assert.equal(afterReset.gemini.textModel, 'gemini-4-hydrogen');
    assert.equal(afterReset.gemini.voice, 'Zephyr');

    // Migrazione: campi non presenti in customizedFields adottano sempre i nuovi default correnti
    const migrated = sanitizeStoredAiSettings({
      openai: {
        textModel: 'vecchio-default-obsoleto',
        audioModel: 'openai/gpt-4o-mini-tts',
        voice: 'alloy',
        audioFormat: 'mp3',
        customizedFields: ['audioModel'],
      },
    });
    assert.equal(migrated.openai.textModel, OPENAI_DEFAULTS.textModel);
    assert.equal(migrated.openai.audioModel, 'openai/gpt-4o-mini-tts');
  });
});

test('validateTtsParameters blocca voice/formato incompatibili su Gemini TTS OpenRouter e accetta quelli validi', () => {
  const errAlloy = validateTtsParameters(
    'openai',
    'google/gemini-3.8-flash-tts',
    'alloy',
    'wav',
  );
  assert.match(errAlloy ?? '', /voce "alloy" non è supportata/i);

  const errMp3 = validateTtsParameters(
    'openai',
    'google/gemini-3.8-flash-lite-tts',
    'Zephyr',
    'mp3',
  );
  assert.match(errMp3 ?? '', /formato "mp3" non è supportato/i);

  assert.equal(
    validateTtsParameters('openai', 'google/gemini-3.8-flash-lite-tts', 'Zephyr', 'wav'),
    null,
  );
  assert.equal(
    validateTtsParameters('openai', 'google/gemini-3.8-flash-lite-tts', 'Kore', 'pcm'),
    null,
  );
  assert.equal(
    validateTtsParameters('openai', 'hexgrad/kokoro-82m', 'if_sara', 'mp3'),
    null,
  );
});

test('normalizeAndConvertAudio converte PCM16 in WAV valido e mantiene MP3/WAV intatti', () => {
  const wavHeader = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WAVEfmt '),
  ]);
  assert.equal(normalizeAndValidateAudio(wavHeader, 'audio/wav'), 'audio/wav');

  const mp3Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);
  assert.equal(normalizeAndValidateAudio(mp3Header, 'audio/mpeg; charset=binary'), 'audio/mpeg');
  assert.equal(normalizeAndValidateAudio(mp3Header, 'audio/wav'), 'audio/mpeg');

  const rawPcm = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  const converted = normalizeAndConvertAudio(rawPcm, 'audio/L16;rate=24000');
  assert.equal(converted.mimeType, 'audio/wav');
  assert.equal(converted.buffer.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(converted.buffer.subarray(8, 12).toString('ascii'), 'WAVE');
  assert.equal(converted.buffer.readUInt32LE(24), 24000);
  assert.equal(converted.buffer.readUInt32LE(40), 6);
  assert.equal(converted.buffer.length, 44 + 6);

  const directWrap = wrapPcm16ToWav(Buffer.from([0x10, 0x20, 0x30, 0x40]), 16000, 1);
  assert.equal(directWrap.readUInt32LE(24), 16000);

  assert.throws(
    () => normalizeAndConvertAudio(Buffer.from('{"error":"not supported"}'), 'application/json'),
    /non audio/,
  );
  assert.throws(
    () => normalizeAndConvertAudio(Buffer.from([0x01, 0x02, 0x03, 0x04]), 'audio/wav'),
    /non corrispondono a un contenitore WAV/,
  );
  assert.throws(() => normalizeAndConvertAudio(Buffer.alloc(0), 'audio/mpeg'), /file vuoto/);
});

test('Timeout, abort e 4xx non vengono ritentati mentre 503/429 restano ritentabili', () => {
  const timeoutErr = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });
  assert.equal(isTimeoutOrAbortError(timeoutErr), true);
  assert.equal(isNonRetriableError(timeoutErr), true);

  assert.equal(isNonRetriableError(new AiProviderError(400, 'Bad format')), true);
  assert.equal(isNonRetriableError(new AiProviderError(401, 'Unauthorized')), true);
  assert.equal(isNonRetriableError(new AiProviderError(403, 'Forbidden')), true);
  assert.equal(isNonRetriableError(new AiProviderError(504, 'Timeout', 'timeout')), true);

  assert.equal(isNonRetriableError({ status: 503, message: 'high demand' }), false);
  assert.equal(isNonRetriableError({ status: 429, message: 'rate limit' }), false);
});

test('getAudioExtensionFromMime mappa correttamente le estensioni dinamiche', () => {
  assert.equal(getAudioExtensionFromMime('audio/mpeg'), '.mp3');
  assert.equal(getAudioExtensionFromMime('audio/mp3; charset=utf-8'), '.mp3');
  assert.equal(getAudioExtensionFromMime('audio/wav'), '.wav');
  assert.equal(getAudioExtensionFromMime('audio/ogg'), '.ogg');
  assert.equal(getAudioExtensionFromMime('audio/mp4'), '.m4a');
  assert.equal(getAudioExtensionFromMime('audio/aac'), '.aac');
  assert.equal(getAudioExtensionFromMime('audio/unknown'), '.audio');
});
