import fs from 'node:fs';
import path from 'node:path';

export type ActiveProviderKind = 'gemini' | 'openai';
export type GeminiFieldKey = 'textModel' | 'audioModel' | 'voice';
export type OpenAiFieldKey = 'textModel' | 'audioModel' | 'voice' | 'baseUrl' | 'audioFormat';

export interface GeminiProfileSettings {
  textModel: string;
  audioModel: string;
  voice: string;
  customizedFields: GeminiFieldKey[];
}

export interface OpenAiProfileSettings {
  baseUrl: string;
  textModel: string;
  audioModel: string;
  voice: string;
  audioFormat: string;
  customizedFields: OpenAiFieldKey[];
}

export interface StoredAiSettings {
  gemini: GeminiProfileSettings;
  openai: OpenAiProfileSettings;
}

export interface EffectiveAiConfig {
  kind: ActiveProviderKind;
  textModel: string;
  audioModel: string;
  voice: string;
  baseUrl: string;
  audioFormat: string;
  geminiApiKey: string;
  openaiApiKey: string;
}

export interface TtsModelProfile {
  id: string;
  voices: string[];
  formats: string[];
}

export interface AiSettingsPublicPayload {
  providerKind: ActiveProviderKind | null;
  available: boolean;
  textAvailable: boolean;
  defaults: {
    gemini: Omit<GeminiProfileSettings, 'customizedFields'> & { audioFormat: 'wav' };
    openai: Omit<OpenAiProfileSettings, 'customizedFields'>;
  };
  effective: {
    textModel: string;
    audioModel: string;
    voice: string;
    baseUrl?: string;
    audioFormat?: string;
    customizedFields: string[];
  } | null;
  stored: StoredAiSettings;
  catalog: {
    textSuggestions: Record<ActiveProviderKind, string[]>;
    ttsProfiles: TtsModelProfile[];
  };
}

export const GEMINI_DEFAULTS: Omit<GeminiProfileSettings, 'customizedFields'> = {
  textModel: 'gemini-3.1-flash-lite',
  audioModel: 'gemini-3.8-flash-lite-tts',
  voice: 'Kore',
};

export const OPENAI_DEFAULTS: Omit<OpenAiProfileSettings, 'customizedFields'> = {
  baseUrl: 'https://openrouter.ai/api/v1',
  textModel: 'mistralai/mistral-nemo',
  audioModel: 'hexgrad/kokoro-82m',
  voice: 'if_sara',
  audioFormat: 'mp3',
};

export const GEMINI_VOICES = [
  'Kore',
  'Zephyr',
  'Puck',
  'Charon',
  'Fenrir',
  'Leda',
  'Aoede',
  'Orus',
  'Callirrhoe',
  'Autonoe',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Despina',
  'Erinome',
  'Algenib',
  'Rasalgethi',
  'Laomedeia',
  'Achernar',
  'Alnilam',
  'Schedar',
  'Gacrux',
  'Pulcherrima',
  'Achird',
  'Zubenelgenubi',
  'Vindemiatrix',
  'Sadachbia',
  'Sadaltager',
  'Sulafat',
];

export const KNOWN_TTS_PROFILES: TtsModelProfile[] = [
  {
    id: 'gemini-3.8-flash-lite-tts',
    voices: GEMINI_VOICES,
    formats: ['wav'],
  },
  {
    id: 'gemini-3.8-flash-tts',
    voices: GEMINI_VOICES,
    formats: ['wav'],
  },
  {
    id: 'google/gemini-3.8-flash-lite-tts',
    voices: GEMINI_VOICES,
    formats: ['wav', 'pcm'],
  },
  {
    id: 'google/gemini-3.8-flash-tts',
    voices: GEMINI_VOICES,
    formats: ['wav', 'pcm'],
  },
  {
    id: 'google/gemini-2.5-flash-tts',
    voices: GEMINI_VOICES,
    formats: ['wav', 'pcm'],
  },
  {
    id: 'google/gemini-2.5-pro-tts',
    voices: GEMINI_VOICES,
    formats: ['wav', 'pcm'],
  },
  {
    id: 'google/gemini-3.1-flash-tts-preview',
    voices: GEMINI_VOICES,
    formats: ['wav', 'pcm'],
  },
  {
    id: 'hexgrad/kokoro-82m',
    voices: [
      'if_sara',
      'im_nicola',
      'af_alloy',
      'af_bella',
      'af_heart',
      'af_kore',
      'af_nicole',
      'af_nova',
      'af_sarah',
      'af_sky',
      'am_adam',
      'am_michael',
      'bf_emma',
      'bm_george',
    ],
    formats: ['mp3', 'pcm'],
  },
  {
    id: 'qwen/qwen3-tts-1.7b',
    voices: ['serena', 'vivian', 'ryan', 'aiden', 'dylan', 'eric', 'uncle_fu', 'ono_anna', 'sohee'],
    formats: ['mp3', 'pcm'],
  },
  {
    id: 'openai/gpt-4o-mini-tts',
    voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'],
    formats: ['mp3', 'wav', 'pcm', 'aac', 'opus'],
  },
  {
    id: 'gpt-4o-mini-tts',
    voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'],
    formats: ['mp3', 'wav', 'pcm', 'aac', 'opus'],
  },
  {
    id: 'tts-1',
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    formats: ['mp3', 'wav', 'pcm', 'aac', 'opus'],
  },
  {
    id: 'tts-1-hd',
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    formats: ['mp3', 'wav', 'pcm', 'aac', 'opus'],
  },
];

