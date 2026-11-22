import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';
import OpenAI from 'openai';

export type ActiveProviderKind = 'gemini' | 'openai';

export interface AiRuntimeConfig {
  kind: ActiveProviderKind;
  textModel: string;
  audioModel: string;
  geminiApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
}

export class AiProviderError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface GenerateTextParams {
  systemInstruction: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  jsonSchema?: Schema;
  thinkingMinimalForGemini3?: boolean;
}

export interface SynthesizedSpeechResult {
  audioBase64: string;
  mimeType: string;
}

let cachedGeminiKey = '';
let cachedGeminiClient: GoogleGenAI | null = null;

let cachedOpenAiSignature = '';
let cachedOpenAiClient: OpenAI | null = null;

export function resolveAiConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): AiRuntimeConfig | null {
  const geminiApiKey = env.GEMINI_API_KEY?.trim() || '';
  const textModel = env.TEXT_MODEL?.trim() || '';
  const audioModel = env.AUDIO_MODEL?.trim() || '';

  if (geminiApiKey) {
    return {
      kind: 'gemini',
      textModel,
      audioModel,
      geminiApiKey,
      openaiApiKey: '',
      openaiBaseUrl: '',
    };
  }

  const openaiApiKey = env.OPENAI_API_KEY?.trim() || '';
  const openaiBaseUrl = env.OPENAI_BASE_URL?.trim() || '';
  if (openaiApiKey && openaiBaseUrl) {
    return {
      kind: 'openai',
      textModel,
      audioModel,
      geminiApiKey: '',
      openaiApiKey,
      openaiBaseUrl,
    };
  }

  return null;
}

export function isTextAiAvailable(env: Record<string, string | undefined> = process.env): boolean {
  const cfg = resolveAiConfigFromEnv(env);
  return Boolean(cfg && cfg.textModel);
}

export function isPodcastAvailable(env: Record<string, string | undefined> = process.env): boolean {
  const cfg = resolveAiConfigFromEnv(env);
  return Boolean(cfg && cfg.textModel && cfg.audioModel);
}

export function getMissingConfigMessage(
  scope: 'text' | 'podcast',
  env: Record<string, string | undefined> = process.env,
): string {
  const cfg = resolveAiConfigFromEnv(env);
  if (!cfg) {
    const hasPartialOpenAi = Boolean(env.OPENAI_API_KEY?.trim() || env.OPENAI_BASE_URL?.trim());
    if (hasPartialOpenAi) {
      return 'Configurazione OpenAI-compatible incompleta: imposta sia OPENAI_API_KEY sia OPENAI_BASE_URL (oppure imposta GEMINI_API_KEY).';
    }
    return 'Servizio AI non attivo: imposta GEMINI_API_KEY oppure OPENAI_API_KEY e OPENAI_BASE_URL sul server.';
  }
  if (!cfg.textModel) {
    return 'Configurazione AI incompleta: imposta TEXT_MODEL nelle variabili ambiente del server.';
  }
  if (scope === 'podcast' && !cfg.audioModel) {
    return 'Servizio Podcast AI incompleto: imposta AUDIO_MODEL nelle variabili ambiente del server.';
  }
  return 'Configurazione AI non valida.';
}

function getRequiredConfig(
  scope: 'text' | 'podcast',
  env: Record<string, string | undefined> = process.env,
): AiRuntimeConfig {
  const cfg = resolveAiConfigFromEnv(env);
  if (!cfg || !cfg.textModel || (scope === 'podcast' && !cfg.audioModel)) {
    throw new AiProviderError(503, getMissingConfigMessage(scope, env));
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

function isNonRetriableError(error: unknown): boolean {
  if (error instanceof AiProviderError) {
    return error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403;
  }
  const err = error as { status?: number; message?: string };
  const status = typeof err?.status === 'number' ? err.status : 0;
  const message = typeof err?.message === 'string' ? err.message : '';
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED')
  );
}

async function withSingleRetry<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isNonRetriableError(error)) throw error;
    console.warn(`[ai/${stage}] primo tentativo non riuscito, riprovo tra 1s...`);
    await sleep(1000);
    return await fn();
  }
}

