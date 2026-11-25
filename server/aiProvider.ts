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

const TEXT_TIMEOUT_MS = 90000;
const TTS_TIMEOUT_MS = 65000;
const TTS_CONCURRENCY = 2;
const PCM_WAV_MAX_CHUNK_CHARS = 750;
const MP3_MAX_CHUNK_CHARS = 1500;

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
    return 'Configurazione OpenAI-compatible incompleta: imposta l\'URL provider nelle Impostazioni dell\'app.';
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
      error.statusCode === 402 ||
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
    status === 402 ||
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
    try {
      if (cfg.kind === 'gemini') {
        const ai = getGeminiClient(cfg.geminiApiKey);
        const isGemini4 = cfg.textModel.startsWith('gemini-4-');
        const isGemini3 = cfg.textModel.startsWith('gemini-3');

        const config: Record<string, unknown> = {
          systemInstruction: params.systemInstruction,
          abortSignal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
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
      const isOpenRouter = cfg.baseUrl.toLowerCase().includes('openrouter.ai');
      const preferNoReasoning = Boolean(params.thinkingMinimalForGemini3 && isOpenRouter);

      const runChat = (withJsonFormat: boolean, disableReasoning: boolean) => {
        const body: Record<string, unknown> = {
          model: cfg.textModel,
          messages,
        };
        if (params.maxOutputTokens !== undefined) {
          body.max_tokens = params.maxOutputTokens;
        }
        if (params.temperature !== undefined) {
          body.temperature = params.temperature;
        }
        if (withJsonFormat) {
          body.response_format = { type: 'json_object' };
        }
        if (disableReasoning) {
          body.reasoning = { enabled: false, exclude: true };
        }
        return client.chat.completions.create(
          body as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
          { signal: AbortSignal.timeout(TEXT_TIMEOUT_MS) },
        );
      };

      const executeWithFallback = async (
        withJson: boolean,
        disableReasoning: boolean,
      ): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
        try {
          return await runChat(withJson, disableReasoning);
        } catch (err) {
          const apiErr = err as { status?: number };
          if (apiErr?.status === 400 || apiErr?.status === 422) {
            if (disableReasoning) {
              return executeWithFallback(withJson, false);
            }
            if (withJson) {
              return executeWithFallback(false, false);
            }
          }
          throw err;
        }
      };

      let completion = await executeWithFallback(Boolean(params.jsonSchema), preferNoReasoning);
      let content = completion.choices?.[0]?.message?.content?.trim() || '';

      // Alcuni provider/modelli restituiscono content vuoto con response_format=json_object o reasoning disabilitato
      if (!content && (params.jsonSchema || preferNoReasoning)) {
        completion = await executeWithFallback(false, false);
        content = completion.choices?.[0]?.message?.content?.trim() || '';
      }

      return content;
    } catch (err) {
      if (isTimeoutOrAbortError(err)) {
        throw new AiProviderError(
          504,
          'Il modello testo AI non ha risposto entro 90s. Riprova o scegli un modello testo più rapido.',
          'timeout testo',
        );
      }
      throw err;
    }
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

export function splitTextForTts(text: string, maxChunkChars = PCM_WAV_MAX_CHUNK_CHARS): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkChars) return [cleaned];

  const units: string[] = [];
  for (const para of cleaned.split(/\n+/)) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;
    if (trimmedPara.length <= maxChunkChars) {
      units.push(trimmedPara);
      continue;
    }
    const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      if (trimmedSentence.length <= maxChunkChars) {
        units.push(trimmedSentence);
        continue;
      }
      // Fallback word split for unusually long unbroken sentences
      let current = '';
      for (const word of trimmedSentence.split(/\s+/)) {
        if (!current) {
          current = word;
        } else if (current.length + 1 + word.length <= maxChunkChars) {
          current += ` ${word}`;
        } else {
          units.push(current);
          current = word;
        }
      }
      if (current) units.push(current);
    }
  }

  const chunks: string[] = [];
  let buffer = '';
  for (const unit of units) {
    if (!buffer) {
      buffer = unit;
    } else if (buffer.length + 2 + unit.length <= maxChunkChars) {
      buffer = `${buffer}\n\n${unit}`;
    } else {
      chunks.push(buffer);
      buffer = unit;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export function extractPcmFromWav(
  wavBuffer: Buffer,
): { pcm: Buffer; sampleRate: number; channels: number } | null {
  if (
    wavBuffer.length < 44 ||
    wavBuffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    wavBuffer.subarray(8, 12).toString('ascii') !== 'WAVE'
  ) {
    return null;
  }

  let sampleRate = 24000;
  let channels = 1;
  let pcm: Buffer | null = null;
  let offset = 12;

  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = Math.min(wavBuffer.length, dataStart + chunkSize);

    if (chunkId === 'fmt ' && dataEnd - dataStart >= 16) {
      channels = wavBuffer.readUInt16LE(dataStart + 2) || 1;
      sampleRate = wavBuffer.readUInt32LE(dataStart + 4) || 24000;
    } else if (chunkId === 'data') {
      pcm = wavBuffer.subarray(dataStart, dataEnd);
      break;
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    if (offset + 8 + paddedSize <= offset) break;
    offset = dataStart + paddedSize;
  }

  if (!pcm || pcm.length === 0) return null;
  return { pcm, sampleRate, channels };
}

function stripId3TagsFromMp3(mp3Buffer: Buffer): Buffer {
  let start = 0;
  if (mp3Buffer.length >= 10 && mp3Buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    const tagSize =
      ((mp3Buffer[6] & 0x7f) << 21) |
      ((mp3Buffer[7] & 0x7f) << 14) |
      ((mp3Buffer[8] & 0x7f) << 7) |
      (mp3Buffer[9] & 0x7f);
    if (10 + tagSize < mp3Buffer.length) {
      start = 10 + tagSize;
    }
  }
  let end = mp3Buffer.length;
  if (end - start > 128 && mp3Buffer.subarray(end - 128, end - 125).toString('ascii') === 'TAG') {
    end -= 128;
  }
  return mp3Buffer.subarray(start, end);
}

export function mergeAudioChunks(
  chunks: Array<{ buffer: Buffer; mimeType: string }>,
): { buffer: Buffer; mimeType: string } {
  if (chunks.length === 0) {
    throw new AiProviderError(502, 'Nessun segmento audio ricevuto.', 'validazione audio');
  }
  if (chunks.length === 1) return chunks[0];

  const primaryMime = chunks[0].mimeType;
  if (primaryMime === 'audio/wav') {
    const parsedChunks = chunks.map((chunk) => extractPcmFromWav(chunk.buffer));
    if (parsedChunks.every((item): item is NonNullable<typeof item> => item !== null)) {
      const { sampleRate, channels } = parsedChunks[0];
      const combinedPcm = Buffer.concat(parsedChunks.map((item) => item.pcm));
      return {
        buffer: wrapPcm16ToWav(combinedPcm, sampleRate, channels),
        mimeType: 'audio/wav',
      };
    }
  }

  if (primaryMime === 'audio/mpeg') {
    const stripped = chunks.map((chunk, idx) =>
      idx === 0 ? chunk.buffer : stripId3TagsFromMp3(chunk.buffer),
    );
    return {
      buffer: Buffer.concat(stripped),
      mimeType: 'audio/mpeg',
    };
  }

  return chunks[0];
}

async function synthesizeSingleSpeechChunk(
  text: string,
  cfg: EffectiveAiConfig,
): Promise<{ buffer: Buffer; mimeType: string }> {
  return withSingleRetry('tts', async () => {
    try {
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
                    style:
                      'Speaker radiofonico giornalistico italiano, tono chiaro, professionale e naturale',
                  },
                },
              ],
            },
          ],
          config: {
            abortSignal: AbortSignal.timeout(TTS_TIMEOUT_MS),
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } },
            },
          },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.find(
          (part) => part.inlineData?.data,
        );
        const audioBase64 = audioPart?.inlineData?.data;
        if (!audioBase64) {
          throw new AiProviderError(
            502,
            'Il modello audio non ha restituito tracce vocali.',
            'ricezione audio',
          );
        }

        const rawBuffer = Buffer.from(audioBase64, 'base64');
        return normalizeAndConvertAudio(rawBuffer, audioPart?.inlineData?.mimeType, 'wav');
      }

      const client = getOpenAiClient(cfg.openaiApiKey, cfg.baseUrl);
      type SpeechParams = OpenAI.Audio.Speech.SpeechCreateParams;

      const speechResponse = await client.audio.speech.create(
        {
          model: cfg.audioModel,
          input: text,
          voice: cfg.voice as SpeechParams['voice'],
          response_format: cfg.audioFormat as SpeechParams['response_format'],
        },
        { signal: AbortSignal.timeout(TTS_TIMEOUT_MS) },
      );

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
      return normalizeAndConvertAudio(rawBuffer, contentType, cfg.audioFormat);
    } catch (err) {
      if (isTimeoutOrAbortError(err)) {
        throw new AiProviderError(
          504,
          'Timeout durante la sintesi audio TTS del provider (65s). Riprova o usa un modello TTS più veloce.',
          'timeout audio TTS',
        );
      }
      throw err;
    }
  });
}

