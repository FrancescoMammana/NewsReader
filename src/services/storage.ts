import {
  type AiSettingsState,
  type Comment,
  type ConfiguredFeed,
  type CustomRssFeed,
  DEFAULT_CONFIGURED_FEEDS,
  type Item,
  type Preferences,
  type Story,
  type StoryType,
  type WebPreviewInfo,
} from '../types/tmw';

const KEYS = {
  PREFS: 'tmw_prefs_v1',
  FAV_IDS: 'tmw_fav_ids_v1',
  FAV_ITEMS: 'tmw_fav_items_v1',
  PINNED_STORIES: 'tmw_pinned_stories_v1',
  READ_STORY_IDS: 'tmw_read_story_ids_v1',
  FILTER_KEYWORDS: 'tmw_filter_keywords_v1',
  BLOCKLIST: 'tmw_blocklist_v1',
  LAST_READ_STORY: 'tmw_last_read_story_v1',
  PODCAST_AVAILABLE: 'tmw_podcast_available_v1',
  AI_SETTINGS: 'tmw_ai_settings_v1',
  NOTES: 'tmw_article_notes_v1',
  DRAFTS: 'tmw_drafts_v1',
  PREVIEW_CACHE: 'tmw_preview_cache_v1',
};

export const DEFAULT_PREFERENCES: Preferences = {
  font: 'RobotoSlab',
  fontSize: 'regular',
  tabOrder: DEFAULT_CONFIGURED_FEEDS.map((f) => f.id),
  configuredFeeds: DEFAULT_CONFIGURED_FEEDS,
  storyMarkingMode: 'tap',
  appColorId: 'deepOrange',
  dateFormat: 'timeAgo',
  textScaleFactor: 1,
  themeMode: 'light',
  isComplexStoryTileEnabled: true,
  isFaviconEnabled: true,
  isMetadataEnabled: true,
  isUrlEnabled: true,
  isMarkReadStoriesEnabled: true,
  isAutoScrollEnabled: false,
  isTapAnywhereToCollapseEnabled: true,
  isManualPaginationEnabled: false,
  isEyeCandyEnabled: false,
  isTrueDarkModeEnabled: true,
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

function sanitizeConfiguredFeeds(raw?: unknown): ConfiguredFeed[] {
  if (!Array.isArray(raw)) return DEFAULT_CONFIGURED_FEEDS;
  return raw.filter(
    (f): f is ConfiguredFeed =>
      Boolean(f) &&
      typeof f === 'object' &&
      typeof (f as ConfiguredFeed).id === 'string' &&
      typeof (f as ConfiguredFeed).label === 'string' &&
      ((f as ConfiguredFeed).kind === 'tmw' || (f as ConfiguredFeed).kind === 'rss') &&
      typeof (f as ConfiguredFeed).source === 'string' &&
      typeof (f as ConfiguredFeed).url === 'string',
  );
}

function sanitizeLegacyCustomFeeds(raw?: unknown): ConfiguredFeed[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (f): f is CustomRssFeed =>
        Boolean(f) &&
        typeof f === 'object' &&
        typeof (f as CustomRssFeed).id === 'string' &&
        typeof (f as CustomRssFeed).label === 'string' &&
        typeof (f as CustomRssFeed).url === 'string',
    )
    .map((f) => ({
      id: f.id,
      label: f.label,
      kind: 'rss' as const,
      source: f.url,
      url: f.url,
    }));
}

function sanitizeTabOrder(order?: unknown, feeds: ConfiguredFeed[] = []): StoryType[] {
  const allowed = new Set<string>(feeds.map((f) => f.id));
  if (!Array.isArray(order)) {
    return feeds.map((f) => f.id);
  }
  const seen = new Set<string>();
  const valid: StoryType[] = [];
  for (const t of order) {
    if (typeof t === 'string' && allowed.has(t) && !seen.has(t)) {
      seen.add(t);
      valid.push(t);
    }
  }
  for (const f of feeds) {
    if (!seen.has(f.id)) valid.push(f.id);
  }
  return valid;
}

export const storage = {
  getPreferences(): Preferences {
    const saved = readJson<
      Partial<Preferences> & {
        customFeeds?: unknown;
        fetchMode?: unknown;
        commentsOrder?: unknown;
        isNotificationEnabled?: unknown;
        isDevModeEnabled?: unknown;
      }
    >(KEYS.PREFS, {});
    const configuredFeeds = Array.isArray(saved.configuredFeeds)
      ? sanitizeConfiguredFeeds(saved.configuredFeeds)
      : [...DEFAULT_CONFIGURED_FEEDS, ...sanitizeLegacyCustomFeeds(saved.customFeeds)];

    const hasLegacyKeys =
      'fetchMode' in saved ||
      'commentsOrder' in saved ||
      'isNotificationEnabled' in saved ||
      'isDevModeEnabled' in saved ||
      'customFeeds' in saved;

    const rest = { ...saved };
    delete rest.fetchMode;
    delete rest.commentsOrder;
    delete rest.isNotificationEnabled;
    delete rest.isDevModeEnabled;
    delete rest.customFeeds;

    const normalized: Preferences = {
      ...DEFAULT_PREFERENCES,
      ...rest,
      configuredFeeds,
      tabOrder: sanitizeTabOrder(saved.tabOrder, configuredFeeds),
    };

    if (hasLegacyKeys) {
      writeJson(KEYS.PREFS, normalized);
    }

    return normalized;
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

  getPodcastAvailable(): boolean | null {
    return readJson<boolean | null>(KEYS.PODCAST_AVAILABLE, null);
  },
  savePodcastAvailable(available: boolean): void {
    writeJson(KEYS.PODCAST_AVAILABLE, available);
  },

  getAiSettings(): AiSettingsState | null {
    return readJson<AiSettingsState | null>(KEYS.AI_SETTINGS, null);
  },
  saveAiSettings(settings: AiSettingsState | null): void {
    if (!settings) {
      localStorage.removeItem(KEYS.AI_SETTINGS);
    } else {
      writeJson(KEYS.AI_SETTINGS, settings);
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

  getPreviewCache(): Record<string, WebPreviewInfo> {
    return readJson<Record<string, WebPreviewInfo>>(KEYS.PREVIEW_CACHE, {});
  },
  savePreviewCache(map: Record<string, WebPreviewInfo>): void {
    const entries = Object.entries(map).slice(-200);
    writeJson(KEYS.PREVIEW_CACHE, Object.fromEntries(entries));
  },

  clearPreviews(): void {
    localStorage.removeItem(KEYS.PREVIEW_CACHE);
  },
};