export async function generateAiText(params: GenerateTextParams): Promise<string> {
  const cfg = getRequiredConfig('text');

  return withSingleRetry('text', async () => {
    if (cfg.kind === 'gemini') {
      const ai = getGeminiClient(cfg.geminiApiKey);
      const isGemini4 = cfg.textModel.startsWith('gemini-4-');
      const isGemini3 = cfg.textModel.startsWith('gemini-3');

      const config: Record<string, unknown> = {
        systemInstruction: params.systemInstruction,
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

    const client = getOpenAiClient(cfg.openaiApiKey, cfg.openaiBaseUrl);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.systemInstruction },
      { role: 'user', content: params.prompt },
    ];

    const runChat = (withJsonFormat: boolean) =>
      client.chat.completions.create({
        model: cfg.textModel,
        messages,
        ...(params.maxOutputTokens !== undefined ? { max_tokens: params.maxOutputTokens } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(withJsonFormat ? { response_format: { type: 'json_object' } } : {}),
      });

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

const MIME_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
};

export function normalizeAndValidateAudio(buffer: Buffer, rawMimeType?: string): string {
  if (buffer.length === 0) {
    throw new AiProviderError(502, 'Il modello audio ha restituito un file vuoto.');
  }

  const baseMime = (rawMimeType || '').split(';')[0]?.trim().toLowerCase() || '';
  if (
    baseMime === 'audio/l16' ||
    baseMime === 'audio/pcm' ||
    baseMime === 'audio/raw' ||
    /^audio\/l\d+$/.test(baseMime)
  ) {
    throw new AiProviderError(
      502,
      `Il provider TTS ha restituito audio PCM grezzo (${rawMimeType}), non riproducibile direttamente dal browser senza conversione.`,
    );
  }

  if (baseMime.startsWith('text/') || baseMime === 'application/json' || baseMime === 'application/xml') {
    throw new AiProviderError(502, `Il provider TTS ha restituito una risposta non audio (${baseMime}).`);
  }

  const headText = buffer.subarray(0, 64).toString('utf8').trimStart();
  if (headText.startsWith('{') || headText.startsWith('[') || headText.startsWith('<')) {
    throw new AiProviderError(502, 'Il provider TTS ha restituito dati JSON/HTML anziché audio binario.');
  }

  const normalizedDeclared = MIME_ALIASES[baseMime] || baseMime;
  const magicMime = detectMagicAudioMime(buffer);

  if (normalizedDeclared === 'audio/wav' && magicMime !== 'audio/wav') {
    if (magicMime) return magicMime;
    throw new AiProviderError(
      502,
      'Il provider ha dichiarato audio/wav ma i byte ricevuti non corrispondono a un contenitore WAV valido.',
    );
  }

  if (normalizedDeclared.startsWith('audio/')) {
    return normalizedDeclared;
  }

  if (magicMime) {
    return magicMime;
  }

  throw new AiProviderError(
    502,
    `Formato audio restituito dal provider non riconosciuto o non supportato (${rawMimeType || 'sconosciuto'}).`,
  );
}

export async function synthesizeAiSpeech(text: string): Promise<SynthesizedSpeechResult> {
  const cfg = getRequiredConfig('podcast');

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
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
      const audioBase64 = audioPart?.inlineData?.data;
      if (!audioBase64) {
        throw new AiProviderError(502, 'Il modello audio non ha restituito tracce vocali.');
      }

      const buffer = Buffer.from(audioBase64, 'base64');
      const mimeType = normalizeAndValidateAudio(buffer, audioPart?.inlineData?.mimeType);
      return { audioBase64, mimeType };
    }

    const client = getOpenAiClient(cfg.openaiApiKey, cfg.openaiBaseUrl);
    const speechResponse = await client.audio.speech.create({
      model: cfg.audioModel,
      input: text,
      voice: 'alloy',
      response_format: 'mp3',
    });

    if (!speechResponse.ok) {
      const errBody = (await speechResponse.text().catch(() => '')).slice(0, 180).trim();
      throw new AiProviderError(
        speechResponse.status || 502,
        errBody || `Errore dal servizio TTS (${speechResponse.status})`,
      );
    }

    const contentType = speechResponse.headers.get('content-type') || '';
    const buffer = Buffer.from(await speechResponse.arrayBuffer());
    const mimeType = normalizeAndValidateAudio(buffer, contentType);
    return {
      audioBase64: buffer.toString('base64'),
      mimeType,
    };
  });
}

export function toAiHttpError(
  error: unknown,
  scope: 'podcast' | 'qa',
): { status: number; message: string } {
  if (error instanceof AiProviderError) {
    return { status: error.statusCode, message: error.message };
  }

  const cfg = resolveAiConfigFromEnv();
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
      : status === 401 || status === 403 || raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')
        ? 403
        : status === 503 || raw.includes('UNAVAILABLE') || raw.includes('high demand')
          ? 503
          : status === 400
            ? 400
            : 502;

  const authMsg = isGemini
    ? 'Chiave GEMINI_API_KEY non valida o bloccata per chiamate da server esterno (403).'
    : 'Credenziali OpenAI-compatible non valide o accesso negato dal provider (403).';

  const messages: Record<number, string> = {
    400: 'Richiesta AI non valida (400). Controlla il modello configurato e i dati inviati.',
    403: authMsg,
    429: 'Quota AI temporaneamente esaurita (429): attendi 1 minuto e riprova.',
    502:
      scope === 'podcast'
        ? 'Errore nella generazione del podcast AI.'
        : 'Errore durante la generazione della risposta AI.',
    503: 'Servizio AI momentaneamente non disponibile o sovraccarico (503). Riprova tra poco.',
  };

  const extra = detail && code !== 403 ? `: ${detail}` : '';
  return { status: code, message: `${messages[code]}${extra}` };
}
