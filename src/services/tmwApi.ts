import type {
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

  const res = await fetch(url, { ...fetchInit, signal: effectiveSignal });
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
    { fallbackError: 'Failed to load TuttoMercatoWeb feed' },
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
    { fallbackError: 'Impossibile caricare il feed RSS' },
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

export async function generatePodcastApi(
  feedLabel: string,
  articles: PodcastArticleInput[],
): Promise<GeneratePodcastResponse> {
  const data = await fetchJson<Partial<GeneratePodcastResponse>>('/api/podcast/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedLabel, articles }),
    timeoutMs: 90000,
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
