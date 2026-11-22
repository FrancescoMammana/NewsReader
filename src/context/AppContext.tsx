import React, { useCallback, useMemo } from 'react';
import type { Item, ItemScreenArgs, PodcastEpisode, Preferences, Story, StoryType, ToastMessage } from '../types/tmw';
import { FeedsProvider, type FeedBucket, type FeedMap, EMPTY_FEED_BUCKET, useFeeds } from './FeedsContext';
import { LibraryProvider, useLibrary } from './LibraryContext';
import { NavigationProvider, useNavigation } from './NavigationContext';
import { PodcastProvider, usePodcast } from './PodcastContext';
import { PreferencesProvider, usePreferences } from './PreferencesContext';
import { ToastProvider, useToasts } from './ToastContext';

export { EMPTY_FEED_BUCKET, type FeedBucket, type FeedMap };
export { useFeeds, useLibrary, useNavigation, usePodcast, usePreferences, useToasts };

interface AppContextValue {
  preferences: Preferences;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  accentHex: string;
  isDarkActive: boolean;

  activeTab: StoryType | 'profile';
  setActiveTab: (tab: StoryType | 'profile') => void;

  // Configured feeds (TMW + RSS/Atom)
  addCustomFeed: (label: string, url: string) => Promise<boolean>;
  removeFeed: (id: string) => void;
  restoreDefaultTmwFeeds: () => void;
  getFeedLabel: (id: StoryType) => string;

  // Stories & Offline Cache
  feeds: FeedMap;
  ensureFeedLoaded: (type: StoryType) => void;
  refreshFeed: (type: StoryType) => Promise<void>;
  loadMoreFeed: (type: StoryType) => Promise<void>;
  readStoryIds: Set<number>;
  markStoryRead: (story: Story) => void;
  clearReadStories: () => void;
  offlineArticleCount: number;
  isOfflineCached: (id: number, url?: string) => boolean;
  cacheArticleOffline: (story: Story) => Promise<void>;
  clearOfflineCache: () => Promise<void>;

  // Pins, Favorites, Keywords, Blocklist
  pinnedStories: Story[];
  isPinned: (id: number) => boolean;
  togglePin: (story: Story) => void;
  unpinStory: (id: number) => void;

  favIds: number[];
  favItems: Item[];
  isFav: (id: number) => boolean;
  toggleFav: (item: Item) => void;
  removeFav: (id: number) => void;
  clearFavs: () => void;
  importFavIds: (ids: number[]) => void;

  filterKeywords: string[];
  addFilterKeyword: (kw: string) => void;
  removeFilterKeyword: (kw: string) => void;

  blocklist: string[];
  isBlocked: (author: string) => boolean;
  toggleBlockUser: (author: string) => void;

  // Navigation / Split View / Modals
  selectedItemArgs: ItemScreenArgs | null;
  itemHistoryStack: ItemScreenArgs[];
  splitViewExpanded: boolean;
  setSplitViewExpanded: (expanded: boolean) => void;
  openItem: (args: ItemScreenArgs, pushToStack?: boolean) => void;
  goBackItem: () => void;
  closeItem: () => void;

  lastReadStory: Story | null;
  dismissReminder: () => void;

  userDialogUsername: string | null;
  openUserDialog: (author: string | null) => void;

  // Toasts
  toasts: ToastMessage[];
  showToast: (
    text: string,
    opts?: { variant?: 'default' | 'error' | 'success'; actionLabel?: string; onAction?: () => void },
  ) => void;
  dismissToast: (id: number) => void;

  // AI Podcast
  podcastAvailable: boolean;
  activePodcast: PodcastEpisode | null;
  podcastGeneratingForFeed: string | null;
  generateFeedPodcast: (feedId: StoryType, forceRegenerate?: boolean) => Promise<void>;
  closePodcastPlayer: () => void;
  checkPodcastStatus: () => Promise<boolean>;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      <PreferencesProvider>
        <LibraryProvider>
          <NavigationProvider>
            <FeedsProvider>
              <PodcastProvider>{children}</PodcastProvider>
            </FeedsProvider>
          </NavigationProvider>
        </LibraryProvider>
      </PreferencesProvider>
    </ToastProvider>
  );
};

