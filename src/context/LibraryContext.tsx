import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Item, Story } from '../types/tmw';
import { fetchTmwArticle } from '../services/tmwApi';
import { offlineDb } from '../services/offlineDb';
import { storage } from '../services/storage';
import { mergeFullArticle } from '../utils/articleMerge';
import { usePreferences } from './PreferencesContext';
import { useToasts } from './ToastContext';

export interface LibraryContextValue {
  readStoryIds: Set<number>;
  markStoryRead: (story: Story) => void;
  clearReadStories: () => void;

  lastReadStory: Story | null;
  recordLastReadStory: (story: Story) => void;
  dismissReminder: () => void;

  filterKeywords: string[];
  addFilterKeyword: (kw: string) => void;
  removeFilterKeyword: (kw: string) => void;

  blocklist: string[];
  isBlocked: (author: string) => boolean;
  toggleBlockUser: (author: string) => void;

  pinnedStories: Story[];
  isPinned: (id: number) => boolean;
  togglePin: (story: Story) => void;
  unpinStory: (id: number) => void;

  favIds: number[];
  favItems: Item[];
  favIdSetRef: React.RefObject<Set<number>>;
  isFav: (id: number) => boolean;
  toggleFav: (item: Item) => void;
  removeFav: (id: number) => void;
  clearFavs: () => void;
  importFavIds: (ids: number[], lookupStories?: Story[]) => void;

  offlineArticleCount: number;
  isOfflineCached: (id: number, url?: string) => boolean;
  refreshOfflineIds: () => Promise<void>;
  cacheArticleOffline: (story: Story) => Promise<void>;
  clearOfflineCache: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences } = usePreferences();
  const { showToast } = useToasts();

  // Read stories & Reminder
  const [readStoryIds, setReadStoryIds] = useState<Set<number>>(
    () => new Set(storage.getReadStoryIds()),
  );
  const [lastReadStory, setLastReadStory] = useState<Story | null>(() =>
    storage.getLastReadStory(),
  );

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
    showToast('Cronologia articoli letti azzerata');
  }, [showToast]);

  const recordLastReadStory = useCallback((story: Story) => {
    setLastReadStory(story);
    storage.saveLastReadStory(story);
  }, []);

  const dismissReminder = useCallback(() => {
    setLastReadStory(null);
    storage.saveLastReadStory(null);
  }, []);

  // Keywords & Blocklist
  const [filterKeywords, setFilterKeywords] = useState<string[]>(() =>
    storage.getFilterKeywords(),
  );
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
  const isPinned = useCallback(
    (id: number) => pinnedStories.some((s) => s.id === id),
    [pinnedStories],
  );
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

  // Favorites & Offline IndexedDB protection
  const [favItems, setFavItems] = useState<Item[]>(() => storage.getFavItems());
  const favIds = useMemo(() => favItems.map((i) => i.id), [favItems]);
  const favIdSetRef = useRef<Set<number>>(new Set(favIds));
  favIdSetRef.current = new Set(favIds);
  const isFav = useCallback((id: number) => favItems.some((i) => i.id === id), [favItems]);

  const [offlineArticleIds, setOfflineArticleIds] = useState<Set<number>>(new Set());
  const [offlineArticleUrls, setOfflineArticleUrls] = useState<Set<string>>(new Set());
  const offlineArticleCount = offlineArticleIds.size;

  const refreshOfflineIds = useCallback(async () => {
    const { ids, urls } = await offlineDb.getOfflineArticleKeys();
    setOfflineArticleIds(new Set(ids));
    setOfflineArticleUrls(new Set(urls));
  }, []);

  const isOfflineCached = useCallback(
    (id: number, url?: string) =>
      offlineArticleIds.has(id) || (Boolean(url) && offlineArticleUrls.has(url as string)),
    [offlineArticleIds, offlineArticleUrls],
  );

  const cacheArticleOffline = useCallback(async (story: Story) => {
    await offlineDb.saveArticle(story, favIdSetRef.current);
    const { ids, urls } = await offlineDb.getOfflineArticleKeys();
    setOfflineArticleIds(new Set(ids));
    setOfflineArticleUrls(new Set(urls));
  }, []);

  useEffect(() => {
    offlineDb.clearLegacyLocalStorage();
    void refreshOfflineIds();
  }, [refreshOfflineIds]);

  const toggleFav = useCallback(
    (item: Item) => {
      const exists = favIdSetRef.current.has(item.id);
      setFavItems((prev) => {
        const next = exists ? prev.filter((i) => i.id !== item.id) : [item, ...prev];
        storage.saveFavItems(next);
        storage.saveFavIds(next.map((x) => x.id));
        return next;
      });
      showToast(exists ? 'Removed from favorites' : 'Added to favorites');

      if (!exists) {
        const nextProtected = new Set(favIdSetRef.current);
        nextProtected.add(item.id);
        void (async () => {
          const story = item as Story;
          await offlineDb.saveArticle(story, nextProtected);
          await refreshOfflineIds();
          if (story.url && (typeof navigator === 'undefined' || navigator.onLine)) {
            const full = await fetchTmwArticle(story.url).catch(() => null);
            if (full) {
              const merged = mergeFullArticle(story, full);
              await offlineDb.saveArticle(merged, nextProtected);
              setFavItems((cur) => {
                if (!cur.some((x) => x.id === merged.id)) return cur;
                const updated = cur.map((x) => (x.id === merged.id ? merged : x));
                storage.saveFavItems(updated);
                return updated;
              });
            }
          }
          await refreshOfflineIds();
        })();
      }
    },
    [showToast, refreshOfflineIds],
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
    (ids: number[], lookupStories: Story[] = []) => {
      const clean = ids.filter((n) => Number.isFinite(n) && n > 0);
      if (clean.length === 0) return;
      const existingMap = new Map(favItems.map((i) => [i.id, i]));
      const storyLookup = new Map(lookupStories.map((s) => [s.id, s]));

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
            parent: 0,
            hidden: false,
            by: 'TUTTOmercatoWEB',
            text: '',
            url: `https://www.tuttomercatoweb.com/?id=${id}`,
            title: `TUTTOmercatoWEB Article #${id}`,
            type: 'story',
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

  const clearOfflineCache = useCallback(async () => {
    await offlineDb.clearOfflineData(favIdSetRef.current);
    storage.clearPreviews();
    await refreshOfflineIds();
    showToast('Articoli offline rimossi (preferiti mantenuti)', { variant: 'success' });
  }, [showToast, refreshOfflineIds]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      readStoryIds,
      markStoryRead,
      clearReadStories,
      lastReadStory,
      recordLastReadStory,
      dismissReminder,
      filterKeywords,
      addFilterKeyword,
      removeFilterKeyword,
      blocklist,
      isBlocked,
      toggleBlockUser,
      pinnedStories,
      isPinned,
      togglePin,
      unpinStory,
      favIds,
      favItems,
      favIdSetRef,
      isFav,
      toggleFav,
      removeFav,
      clearFavs,
      importFavIds,
      offlineArticleCount,
      isOfflineCached,
      refreshOfflineIds,
      cacheArticleOffline,
      clearOfflineCache,
    }),
    [
      readStoryIds,
      markStoryRead,
      clearReadStories,
      lastReadStory,
      recordLastReadStory,
      dismissReminder,
      filterKeywords,
      addFilterKeyword,
      removeFilterKeyword,
      blocklist,
      isBlocked,
      toggleBlockUser,
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
      offlineArticleCount,
      isOfflineCached,
      refreshOfflineIds,
      cacheArticleOffline,
      clearOfflineCache,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
