import {
  ALL_STORY_TYPES,
  type Comment,
  type Item,
  type Preferences,
  type Story,
  type StoryType,
  type WebPreviewInfo,
} from '../types/hn';

const KEYS = {
  PREFS: 'tmw_prefs_v1',
  FAV_IDS: 'tmw_fav_ids_v1',
  FAV_ITEMS: 'tmw_fav_items_v1',
  PINNED_STORIES: 'tmw_pinned_stories_v1',
  READ_STORY_IDS: 'tmw_read_story_ids_v1',
  FILTER_KEYWORDS: 'tmw_filter_keywords_v1',
  BLOCKLIST: 'tmw_blocklist_v1',
  LAST_READ_STORY: 'tmw_last_read_story_v1',
  NOTES: 'tmw_article_notes_v1',
  DRAFTS: 'tmw_drafts_v1',
  OFFLINE_STORIES: 'tmw_offline_stories_v1',
  OFFLINE_ARTICLES: 'tmw_offline_articles_v1',
  PREVIEW_CACHE: 'tmw_preview_cache_v1',
};

export const DEFAULT_PREFERENCES: Preferences = {
  fetchMode: 'eager',
  commentsOrder: 'natural',
  font: 'RobotoSlab',
  fontSize: 'regular',
  tabOrder: ['latest', 'serieA', 'estero', 'serieB', 'editoriale'],
  storyMarkingMode: 'tap',
  appColorId: 'deepOrange',
  dateFormat: 'timeAgo',
  textScaleFactor: 1,
  themeMode: 'system',
  isComplexStoryTileEnabled: true,
  isFaviconEnabled: true,
  isMetadataEnabled: true,
  isUrlEnabled: true,
  isMarkReadStoriesEnabled: true,
  isNotificationEnabled: true,
  isAutoScrollEnabled: false,
  isTapAnywhereToCollapseEnabled: true,
  isManualPaginationEnabled: false,
  isEyeCandyEnabled: false,
  isTrueDarkModeEnabled: false,
  isDevModeEnabled: false,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function sanitizeTabOrder(order?: unknown): StoryType[] {
  if (!Array.isArray(order)) return DEFAULT_PREFERENCES.tabOrder;
  const valid = order.filter((t): t is StoryType => ALL_STORY_TYPES.includes(t as StoryType));
  if (valid.length !== ALL_STORY_TYPES.length) return DEFAULT_PREFERENCES.tabOrder;
  return valid;
}

export const storage = {
  getPreferences(): Preferences {
    const saved = readJson<Partial<Preferences>>(KEYS.PREFS, {});
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
      tabOrder: sanitizeTabOrder(saved.tabOrder),
    };
  },
  savePreferences(prefs: Preferences): void {
    writeJson(KEYS.PREFS, prefs);
  },

  getFavIds(): number[] {
    return readJson<number[]>(KEYS.FAV_IDS, []);
  },
  saveFavIds(ids: number[]): void {
    writeJson(KEYS.FAV_IDS, ids);
  },

  getFavItems(): Item[] {
    return readJson<Item[]>(KEYS.FAV_ITEMS, []);
  },
  saveFavItems(items: Item[]): void {
    writeJson(KEYS.FAV_ITEMS, items.slice(0, 120));
  },

  getPinnedStories(): Story[] {
    return readJson<Story[]>(KEYS.PINNED_STORIES, []);
  },
  savePinnedStories(stories: Story[]): void {
    writeJson(KEYS.PINNED_STORIES, stories);
  },

  getReadStoryIds(): number[] {
    return readJson<number[]>(KEYS.READ_STORY_IDS, []);
  },
  saveReadStoryIds(ids: number[]): void {
    writeJson(KEYS.READ_STORY_IDS, ids.slice(-2000));
  },

  getFilterKeywords(): string[] {
    return readJson<string[]>(KEYS.FILTER_KEYWORDS, []);
  },
  saveFilterKeywords(keywords: string[]): void {
    writeJson(KEYS.FILTER_KEYWORDS, keywords);
  },

  getBlocklist(): string[] {
    return readJson<string[]>(KEYS.BLOCKLIST, []);
  },
  saveBlocklist(users: string[]): void {
    writeJson(KEYS.BLOCKLIST, users);
  },

  getLastReadStory(): Story | null {
    return readJson<Story | null>(KEYS.LAST_READ_STORY, null);
  },
  saveLastReadStory(story: Story | null): void {
    if (!story) {
      localStorage.removeItem(KEYS.LAST_READ_STORY);
    } else {
      writeJson(KEYS.LAST_READ_STORY, story);
    }
  },

  getArticleNotes(articleId: number): Comment[] {
    const all = readJson<Record<string, Comment[]>>(KEYS.NOTES, {});
    return all[String(articleId)] || [];
  },
  saveArticleNotes(articleId: number, notes: Comment[]): void {
    const all = readJson<Record<string, Comment[]>>(KEYS.NOTES, {});
    if (notes.length === 0) {
      delete all[String(articleId)];
    } else {
      all[String(articleId)] = notes;
    }
    writeJson(KEYS.NOTES, all);
  },

  getDraft(itemId: number): string {
    const drafts = readJson<Record<string, string>>(KEYS.DRAFTS, {});
    return drafts[String(itemId)] || '';
  },
  saveDraft(itemId: number, text: string): void {
    const drafts = readJson<Record<string, string>>(KEYS.DRAFTS, {});
    if (!text) {
      delete drafts[String(itemId)];
    } else {
      drafts[String(itemId)] = text;
    }
    writeJson(KEYS.DRAFTS, drafts);
  },

  getOfflineStories(): Record<string, Story[]> {
    return readJson<Record<string, Story[]>>(KEYS.OFFLINE_STORIES, {});
  },
  saveOfflineStories(map: Record<string, Story[]>): void {
    writeJson(KEYS.OFFLINE_STORIES, map);
  },

  getOfflineArticles(): Record<string, Story> {
    return readJson<Record<string, Story>>(KEYS.OFFLINE_ARTICLES, {});
  },
  saveOfflineArticles(map: Record<string, Story>): void {
    const entries = Object.entries(map).slice(-120);
    writeJson(KEYS.OFFLINE_ARTICLES, Object.fromEntries(entries));
  },

  getPreviewCache(): Record<string, WebPreviewInfo> {
    return readJson<Record<string, WebPreviewInfo>>(KEYS.PREVIEW_CACHE, {});
  },
  savePreviewCache(map: Record<string, WebPreviewInfo>): void {
    const entries = Object.entries(map).slice(-200);
    writeJson(KEYS.PREVIEW_CACHE, Object.fromEntries(entries));
  },

  clearCache(): void {
    localStorage.removeItem(KEYS.OFFLINE_STORIES);
    localStorage.removeItem(KEYS.OFFLINE_ARTICLES);
    localStorage.removeItem(KEYS.PREVIEW_CACHE);
    localStorage.removeItem(KEYS.READ_STORY_IDS);
  },
};