export const TEXT_MODEL_SUGGESTIONS: Record<ActiveProviderKind, string[]> = {
  gemini: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
  openai: [
    'mistralai/mistral-nemo',
    'openai/gpt-oss-20b',
    'google/gemini-2.5-flash-lite',
    'openai/gpt-4o-mini',
    'gpt-4o-mini',
  ],
};

let dynamicOpenRouterProfiles: TtsModelProfile[] | null = null;
let dynamicOpenRouterFetchedAt = 0;

export async function refreshOpenRouterSpeechCatalog(): Promise<TtsModelProfile[]> {
  const now = Date.now();
  if (dynamicOpenRouterProfiles && now - dynamicOpenRouterFetchedAt < 3600_000) {
    return dynamicOpenRouterProfiles;
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/audio/speech/models', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return KNOWN_TTS_PROFILES;
    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        output_modalities?: Array<{
          type?: string;
          supported_parameters?: {
            voice?: { values?: unknown };
            response_format?: { values?: unknown };
          };
        }>;
      }>;
    };
    const merged = new Map<string, TtsModelProfile>(
      KNOWN_TTS_PROFILES.map((profile) => [profile.id, profile]),
    );
    for (const item of json.data || []) {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) continue;
      const speechMod = item.output_modalities?.find((m) => m.type === 'speech');
      const rawVoices = speechMod?.supported_parameters?.voice?.values;
      const rawFormats = speechMod?.supported_parameters?.response_format?.values;
      const voices = Array.isArray(rawVoices)
        ? rawVoices.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : [];
      const formats = Array.isArray(rawFormats)
        ? rawFormats.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        : [];
      if (voices.length > 0 || formats.length > 0) {
        const existing = merged.get(id);
        merged.set(id, {
          id,
          voices: voices.length > 0 ? voices : (existing?.voices ?? []),
          formats: formats.length > 0 ? formats : (existing?.formats ?? ['mp3', 'wav', 'pcm']),
        });
      }
    }
    dynamicOpenRouterProfiles = Array.from(merged.values());
    dynamicOpenRouterFetchedAt = now;
    return dynamicOpenRouterProfiles;
  } catch {
    return dynamicOpenRouterProfiles ?? KNOWN_TTS_PROFILES;
  }
}

export function findTtsModelProfile(audioModel: string): TtsModelProfile | null {
  const normalized = audioModel.trim().toLowerCase();
  if (!normalized) return null;
  const catalog = dynamicOpenRouterProfiles ?? KNOWN_TTS_PROFILES;
  const exact = catalog.find((p) => p.id.toLowerCase() === normalized);
  if (exact) return exact;
  if (normalized.startsWith('google/gemini-') && normalized.includes('tts')) {
    return { id: audioModel, voices: GEMINI_VOICES, formats: ['wav', 'pcm'] };
  }
  if (normalized.startsWith('gemini-') && normalized.includes('tts')) {
    return { id: audioModel, voices: GEMINI_VOICES, formats: ['wav'] };
  }
  return null;
}

