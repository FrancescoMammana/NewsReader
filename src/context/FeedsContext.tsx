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
  type ConfiguredFeed,
  DEFAULT_CONFIGURED_FEEDS,
  type Preferences,
  type Story,
  type StoryType,
} from '../types/tmw';
import { fetchCustomRssFeed, fetchTmwArticle, fetchTmwFeed } from '../services/tmwApi';
import { offlineDb } from '../services/offlineDb';
import { storage } from '../services/storage';
import { shouldHideByKeywords } from '../utils/formatting';
import { mergeFullArticle } from '../utils/articleMerge';
import { useLibrary } from './LibraryContext';
import { useNavigation } from './NavigationContext';
import { usePreferences } from './PreferencesContext';
import { useToasts } from './ToastContext';

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

export type FeedMap = Record<string, FeedBucket>;

function createInitialFeeds(tabIds: StoryType[]): FeedMap {
  const map: FeedMap = {};
  for (const t of tabIds) {
    map[t] = { ...EMPTY_FEED_BUCKET };
  }
  return map;
}

export interface FeedsContextValue {
  feeds: FeedMap;
  feedsRef: React.RefObject<FeedMap>;
  addCustomFeed: (label: string, url: string) => Promise<boolean>;
  removeFeed: (id: string) => void;
  restoreDefaultTmwFeeds: () => void;
  getFeedLabel: (id: StoryType) => string;
  ensureFeedLoaded: (type: StoryType) => void;
  refreshFeed: (type: StoryType) => Promise<void>;
  loadMoreFeed: (type: StoryType) => Promise<void>;
}

const FeedsContext = createContext<FeedsContextValue | null>(null);

export const FeedsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences, setPreferences } = usePreferences();
  const { showToast } = useToasts();
  const { filterKeywords, favIdSetRef, refreshOfflineIds } = useLibrary();
  const { setActiveTab } = useNavigation();

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

  const prefetchTabArticles = useCallback(
    async (stories: Story[], limit = 15) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const targets = stories.slice(0, limit);
      if (targets.length === 0) return;

      const queue = [...targets];
      const workerCount = Math.min(4, queue.length);

      const runWorker = async () => {
        while (queue.length > 0) {
          const story = queue.shift();
          if (!story) break;
          try {
            const existing = await offlineDb.getArticle(story.id, story.url);
            if (existing && existing.text && existing.text.length >= 180) {
              if (existing.id !== story.id) {
                await offlineDb.saveArticle(
                  { ...existing, id: story.id, url: story.url || existing.url },
                  favIdSetRef.current,
                );
              }
              continue;
            }
            if (!story.url) {
              if (story.text) await offlineDb.saveArticle(story, favIdSetRef.current);
              continue;
            }
            const full = await fetchTmwArticle(story.url).catch(() => null);
            if (full) {
              const merged = mergeFullArticle(story, full);
              await offlineDb.saveArticle(merged, favIdSetRef.current);
            } else if (story.text) {
              await offlineDb.saveArticle(story, favIdSetRef.current);
            }
          } catch {
            // Ignore individual prefetch failure
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      await refreshOfflineIds();
    },
    [favIdSetRef, refreshOfflineIds],
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
      const deviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (deviceOffline) {
        const cached = await offlineDb.getFeedStories(type);
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
        void offlineDb.saveFeedStories(type, stories);
        void prefetchTabArticles(stories, 15);

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
        const cached = await offlineDb.getFeedStories(type);
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
              : 'Impossibile caricare il feed. Verifica la connessione.';
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
    [fetchFeedByKey, prefetchTabArticles, applyKeywordFilter, showToast],
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
        const finalLabel =
          label.trim() || feedTitle || new URL(cleanUrl).hostname.replace(/^www\./, '');
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

        void offlineDb.saveFeedStories(newFeed.id, stories);
        void prefetchTabArticles(stories, 15);

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
    [applyKeywordFilter, prefetchTabArticles, setActiveTab, setPreferences, showToast],
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
      void offlineDb.deleteFeedStories(id);
      setActiveTab((cur) => (cur === id ? nextOrder[0] ?? 'profile' : cur));
      showToast('Feed rimosso');
    },
    [setActiveTab, setPreferences, showToast],
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
  }, [setPreferences, showToast]);

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
      const deviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (deviceOffline || !feed || feed.kind !== 'tmw') return;
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
    [applyKeywordFilter],
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

  const value = useMemo<FeedsContextValue>(
    () => ({
      feeds,
      feedsRef,
      addCustomFeed,
      removeFeed,
      restoreDefaultTmwFeeds,
      getFeedLabel,
      ensureFeedLoaded,
      refreshFeed,
      loadMoreFeed,
    }),
    [
      feeds,
      addCustomFeed,
      removeFeed,
      restoreDefaultTmwFeeds,
      getFeedLabel,
      ensureFeedLoaded,
      refreshFeed,
      loadMoreFeed,
    ],
  );

  return <FeedsContext.Provider value={value}>{children}</FeedsContext.Provider>;
};

export function useFeeds(): FeedsContextValue {
  const ctx = useContext(FeedsContext);
  if (!ctx) throw new Error('useFeeds must be used inside FeedsProvider');
  return ctx;
}
