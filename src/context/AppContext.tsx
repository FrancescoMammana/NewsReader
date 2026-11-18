import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ACCENT_COLORS,
  type ConfiguredFeed,
  DEFAULT_CONFIGURED_FEEDS,
  type Item,
  type ItemScreenArgs,
  type Preferences,
  type Story,
  type StoryType,
  type ToastMessage,
} from '../types/tmw';
import { fetchCustomRssFeed, fetchTmwArticle, fetchTmwFeed } from '../services/tmwApi';
import { storage } from '../services/storage';
import { shouldHideByKeywords } from '../utils/formatting';

export interface FeedBucket {
  stories: Story[];
  nextStart: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

export const EMPTY_FEED_BUCKET: FeedBucket = {
  stories: [],
  nextStart: 0,
  loading: false,
  loadingMore: false,
  error: null,
};

type FeedMap = Record<string, FeedBucket>;

function createInitialFeeds(tabIds: StoryType[]): FeedMap {
  const map: FeedMap = {};
  for (const t of tabIds) {
    map[t] = { ...EMPTY_FEED_BUCKET };
  }
  return map;
}

interface AppContextValue {
  preferences: Preferences;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  accentHex: string;
  isDarkActive: boolean;

  activeTab: StoryType | 'profile';
  setActiveTab: (tab: StoryType | 'profile') => void;

  // Configured feeds (TMW + RSS/Atom)
  addCustomFeed: (label: string, url: string) => Promise<boolean>;
  removeFeed: (id: string) => void;
  restoreDefaultTmwFeeds: () => void;
  getFeedLabel: (id: StoryType) => string;

  // Stories & Offline
  feeds: FeedMap;
  ensureFeedLoaded: (type: StoryType) => void;
  refreshFeed: (type: StoryType) => Promise<void>;
  loadMoreFeed: (type: StoryType) => Promise<void>;
  readStoryIds: Set<number>;
  markStoryRead: (story: Story) => void;
  clearReadStories: () => void;
  isOfflineReading: boolean;
  toggleOfflineMode: (enabled: boolean) => void;
  offlineProgress: { active: boolean; current: number; total: number };
  downloadForOffline: () => Promise<void>;

  // Pins, Favorites, Keywords, Blocklist
  pinnedStories: Story[];
  isPinned: (id: number) => boolean;
  togglePin: (story: Story) => void;
  unpinStory: (id: number) => void;

  favIds: number[];
  favItems: Item[];
  isFav: (id: number) => boolean;
  toggleFav: (item: Item) => void;
  removeFav: (id: number) => void;
  clearFavs: () => void;
  importFavIds: (ids: number[]) => void;

  filterKeywords: string[];
  addFilterKeyword: (kw: string) => void;
  removeFilterKeyword: (kw: string) => void;

  blocklist: string[];
  isBlocked: (author: string) => boolean;
  toggleBlockUser: (author: string) => void;

  // Navigation / Split View / Modals
  selectedItemArgs: ItemScreenArgs | null;
  itemHistoryStack: ItemScreenArgs[];
  splitViewExpanded: boolean;
  setSplitViewExpanded: (expanded: boolean) => void;
  openItem: (args: ItemScreenArgs, pushToStack?: boolean) => void;
  goBackItem: () => void;
  closeItem: () => void;

  lastReadStory: Story | null;
  dismissReminder: () => void;

  userDialogUsername: string | null;
  openUserDialog: (author: string | null) => void;

  clearAllCache: () => void;

  // Toasts
  toasts: ToastMessage[];
  showToast: (
    text: string,
    opts?: { variant?: 'default' | 'error' | 'success'; actionLabel?: string; onAction?: () => void },
  ) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(() => storage.getPreferences());
  const [activeTab, setActiveTab] = useState<StoryType | 'profile'>(
    () => preferences.tabOrder[0] || 'profile',
  );

  // System dark media query
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDarkActive =
    preferences.themeMode === 'dark' || (preferences.themeMode === 'system' && systemDark);