export function validateTtsParameters(
  kind: ActiveProviderKind,
  audioModel: string,
  voice: string,
  audioFormat: string,
): string | null {
  if (!voice.trim()) {
    return 'Voce TTS mancante nelle impostazioni AI.';
  }
  const profile = findTtsModelProfile(audioModel);
  if (!profile) {
    if (kind === 'openai' && !audioFormat.trim()) {
      return 'Formato audio mancante nelle impostazioni AI.';
    }
    return null;
  }
  if (profile.voices.length > 0 && !profile.voices.includes(voice)) {
    return `La voce "${voice}" non è supportata dal modello "${audioModel}". Voci valide: ${profile.voices.slice(0, 8).join(', ')}.`;
  }
  if (kind === 'openai') {
    const fmt = audioFormat.trim().toLowerCase();
    if (!profile.formats.includes(fmt)) {
      return `Il formato "${audioFormat}" non è supportato dal modello "${audioModel}". Formati consentiti: ${profile.formats.join(', ')}.`;
    }
  }
  return null;
}

export function createDefaultStoredAiSettings(): StoredAiSettings {
  return {
    gemini: { ...GEMINI_DEFAULTS, customizedFields: [] },
    openai: { ...OPENAI_DEFAULTS, customizedFields: [] },
  };
}

function resolveSettingsPath(): string {
  const customPath = process.env.AI_SETTINGS_PATH?.trim();
  if (customPath) return path.resolve(customPath);
  return path.resolve(process.cwd(), 'data', 'ai-settings.json');
}

function sanitizeFields<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  const allowedSet = new Set<string>(allowed);
  const out: T[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && allowedSet.has(entry) && !out.includes(entry as T)) {
      out.push(entry as T);
    }
  }
  return out;
}

export function sanitizeStoredAiSettings(raw: unknown): StoredAiSettings {
  const defaults = createDefaultStoredAiSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as { gemini?: Record<string, unknown>; openai?: Record<string, unknown> };

  const gem = obj.gemini || {};
  const oa = obj.openai || {};

  const geminiCustomized = sanitizeFields<GeminiFieldKey>(gem.customizedFields, [
    'textModel',
    'audioModel',
    'voice',
  ]);
  const openaiCustomized = sanitizeFields<OpenAiFieldKey>(oa.customizedFields, [
    'textModel',
    'audioModel',
    'voice',
    'baseUrl',
    'audioFormat',
  ]);

  return {
    gemini: {
      textModel:
        geminiCustomized.includes('textModel') && typeof gem.textModel === 'string' && gem.textModel.trim()
          ? gem.textModel.trim()
          : defaults.gemini.textModel,
      audioModel:
        geminiCustomized.includes('audioModel') && typeof gem.audioModel === 'string' && gem.audioModel.trim()
          ? gem.audioModel.trim()
          : defaults.gemini.audioModel,
      voice:
        geminiCustomized.includes('voice') && typeof gem.voice === 'string' && gem.voice.trim()
          ? gem.voice.trim()
          : defaults.gemini.voice,
      customizedFields: geminiCustomized,
    },
    openai: {
      baseUrl:
        openaiCustomized.includes('baseUrl') && typeof oa.baseUrl === 'string' && oa.baseUrl.trim()
          ? oa.baseUrl.trim()
          : defaults.openai.baseUrl,
      textModel:
        openaiCustomized.includes('textModel') && typeof oa.textModel === 'string' && oa.textModel.trim()
          ? oa.textModel.trim()
          : defaults.openai.textModel,
      audioModel:
        openaiCustomized.includes('audioModel') && typeof oa.audioModel === 'string' && oa.audioModel.trim()
          ? oa.audioModel.trim()
          : defaults.openai.audioModel,
      voice:
        openaiCustomized.includes('voice') && typeof oa.voice === 'string' && oa.voice.trim()
          ? oa.voice.trim()
          : defaults.openai.voice,
      audioFormat:
        openaiCustomized.includes('audioFormat') && typeof oa.audioFormat === 'string' && oa.audioFormat.trim()
          ? oa.audioFormat.trim().toLowerCase()
          : defaults.openai.audioFormat,
      customizedFields: openaiCustomized,
    },
  };
}

export function readStoredAiSettings(settingsPath: string = resolveSettingsPath()): StoredAiSettings {
  try {
    if (!fs.existsSync(settingsPath)) {
      return createDefaultStoredAiSettings();
    }
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return sanitizeStoredAiSettings(JSON.parse(raw));
  } catch {
    return createDefaultStoredAiSettings();
  }
}

export function writeStoredAiSettings(
  settings: StoredAiSettings,
  settingsPath: string = resolveSettingsPath(),
): StoredAiSettings {
  const clean = sanitizeStoredAiSettings(settings);
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(clean, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ai/settings] Impossibile salvare ai-settings.json su disco:', err);
  }
  return clean;
}

