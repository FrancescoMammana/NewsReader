import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Globe,
  Heart,
  MoreHorizontal,
  Pin,
  PinOff,
  Share2,
} from 'lucide-react';
import type { Story } from '../types/hn';
import { useApp } from '../context/AppContext';
import { getFaviconUrl, getReadableUrl, getStoryMetadata } from '../utils/formatting';
import { LinkPreview } from './LinkPreview';

interface StoryTileProps {
  story: Story;
  onTap: () => void;
  onScrollSeen?: () => void;
  hasRead?: boolean;
  isSelected?: boolean;
  isPinnedTile?: boolean;
  showWebPreview: boolean;
  showMetadata: boolean;
  showFavicon: boolean;
  showUrl: boolean;
  disableActions?: boolean;
}

export const StoryTile: React.FC<StoryTileProps> = ({
  story,
  onTap,
  onScrollSeen,
  hasRead = false,
  isSelected = false,
  isPinnedTile = false,
  showWebPreview,
  showMetadata,
  showFavicon,
  showUrl,
  disableActions = false,
}) => {
  const {
    isOfflineReading,
    isPinned,
    togglePin,
    isFav,
    toggleFav,
    showToast,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [faviconErr, setFaviconErr] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!onScrollSeen || hasRead || story.hidden) return;
    const el = articleRef.current;
    if (!el) return;
    let seen = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            seen = true;
          } else if (seen && entry.boundingClientRect.top < 120) {
            onScrollSeen();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onScrollSeen, hasRead, story.hidden]);

  if (story.hidden) return null;

  const domain = getReadableUrl(story.url);
  const pinned = isPinned(story.id);
  const faved = isFav(story.id);
  const faviconUrl = story.url ? getFaviconUrl(story.url, 32) : '';

  const handleCopyShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = story.url || 'https://www.tuttomercatoweb.com';
    void navigator.clipboard.writeText(link);
    showToast('Link copied to clipboard');
    setMenuOpen(false);
  };

  return (
    <article
      ref={articleRef}
      onClick={onTap}
      className={`group relative px-3.5 py-3 cursor-pointer transition-colors border-b border-neutral-200/70 dark:border-neutral-800/80 ${
        isSelected
          ? 'bg-neutral-100/90 dark:bg-neutral-800/70'
          : isPinnedTile
            ? ''
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
      }`}
      style={
        isPinnedTile
          ? { backgroundColor: 'var(--hacki-accent-soft)' }
          : undefined
      }
    >
      <div className="flex items-start gap-2.5">
        {!showWebPreview && showFavicon && (
          <div className="w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center">
            {story.url && faviconUrl && !faviconErr ? (
              <img
                src={faviconUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFaviconErr(true)}
                className="w-4 h-4 object-contain rounded-xs"
              />
            ) : (
              <Globe className="w-4 h-4 text-neutral-400" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-[15px] leading-snug ${
                hasRead
                  ? 'font-normal text-neutral-500 dark:text-neutral-500'
                  : 'font-semibold text-neutral-900 dark:text-neutral-100'
              }`}
            >
              <span>{story.title}</span>
              {showUrl && domain && (
                <span className="ml-1.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  ({domain})
                </span>
              )}
            </h3>

            {!disableActions && (
              <div
                className="relative shrink-0 flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {story.url && (
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open on TuttoMercatoWeb"
                    className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Article actions"
                  className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          togglePin(story);
                          setMenuOpen(false);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                      >
                        {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        <span>{pinned ? 'Unpin' : 'Pin to top'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          toggleFav(story);
                          setMenuOpen(false);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                      >
                        <Heart className={`w-4 h-4 ${faved ? 'fill-current text-red-500' : ''}`} />
                        <span>{faved ? 'Unfavorite' : 'Favorite'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyShare}
                        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Copy link</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {showMetadata && (
            <p
              className={`mt-1 text-xs tabular-nums ${
                hasRead
                  ? 'text-neutral-400 dark:text-neutral-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {getStoryMetadata(story)}
            </p>
          )}

          {showWebPreview && (
            <LinkPreview
              story={story}
              isOfflineReading={isOfflineReading}
              hasRead={hasRead}
              onOpenThread={onTap}
            />
          )}
        </div>
      </div>
    </article>
  );
};
