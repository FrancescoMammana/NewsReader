import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';
import OpenAI from 'openai';
import {
  type ActiveProviderKind,
  type AiRuntimeOverrides,
  type EffectiveAiConfig,
  resolveEffectiveAiConfig,
  validateTtsParameters,
} from './aiSettings.ts';

export type { ActiveProviderKind, AiRuntimeOverrides, EffectiveAiConfig };

export class AiProviderError extends Error {
  readonly statusCode: number;
  readonly phase: string;

  constructor(statusCode: number, message: string, phase = 'richiesta') {
    super(message);
    this.statusCode = statusCode;
    this.phase = phase;
  }
}

export interface GenerateTextParams {
  systemInstruction: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  jsonSchema?: Schema;
  thinkingMinimalForGemini3?: boolean;
  overrides?: AiRuntimeOverrides;
}

export interface SynthesizedSpeechResult {
  audioBase64: string;
  mimeType: string;
}

const UPSTREAM_TIMEOUT_MS = 75000;

let cachedGeminiKey = '';
let cachedGeminiClient: GoogleGenAI | null = null;

let cachedOpenAiSignature = '';
let cachedOpenAiClient: OpenAI | null = null;

export function resolveAiConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  overrides?: AiRuntimeOverrides,
): EffectiveAiConfig | null {
  return resolveEffectiveAiConfig(env, undefined, overrides);
}

export function isTextAiAvailable(
  env: Record<string, string | undefined> = process.env,
  overrides?: AiRuntimeOverrides,
): boolean {
  const cfg = resolveEffectiveAiConfig(env, undefined, overrides);
  return Boolean(cfg && cfg.textModel);
}

export function isPodcastAvailable(
  env: Record<string, string | undefined> = process.env,
  overrides?: AiRuntimeOverrides,
): boolean {
  const cfg = resolveEffectiveAiConfig(env, undefined, overrides);
  return Boolean(cfg && cfg.textModel && cfg.audioModel);
}

export function getMissingConfigMessage(
  scope: 'text' | 'podcast',
  env: Record<string, string | undefined> = process.env,
): string {
  const cfg = resolveEffectiveAiConfig(env);
  if (!cfg) {
    return 'Servizio AI non attivo: imposta GEMINI_API_KEY oppure OPENAI_API_KEY nelle variabili ambiente del server.';
  }
  if (!cfg.textModel) {
    return 'Configurazione AI incompleta: imposta il modello testo nelle Impostazioni o via TEXT_MODEL.';
  }
  if (scope === 'podcast' && !cfg.audioModel) {
    return 'Servizio Podcast AI incompleto: imposta il modello audio nelle Impostazioni o via AUDIO_MODEL.';
  }
  if (cfg.kind === 'openai' && !cfg.baseUrl) {
    return 'Configurazione OpenAI-compatible incompleta: imposta l\'URL provider nelle Impostazioni o via OPENAI_BASE_URL.';
  }
  return 'Configurazione AI non valida.';
}

function getRequiredConfig(
  scope: 'text' | 'podcast',
  env: Record<string, string | undefined> = process.env,
  overrides?: AiRuntimeOverrides,
): EffectiveAiConfig {
  const cfg = resolveEffectiveAiConfig(env, undefined, overrides);
  if (
    !cfg ||
    !cfg.textModel ||
    (scope === 'podcast' && !cfg.audioModel) ||
    (cfg.kind === 'openai' && !cfg.baseUrl)
  ) {
    throw new AiProviderError(503, getMissingConfigMessage(scope, env), 'configurazione');
  }
  return cfg;
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (cachedGeminiClient && cachedGeminiKey === apiKey) {
    return cachedGeminiClient;
  }
  cachedGeminiKey = apiKey;
  cachedGeminiClient = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  return cachedGeminiClient;
}

function getOpenAiClient(apiKey: string, baseURL: string): OpenAI {
  const signature = `${apiKey}\n${baseURL}`;
  if (cachedOpenAiClient && cachedOpenAiSignature === signature) {
    return cachedOpenAiClient;
  }
  cachedOpenAiSignature = signature;
  cachedOpenAiClient = new OpenAI({ apiKey, baseURL });
  return cachedOpenAiClient;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isTimeoutOrAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; code?: string; status?: number; message?: string };
  const name = (err.name || '').toLowerCase();
  const msg = (err.message || '').toLowerCase();
  return (
    name === 'aborterror' ||
    name === 'timeouterror' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ABORT_ERR' ||
    err.status === 408 ||
    err.status === 504 ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  );
}

