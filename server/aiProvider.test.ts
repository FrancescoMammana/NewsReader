import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMissingConfigMessage,
  isPodcastAvailable,
  isTextAiAvailable,
  normalizeAndValidateAudio,
  resolveAiConfigFromEnv,
} from './aiProvider.ts';
import { getAudioExtensionFromMime } from '../src/utils/formatting.ts';

test('Gemini ha precedenza assoluta e ignora le credenziali OpenAI', () => {
  const cfg = resolveAiConfigFromEnv({
    GEMINI_API_KEY: 'gem-key',
    OPENAI_API_KEY: 'oa-key',
    OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
    TEXT_MODEL: 'gemini-3.1-flash-lite',
    AUDIO_MODEL: 'gemini-3.8-flash-lite-tts',
  });

  assert.ok(cfg);
  assert.equal(cfg.kind, 'gemini');
  assert.equal(cfg.geminiApiKey, 'gem-key');
  assert.equal(cfg.openaiApiKey, '');
  assert.equal(cfg.openaiBaseUrl, '');
  assert.equal(cfg.textModel, 'gemini-3.1-flash-lite');
  assert.equal(cfg.audioModel, 'gemini-3.8-flash-lite-tts');
});

test('OpenAI-compatible viene selezionato solo senza GEMINI_API_KEY e richiede key + baseURL', () => {
  const cfg = resolveAiConfigFromEnv({
    GEMINI_API_KEY: '   ',
    OPENAI_API_KEY: 'or-key',
    OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
    TEXT_MODEL: 'openai/gpt-4o-mini',
    AUDIO_MODEL: 'openai/gpt-4o-mini-tts',
  });

  assert.ok(cfg);
  assert.equal(cfg.kind, 'openai');
  assert.equal(cfg.openaiApiKey, 'or-key');
  assert.equal(cfg.openaiBaseUrl, 'https://openrouter.ai/api/v1');

  const incomplete = resolveAiConfigFromEnv({
    OPENAI_API_KEY: 'or-key',
    OPENAI_BASE_URL: '',
    TEXT_MODEL: 'openai/gpt-4o-mini',
    AUDIO_MODEL: 'openai/gpt-4o-mini-tts',
  });
  assert.equal(incomplete, null);
  assert.match(
    getMissingConfigMessage('podcast', { OPENAI_API_KEY: 'or-key' }),
    /OPENAI_API_KEY.*OPENAI_BASE_URL/,
  );
});

test('isTextAiAvailable e isPodcastAvailable richiedono i relativi modelli configurati', () => {
  const onlyTextEnv = {
    OPENAI_API_KEY: 'or-key',
    OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
    TEXT_MODEL: 'openai/gpt-4o-mini',
    AUDIO_MODEL: '',
  };
  assert.equal(isTextAiAvailable(onlyTextEnv), true);
  assert.equal(isPodcastAvailable(onlyTextEnv), false);

  const fullEnv = { ...onlyTextEnv, AUDIO_MODEL: 'openai/gpt-4o-mini-tts' };
  assert.equal(isPodcastAvailable(fullEnv), true);
});

test('normalizeAndValidateAudio accetta MP3/WAV reali e rifiuta PCM grezzo o JSON/HTML', () => {
  const wavHeader = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WAVEfmt '),
  ]);
  assert.equal(normalizeAndValidateAudio(wavHeader, 'audio/wav'), 'audio/wav');
  assert.equal(normalizeAndValidateAudio(wavHeader), 'audio/wav');

  const mp3Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);
  assert.equal(normalizeAndValidateAudio(mp3Header, 'audio/mpeg; charset=binary'), 'audio/mpeg');
  assert.equal(normalizeAndValidateAudio(mp3Header, 'audio/wav'), 'audio/mpeg');

  assert.throws(
    () => normalizeAndValidateAudio(Buffer.from([0x01, 0x02, 0x03]), 'audio/L16;rate=24000'),
    /PCM grezzo/,
  );
  assert.throws(
    () => normalizeAndValidateAudio(Buffer.from('{"error":"not supported"}'), 'application/json'),
    /non audio/,
  );
  assert.throws(
    () => normalizeAndValidateAudio(Buffer.from([0x01, 0x02, 0x03, 0x04]), 'audio/wav'),
    /non corrispondono a un contenitore WAV/,
  );
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
