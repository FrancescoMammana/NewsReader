import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Loader2, RefreshCw, WifiOff, X } from 'lucide-react';
import type { Story, StoryType } from '../types/tmw';
import { EMPTY_FEED_BUCKET, useApp } from '../context/AppContext';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { StoryTile } from './StoryTile';

interface StoriesFeedProps {
  storyType: StoryType;
}

const PULL_THRESHOLD_PX = 56;

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
    podcastAvailable,
    podcastGeneratingForFeed,
    generateFeedPodcast,
  } = useApp();
  const isOnline = useOnlineStatus();
  const isGeneratingThisPodcast = podcastGeneratingForFeed === storyType;
  const isAnyPodcastGenerating = podcastGeneratingForFeed !== null;

  const bucket = feeds[storyType] ?? EMPTY_FEED_BUCKET;
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    setPullDistance(0);
    touchStartYRef.current = null;
    ensureFeedLoaded(storyType);
  }, [storyType, ensureFeedLoaded]);

  const handleStoryTap = (story: Story) => {
    openItem({ item: story });
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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0 || bucket.loading || e.touches.length !== 1) {
      touchStartYRef.current = null;
      return;
    }
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || e.touches.length !== 1) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) {
      touchStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - touchStartYRef.current;
    if (delta > 0) {
      setPullDistance(Math.min(84, delta * 0.5));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartYRef.current === null) return;
    const shouldRefresh = pullDistance >= PULL_THRESHOLD_PX;
    touchStartYRef.current = null;
    setPullDistance(0);
    if (shouldRefresh && !bucket.loading) {
      void refreshFeed(storyType);
    }
  };

  const visibleCount = bucket.stories.filter((s) => !s.hidden).length;

  return (
    <div className="flex flex-col h-full">
      {!isOnline && (
        <div className="px-3.5 py-1.5 bg-neutral-900 text-white dark:bg-neutral-800 text-xs flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Connessione assente — lettura articoli salvati offline</span>
        </div>
      )}

      {/* Feed Action Bar */}
      <div className="px-3.5 py-1.5 border-b border-neutral-200/70 dark:border-neutral-800/80 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span className="tabular-nums truncate">{visibleCount} articoli</span>
        <div className="flex items-center gap-3 shrink-0">
          {podcastAvailable && (
            <button
              type="button"
              disabled={isAnyPodcastGenerating || visibleCount === 0}
              onClick={() => void generateFeedPodcast(storyType)}
              title="Ascolta il podcast AI in italiano degli ultimi 15 articoli"
              className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 font-medium"
              style={{ color: accentHex }}
            >
              {isGeneratingThisPodcast ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Headphones className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingThisPodcast ? 'Creazione...' : 'Podcast'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void refreshFeed(storyType)}
            className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer shrink-0"
            style={{ color: accentHex }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${bucket.loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="flex-1 overflow-y-auto overscroll-y-contain"
      >
        {pullDistance > 8 && (
          <div
            className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 overflow-hidden transition-[height] duration-75"
            style={{ height: `${Math.round(pullDistance)}px` }}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform ${
                pullDistance >= PULL_THRESHOLD_PX ? 'rotate-180' : ''
              }`}
              style={{ color: accentHex }}
            />
            <span>
              {pullDistance >= PULL_THRESHOLD_PX
                ? 'Rilascia per aggiornare'
                : 'Trascina per aggiornare'}
            </span>
          </div>
        )}
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
            <button
              type="button"
              onClick={() => void refreshFeed(storyType)}
              className="px-4 py-1.5 rounded-lg text-white text-xs font-medium cursor-pointer"
              style={{ backgroundColor: accentHex }}
            >
              Riprova
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
        {bucket.stories.length > 0 && bucket.nextStart !== null && isOnline && (
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