export function useApp(): AppContextValue {
  const { toasts, showToast, dismissToast } = useToasts();
  const { preferences, updatePreference, accentHex, isDarkActive } = usePreferences();
  const library = useLibrary();
  const nav = useNavigation();
  const feedsCtx = useFeeds();
  const podcast = usePodcast();

  const { importFavIds: libraryImportFavIds } = library;
  const { feedsRef } = feedsCtx;

  const importFavIds = useCallback(
    (ids: number[]) => {
      const allFeedStories = Object.values(feedsRef.current).flatMap((b) => b.stories);
      libraryImportFavIds(ids, allFeedStories);
    },
    [feedsRef, libraryImportFavIds],
  );

  return useMemo<AppContextValue>(
    () => ({
      preferences,
      updatePreference,
      accentHex,
      isDarkActive,
      activeTab: nav.activeTab,
      setActiveTab: nav.setActiveTab,
      addCustomFeed: feedsCtx.addCustomFeed,
      removeFeed: feedsCtx.removeFeed,
      restoreDefaultTmwFeeds: feedsCtx.restoreDefaultTmwFeeds,
      getFeedLabel: feedsCtx.getFeedLabel,
      feeds: feedsCtx.feeds,
      ensureFeedLoaded: feedsCtx.ensureFeedLoaded,
      refreshFeed: feedsCtx.refreshFeed,
      loadMoreFeed: feedsCtx.loadMoreFeed,
      readStoryIds: library.readStoryIds,
      markStoryRead: library.markStoryRead,
      clearReadStories: library.clearReadStories,
      offlineArticleCount: library.offlineArticleCount,
      isOfflineCached: library.isOfflineCached,
      cacheArticleOffline: library.cacheArticleOffline,
      clearOfflineCache: library.clearOfflineCache,
      pinnedStories: library.pinnedStories,
      isPinned: library.isPinned,
      togglePin: library.togglePin,
      unpinStory: library.unpinStory,
      favIds: library.favIds,
      favItems: library.favItems,
      isFav: library.isFav,
      toggleFav: library.toggleFav,
      removeFav: library.removeFav,
      clearFavs: library.clearFavs,
      importFavIds,
      filterKeywords: library.filterKeywords,
      addFilterKeyword: library.addFilterKeyword,
      removeFilterKeyword: library.removeFilterKeyword,
      blocklist: library.blocklist,
      isBlocked: library.isBlocked,
      toggleBlockUser: library.toggleBlockUser,
      selectedItemArgs: nav.selectedItemArgs,
      itemHistoryStack: nav.itemHistoryStack,
      splitViewExpanded: nav.splitViewExpanded,
      setSplitViewExpanded: nav.setSplitViewExpanded,
      openItem: nav.openItem,
      goBackItem: nav.goBackItem,
      closeItem: nav.closeItem,
      lastReadStory: library.lastReadStory,
      dismissReminder: library.dismissReminder,
      userDialogUsername: nav.userDialogUsername,
      openUserDialog: nav.openUserDialog,
      toasts,
      showToast,
      dismissToast,
      podcastAvailable: podcast.podcastAvailable,
      activePodcast: podcast.activePodcast,
      podcastGeneratingForFeed: podcast.podcastGeneratingForFeed,
      generateFeedPodcast: podcast.generateFeedPodcast,
      closePodcastPlayer: podcast.closePodcastPlayer,
      checkPodcastStatus: podcast.checkPodcastStatus,
    }),
    [
      preferences,
      updatePreference,
      accentHex,
      isDarkActive,
      nav,
      feedsCtx,
      library,
      importFavIds,
      toasts,
      showToast,
      dismissToast,
      podcast,
    ],
  );
}