export function isNonRetriableError(error: unknown): boolean {
  if (isTimeoutOrAbortError(error)) return true;
  if (error instanceof AiProviderError) {
    return (
      error.statusCode === 400 ||
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      error.statusCode === 404 ||
      error.statusCode === 408 ||
      error.statusCode === 422 ||
      error.statusCode === 504
    );
  }
  const err = error as { status?: number; message?: string };
  const status = typeof err?.status === 'number' ? err.status : 0;
  const message = typeof err?.message === 'string' ? err.message : '';
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 408 ||
    status === 422 ||
    status === 504 ||
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED')
  );
}

async function withSingleRetry<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isNonRetriableError(error)) throw error;
    console.warn(`[ai/${stage}] tentativo transitorio non riuscito, riprovo una volta tra 1s...`);
    await sleep(1000);
    return await fn();
  }
}

export async function generateAiText(params: GenerateTextParams): Promise<string> {
  const cfg = getRequiredConfig('text', process.env, params.overrides);

  return withSingleRetry('text', async () => {
    if (cfg.kind === 'gemini') {
      const ai = getGeminiClient(cfg.geminiApiKey);
      const isGemini4 = cfg.textModel.startsWith('gemini-4-');
      const isGemini3 = cfg.textModel.startsWith('gemini-3');

      const config: Record<string, unknown> = {
        systemInstruction: params.systemInstruction,
        abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      };
      if (params.maxOutputTokens !== undefined) {
        config.maxOutputTokens = params.maxOutputTokens;
      }
      if (params.temperature !== undefined && !isGemini4) {
        config.temperature = params.temperature;
      }
      if (params.thinkingMinimalForGemini3 && isGemini3) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }
      if (params.jsonSchema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = params.jsonSchema;
      }

      const response = await ai.models.generateContent({
        model: cfg.textModel,
        contents: params.prompt,
        config,
      });
      return response.text?.trim() || '';
    }

    const client = getOpenAiClient(cfg.openaiApiKey, cfg.baseUrl);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.systemInstruction },
      { role: 'user', content: params.prompt },
    ];

    const runChat = (withJsonFormat: boolean) =>
      client.chat.completions.create(
        {
          model: cfg.textModel,
          messages,
          ...(params.maxOutputTokens !== undefined ? { max_tokens: params.maxOutputTokens } : {}),
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(withJsonFormat ? { response_format: { type: 'json_object' } } : {}),
        },
        { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
      );

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    if (params.jsonSchema) {
      try {
        completion = await runChat(true);
      } catch (err) {
        const apiErr = err as { status?: number; message?: string };
        const msg = (apiErr?.message || '').toLowerCase();
        if (
          apiErr?.status === 400 &&
          (msg.includes('response_format') || msg.includes('json_object') || msg.includes('json mode'))
        ) {
          completion = await runChat(false);
        } else {
          throw err;
        }
      }
    } else {
      completion = await runChat(false);
    }

    return completion.choices?.[0]?.message?.content?.trim() || '';
  });
}

function detectMagicAudioMime(buffer: Buffer): string {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return 'audio/ogg';
  }
  if (buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'audio/mp4';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'audio/webm';
  }
  if (
    (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return 'audio/mpeg';
  }
  return '';
}

function parsePcmMimeMetadata(rawMimeType?: string): { sampleRate: number; channels: number } {
  let sampleRate = 24000;
  let channels = 1;
  if (!rawMimeType) return { sampleRate, channels };
  const rateMatch = rawMimeType.match(/(?:rate|samplerate)\s*=\s*(\d{4,6})/i);
  if (rateMatch) {
    const parsed = Number(rateMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 8000 && parsed <= 192000) {
      sampleRate = parsed;
    }
  }
  const chMatch = rawMimeType.match(/channels\s*=\s*(\d)/i);
  if (chMatch) {
    const parsedCh = Number(chMatch[1]);
    if (parsedCh === 1 || parsedCh === 2) {
      channels = parsedCh;
    }
  }
  return { sampleRate, channels };
}