export function detectActiveProviderKind(
  env: Record<string, string | undefined> = process.env,
): ActiveProviderKind | null {
  if (env.GEMINI_API_KEY?.trim()) return 'gemini';
  if (env.OPENAI_API_KEY?.trim()) return 'openai';
  return null;
}

export interface AiRuntimeOverrides {
  textModel?: string;
  audioModel?: string;
  voice?: string;
  baseUrl?: string;
  audioFormat?: string;
}

export function resolveEffectiveAiConfig(
  env: Record<string, string | undefined> = process.env,
  stored: StoredAiSettings = readStoredAiSettings(),
  overrides?: AiRuntimeOverrides,
): EffectiveAiConfig | null {
  const kind = detectActiveProviderKind(env);
  if (!kind) return null;

  const envTextModel = env.TEXT_MODEL?.trim() || '';
  const envAudioModel = env.AUDIO_MODEL?.trim() || '';

  if (kind === 'gemini') {
    const profile = stored.gemini;
    const customSet = new Set(profile.customizedFields);
    const textModel =
      overrides?.textModel?.trim() ||
      (customSet.has('textModel') ? profile.textModel : envTextModel || GEMINI_DEFAULTS.textModel);
    const audioModel =
      overrides?.audioModel?.trim() ||
      (customSet.has('audioModel') ? profile.audioModel : envAudioModel || GEMINI_DEFAULTS.audioModel);
    const voice =
      overrides?.voice?.trim() || (customSet.has('voice') ? profile.voice : GEMINI_DEFAULTS.voice);

    return {
      kind: 'gemini',
      textModel,
      audioModel,
      voice,
      baseUrl: '',
      audioFormat: 'wav',
      geminiApiKey: env.GEMINI_API_KEY?.trim() || '',
      openaiApiKey: '',
    };
  }

  const profile = stored.openai;
  const customSet = new Set(profile.customizedFields);
  const envBaseUrl = env.OPENAI_BASE_URL?.trim() || '';

  const baseUrl =
    overrides?.baseUrl?.trim() ||
    (customSet.has('baseUrl') ? profile.baseUrl : envBaseUrl || OPENAI_DEFAULTS.baseUrl);
  const textModel =
    overrides?.textModel?.trim() ||
    (customSet.has('textModel') ? profile.textModel : envTextModel || OPENAI_DEFAULTS.textModel);
  const audioModel =
    overrides?.audioModel?.trim() ||
    (customSet.has('audioModel') ? profile.audioModel : envAudioModel || OPENAI_DEFAULTS.audioModel);
  const voice =
    overrides?.voice?.trim() || (customSet.has('voice') ? profile.voice : OPENAI_DEFAULTS.voice);
  const audioFormat = (
    overrides?.audioFormat?.trim() ||
    (customSet.has('audioFormat') ? profile.audioFormat : OPENAI_DEFAULTS.audioFormat)
  ).toLowerCase();

  return {
    kind: 'openai',
    textModel,
    audioModel,
    voice,
    baseUrl,
    audioFormat,
    geminiApiKey: '',
    openaiApiKey: env.OPENAI_API_KEY?.trim() || '',
  };
}

