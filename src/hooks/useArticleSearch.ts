import { useCallback, useState } from 'react';
import type { Item, SearchParams, Story } from '../types/tmw';
import { offlineDb } from '../services/offlineDb';
import { mergeStoryRichness } from '../utils/articleMerge';

interface UseArticleSearchProps {
  feeds: Record<string, { stories: Story[] }>;
  pinnedStories: Story[];
  favItems: Item[];
}

const INITIAL_PARAMS: SearchParams = {
  query: '',
  page: 0,
  sorted: false,
  exactMatch: false,
  startTime: null,
  endTime: null,
};

export function useArticleSearch({ feeds, pinnedStories, favItems }: UseArticleSearchProps) {
  const [params, setParams] = useState<SearchParams>(INITIAL_PARAMS);
  const [allMatches, setAllMatches] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(
    async (nextParams: SearchParams) => {
      const hasFilter =
        Boolean(nextParams.query.trim()) || nextParams.startTime !== null;

      if (!hasFilter) {
        setAllMatches([]);
        setHasSearched(false);
        return;
      }

      setLoading(true);
      setHasSearched(true);
      try {
        const [cachedFeeds, cachedArticles] = await Promise.all([
          offlineDb.getAllFeedStories(),
          offlineDb.getAllArticles(),
        ]);

        const poolMap = new Map<string, Story>();
        const addAll = (list: Story[]) => {
          for (const item of list) {
            if (!item || typeof item.id !== 'number') continue;
            const key = item.url?.trim() || `id:${item.id}`;
            poolMap.set(key, mergeStoryRichness(poolMap.get(key), item));
          }
        };

        addAll(cachedFeeds);
        addAll(Object.values(feeds).flatMap((b) => b.stories));
        addAll(pinnedStories);
        addAll((favItems as Story[]).filter((i) => i.type !== 'comment'));
        addAll(cachedArticles);

        let results = Array.from(poolMap.values()).filter((s) => !s.hidden);

        const rawQuery = nextParams.query.trim().toLowerCase();
        if (rawQuery) {
          if (nextParams.exactMatch) {
            results = results.filter((s) => s.title.toLowerCase().includes(rawQuery));
          } else {
            const tokens = rawQuery.split(/\s+/).filter(Boolean);
            results = results.filter((s) => {
              const haystack = [
                s.title,
                s.subtitle,
                s.text,
                s.by,
                s.category,
                s.label,
                s.url,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return tokens.every((tok) => haystack.includes(tok));
            });
          }
        }

        if (nextParams.startTime !== null) {
          const startSec = Math.floor(nextParams.startTime / 1000);
          const rawEnd = nextParams.endTime ?? Date.now();
          let endSec = Math.floor(rawEnd / 1000);
          if (endSec <= startSec) {
            endSec = startSec + 86400;
          }
          results = results.filter((s) => s.time >= startSec && s.time <= endSec);
        }

        if (nextParams.sorted || !rawQuery) {
          results.sort((a, b) => b.time - a.time);
        } else {
          results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(rawQuery) ? 1 : 0;
            const bTitle = b.title.toLowerCase().includes(rawQuery) ? 1 : 0;
            if (aTitle !== bTitle) return bTitle - aTitle;
            return b.time - a.time;
          });
        }

        setAllMatches(results);
      } catch {
        setAllMatches([]);
      } finally {
        setLoading(false);
      }
    },
    [feeds, pinnedStories, favItems],
  );

  return {
    params,
    setParams,
    allMatches,
    loading,
    hasSearched,
    runSearch,
  };
}
