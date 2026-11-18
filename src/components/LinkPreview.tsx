import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import type { Story, WebPreviewInfo } from '../types/tmw';
import { fetchLinkPreview } from '../services/tmwApi';
import { storage } from '../services/storage';
import { getFaviconUrl } from '../utils/formatting';

interface LinkPreviewProps {
  story: Story;
  isOfflineReading: boolean;
  hasRead: boolean;
  onOpenThread: () => void;
}

const memoryPreviewCache = new Map<string, WebPreviewInfo>();

export const LinkPreview: React.FC<LinkPreviewProps> = ({
  story,
  isOfflineReading,
  hasRead,
  onOpenThread,
}) => {
  const cacheKey = story.url || String(story.id);
  const [info, setInfo] = useState<WebPreviewInfo | null>(() => {
    if (story.image && story.text) {
      return { title: story.title, description: story.text, image: story.image };
    }
    if (memoryPreviewCache.has(cacheKey)) {
      return memoryPreviewCache.get(cacheKey)!;
    }
    const stored = storage.getPreviewCache()[cacheKey];
    if (stored) {
      memoryPreviewCache.set(cacheKey, stored);
      return stored;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !info);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (info) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      if (isOfflineReading) {
        const offlineArt = storage.getOfflineArticles()[String(story.id)];
        const res: WebPreviewInfo = {
          title: story.title,
          description: offlineArt?.subtitle || offlineArt?.text || story.text || 'Offline cached article',
          image: offlineArt?.image || story.image,
        };
        if (!cancelled) {
          setInfo(res);
          setLoading(false);
        }
        return;
      }

      const webInfo = story.url ? await fetchLinkPreview(story.url) : {};
      const finalInfo: WebPreviewInfo = {
        title: webInfo.title || story.title,
        description: story.text || webInfo.description || story.category || 'TUTTOmercatoWEB',
        image: story.image || webInfo.image,
        icon: webInfo.icon,
      };

      if (!cancelled) {
        memoryPreviewCache.set(cacheKey, finalInfo);
        const disk = storage.getPreviewCache();
        disk[cacheKey] = finalInfo;
        storage.savePreviewCache(disk);
        setInfo(finalInfo);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, info, isOfflineReading, story]);

  if (loading) {
    return (
      <div className="mt-2 flex gap-3 items-start animate-pulse">
        <div
          className="w-16 h-16 shrink-0 rounded"
          style={{ backgroundColor: 'var(--tmw-accent-soft)' }}
        />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-2.5 rounded w-full" style={{ backgroundColor: 'var(--tmw-accent-soft)' }} />
          <div className="h-2.5 rounded w-5/6" style={{ backgroundColor: 'var(--tmw-accent-soft)' }} />
          <div className="h-2.5 rounded w-2/3" style={{ backgroundColor: 'var(--tmw-accent-soft)' }} />
        </div>
      </div>
    );
  }

  const favicon = story.url ? getFaviconUrl(story.url, 64) : '';
  const thumbSrc = !imgFailed && (info?.image || story.image) ? info?.image || story.image : '';

  return (
    <div className="mt-2 flex gap-3 items-start">
      <a
        href={story.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          if (!story.url) {
            e.preventDefault();
            onOpenThread();
          }
        }}
        className="w-16 h-16 shrink-0 rounded overflow-hidden flex items-center justify-center bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-200/70 dark:border-neutral-800"
        title={story.url ? `Open ${story.url}` : 'Read article'}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={story.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : favicon ? (
          <img
            src={favicon}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            className="w-6 h-6 object-contain"
          />
        ) : (
          <Globe className="w-5 h-5 text-neutral-400" />
        )}
      </a>

      <div
        onClick={onOpenThread}
        className={`flex-1 min-w-0 text-xs leading-relaxed line-clamp-3 cursor-pointer ${
          hasRead
            ? 'text-neutral-400 dark:text-neutral-500'
            : 'text-neutral-600 dark:text-neutral-300'
        }`}
      >
        {info?.description || story.text}
      </div>
    </div>
  );
};