export function updateStoredSettingsForActiveProvider(
  patch: Partial<{
    textModel: string;
    audioModel: string;
    voice: string;
    baseUrl: string;
    audioFormat: string;
  }>,
  env: Record<string, string | undefined> = process.env,
  settingsPath: string = resolveSettingsPath(),
): StoredAiSettings {
  const current = readStoredAiSettings(settingsPath);
  const kind = detectActiveProviderKind(env);
  if (!kind) return current;

  if (kind === 'gemini') {
    const customSet = new Set(current.gemini.customizedFields);
    const nextGemini = { ...current.gemini };

    if (typeof patch.textModel === 'string' && patch.textModel.trim()) {
      const val = patch.textModel.trim();
      nextGemini.textModel = val;
      if (val !== GEMINI_DEFAULTS.textModel) customSet.add('textModel');
      else customSet.delete('textModel');
    }
    if (typeof patch.audioModel === 'string' && patch.audioModel.trim()) {
      const val = patch.audioModel.trim();
      nextGemini.audioModel = val;
      if (val !== GEMINI_DEFAULTS.audioModel) customSet.add('audioModel');
      else customSet.delete('audioModel');
    }
    if (typeof patch.voice === 'string' && patch.voice.trim()) {
      const val = patch.voice.trim();
      nextGemini.voice = val;
      if (val !== GEMINI_DEFAULTS.voice) customSet.add('voice');
      else customSet.delete('voice');
    }
    nextGemini.customizedFields = Array.from(customSet);
    return writeStoredAiSettings({ ...current, gemini: nextGemini }, settingsPath);
  }

  const customSet = new Set(current.openai.customizedFields);
  const nextOpenAi = { ...current.openai };

  if (typeof patch.baseUrl === 'string' && patch.baseUrl.trim()) {
    const val = patch.baseUrl.trim().replace(/\/+$/, '');
    nextOpenAi.baseUrl = val;
    if (val !== OPENAI_DEFAULTS.baseUrl) customSet.add('baseUrl');
    else customSet.delete('baseUrl');
  }
  if (typeof patch.textModel === 'string' && patch.textModel.trim()) {
    const val = patch.textModel.trim();
    nextOpenAi.textModel = val;
    if (val !== OPENAI_DEFAULTS.textModel) customSet.add('textModel');
    else customSet.delete('textModel');
  }
  if (typeof patch.audioModel === 'string' && patch.audioModel.trim()) {
    const val = patch.audioModel.trim();
    nextOpenAi.audioModel = val;
    if (val !== OPENAI_DEFAULTS.audioModel) customSet.add('audioModel');
    else customSet.delete('audioModel');
  }
  if (typeof patch.voice === 'string' && patch.voice.trim()) {
    const val = patch.voice.trim();
    nextOpenAi.voice = val;
    if (val !== OPENAI_DEFAULTS.voice) customSet.add('voice');
    else customSet.delete('voice');
  }
  if (typeof patch.audioFormat === 'string' && patch.audioFormat.trim()) {
    const val = patch.audioFormat.trim().toLowerCase();
    nextOpenAi.audioFormat = val;
    if (val !== OPENAI_DEFAULTS.audioFormat) customSet.add('audioFormat');
    else customSet.delete('audioFormat');
  }
  nextOpenAi.customizedFields = Array.from(customSet);
  return writeStoredAiSettings({ ...current, openai: nextOpenAi }, settingsPath);
}

export function resetStoredSettingsForActiveProvider(
  env: Record<string, string | undefined> = process.env,
  settingsPath: string = resolveSettingsPath(),
): StoredAiSettings {
  const current = readStoredAiSettings(settingsPath);
  const kind = detectActiveProviderKind(env);
  if (!kind) return current;

  if (kind === 'gemini') {
    return writeStoredAiSettings(
      {
        ...current,
        gemini: { ...GEMINI_DEFAULTS, customizedFields: [] },
      },
      settingsPath,
    );
  }

  return writeStoredAiSettings(
    {
      ...current,
      openai: { ...OPENAI_DEFAULTS, customizedFields: [] },
    },
    settingsPath,
  );
}

export async function getPublicAiSettingsPayload(
  env: Record<string, string | undefined> = process.env,
  settingsPath: string = resolveSettingsPath(),
): Promise<AiSettingsPublicPayload> {
  const stored = readStoredAiSettings(settingsPath);
  const effective = resolveEffectiveAiConfig(env, stored);
  const kind = effective?.kind ?? null;
  const catalog = kind === 'openai' ? await refreshOpenRouterSpeechCatalog() : KNOWN_TTS_PROFILES;

  return {
    providerKind: kind,
    available: Boolean(effective && effective.textModel && effective.audioModel),
    textAvailable: Boolean(effective && effective.textModel),
    defaults: {
      gemini: { ...GEMINI_DEFAULTS, audioFormat: 'wav' },
      openai: { ...OPENAI_DEFAULTS },
    },
    effective: effective
      ? kind === 'gemini'
        ? {
            textModel: effective.textModel,
            audioModel: effective.audioModel,
            voice: effective.voice,
            customizedFields: stored.gemini.customizedFields,
          }
        : {
            textModel: effective.textModel,
            audioModel: effective.audioModel,
            voice: effective.voice,
            baseUrl: effective.baseUrl,
            audioFormat: effective.audioFormat,
            customizedFields: stored.openai.customizedFields,
          }
      : null,
    stored,
    catalog: {
      textSuggestions: TEXT_MODEL_SUGGESTIONS,
      ttsProfiles: catalog,
    },
  };
}
