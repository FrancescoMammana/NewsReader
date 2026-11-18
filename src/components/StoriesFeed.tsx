import React, { useEffect, useRef } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import type { Story, StoryType } from '../types/hn';
import { useApp } from '../context/AppContext';
import { StoryTile } from './StoryTile';

interface StoriesFeedProps {
  storyType: StoryType;
}

export const StoriesFeed: React.FC<StoriesFeedProps> = ({ storyType }) => {
  const {
    preferences,
    accentHex,
    feeds,
    ensureFeedLoaded,
    refreshFeed,
    loadMoreFeed,
    pinnedStories,
    unpinStory,
    readStoryIds,
    markStoryRead,
    selectedItemArgs,
    openItem,
    isOfflineReading,
    toggleOfflineMode,
    offlineProgress,
    downloadForOffline,
  } = useApp();

  const bucket = feeds[storyType];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureFeedLoaded(storyType);
  }, [storyType, ensureFeedLoaded]);

  const handleStoryTap = (story: Story) => {
    openItem({
      item: story,
      shouldMarkNewComment: preferences.isMarkReadStoriesEnabled && readStoryIds.has(story.id),
    });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (
      !preferences.isManualPaginationEnabled &&
      !bucket.loadingMore &&
      !bucket.loading &&
      bucket.nextStart !== null &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 280
    ) {
      void loadMoreFeed(storyType);
    }
  };

  const visibleCount = bucket.stories.filter((s) => !s.hidden).length;

  return (
    <div className="flex flex-col h-full">
      {isOfflineReading && (
        <div className="px-3.5 py-1.5 bg-neutral-900 text-white dark:bg-neutral-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Modalità Offline attiva</span>
          </div>
          <button
            type="button"
            onClick={() => toggleOfflineMode(false)}
            className="underline hover:opacity-80"
          >
            Torna Online
          </button>
        </div>
      )}

      {/* Feed Action Bar */}
      <div className="px-3.5 py-1.5 border-b border-neutral-200/70 dark:border-neutral-800/80 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span className="tabular-nums truncate">{visibleCount} articoli</span>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={offlineProgress.active}
            onClick={() => void downloadForOffline()}
            title="Scarica articoli per lettura offline"
            className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {offlineProgress.active
                ? `${offlineProgress.current}/${offlineProgress.total}`
                : 'Salva offline'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleOfflineMode(!isOfflineReading)}
            title={isOfflineReading ? 'Torna online' : 'Attiva lettura offline'}
            className={`flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 ${
              isOfflineReading ? 'font-semibold' : ''
            }`}
            style={isOfflineReading ? { color: accentHex } : undefined}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
          </button>
          <button
            type="button"
            onClick={() => void refreshFeed(storyType)}
            className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"
            style={{ color: accentHex }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${bucket.loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {/* Pinned Stories */}
        {pinnedStories.length > 0 && (
          <div className="border-b-2" style={{ borderBottomColor: accentHex }}>
            {pinnedStories.map((story) => (
              <div key={`pin-${story.id}`} className="relative">
                <StoryTile
                  story={story}
                  onTap={() => handleStoryTap(story)}
                  isPinnedTile
                  isSelected={selectedItemArgs?.item.id === story.id}
                  hasRead={preferences.isMarkReadStoriesEnabled && readStoryIds.has(story.id)}
                  showWebPreview={preferences.isComplexStoryTileEnabled}
                  showMetadata={preferences.isMetadataEnabled}
                  showFavicon={preferences.isFaviconEnabled}
                  showUrl={preferences.isUrlEnabled}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinStory(story.id);
                  }}
                  title="Unpin"
                  className="absolute right-2 bottom-2 p-1 rounded bg-white/80 dark:bg-neutral-900/80 text-neutral-500 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Loading / Error / Empty */}
        {bucket.loading && bucket.stories.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-500">
            Caricamento articoli...
          </div>
        )}

        {bucket.error && bucket.stories.length === 0 && (
          <div className="py-16 px-6 text-center space-y-3">
            <p className="text-sm text-neutral-500">{bucket.error}</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void refreshFeed(storyType)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: accentHex }}
              >
                Riprova
              </button>
              {!isOfflineReading && (
                <button
                  type="button"
                  onClick={() => toggleOfflineMode(true)}
                  className="px-4 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
                >
                  Modalità Offline
                </button>
              )}
            </div>
          </div>
        )}

        {!bucket.loading && !bucket.error && isOfflineReading && bucket.stories.length === 0 && (
          <div className="py-16 px-6 text-center space-y-3">
            <p className="text-sm text-neutral-500">
              Nessun articolo salvato offline per questa sezione.
            </p>
            <button
              type="button"
              onClick={() => toggleOfflineMode(false)}
              className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
              style={{ backgroundColor: accentHex }}
            >
              Torna online e scarica
            </button>
          </div>
        )}

        {/* Feed Stories */}
        {bucket.stories.map((story) => (
          <StoryTile
            key={story.id}
            story={story}
            onTap={() => handleStoryTap(story)}
            onScrollSeen={
              preferences.isMarkReadStoriesEnabled && preferences.storyMarkingMode === 'scroll'
                ? () => markStoryRead(story)
                : undefined
            }
            isSelected={selectedItemArgs?.item.id === story.id}
            hasRead={preferences.isMarkReadStoriesEnabled && readStoryIds.has(story.id)}
            showWebPreview={preferences.isComplexStoryTileEnabled}
            showMetadata={preferences.isMetadataEnabled}
            showFavicon={preferences.isFaviconEnabled}
            showUrl={preferences.isUrlEnabled}
          />
        ))}

        {/* Pagination */}
        {bucket.stories.length > 0 && bucket.nextStart !== null && !isOfflineReading && (
          <div className="py-5 text-center">
            <button
              type="button"
              disabled={bucket.loadingMore}
              onClick={() => void loadMoreFeed(storyType)}
              className="px-4 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900"
              style={{ color: accentHex }}
            >
              {bucket.loadingMore ? 'Loading more...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
