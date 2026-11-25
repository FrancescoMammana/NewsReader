import type {
  AiRuntimeOverrides,
  AiSettingsPayload,
  PodcastSegment,
  Story,
  StoryType,
  WebPreviewInfo,
} from '../types/tmw';

interface FetchJsonOptions extends RequestInit {
  fallbackError?: string;
  timeoutMs?: number;
}

async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { fallbackError, timeoutMs = 15000, signal, ...fetchInit } = options;
  const effectiveSignal =
    signal ??
    (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : undefined);

  let res: Response;
  try {
    res = await fetch(url, { ...fetchInit, signal: effectiveSignal });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' ||
        err.name === 'AbortError' ||
        err.message.toLowerCase().includes('timed out'))
    ) {
      throw new Error(
        `[timeout] Il server non ha risposto entro ${Math.round(timeoutMs / 1000)}s. Riprova tra poco o prova un modello più rapido.`,
      );
    }
    throw err;
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!res.ok || !data) {
    throw new Error(data?.error || fallbackError || `Errore HTTP ${res.status}`);
  }
  return data;
}

export async function fetchTmwFeed(
  type: StoryType,
  start = 0,
): Promise<{ stories: Story[]; nextStart: number | null }> {
  return fetchJson<{ stories: Story[]; nextStart: number | null }>(
    `/api/tmw/feed?category=${encodeURIComponent(type)}&start=${start}&_t=${Date.now()}`,
    {
      fallbackError: 'Failed to load TuttoMercatoWeb feed',
      timeoutMs: 30000,
    },
  );
}

export async function fetchCustomRssFeed(
  url: string,
  label?: string,
): Promise<{ feedTitle?: string; stories: Story[]; nextStart: number | null }> {
  const sp = new URLSearchParams({ url, _t: String(Date.now()) });
  if (label) sp.set('label', label);
  const data = await fetchJson<{ feedTitle?: string; stories?: Story[] }>(
    `/api/rss/feed?${sp.toString()}`,
    {
      fallbackError: 'Impossibile caricare il feed RSS',
      timeoutMs: 30000,
    },
  );
  return {
    feedTitle: data.feedTitle,
    stories: data.stories ?? [],
    nextStart: null,
  };
}

export async function fetchTmwArticle(url: string): Promise<Story | null> {
  if (!url) return null;
  const endpoint = url.startsWith('https://www.tuttomercatoweb.com')
    ? `/api/tmw/article?url=${encodeURIComponent(url)}`
    : `/api/rss/article?url=${encodeURIComponent(url)}`;
  try {
    const data = await fetchJson<{ article?: Story }>(endpoint);
    return data.article ?? null;
  } catch {
    return null;
  }
}

export async function fetchLinkPreview(url: string): Promise<WebPreviewInfo> {
  try {
    return await fetchJson<WebPreviewInfo>(`/api/link-preview?url=${encodeURIComponent(url)}`);
  } catch {
    return {};
  }
}

export interface PodcastArticleInput {
  id: number;
  title: string;
  by?: string;
  category?: string;
  subtitle?: string;
  text?: string;
}

export interface GeneratePodcastResponse {
  episodeTitle: string;
  script: string;
  segments: PodcastSegment[];
  audioBase64: string;
  mimeType: string;
  generatedAt: number;
}

export async function fetchPodcastStatus(): Promise<boolean> {
  const data = await fetchJson<{ available?: boolean }>(`/api/podcast/status?_t=${Date.now()}`, {
    timeoutMs: 6000,
  });
  return Boolean(data.available);
}

export async function fetchAiSettings(): Promise<AiSettingsPayload> {
  return fetchJson<AiSettingsPayload>(`/api/ai/settings?_t=${Date.now()}`, {
    timeoutMs: 8000,
    fallbackError: 'Impossibile caricare le impostazioni AI.',
  });
}

export async function saveAiSettingsApi(patch: AiRuntimeOverrides): Promise<AiSettingsPayload> {
  return fetchJson<AiSettingsPayload>('/api/ai/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    timeoutMs: 8000,
    fallbackError: 'Impossibile salvare le impostazioni AI.',
  });
}

export async function resetAiSettingsApi(): Promise<AiSettingsPayload> {
  return fetchJson<AiSettingsPayload>('/api/ai/settings/reset', {
    method: 'POST',
    timeoutMs: 8000,
    fallbackError: 'Impossibile ripristinare le impostazioni AI predefinite.',
  });
}

export interface GeneratePodcastScriptResponse {
  episodeTitle: string;
  script: string;
  segments: PodcastSegment[];
}

export async function generatePodcastScriptApi(
  feedLabel: string,
  articles: PodcastArticleInput[],
  aiConfig?: AiRuntimeOverrides,
): Promise<GeneratePodcastScriptResponse> {
  const data = await fetchJson<Partial<GeneratePodcastScriptResponse>>('/api/podcast/script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedLabel, articles, aiConfig }),
    timeoutMs: 135000,
    fallbackError: 'Impossibile generare il copione del podcast AI.',
  });
  if (!data.episodeTitle || !data.script) {
    throw new Error('Copione incompleto restituito dal server Podcast AI.');
  }
  return {
    episodeTitle: data.episodeTitle,
    script: data.script,
    segments: Array.isArray(data.segments) ? data.segments : [],
  };
}

export async function generatePodcastAudioApi(
  script: string,
  aiConfig?: AiRuntimeOverrides,
): Promise<{ audioBlob: Blob; mimeType: string }> {
  const timeoutMs = 150000;
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetch('/api/podcast/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, aiConfig }),
      signal,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' ||
        err.name === 'AbortError' ||
        err.message.toLowerCase().includes('timed out'))
    ) {
      throw new Error(
        `[timeout] La sintesi audio non ha risposto entro ${Math.round(timeoutMs / 1000)}s. Riprova tra poco o scegli un modello TTS più rapido.`,
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errPayload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errPayload?.error || `Errore HTTP ${res.status} nella sintesi audio TTS.`);
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0]?.trim() || '';
  if (!contentType.toLowerCase().startsWith('audio/')) {
    throw new Error(`Formato audio non valido restituito dal server (${contentType || 'sconosciuto'}).`);
  }

  const audioBlob = await res.blob();
  if (audioBlob.size === 0) {
    throw new Error('File audio vuoto restituito dal server Podcast AI.');
  }
  return { audioBlob, mimeType: contentType };
}

export async function generatePodcastApi(
  feedLabel: string,
  articles: PodcastArticleInput[],
  aiConfig?: AiRuntimeOverrides,
): Promise<GeneratePodcastResponse> {
  const data = await fetchJson<Partial<GeneratePodcastResponse>>('/api/podcast/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedLabel, articles, aiConfig }),
    timeoutMs: 180000,
    fallbackError: 'Impossibile generare il podcast AI.',
  });
  const mimeType = typeof data.mimeType === 'string' ? data.mimeType.trim() : '';
  if (!data.audioBase64 || !mimeType.toLowerCase().startsWith('audio/') || !data.episodeTitle || !data.script) {
    throw new Error('Risposta incompleta o formato audio non valido dal server Podcast AI.');
  }
  return {
    episodeTitle: data.episodeTitle,
    script: data.script,
    segments: Array.isArray(data.segments) ? data.segments : [],
    audioBase64: data.audioBase64,
    mimeType,
    generatedAt: data.generatedAt ?? Date.now(),
  };
}
