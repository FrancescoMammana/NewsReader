import type { DateDisplayFormat, Item, Story } from '../types/tmw';

export function normalizeEpochMs(ts: number): number {
  if (!ts) return 0;
  return ts < 9999999999 ? ts * 1000 : ts;
}

export function toTimeAgoString(ts: number): string {
  const ms = normalizeEpochMs(ts);
  if (!ms) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function formatTimestamp(ts: number, format: DateDisplayFormat): string {
  if (!ts) return '';
  if (format === 'timeAgo') {
    return toTimeAgoString(ts);
  }
  const date = new Date(normalizeEpochMs(ts));
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  switch (format) {
    case 'yMd':
      return `${date.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })} ${timeStr}`;
    case 'yMEd':
      return `${date.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' })} ${timeStr}`;
    case 'yMMMd':
      return `${date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} ${timeStr}`;
    case 'yMMMEd':
      return `${date.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} ${timeStr}`;
  }
}

export function getReadableUrl(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getFaviconUrl(url: string, size = 32): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return '';
  }
}

export function getStoryMetadata(story: Story): string {
  const parts: string[] = [];
  if (story.category) {
    parts.push(story.category);
  }
  if (story.label) {
    parts.push(story.label);
  }
  if (!story.category && story.by) {
    parts.push(story.by);
  }
  const ago = toTimeAgoString(story.time);
  if (ago) {
    parts.push(ago);
  }
  return parts.join(' · ');
}

export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (textarea) {
    textarea.innerHTML = input;
    return textarea.value;
  }
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/');
}

export function extractTmwItemId(url: string): number | null {
  const match = url.match(/tuttomercatoweb\.com\/.*-(\d{5,9})(?:[/?#]|$)/);
  if (match && match[1]) {
    const id = Number(match[1]);
    return Number.isNaN(id) ? null : id;
  }
  return null;
}

export function shouldHideByKeywords(item: Pick<Item, 'title' | 'text'>, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const hay = `${item.title || ''} ${item.text || ''}`.toLowerCase();
  return keywords.some((kw) => kw && hay.includes(kw.toLowerCase()));
}
