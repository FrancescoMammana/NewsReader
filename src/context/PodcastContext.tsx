import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PodcastEpisode, Story, StoryType } from '../types/tmw';
import { fetchPodcastStatus, fetchTmwArticle, generatePodcastApi } from '../services/tmwApi';
import { offlineDb } from '../services/offlineDb';
import { storage } from '../services/storage';
import { mergeFullArticle } from '../utils/articleMerge';
import { useFeeds } from './FeedsContext';
import { useLibrary } from './LibraryContext';
import { usePreferences } from './PreferencesContext';
import { useToasts } from './ToastContext';

export interface PodcastContextValue {
  podcastAvailable: boolean;
  activePodcast: PodcastEpisode | null;
  podcastGeneratingForFeed: string | null;
  generateFeedPodcast: (feedId: StoryType, forceRegenerate?: boolean) => Promise<void>;
  closePodcastPlayer: () => void;
  checkPodcastStatus: () => Promise<boolean>;
}

const PodcastContext = createContext<PodcastContextValue | null>(null);

export const PodcastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences } = usePreferences();
  const { showToast } = useToasts();
  const { favIdSetRef, refreshOfflineIds } = useLibrary();
  const { feedsRef } = useFeeds();

  const configuredFeedsRef = useRef(preferences.configuredFeeds);
  configuredFeedsRef.current = preferences.configuredFeeds;

  const [podcastAvailable, setPodcastAvailable] = useState<boolean>(() => {
    return storage.getPodcastAvailable() ?? false;
  });
  const [activePodcast, setActivePodcast] = useState<PodcastEpisode | null>(null);
  const [podcastGeneratingForFeed, setPodcastGeneratingForFeed] = useState<string | null>(null);
  const podcastBusyRef = useRef(false);

  const checkPodcastStatus = useCallback(async (): Promise<boolean> => {
    try {
      const available = await fetchPodcastStatus();
      setPodcastAvailable(available);
      storage.savePodcastAvailable(available);
      return available;
    } catch {
      // Keep last known state on transient network failure or offline
      return storage.getPodcastAvailable() ?? false;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const runCheck = async () => {
      try {
        const available = await fetchPodcastStatus();
        if (active) {
          setPodcastAvailable(available);
          storage.savePodcastAvailable(available);
        }
      } catch {
        // Keep last known available state on network glitch
      }
    };

    void runCheck();

    // Auto-retry after 2.5s and 6s (e.g. server spin-up or network reconnect)
    const timer1 = setTimeout(() => {
      if (active) void runCheck();
    }, 2500);

    const timer2 = setTimeout(() => {
      if (active) void runCheck();
    }, 6000);

    // Re-verify on user return, tab visibility, or when device reconnects
    const handleRecheck = () => {
      if (document.visibilityState === 'visible' || navigator.onLine) {
        void runCheck();
      }
    };

    window.addEventListener('visibilitychange', handleRecheck);
    window.addEventListener('online', handleRecheck);
    window.addEventListener('focus', handleRecheck);

    return () => {
      active = false;
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('visibilitychange', handleRecheck);
      window.removeEventListener('online', handleRecheck);
      window.removeEventListener('focus', handleRecheck);
    };
  }, []);

  const closePodcastPlayer = useCallback(() => {
    setActivePodcast(null);
  }, []);

  const generateFeedPodcast = useCallback(
    async (feedId: StoryType, forceRegenerate = false) => {
      if (!podcastAvailable || podcastBusyRef.current) return;

      const bucket = feedsRef.current[feedId];
      const targetStories = (bucket?.stories ?? []).filter((s) => !s.hidden).slice(0, 15);
      if (targetStories.length === 0) {
        showToast('Nessun articolo disponibile in questa sezione per il podcast.', {
          variant: 'error',
        });
        return;
      }

      const storiesSignature = targetStories.map((s) => s.id).join(',');
      if (!forceRegenerate) {
        const cached = await offlineDb.getPodcast(feedId);
        if (cached && cached.storiesSignature === storiesSignature && cached.audioBlob) {
          setActivePodcast(cached);
          return;
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        showToast('Connessione assente: impossibile generare un nuovo podcast AI.', {
          variant: 'error',
        });
        return;
      }

      podcastBusyRef.current = true;
      setPodcastGeneratingForFeed(feedId);

      try {
        const enrichedArticles = new Map<number, Story>();
        await Promise.all(
          targetStories.map(async (s) => {
            const cached = await offlineDb.getArticle(s.id, s.url);
            if (cached) {
              enrichedArticles.set(s.id, cached);
            }
          }),
        );

        const missingUrls = targetStories.filter((s) => {
          const cached = enrichedArticles.get(s.id);
          const bestText = cached?.text || s.text || '';
          return Boolean(s.url) && bestText.length < 180;
        });

        if (missingUrls.length > 0) {
          const queue = [...missingUrls];
          const workers = Math.min(4, queue.length);
          const fetchAllMissing = Promise.all(
            Array.from({ length: workers }, async () => {
              while (queue.length > 0) {
                const story = queue.shift();
                if (!story?.url) continue;
                const full = await fetchTmwArticle(story.url).catch(() => null);
                if (full) {
                  const merged = mergeFullArticle(story, full);
                  enrichedArticles.set(story.id, merged);
                  await offlineDb.saveArticle(merged, favIdSetRef.current);
                }
              }
            }),
          );
          await Promise.race([
            fetchAllMissing,
            new Promise<void>((resolve) => setTimeout(resolve, 4500)),
          ]);
          void refreshOfflineIds();
        }

        const feedObj = configuredFeedsRef.current.find((f) => f.id === feedId);
        const feedLabel = feedObj ? feedObj.label : feedId;
        const payloadArticles = targetStories.map((s) => {
          const full = enrichedArticles.get(s.id);
          return {
            id: s.id,
            title: full?.title || s.title,
            by: full?.by || s.by,
            category: full?.category || s.category,
            subtitle: full?.subtitle || s.subtitle,
            text: full?.text || s.text || s.subtitle || '',
          };
        });

        const generated = await generatePodcastApi(feedLabel, payloadArticles);
        const bytes = Uint8Array.from(atob(generated.audioBase64), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([bytes], { type: generated.mimeType || 'audio/wav' });

        const episode: PodcastEpisode = {
          feedId,
          feedLabel,
          episodeTitle: generated.episodeTitle,
          script: generated.script,
          segments: generated.segments,
          storiesSignature,
          audioBlob,
          generatedAt: generated.generatedAt,
        };

        await offlineDb.savePodcast(episode);
        setActivePodcast(episode);
        showToast('Podcast in italiano pronto!', { variant: 'success' });
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Errore nella creazione del podcast AI.';
        showToast(msg, { variant: 'error' });
      } finally {
        podcastBusyRef.current = false;
        setPodcastGeneratingForFeed(null);
      }
    },
    [favIdSetRef, feedsRef, podcastAvailable, refreshOfflineIds, showToast],
  );

  const value = useMemo<PodcastContextValue>(
    () => ({
      podcastAvailable,
      activePodcast,
      podcastGeneratingForFeed,
      generateFeedPodcast,
      closePodcastPlayer,
      checkPodcastStatus,
    }),
    [
      podcastAvailable,
      activePodcast,
      podcastGeneratingForFeed,
      generateFeedPodcast,
      closePodcastPlayer,
      checkPodcastStatus,
    ],
  );

  return <PodcastContext.Provider value={value}>{children}</PodcastContext.Provider>;
};

export function usePodcast(): PodcastContextValue {
  const ctx = useContext(PodcastContext);
  if (!ctx) throw new Error('usePodcast must be used inside PodcastProvider');
  return ctx;
}