export function wrapPcm16ToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const bitsPerSample = 16;
  const alignedLen = pcmBuffer.length - (pcmBuffer.length % 2);
  const pcmSlice = alignedLen === pcmBuffer.length ? pcmBuffer : pcmBuffer.subarray(0, alignedLen);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcmSlice.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcmSlice.length, 40);

  return Buffer.concat([header, pcmSlice]);
}

const MIME_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
};

export function normalizeAndConvertAudio(
  buffer: Buffer,
  rawMimeType?: string,
  requestedFormat?: string,
): { buffer: Buffer; mimeType: string } {
  if (buffer.length === 0) {
    throw new AiProviderError(502, 'Il modello audio ha restituito un file vuoto.', 'validazione audio');
  }

  const baseMime = (rawMimeType || '').split(';')[0]?.trim().toLowerCase() || '';
  if (baseMime.startsWith('text/') || baseMime === 'application/json' || baseMime === 'application/xml') {
    throw new AiProviderError(
      502,
      `Il provider TTS ha restituito una risposta non audio (${baseMime}).`,
      'validazione audio',
    );
  }

  const headText = buffer.subarray(0, 64).toString('utf8').trimStart();
  if (headText.startsWith('{') || headText.startsWith('[') || headText.startsWith('<')) {
    throw new AiProviderError(
      502,
      'Il provider TTS ha restituito dati JSON/HTML anziché audio binario.',
      'validazione audio',
    );
  }

  const isDeclaredPcm =
    baseMime === 'audio/l16' ||
    baseMime === 'audio/pcm' ||
    baseMime === 'audio/raw' ||
    /^audio\/l\d+$/.test(baseMime);

  const magicMime = detectMagicAudioMime(buffer);
  const reqFmt = (requestedFormat || '').trim().toLowerCase();

  if (isDeclaredPcm || (reqFmt === 'pcm' && !magicMime)) {
    if (buffer.length < 2) {
      throw new AiProviderError(502, 'Flusso PCM audio incompleto o troppo corto.', 'conversione WAV');
    }
    const { sampleRate, channels } = parsePcmMimeMetadata(rawMimeType);
    return {
      buffer: wrapPcm16ToWav(buffer, sampleRate, channels),
      mimeType: 'audio/wav',
    };
  }

  const normalizedDeclared = MIME_ALIASES[baseMime] || baseMime;

  if (normalizedDeclared === 'audio/wav' && magicMime !== 'audio/wav') {
    if (magicMime) return { buffer, mimeType: magicMime };
    throw new AiProviderError(
      502,
      'Il provider ha dichiarato audio/wav ma i byte ricevuti non corrispondono a un contenitore WAV valido.',
      'validazione audio',
    );
  }

  if (normalizedDeclared.startsWith('audio/')) {
    return { buffer, mimeType: normalizedDeclared };
  }

  if (magicMime) {
    return { buffer, mimeType: magicMime };
  }

  throw new AiProviderError(
    502,
    `Formato audio restituito dal provider non riconosciuto o non supportato (${rawMimeType || 'sconosciuto'}).`,
    'validazione audio',
  );
}

export function normalizeAndValidateAudio(buffer: Buffer, rawMimeType?: string): string {
  return normalizeAndConvertAudio(buffer, rawMimeType).mimeType;
}

