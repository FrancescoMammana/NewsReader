import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Search as SearchIcon, X } from 'lucide-react';
import { useFeeds, useLibrary, useNavigation, usePreferences } from '../context/AppContext';
import { useArticleSearch } from '../hooks/useArticleSearch';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { StoryTile } from './StoryTile';

const PAGE_SIZE = 30;

const QUICK_RANGES = [
  { label: 'Ultime 24h', days: 1 },
  { label: 'Ultima settimana', days: 7 },
  { label: 'Ultimo mese', days: 30 },
];

interface SearchViewProps {
  isVisible?: boolean;
}

export const SearchView: React.FC<SearchViewProps> = ({ isVisible = true }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration(scrollRef, 'search', isVisible);
  const { preferences, accentHex } = usePreferences();
  const { openItem } = useNavigation();
  const { feeds } = useFeeds();
  const { pinnedStories, favItems } = useLibrary();

  const { params, setParams, allMatches, loading, hasSearched, runSearch } = useArticleSearch({
    feeds,
    pinnedStories,
    favItems,
  });

  const [dateModalOpen, setDateModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(params);
    }, 250);
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

  const visibleLimit = (params.page + 1) * PAGE_SIZE;
  const visibleResults = allMatches.slice(0, visibleLimit);
  const hasMore = visibleResults.length < allMatches.length;

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
            placeholder="Cerca tra gli articoli..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1"
            style={{ '--tw-ring-color': accentHex } as React.CSSProperties}
          />
          {params.query && (
            <button
              type="button"
              onClick={() => setParams((p) => ({ ...p, query: '', page: 0 }))}
              aria-label="Cancella ricerca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Shortcuts when date filter is active */}
        {params.startTime !== null && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
            {[
              { label: '-1g', delta: -1 },
              { label: '+1g', delta: 1 },
              { label: '-1s', delta: -7 },
              { label: '+1s', delta: 7 },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => shiftDateRange(s.delta)}
                className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Filter & Sort Actions */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          <button
            type="button"
            onClick={() => setDateModalOpen(true)}
            className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 flex items-center gap-1 border-neutral-200 dark:border-neutral-700 cursor-pointer"
            style={
              params.startTime !== null
                ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--tmw-accent-soft)' }
                : undefined
            }
          >
            <Calendar className="w-3 h-3" />
            <span>
              {params.startTime !== null
                ? `${new Date(params.startTime).toLocaleDateString('it-IT')} - ${new Date(
                    params.endTime || Date.now(),
                  ).toLocaleDateString('it-IT')}`
                : 'Intervallo date'}
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
            className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 border-neutral-200 dark:border-neutral-700 cursor-pointer"
            style={
              params.sorted
                ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--tmw-accent-soft)' }
                : undefined
            }
          >
            Più recenti
          </button>

          <button
            type="button"
            onClick={() => setParams((p) => ({ ...p, exactMatch: !p.exactMatch, page: 0 }))}
            className="px-2.5 py-1 rounded border whitespace-nowrap shrink-0 border-neutral-200 dark:border-neutral-700 cursor-pointer"
            style={
              params.exactMatch
                ? { borderColor: accentHex, color: accentHex, backgroundColor: 'var(--tmw-accent-soft)' }
                : undefined
            }
          >
            Solo nel titolo
          </button>

          {QUICK_RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => applyQuickRange(r.days)}
              className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && visibleResults.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-500">Ricerca in corso...</div>
        )}
        {!loading && hasSearched && allMatches.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-400">
            Nessun articolo trovato.
          </div>
        )}
        {!hasSearched && allMatches.length === 0 && (
          <div className="py-16 px-6 text-center text-sm text-neutral-400">
            Cerca per titolo, testo o fonte tra tutti gli articoli caricati e salvati offline.
          </div>
        )}

        {hasSearched && allMatches.length > 0 && (
          <div className="px-3.5 py-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/70 dark:border-neutral-800/80 tabular-nums">
            {allMatches.length} {allMatches.length === 1 ? 'articolo trovato' : 'articoli trovati'}
          </div>
        )}

        {visibleResults.map((item) => (
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

        {hasMore && (
          <div className="py-4 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
              className="px-4 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              style={{ color: accentHex }}
            >
              Carica altri risultati
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
            <h4 className="text-sm font-semibold">Intervallo date personalizzato</h4>
            <div className="space-y-2 text-xs">
              <label className="block">
                <span className="text-neutral-500">Da</span>
                <input
                  type="date"
                  value={
                    params.startTime
                      ? new Date(params.startTime).toISOString().slice(0, 10)
                      : ''
                  }
                  onChange={(e) => {
                    const ms = e.target.value ? Date.parse(`${e.target.value}T00:00:00`) : null;
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
                <span className="text-neutral-500">A</span>
                <input
                  type="date"
                  value={
                    params.endTime
                      ? new Date(params.endTime).toISOString().slice(0, 10)
                      : ''
                  }
                  onChange={(e) => {
                    const ms = e.target.value ? Date.parse(`${e.target.value}T23:59:59`) : null;
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
                className="px-3 py-1.5 rounded text-white font-medium cursor-pointer"
                style={{ backgroundColor: accentHex }}
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
