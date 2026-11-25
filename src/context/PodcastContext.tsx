import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AiRuntimeOverrides,
  AiSettingsPayload,
  AiSettingsState,
  PodcastEpisode,
  Story,
  StoryType,
} from '../types/tmw';
import {
  fetchAiSettings,
  fetchPodcastStatus,
  fetchTmwArticle,
  generatePodcastAudioApi,
  generatePodcastScriptApi,
  resetAiSettingsApi,
  saveAiSettingsApi,
} from '../services/tmwApi';
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
  podcastGeneratingStage: 'script' | 'audio' | null;
  podcastError: string | null;
  dismissPodcastError: () => void;
  aiSettings: AiSettingsPayload | null;
  activeAiOverrides: AiRuntimeOverrides | undefined;
  refreshAiSettings: () => Promise<AiSettingsPayload | null>;
  saveAiSettings: (patch: AiRuntimeOverrides) => Promise<AiSettingsPayload>;
  resetAiSettings: () => Promise<AiSettingsPayload>;
  generateFeedPodcast: (feedId: StoryType, forceRegenerate?: boolean) => Promise<void>;
  closePodcastPlayer: () => void;
  checkPodcastStatus: () => Promise<boolean>;
}

const PodcastContext = createContext<PodcastContextValue | null>(null);