export async function synthesizeAiSpeech(
  text: string,
  overrides?: AiRuntimeOverrides,
): Promise<SynthesizedSpeechResult> {
  const cfg = getRequiredConfig('podcast', process.env, overrides);
  const validationError = validateTtsParameters(cfg.kind, cfg.audioModel, cfg.voice, cfg.audioFormat);
  if (validationError) {
    throw new AiProviderError(400, validationError, 'validazione parametri TTS');
  }

  return withSingleRetry('tts', async () => {
    if (cfg.kind === 'gemini') {
      const ai = getGeminiClient(cfg.geminiApiKey);
      const response = await ai.models.generateContent({
        model: cfg.audioModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: 'Speaker radiofonico giornalistico italiano, tono chiaro, professionale e naturale',
                },
              },
            ],
          },
        ],
        config: {
          abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
      const audioBase64 = audioPart?.inlineData?.data;
      if (!audioBase64) {
        throw new AiProviderError(502, 'Il modello audio non ha restituito tracce vocali.', 'ricezione audio');
      }

      const rawBuffer = Buffer.from(audioBase64, 'base64');
      const normalized = normalizeAndConvertAudio(rawBuffer, audioPart?.inlineData?.mimeType, 'wav');
      return {
        audioBase64: normalized.buffer.toString('base64'),
        mimeType: normalized.mimeType,
      };
    }

    const client = getOpenAiClient(cfg.openaiApiKey, cfg.baseUrl);
    type SpeechParams = OpenAI.Audio.Speech.SpeechCreateParams;

    let speechResponse: Response;
    try {
      speechResponse = await client.audio.speech.create(
        {
          model: cfg.audioModel,
          input: text,
          voice: cfg.voice as SpeechParams['voice'],
          response_format: cfg.audioFormat as SpeechParams['response_format'],
        },
        { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
      );
    } catch (err) {
      if (isTimeoutOrAbortError(err)) {
        throw new AiProviderError(
          504,
          'Timeout durante la chiamata al servizio TTS del provider.',
          'timeout',
        );
      }
      throw err;
    }

    if (!speechResponse.ok) {
      const errBody = (await speechResponse.text().catch(() => '')).slice(0, 180).trim();
      throw new AiProviderError(
        speechResponse.status || 502,
        errBody || `Errore dal servizio TTS (${speechResponse.status})`,
        'risposta HTTP TTS',
      );
    }

    const contentType = speechResponse.headers.get('content-type') || '';
    const rawBuffer = Buffer.from(await speechResponse.arrayBuffer());
    const normalized = normalizeAndConvertAudio(rawBuffer, contentType, cfg.audioFormat);
    return {
      audioBase64: normalized.buffer.toString('base64'),
      mimeType: normalized.mimeType,
    };
  });
}

export function toAiHttpError(
  error: unknown,
  scope: 'podcast' | 'qa',
): { status: number; message: string } {
  if (error instanceof AiProviderError) {
    const prefix = error.phase && error.phase !== 'richiesta' ? `[${error.phase}] ` : '';
    return { status: error.statusCode, message: `${prefix}${error.message}` };
  }

  if (isTimeoutOrAbortError(error)) {
    return {
      status: 504,
      message: '[timeout] Il provider AI non ha risposto entro il tempo massimo (75s). Riprova o scegli un modello più rapido.',
    };
  }

  const cfg = resolveEffectiveAiConfig();
  const isGemini = cfg?.kind !== 'openai';
  const err = error as { status?: number; message?: string; error?: { message?: string } };
  const status = typeof err?.status === 'number' ? err.status : 502;
  const raw =
    typeof err?.error?.message === 'string' && err.error.message
      ? err.error.message
      : typeof err?.message === 'string'
        ? err.message
        : '';

  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    detail = parsed?.error?.message ?? raw;
  } catch {
    // Plain-text error
  }
  detail = detail.slice(0, 180).trim();
  console.error(`[ai/${scope}]`, status, detail || raw);

  const code =
    status === 429 || raw.includes('RESOURCE_EXHAUSTED')
      ? 429
      : status === 401
        ? isGemini
          ? 403
          : 401
        : status === 403 || raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')
          ? 403
          : status === 503 || raw.includes('UNAVAILABLE') || raw.includes('high demand')
            ? 503
            : status === 400 || status === 422
              ? 400
              : 502;

  const messages: Record<number, string> = {
    400: 'Richiesta AI non valida (400). Verifica modello, voce o formato audio configurati',
    401: 'Chiave OPENAI_API_KEY non valida o non autorizzata dal provider (401)',
    403: isGemini
      ? 'Chiave GEMINI_API_KEY non valida o bloccata per chiamate da server esterno (403).'
      : 'Accesso negato dal provider OpenAI-compatible (403)',
    429: 'Quota AI temporaneamente esaurita (429): attendi 1 minuto e riprova',
    502:
      scope === 'podcast'
        ? 'Errore nella generazione del podcast AI'
        : 'Errore durante la generazione della risposta AI',
    503: 'Servizio AI momentaneamente non disponibile o sovraccarico (503). Riprova tra poco',
  };

  const extra = detail && !(isGemini && code === 403) ? `: ${detail}` : '';
  return { status: code, message: `${messages[code]}${extra}` };
}
