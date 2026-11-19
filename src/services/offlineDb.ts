import type { PodcastEpisode, Story } from '../types/tmw';

const DB_NAME = 'newsreader_offline_db';
const DB_VERSION = 2;
const STORE_FEEDS = 'feeds';
const STORE_ARTICLES = 'articles';
const STORE_PODCASTS = 'podcasts';
const MAX_NON_FAV_ARTICLES = 300;

interface FeedRecord {
  id: string;
  stories: Story[];
  updatedAt: number;
}

interface ArticleRecord {
  id: number;
  story: Story;
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_FEEDS)) {
          db.createObjectStore(STORE_FEEDS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ARTICLES)) {
          const store = db.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_PODCASTS)) {
          db.createObjectStore(STORE_PODCASTS, { keyPath: 'feedId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function pruneOldArticles(protectedIds: Set<number>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_ARTICLES, 'readwrite');
    const store = tx.objectStore(STORE_ARTICLES);
    const all = await reqToPromise(store.getAll() as IDBRequest<ArticleRecord[]>);
    const nonFavs = all
      .filter((r) => !protectedIds.has(r.id))
      .sort((a, b) => b.cachedAt - a.cachedAt);
    if (nonFavs.length > MAX_NON_FAV_ARTICLES) {
      for (const rec of nonFavs.slice(MAX_NON_FAV_ARTICLES)) {
        store.delete(rec.id);
      }
    }
    await txDone(tx);
  } catch {
    // Ignore pruning errors
  }
}

export const offlineDb = {
  async getFeedStories(feedId: string): Promise<Story[]> {
    const db = await openDb();
    if (!db) return [];
    try {
      const tx = db.transaction(STORE_FEEDS, 'readonly');
      const rec = await reqToPromise(
        tx.objectStore(STORE_FEEDS).get(feedId) as IDBRequest<FeedRecord | undefined>,
      );
      return rec?.stories ?? [];
    } catch {
      return [];
    }
  },

  async saveFeedStories(feedId: string, stories: Story[]): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try {
      const tx = db.transaction(STORE_FEEDS, 'readwrite');
      const record: FeedRecord = {
        id: feedId,
        stories: stories.slice(0, 30),
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE_FEEDS).put(record);
      await txDone(tx);
    } catch {
      // Ignore storage errors gracefully
    }
  },

  async deleteFeedStories(feedId: string): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try {
      const tx = db.transaction(STORE_FEEDS, 'readwrite');
      tx.objectStore(STORE_FEEDS).delete(feedId);
      await txDone(tx);
    } catch {
      // Ignore
    }
  },

  async getArticle(id: number, url?: string): Promise<Story | null> {
    const db = await openDb();
    if (!db) return null;
    try {
      const tx = db.transaction(STORE_ARTICLES, 'readonly');
      const store = tx.objectStore(STORE_ARTICLES);
      const rec = await reqToPromise(store.get(id) as IDBRequest<ArticleRecord | undefined>);
      if (rec?.story) return rec.story;
      if (url) {
        const all = await reqToPromise(store.getAll() as IDBRequest<ArticleRecord[]>);
        const byUrl = all.find((r) => r.story?.url === url);
        if (byUrl?.story) return byUrl.story;
      }
      return null;
    } catch {
      return null;
    }
  },

  async saveArticle(story: Story, protectedIds: Set<number> = new Set()): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try {
      const tx = db.transaction(STORE_ARTICLES, 'readwrite');
      const record: ArticleRecord = {
        id: story.id,
        story,
        cachedAt: Date.now(),
      };
      tx.objectStore(STORE_ARTICLES).put(record);
      await txDone(tx);
      await pruneOldArticles(protectedIds);
    } catch {
      // Ignore storage errors gracefully
    }
  },

  async getAllFeedStories(): Promise<Story[]> {
    const db = await openDb();
    if (!db) return [];
    try {
      const tx = db.transaction(STORE_FEEDS, 'readonly');
      const all = await reqToPromise(
        tx.objectStore(STORE_FEEDS).getAll() as IDBRequest<FeedRecord[]>,
      );
      return all.flatMap((rec) => rec.stories ?? []);
    } catch {
      return [];
    }
  },

  async getAllArticles(): Promise<Story[]> {
    const db = await openDb();
    if (!db) return [];
    try {
      const tx = db.transaction(STORE_ARTICLES, 'readonly');
      const all = await reqToPromise(
        tx.objectStore(STORE_ARTICLES).getAll() as IDBRequest<ArticleRecord[]>,
      );
      return all.map((rec) => rec.story);
    } catch {
      return [];
    }
  },

  async getOfflineArticleKeys(): Promise<{ ids: number[]; urls: string[] }> {
    const db = await openDb();
    if (!db) return { ids: [], urls: [] };
    try {
      const tx = db.transaction(STORE_ARTICLES, 'readonly');
      const all = await reqToPromise(
        tx.objectStore(STORE_ARTICLES).getAll() as IDBRequest<ArticleRecord[]>,
      );
      const ids: number[] = [];
      const urls: string[] = [];
      for (const rec of all) {
        if (Number.isFinite(rec.id)) ids.push(rec.id);
        if (rec.story?.url) urls.push(rec.story.url);
      }
      return { ids, urls };
    } catch {
      return { ids: [], urls: [] };
    }
  },

  async getOfflineArticleIds(): Promise<number[]> {
    const { ids } = await this.getOfflineArticleKeys();
    return ids;
  },

  async getOfflineArticleCount(): Promise<number> {
    const db = await openDb();
    if (!db) return 0;
    try {
      const tx = db.transaction(STORE_ARTICLES, 'readonly');
      return await reqToPromise(tx.objectStore(STORE_ARTICLES).count());
    } catch {
      return 0;
    }
  },

  async getPodcast(feedId: string): Promise<PodcastEpisode | null> {
    const db = await openDb();
    if (!db) return null;
    try {
      const tx = db.transaction(STORE_PODCASTS, 'readonly');
      const rec = await reqToPromise(
        tx.objectStore(STORE_PODCASTS).get(feedId) as IDBRequest<PodcastEpisode | undefined>,
      );
      return rec ?? null;
    } catch {
      return null;
    }
  },

  async savePodcast(episode: PodcastEpisode): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try {
      const tx = db.transaction(STORE_PODCASTS, 'readwrite');
      tx.objectStore(STORE_PODCASTS).put(episode);
      await txDone(tx);
    } catch {
      // Ignore storage errors gracefully
    }
  },

  async clearOfflineData(protectedFavIds: Set<number>): Promise<number> {
    const db = await openDb();
    if (!db) return 0;
    try {
      const tx = db.transaction([STORE_FEEDS, STORE_ARTICLES, STORE_PODCASTS], 'readwrite');
      tx.objectStore(STORE_FEEDS).clear();
      tx.objectStore(STORE_PODCASTS).clear();
      const articleStore = tx.objectStore(STORE_ARTICLES);
      const keys = await reqToPromise(articleStore.getAllKeys() as IDBRequest<IDBValidKey[]>);
      let remaining = 0;
      for (const k of keys) {
        const numKey = Number(k);
        if (!protectedFavIds.has(numKey)) {
          articleStore.delete(k);
        } else {
          remaining++;
        }
      }
      await txDone(tx);
      return remaining;
    } catch {
      return 0;
    }
  },

  clearLegacyLocalStorage(): void {
    try {
      localStorage.removeItem('tmw_offline_stories_v1');
      localStorage.removeItem('tmw_offline_articles_v1');
    } catch {
      // Ignore
    }
  },
};
