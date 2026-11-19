import type {
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
