import type {
  SearchParams,
  Story,
  StoryType,
  WebPreviewInfo,
} from '../types/tmw';

export async function fetchTmwFeed(
  type: StoryType,
  start = 0,
): Promise<{ stories: Story[]; nextStart: number | null }> {
  const res = await fetch(`/api/tmw/feed?category=${encodeURIComponent(type)}&start=${start}`);
  if (!res.ok) throw new Error('Failed to load TuttoMercatoWeb feed');
  return (await res.json()) as { stories: Story[]; nextStart: number | null };
}

export async function fetchCustomRssFeed(
  url: string,
  label?: string,
): Promise<{ feedTitle?: string; stories: Story[]; nextStart: number | null }> {
  const sp = new URLSearchParams({ url });
  if (label) sp.set('label', label);
  const res = await fetch(`/api/rss/feed?${sp.toString()}`);
  const data = (await res.json()) as { feedTitle?: string; stories?: Story[]; error?: string };
  if (!res.ok) throw new Error(data.error || 'Impossibile caricare il feed RSS');
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
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = (await res.json()) as { article?: Story };
  return data.article ?? null;
}

export async function fetchLinkPreview(url: string): Promise<WebPreviewInfo> {
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return {};
    return (await res.json()) as WebPreviewInfo;
  } catch {
    return {};
  }
}

export async function searchTmw(params: SearchParams): Promise<Story[]> {
  const sp = new URLSearchParams();
  if (params.query.trim()) sp.set('q', params.query.trim());
  if (params.typeTag) sp.set('category', params.typeTag);
  if (params.page > 0) sp.set('start', String(params.page * 90));

  const res = await fetch(`/api/tmw/search?${sp.toString()}`);
  if (!res.ok) throw new Error('Search request failed');
  const data = (await res.json()) as { stories?: Story[] };
  let results = data.stories ?? [];

  if (params.exactMatch && params.query.trim()) {
    const qLower = params.query.trim().toLowerCase();
    results = results.filter((s) => s.title.toLowerCase().includes(qLower));
  }

  if (params.postedBy.trim()) {
    const byLower = params.postedBy.trim().toLowerCase();
    results = results.filter(
      (s) =>
        s.by.toLowerCase().includes(byLower) ||
        (s.category || '').toLowerCase().includes(byLower) ||
        (s.label || '').toLowerCase().includes(byLower),
    );
  }

  if (params.startTime !== null && params.endTime !== null) {
    const startSec = Math.floor(params.startTime / 1000);
    let endSec = Math.floor(params.endTime / 1000);
    if (startSec === endSec) endSec += 86400;
    results = results.filter((s) => s.time >= startSec && s.time <= endSec);
  }

  if (params.sorted) {
    results = [...results].sort((a, b) => b.time - a.time);
  }

  return results;
}