  const accentHex = useMemo(() => {
    return ACCENT_COLORS.find((c) => c.id === preferences.appColorId)?.hex ?? '#FF5722';
  }, [preferences.appColorId]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkActive) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--tmw-accent', accentHex);
    root.style.setProperty('--tmw-accent-soft', `${accentHex}24`);
  }, [isDarkActive, accentHex]);

  const updatePreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      storage.savePreferences(next);
      return next;
    });
  }, []);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastCounter = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      text: string,
      opts?: { variant?: 'default' | 'error' | 'success'; actionLabel?: string; onAction?: () => void },
    ) => {
      const id = toastCounter.current++;
      setToasts((prev) => [...prev.slice(-2), { id, text, ...opts }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    [],
  );

  // Read stories & Reminder
  const [readStoryIds, setReadStoryIds] = useState<Set<number>>(() => new Set(storage.getReadStoryIds()));
  const [lastReadStory, setLastReadStory] = useState<Story | null>(() => storage.getLastReadStory());

  const markStoryRead = useCallback(
    (story: Story) => {
      if (!preferences.isMarkReadStoriesEnabled) return;
      setReadStoryIds((prev) => {
        if (prev.has(story.id)) return prev;
        const next = new Set(prev);
        next.add(story.id);
        storage.saveReadStoryIds(Array.from(next));
        return next;
      });
    },
    [preferences.isMarkReadStoriesEnabled],
  );

  const clearReadStories = useCallback(() => {
    setReadStoryIds(new Set());
    storage.saveReadStoryIds([]);
  }, []);

  const dismissReminder = useCallback(() => {
    setLastReadStory(null);
    storage.saveLastReadStory(null);
  }, []);

  // Keywords & Blocklist
  const [filterKeywords, setFilterKeywords] = useState<string[]>(() => storage.getFilterKeywords());
  const addFilterKeyword = useCallback((kw: string) => {
    const clean = kw.trim().toLowerCase();
    if (!clean) return;
    setFilterKeywords((prev) => {
      if (prev.includes(clean)) return prev;
      const next = [...prev, clean];
      storage.saveFilterKeywords(next);
      return next;
    });
  }, []);
  const removeFilterKeyword = useCallback((kw: string) => {
    setFilterKeywords((prev) => {
      const next = prev.filter((k) => k !== kw);
      storage.saveFilterKeywords(next);
      return next;
    });
  }, []);

  const [blocklist, setBlocklist] = useState<string[]>(() => storage.getBlocklist());
  const isBlocked = useCallback((author: string) => blocklist.includes(author), [blocklist]);
  const toggleBlockUser = useCallback(
    (author: string) => {
      if (!author) return;
      setBlocklist((prev) => {
        const exists = prev.includes(author);
        const next = exists ? prev.filter((u) => u !== author) : [...prev, author];
        storage.saveBlocklist(next);
        showToast(exists ? `Unblocked ${author}` : `Blocked ${author}`);
        return next;
      });
    },
    [showToast],
  );

  // Pins
  const [pinnedStories, setPinnedStories] = useState<Story[]>(() => storage.getPinnedStories());
  const isPinned = useCallback((id: number) => pinnedStories.some((s) => s.id === id), [pinnedStories]);
  const togglePin = useCallback(
    (story: Story) => {
      setPinnedStories((prev) => {
        const exists = prev.some((s) => s.id === story.id);
        const next = exists ? prev.filter((s) => s.id !== story.id) : [story, ...prev];
        storage.savePinnedStories(next);
        showToast(exists ? 'Unpinned article' : 'Pinned to top');
        return next;
      });
    },
    [showToast],
  );
  const unpinStory = useCallback((id: number) => {
    setPinnedStories((prev) => {
      const next = prev.filter((s) => s.id !== id);
      storage.savePinnedStories(next);
      return next;
    });
  }, []);

  // Favorites (persisted with full article metadata)
  const [favItems, setFavItems] = useState<Item[]>(() => storage.getFavItems());
  const favIds = useMemo(() => favItems.map((i) => i.id), [favItems]);
  const isFav = useCallback((id: number) => favItems.some((i) => i.id === id), [favItems]);

  const toggleFav = useCallback(
    (item: Item) => {
      setFavItems((prev) => {
        const exists = prev.some((i) => i.id === item.id);
        const next = exists ? prev.filter((i) => i.id !== item.id) : [item, ...prev];
        storage.saveFavItems(next);
        storage.saveFavIds(next.map((x) => x.id));
        showToast(exists ? 'Removed from favorites' : 'Added to favorites');
        return next;
      });
    },
    [showToast],
  );

  const removeFav = useCallback((id: number) => {
    setFavItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      storage.saveFavItems(next);
      storage.saveFavIds(next.map((x) => x.id));
      return next;
    });
  }, []);

  const clearFavs = useCallback(() => {
    setFavItems([]);
    storage.saveFavItems([]);
    storage.saveFavIds([]);
    showToast('All favorites have been removed.');
  }, [showToast]);

  const importFavIds = useCallback(
    (ids: number[]) => {
      const clean = ids.filter((n) => Number.isFinite(n) && n > 0);
      if (clean.length === 0) return;
      const existingMap = new Map(favItems.map((i) => [i.id, i]));
      const allFeedStories = Object.values(feedsRef.current).flatMap((b) => b.stories);
      const storyLookup = new Map(allFeedStories.map((s) => [s.id, s]));

      const added: Item[] = [];
      for (const id of clean) {
        if (existingMap.has(id)) continue;
        const found = storyLookup.get(id);
        if (found) {
          added.push(found);
        } else {
          added.push({
            id,
            time: Math.floor(Date.now() / 1000),
            score: 0,
            parent: 0,
            descendants: 0,
            deleted: false,
            dead: false,
            hidden: false,
            by: 'TUTTOmercatoWEB',
            text: '',
            url: `https://www.tuttomercatoweb.com/?id=${id}`,
            title: `TUTTOmercatoWEB Article #${id}`,
            type: 'story',
            kids: [],
            parts: [],
          });
        }
      }
      if (added.length > 0) {
        const next = [...added, ...favItems];
        setFavItems(next);
        storage.saveFavItems(next);
        storage.saveFavIds(next.map((x) => x.id));
      }
      showToast(`Imported ${clean.length} favorite article${clean.length === 1 ? '' : 's'}.`, {
        variant: 'success',
      });
    },
    [favItems, showToast],
  );

  // Offline mode & Feeds
  const [isOfflineReading, setIsOfflineReading] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState({ active: false, current: 0, total: 0 });
  const [feeds, setFeeds] = useState<FeedMap>(() =>
    createInitialFeeds(preferences.configuredFeeds.map((f) => f.id)),
  );
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;
  const configuredFeedsRef = useRef(preferences.configuredFeeds);
  configuredFeedsRef.current = preferences.configuredFeeds;
  const tabOrderRef = useRef(preferences.tabOrder);
  tabOrderRef.current = preferences.tabOrder;

  const getFeedLabel = useCallback(
    (id: StoryType): string => {
      const found = preferences.configuredFeeds.find((f) => f.id === id);
      return found ? found.label.toUpperCase() : id;
    },
    [preferences.configuredFeeds],
  );

  const applyKeywordFilter = useCallback(
    (stories: Story[]) =>
      stories.map((s) => ({
        ...s,
        hidden: shouldHideByKeywords(s, filterKeywords),
      })),
    [filterKeywords],
  );

  const fetchFeedByKey = useCallback(
    async (
      type: StoryType,
      start = 0,
    ): Promise<{ stories: Story[]; nextStart: number | null; feedTitle?: string }> => {
      const feed = configuredFeedsRef.current.find((f) => f.id === type);
      if (!feed) {
        throw new Error('Feed non trovato');
      }
      if (feed.kind === 'tmw') {
        return fetchTmwFeed(feed.source, start);
      }
      return fetchCustomRssFeed(feed.source, feed.label);
    },
    [],
  );

  const refreshFeed = useCallback(
    async (type: StoryType) => {
      const offlineActive =
        isOfflineReading || (typeof navigator !== 'undefined' && !navigator.onLine);

      if (offlineActive) {
        const cached = storage.getOfflineStories()[type] ?? [];
        setFeeds((prev) => ({
          ...prev,
          [type]: {
            stories: applyKeywordFilter(cached),
            nextStart: null,
            loading: false,
            loadingMore: false,
            error:
              cached.length === 0
                ? 'Sei offline e non ci sono articoli salvati per questa sezione.'
                : null,
          },
        }));
        return;
      }

      setFeeds((prev) => ({
        ...prev,
        [type]: { ...(prev[type] ?? EMPTY_FEED_BUCKET), loading: true, error: null },
      }));

      try {
        const { stories, nextStart } = await fetchFeedByKey(type, 0);
        const existingOffline = storage.getOfflineStories();
        storage.saveOfflineStories({
          ...existingOffline,
          [type]: stories.slice(0, 20),
        });

        setFeeds((prev) => ({
          ...prev,
          [type]: {
            stories: applyKeywordFilter(stories),
            nextStart,
            loading: false,
            loadingMore: false,
            error: null,
          },
        }));
      } catch (err) {
        const cached = storage.getOfflineStories()[type] ?? [];
        if (cached.length > 0) {
          setFeeds((prev) => ({
            ...prev,
            [type]: {
              stories: applyKeywordFilter(cached),
              nextStart: null,
              loading: false,
              loadingMore: false,
              error: null,
            },
          }));
          showToast('Connessione assente: mostrati gli articoli in cache');
        } else {
          const msg =
            err instanceof Error && err.message
              ? err.message
              : 'Impossibile caricare il feed. Verifica la connessione o attiva la Modalità Offline.';
          setFeeds((prev) => ({
            ...prev,
            [type]: {
              ...(prev[type] ?? EMPTY_FEED_BUCKET),
              loading: false,
              error: msg,
            },
          }));
        }
      }
    },
    [isOfflineReading, fetchFeedByKey, applyKeywordFilter, showToast],
  );

  const addCustomFeed = useCallback(
    async (label: string, rawUrl: string): Promise<boolean> => {
      const cleanUrl = rawUrl.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) {
        showToast('Inserisci un URL http:// o https:// valido', { variant: 'error' });
        return false;
      }
      try {
        const { stories, feedTitle } = await fetchCustomRssFeed(cleanUrl, label.trim() || undefined);
        const finalLabel = label.trim() || feedTitle || new URL(cleanUrl).hostname.replace(/^www\./, '');
        const newFeed: ConfiguredFeed = {
          id: `rss_${Date.now()}`,
          label: finalLabel,
          kind: 'rss',
          source: cleanUrl,
          url: cleanUrl,
        };

        setPreferences((prev) => {
          const next: Preferences = {
            ...prev,
            configuredFeeds: [...prev.configuredFeeds, newFeed],
            tabOrder: [...prev.tabOrder, newFeed.id],
          };
          storage.savePreferences(next);
          return next;
        });

        const existingOffline = storage.getOfflineStories();
        storage.saveOfflineStories({
          ...existingOffline,
          [newFeed.id]: stories.slice(0, 20),
        });

        setFeeds((prev) => ({
          ...prev,
          [newFeed.id]: {
            stories: applyKeywordFilter(stories),
            nextStart: null,
            loading: false,
            loadingMore: false,
            error: null,
          },
        }));

        setActiveTab(newFeed.id);
        showToast(`Feed "${finalLabel}" aggiunto (${stories.length} articoli)`, {
          variant: 'success',
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Feed RSS non raggiungibile o non valido';
        showToast(msg, { variant: 'error' });
        return false;
      }
    },
    [applyKeywordFilter, showToast],
  );

  const removeFeed = useCallback(
    (id: string) => {
      const nextOrder = tabOrderRef.current.filter((t) => t !== id);
      setPreferences((prev) => {
        const next: Preferences = {
          ...prev,
          configuredFeeds: prev.configuredFeeds.filter((f) => f.id !== id),
          tabOrder: prev.tabOrder.filter((t) => t !== id),
        };
        storage.savePreferences(next);
        return next;
      });
      setFeeds((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setActiveTab((cur) => (cur === id ? nextOrder[0] ?? 'profile' : cur));
      showToast('Feed rimosso');
    },
    [showToast],
  );

  const restoreDefaultTmwFeeds = useCallback(() => {
    const existingIds = new Set(configuredFeedsRef.current.map((f) => f.id));
    const missing = DEFAULT_CONFIGURED_FEEDS.filter((f) => !existingIds.has(f.id));
    if (missing.length === 0) return;

    setPreferences((prev) => {
      const prevIds = new Set(prev.configuredFeeds.map((f) => f.id));
      const toAdd = DEFAULT_CONFIGURED_FEEDS.filter((f) => !prevIds.has(f.id));
      if (toAdd.length === 0) return prev;
      const next: Preferences = {
        ...prev,
        configuredFeeds: [...prev.configuredFeeds, ...toAdd],
        tabOrder: [...prev.tabOrder, ...toAdd.map((f) => f.id)],
      };
      storage.savePreferences(next);
      return next;
    });

    setFeeds((prev) => {
      const copy = { ...prev };
      for (const f of missing) {
        if (!copy[f.id]) copy[f.id] = { ...EMPTY_FEED_BUCKET };
      }
      return copy;
    });

    showToast('Feed TuttoMercatoWEB ripristinati', { variant: 'success' });
  }, [showToast]);

  const ensureFeedLoaded = useCallback(
    (type: StoryType) => {
      const bucket = feedsRef.current[type];
      if (!bucket || (bucket.stories.length === 0 && !bucket.loading && !bucket.error)) {
        void refreshFeed(type);
      }
    },
    [refreshFeed],
  );

  const loadMoreFeed = useCallback(
    async (type: StoryType) => {
      const feed = configuredFeedsRef.current.find((f) => f.id === type);
      if (isOfflineReading || !feed || feed.kind !== 'tmw') return;
      const bucket = feedsRef.current[type];
      if (!bucket || bucket.loading || bucket.loadingMore || bucket.nextStart === null) return;

      setFeeds((prev) => ({
        ...prev,
        [type]: { ...(prev[type] ?? EMPTY_FEED_BUCKET), loadingMore: true },
      }));

      try {
        const { stories: more, nextStart } = await fetchTmwFeed(feed.source, bucket.nextStart);
        setFeeds((prev) => {
          const cur = prev[type] ?? EMPTY_FEED_BUCKET;
          const existingIds = new Set(cur.stories.map((s) => s.id));
          const deduped = more.filter((s) => !existingIds.has(s.id));
          return {
            ...prev,
            [type]: {
              ...cur,
              stories: applyKeywordFilter([...cur.stories, ...deduped]),
              nextStart: deduped.length > 0 ? nextStart : null,
              loadingMore: false,
            },
          };
        });
      } catch {
        setFeeds((prev) => ({
          ...prev,
          [type]: { ...(prev[type] ?? EMPTY_FEED_BUCKET), loadingMore: false },
        }));
      }
    },
    [isOfflineReading, applyKeywordFilter],
  );

  useEffect(() => {
    setFeeds((prev) => {
      const next: FeedMap = {};
      for (const [t, bucket] of Object.entries(prev)) {
        next[t] = {
          ...bucket,
          stories: bucket.stories.map((s) => ({
            ...s,
            hidden: shouldHideByKeywords(s, filterKeywords),
          })),
        };
      }
      return next;
    });
  }, [filterKeywords]);

  const toggleOfflineMode = useCallback(
    (enabled: boolean) => {
      setIsOfflineReading(enabled);
      const tabIds = configuredFeedsRef.current.map((f) => f.id);
      if (enabled) {
        const offlineMap = storage.getOfflineStories();
        setFeeds(() => {
          const next: FeedMap = {};
          for (const t of tabIds) {
            const list = offlineMap[t] ?? [];
            next[t] = {
              stories: applyKeywordFilter(list),
              nextStart: null,
              loading: false,
              loadingMore: false,
              error: null,
            };
          }
          return next;
        });
        showToast('Offline Reading Mode enabled');
      } else {
        setFeeds(createInitialFeeds(tabIds));
        showToast('Switched back to Online Mode');
      }
    },
    [applyKeywordFilter, showToast],
  );

  const downloadForOffline = useCallback(async () => {
    if (offlineProgress.active) return;
    const types = preferences.tabOrder;
    const perTab = 10;
    const totalStories = types.length * perTab;
    let done = 0;
    setOfflineProgress({ active: true, current: 0, total: totalStories });

    const offlineStoriesMap: Record<string, Story[]> = storage.getOfflineStories();
    const offlineArticlesMap: Record<string, Story> = storage.getOfflineArticles();

    try {
      for (const t of types) {
        const res = await fetchFeedByKey(t, 0).catch(() => ({ stories: [] as Story[], nextStart: null }));
        const batch = res.stories.slice(0, 20);
        offlineStoriesMap[t] = batch;
        for (const story of batch.slice(0, perTab)) {
          done++;
          setOfflineProgress({ active: true, current: done, total: totalStories });
          if (story.url) {
            const full = await fetchTmwArticle(story.url).catch(() => null);
            if (full) {
              offlineArticlesMap[String(story.id)] = {
                ...story,
                ...full,
                text: full.text && full.text.length > (story.text || '').length ? full.text : story.text || full.text,
              };
            } else if (story.text) {
              offlineArticlesMap[String(story.id)] = story;
            }
          }
        }
      }
      storage.saveOfflineStories(offlineStoriesMap);
      storage.saveOfflineArticles(offlineArticlesMap);
      showToast('Articoli salvati per la lettura offline.', { variant: 'success' });
    } catch {
      showToast('Offline download encountered an error.', { variant: 'error' });
    } finally {
      setOfflineProgress({ active: false, current: 0, total: 0 });
    }
  }, [offlineProgress.active, preferences.tabOrder, fetchFeedByKey, showToast]);

  // Split View & Item Navigation
  const [itemHistoryStack, setItemHistoryStack] = useState<ItemScreenArgs[]>([]);
  const [splitViewExpanded, setSplitViewExpanded] = useState(false);

  const selectedItemArgs =
    itemHistoryStack.length > 0 ? itemHistoryStack[itemHistoryStack.length - 1] : null;

  const openItem = useCallback(
    (args: ItemScreenArgs, pushToStack = false) => {
      setItemHistoryStack((prev) => (pushToStack ? [...prev, args] : [args]));
      if (args.item.type !== 'comment') {
        const story = args.item as Story;
        setLastReadStory(story);
        storage.saveLastReadStory(story);
        if (preferences.isMarkReadStoriesEnabled && preferences.storyMarkingMode === 'tap') {
          markStoryRead(story);
        }
      }
    },
    [preferences.isMarkReadStoriesEnabled, preferences.storyMarkingMode, markStoryRead],
  );

  const goBackItem = useCallback(() => {
    setItemHistoryStack((prev) => prev.slice(0, -1));
  }, []);

  const closeItem = useCallback(() => {
    setItemHistoryStack([]);
    setSplitViewExpanded(false);
  }, []);

  const clearAllCache = useCallback(() => {
    storage.clearCache();
    setReadStoryIds(new Set());
    showToast('Cache cleared!', { variant: 'success' });
  }, [showToast]);

  const [userDialogUsername, setUserDialogUsername] = useState<string | null>(null);

  const value: AppContextValue = {
    preferences,
    updatePreference,
    accentHex,
    isDarkActive,
    activeTab,
    setActiveTab,
    addCustomFeed,
    removeFeed,
    restoreDefaultTmwFeeds,
    getFeedLabel,
    feeds,
    ensureFeedLoaded,
    refreshFeed,
    loadMoreFeed,
    readStoryIds,
    markStoryRead,
    clearReadStories,
    isOfflineReading,
    toggleOfflineMode,
    offlineProgress,
    downloadForOffline,
    pinnedStories,
    isPinned,
    togglePin,
    unpinStory,
    favIds,
    favItems,
    isFav,
    toggleFav,
    removeFav,
    clearFavs,
    importFavIds,
    filterKeywords,
    addFilterKeyword,
    removeFilterKeyword,
    blocklist,
    isBlocked,
    toggleBlockUser,
    selectedItemArgs,
    itemHistoryStack,
    splitViewExpanded,
    setSplitViewExpanded,
    openItem,
    goBackItem,
    closeItem,
    lastReadStory,
    dismissReminder,
    userDialogUsername,
    openUserDialog: setUserDialogUsername,
    clearAllCache,
    toasts,
    showToast,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
