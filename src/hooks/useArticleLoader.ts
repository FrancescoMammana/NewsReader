import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item, Story } from '../types/tmw';
import { fetchTmwArticle } from '../services/tmwApi';
import { offlineDb } from '../services/offlineDb';
import { mergeFullArticle } from '../utils/articleMerge';

interface UseArticleLoaderParams {
  item: Item;
  cacheArticleOffline: (story: Story) => Promise<void>;
}

export function useArticleLoader({ item, cacheArticleOffline }: UseArticleLoaderParams) {
  const [article, setArticle] = useState<Story>(item as Story);
  const [loading, setLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const requestIdRef = useRef(0);

  const loadArticle = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setImgFailed(false);

    const cached = await offlineDb.getArticle(item.id, item.url);
    if (requestIdRef.current !== reqId) return;

    const offlineOnly = typeof navigator !== 'undefined' && !navigator.onLine;
    if (offlineOnly) {
      setArticle(cached ?? (item as Story));
      setLoading(false);
      return;
    }

    const hasRichCache = Boolean(cached && cached.text && cached.text.length >= 180);
    if (hasRichCache && cached) {
      setArticle(cached);
    }

    if (!item.url) {
      if (!cached) setArticle(item as Story);
      setLoading(false);
      return;
    }

    setLoading(!hasRichCache);
    try {
      const full = await fetchTmwArticle(item.url);
      if (requestIdRef.current !== reqId) return;
      if (full) {
        const merged = mergeFullArticle(item as Story, full);
        setArticle(merged);
        void cacheArticleOffline(merged);
      } else if (cached) {
        setArticle(cached);
      }
    } catch {
      if (requestIdRef.current === reqId && cached) {
        setArticle(cached);
      }
    } finally {
      if (requestIdRef.current === reqId) {
        setLoading(false);
      }
    }
  }, [item, cacheArticleOffline]);

  useEffect(() => {
    setArticle(item as Story);
    void loadArticle();
  }, [item, loadArticle]);

  return {
    article,
    loading,
    imgFailed,
    setImgFailed,
    reloadArticle: loadArticle,
  };
}