function extractCustomOverridesFromState(
  providerKind: AiSettingsPayload['providerKind'],
  stored: AiSettingsState | null,
): AiRuntimeOverrides | undefined {
  if (!providerKind || !stored) return undefined;
  if (providerKind === 'gemini') {
    const profile = stored.gemini;
    if (!profile || profile.customizedFields.length === 0) return undefined;
    const out: AiRuntimeOverrides = {};
    for (const key of profile.customizedFields) {
      if (key === 'textModel' || key === 'audioModel' || key === 'voice') {
        if (profile[key]?.trim()) out[key] = profile[key].trim();
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  const profile = stored.openai;
  if (!profile || profile.customizedFields.length === 0) return undefined;
  const out: AiRuntimeOverrides = {};
  for (const key of profile.customizedFields) {
    if (
      key === 'textModel' ||
      key === 'audioModel' ||
      key === 'voice' ||
      key === 'baseUrl' ||
      key === 'audioFormat'
    ) {
      if (profile[key]?.trim()) out[key] = profile[key].trim();
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

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
  const [aiSettings, setAiSettings] = useState<AiSettingsPayload | null>(null);
  const [podcastError, setPodcastError] = useState<string | null>(null);
  const [activePodcast, setActivePodcast] = useState<PodcastEpisode | null>(null);
  const [podcastGeneratingForFeed, setPodcastGeneratingForFeed] = useState<string | null>(null);
  const [podcastGeneratingStage, setPodcastGeneratingStage] = useState<'script' | 'audio' | null>(
    null,
  );
  const podcastBusyRef = useRef(false);

  const applyServerPayload = useCallback((payload: AiSettingsPayload) => {
    setAiSettings(payload);
    storage.saveAiSettings(payload.stored);
    setPodcastAvailable(payload.available);
    storage.savePodcastAvailable(payload.available);
  }, []);

  const refreshAiSettings = useCallback(async (): Promise<AiSettingsPayload | null> => {
    try {
      const serverPayload = await fetchAiSettings();
      const localStored = storage.getAiSettings();
      const serverCustomCount = serverPayload.effective?.customizedFields?.length ?? 0;
      const localPatch =
        serverCustomCount === 0
          ? extractCustomOverridesFromState(serverPayload.providerKind, localStored)
          : undefined;

      if (localPatch) {
        const synced = await saveAiSettingsApi(localPatch);
        applyServerPayload(synced);
        return synced;
      }

      applyServerPayload(serverPayload);
      return serverPayload;
    } catch {
      return null;
    }
  }, [applyServerPayload]);

  const checkPodcastStatus = useCallback(async (): Promise<boolean> => {
    const payload = await refreshAiSettings();
    if (payload) return payload.available;
    try {
      const available = await fetchPodcastStatus();
      setPodcastAvailable(available);
      storage.savePodcastAvailable(available);
      return available;
    } catch {
      return storage.getPodcastAvailable() ?? false;
    }
  }, [refreshAiSettings]);

  const saveAiSettings = useCallback(
    async (patch: AiRuntimeOverrides): Promise<AiSettingsPayload> => {
      const updated = await saveAiSettingsApi(patch);
      applyServerPayload(updated);
      setPodcastError(null);
      return updated;
    },
    [applyServerPayload],
  );

  const resetAiSettings = useCallback(async (): Promise<AiSettingsPayload> => {
    const updated = await resetAiSettingsApi();
    applyServerPayload(updated);
    setPodcastError(null);
    return updated;
  }, [applyServerPayload]);

  useEffect(() => {
    let active = true;

    const runSync = async () => {
      const payload = await refreshAiSettings();
      if (!active || payload) return;
      try {
        const available = await fetchPodcastStatus();
        if (active) {
          setPodcastAvailable(available);
          storage.savePodcastAvailable(available);
        }
      } catch {
        // Keep cached status when offline
      }
    };

    void runSync();

    const timer1 = setTimeout(() => {
      if (active) void runSync();
    }, 2500);

    const timer2 = setTimeout(() => {
      if (active) void runSync();
    }, 6000);

    const handleRecheck = () => {
      if (document.visibilityState === 'visible' || navigator.onLine) {
        void runSync();
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
  }, [refreshAiSettings]);

  const activeAiOverrides = useMemo<AiRuntimeOverrides | undefined>(() => {
    const providerKind = aiSettings?.providerKind ?? null;
    if (!providerKind) return undefined;
    return extractCustomOverridesFromState(providerKind, aiSettings?.stored ?? storage.getAiSettings());
  }, [aiSettings]);

  const closePodcastPlayer = useCallback(() => {
    setActivePodcast(null);
  }, []);

  const dismissPodcastError = useCallback(() => {
    setPodcastError(null);
  }, []);

  const generateFeedPodcast = useCallback(
    async (feedId: StoryType, forceRegenerate = false) => {
      if (!podcastAvailable || podcastBusyRef.current) return;

      const bucket = feedsRef.current[feedId];
      const targetStories = (bucket?.stories ?? []).filter((s) => !s.hidden).slice(0, 10);
      if (targetStories.length === 0) {
        const msg = 'Nessun articolo disponibile in questa sezione per il podcast.';
        setPodcastError(msg);
        showToast(msg, { variant: 'error' });
        return;
      }

      const storiesSignature = targetStories.map((s) => s.id).join(',');
      if (!forceRegenerate) {
        const cached = await offlineDb.getPodcast(feedId);
        if (cached && cached.storiesSignature === storiesSignature && cached.audioBlob) {
          setPodcastError(null);
          setActivePodcast(cached);
          return;
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const msg = 'Connessione assente: impossibile generare un nuovo podcast AI.';
        setPodcastError(msg);
        showToast(msg, { variant: 'error' });
        return;
      }

      podcastBusyRef.current = true;
      setPodcastError(null);
      setPodcastGeneratingForFeed(feedId);
      setPodcastGeneratingStage('script');

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

        const scriptPayload = await generatePodcastScriptApi(
          feedLabel,
          payloadArticles,
          activeAiOverrides,
        );
        setPodcastGeneratingStage('audio');
        const { audioBlob } = await generatePodcastAudioApi(
          scriptPayload.script,
          activeAiOverrides,
        );

        const episode: PodcastEpisode = {
          feedId,
          feedLabel,
          episodeTitle: scriptPayload.episodeTitle,
          script: scriptPayload.script,
          segments: scriptPayload.segments,
          storiesSignature,
          audioBlob,
          generatedAt: Date.now(),
        };

        await offlineDb.savePodcast(episode);
        setPodcastError(null);
        setActivePodcast(episode);
        showToast('Podcast in italiano pronto!', { variant: 'success' });
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Errore nella creazione del podcast AI.';
        setPodcastError(msg);
        showToast(msg, { variant: 'error' });
      } finally {
        podcastBusyRef.current = false;
        setPodcastGeneratingForFeed(null);
        setPodcastGeneratingStage(null);
      }
    },
    [activeAiOverrides, favIdSetRef, feedsRef, podcastAvailable, refreshOfflineIds, showToast],
  );

  const value = useMemo<PodcastContextValue>(
    () => ({
      podcastAvailable,
      activePodcast,
      podcastGeneratingForFeed,
      podcastGeneratingStage,
      podcastError,
      dismissPodcastError,
      aiSettings,
      activeAiOverrides,
      refreshAiSettings,
      saveAiSettings,
      resetAiSettings,
      generateFeedPodcast,
      closePodcastPlayer,
      checkPodcastStatus,
    }),
    [
      podcastAvailable,
      activePodcast,
      podcastGeneratingForFeed,
      podcastGeneratingStage,
      podcastError,
      dismissPodcastError,
      aiSettings,
      activeAiOverrides,
      refreshAiSettings,
      saveAiSettings,
      resetAiSettings,
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