export async function synthesizeAiSpeechBuffer(
  text: string,
  overrides?: AiRuntimeOverrides,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const cfg = getRequiredConfig('podcast', process.env, overrides);
  const validationError = validateTtsParameters(cfg.kind, cfg.audioModel, cfg.voice, cfg.audioFormat);
  if (validationError) {
    throw new AiProviderError(400, validationError, 'validazione parametri TTS');
  }

  const fmt = cfg.kind === 'gemini' ? 'wav' : cfg.audioFormat.trim().toLowerCase();
  const canSplit = fmt === 'pcm' || fmt === 'wav' || fmt === 'mp3';
  const maxChunkChars = fmt === 'mp3' ? MP3_MAX_CHUNK_CHARS : PCM_WAV_MAX_CHUNK_CHARS;
  const chunks = canSplit ? splitTextForTts(text, maxChunkChars) : [text.trim()];

  if (chunks.length <= 1) {
    return synthesizeSingleSpeechChunk(chunks[0] || text, cfg);
  }

  const results: Array<{ buffer: Buffer; mimeType: string } | undefined> = new Array(chunks.length);
  let nextIndex = 0;

  const workerCount =
    cfg.kind === 'openai' ? 1 : Math.min(TTS_CONCURRENCY, chunks.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < chunks.length) {
        const currentIdx = nextIndex++;
        results[currentIdx] = await synthesizeSingleSpeechChunk(chunks[currentIdx], cfg);
      }
    }),
  );

  return mergeAudioChunks(results as Array<{ buffer: Buffer; mimeType: string }>);
}

export async function synthesizeAiSpeech(
  text: string,
  overrides?: AiRuntimeOverrides,
): Promise<SynthesizedSpeechResult> {
  const { buffer, mimeType } = await synthesizeAiSpeechBuffer(text, overrides);
  return {
    audioBase64: buffer.toString('base64'),
    mimeType,
  };
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
      message: '[timeout] Il provider AI non ha risposto in tempo. Riprova o scegli un modello più rapido.',
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
      : status === 402
        ? 402
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
    402: 'Credito OpenRouter insufficiente o limite richieste simultanee superato (402). OpenRouter non offre modelli TTS gratuiti: ricarica il credito o scegli un modello più economico come hexgrad/kokoro-82m',
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
