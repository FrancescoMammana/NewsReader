import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Search as SearchIcon, X } from 'lucide-react';
import {
  ALL_TYPE_TAG_FILTERS,
  type SearchParams,
  type Story,
  type TypeTagFilter,
} from '../types/hn';
import { searchTmw } from '../services/hnApi';
import { useApp } from '../context/AppContext';
import { StoryTile } from './StoryTile';

const INITIAL_PARAMS: SearchParams = {
  query: '',
  page: 0,
  sorted: false,
  exactMatch: false,
  postedBy: '',
  typeTag: null,
  startTime: null,
  endTime: null,
};

const QUICK_RANGES = [
  { label: 'Past 24h', days: 1 },
  { label: 'Past week', days: 7 },
  { label: 'Past month', days: 30 },
];

export const SearchView: React.FC = () => {
  const { preferences, accentHex, openItem } = useApp();
  const [params, setParams] = useState<SearchParams>(INITIAL_PARAMS);
  const [results, setResults] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);

  const runSearch = useCallback(async (nextParams: SearchParams, append = false) => {
    const hasFilter =
      Boolean(nextParams.query.trim()) ||
      Boolean(nextParams.typeTag) ||
      nextParams.startTime !== null;

    if (!hasFilter) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const hits = await searchTmw(nextParams);
      setResults((prev) => (append ? [...prev, ...hits] : hits));
    } catch {
      if (!append) setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(params, params.page > 0);
    }, 450);
    return () => clearTimeout(timer);
  }, [params, runSearch]);

  const applyQuickRange = (days: number) => {
    const end = Date.now();
    const start = end - days * 86400 * 1000;
    setParams((p) => ({ ...p, startTime: start, endTime: end, page: 0 }));
  };

  const shiftDateRange = (deltaDays: number) => {
    setParams((p) => {
      const baseStart = p.startTime ?? Date.now() - 86400 * 1000;
      const baseEnd = p.endTime ?? Date.now();
      const shift = deltaDays * 86400 * 1000;
      return {
        ...p,
        startTime: baseStart + shift,
        endTime: baseEnd + shift,
        page: 0,
      };
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input & Filter Chips */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2.5">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={params.query}
            onChange={(e) => setParams((p) => ({ ...p, query: e.target.value, page: 0 }))}
            placeholder="Cerca su TuttoMercatoWeb..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1"
            style={{ '--tw-ring-color': accentHex } as React.CSSProperties}
          />
          {params.query && (
            <button
              type="button"
              onClick={() => setParams((p) => ({ ...p, query: '', page: 0 }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Shortcuts when date filter is active */}
        {params.startTime !== null && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
            {[
              { label: '-1d', delta: -1 },
              { label: '+1d', delta: 1 },
              { label: '-1w', delta: -7 },
              { label: '+1w', delta: 7 },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => shiftDateRange(s.delta)}
                className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Row 1: Date, Sort, Exact, Quick Ranges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          <button
            type="button"
            onClick={() => setDateModalOpen(true)}
            className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 flex items-center gap-1 border-neutral-200 dark:border-neutral-700"
            style={
              params.startTime !== null
                ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--hacki-accent-soft)' }
                : undefined
            }
          >
            <Calendar className="w-3 h-3" />
            <span>
              {params.startTime !== null
                ? `${new Date(params.startTime).toLocaleDateString()} - ${new Date(
                    params.endTime || Date.now(),
                  ).toLocaleDateString()}`
                : 'date range'}
            </span>
            {params.startTime !== null && (
              <X
                className="w-3 h-3 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setParams((p) => ({ ...p, startTime: null, endTime: null, page: 0 }));
                }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setParams((p) => ({ ...p, sorted: !p.sorted, page: 0 }))}
            className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 border-neutral-200 dark:border-neutral-700"
            style={
              params.sorted
                ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--hacki-accent-soft)' }
                : undefined
            }
          >
            newest first
          </button>

          <button
            type="button"
            onClick={() => setParams((p) => ({ ...p, exactMatch: !p.exactMatch, page: 0 }))}
            className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 border-neutral-200 dark:border-neutral-700"
            style={
              params.exactMatch
                ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--hacki-accent-soft)' }
                : undefined
            }
          >
            title match
          </button>

          {QUICK_RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => applyQuickRange(r.days)}
              className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0"
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Row 2: TMW Category filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          {ALL_TYPE_TAG_FILTERS.map((tag: TypeTagFilter) => {
            const selected = params.typeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setParams((p) => ({ ...p, typeTag: selected ? null : tag, page: 0 }))
                }
                className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 border-neutral-200 dark:border-neutral-700"
                style={
                  selected
                    ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--hacki-accent-soft)' }
                    : undefined
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && results.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-500">Searching...</div>
        )}
        {!loading && hasSearched && results.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-400">Nothing found...</div>
        )}
        {!hasSearched && results.length === 0 && (
          <div className="py-16 px-6 text-center text-sm text-neutral-400">
            Cerca giocatori, squadre o notizie su TuttoMercatoWeb.
          </div>
        )}

        {results.map((item) => (
          <StoryTile
            key={`search-story-${item.id}`}
            story={item}
            onTap={() => openItem({ item })}
            showWebPreview={preferences.isComplexStoryTileEnabled}
            showMetadata={preferences.isMetadataEnabled}
            showFavicon={preferences.isFaviconEnabled}
            showUrl={preferences.isUrlEnabled}
          />
        ))}

        {results.length > 0 && (
          <div className="py-4 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
              className="px-4 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              style={{ color: accentHex }}
            >
              {loading ? 'Loading...' : 'Load more results'}
            </button>
          </div>
        )}
      </div>

      {/* Date Range Modal */}
      {dateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDateModalOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold">Custom Date Range</h4>
            <div className="space-y-2 text-xs">
              <label className="block">
                <span className="text-neutral-500">From</span>
                <input
                  type="date"
                  value={
                    params.startTime
                      ? new Date(params.startTime).toISOString().slice(0, 10)
                      : ''
                  }
                  onChange={(e) => {
                    const ms = e.target.value ? Date.parse(e.target.value) : null;
                    setParams((p) => ({
                      ...p,
                      startTime: ms,
                      endTime: p.endTime ?? Date.now(),
                      page: 0,
                    }));
                  }}
                  className="mt-1 w-full px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                />
              </label>
              <label className="block">
                <span className="text-neutral-500">To</span>
                <input
                  type="date"
                  value={
                    params.endTime
                      ? new Date(params.endTime).toISOString().slice(0, 10)
                      : ''
                  }
                  onChange={(e) => {
                    const ms = e.target.value ? Date.parse(e.target.value) : null;
                    setParams((p) => ({
                      ...p,
                      startTime: p.startTime ?? (ms ? ms - 86400 * 1000 : null),
                      endTime: ms,
                      page: 0,
                    }));
                  }}
                  className="mt-1 w-full px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDateModalOpen(false)}
                className="px-3 py-1.5 rounded text-white font-medium"
                style={{ backgroundColor: accentHex }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
