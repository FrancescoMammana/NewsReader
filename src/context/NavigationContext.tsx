import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ItemScreenArgs, Story, StoryType } from '../types/tmw';
import { useLibrary } from './LibraryContext';
import { usePreferences } from './PreferencesContext';

const ACTIVE_TAB_SESSION_KEY = 'newsreader_active_tab_v1';

export interface NavigationContextValue {
  activeTab: StoryType | 'profile';
  setActiveTab: React.Dispatch<React.SetStateAction<StoryType | 'profile'>>;
  selectedItemArgs: ItemScreenArgs | null;
  itemHistoryStack: ItemScreenArgs[];
  splitViewExpanded: boolean;
  setSplitViewExpanded: (expanded: boolean) => void;
  openItem: (args: ItemScreenArgs, pushToStack?: boolean) => void;
  goBackItem: () => void;
  closeItem: () => void;
  userDialogUsername: string | null;
  openUserDialog: (author: string | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences } = usePreferences();
  const { markStoryRead, recordLastReadStory } = useLibrary();

  const [activeTab, setActiveTab] = useState<StoryType | 'profile'>(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_TAB_SESSION_KEY);
      if (
        saved &&
        (saved === 'profile' ||
          saved === 'favorites' ||
          saved === 'search' ||
          preferences.tabOrder.includes(saved))
      ) {
        return saved;
      }
    } catch {
      // Ignore sessionStorage errors
    }
    return preferences.tabOrder[0] || 'profile';
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_TAB_SESSION_KEY, activeTab);
    } catch {
      // Ignore sessionStorage errors
    }
  }, [activeTab]);

  const [itemHistoryStack, setItemHistoryStack] = useState<ItemScreenArgs[]>([]);
  const [splitViewExpanded, setSplitViewExpanded] = useState(false);
  const [userDialogUsername, setUserDialogUsername] = useState<string | null>(null);

  const selectedItemArgs =
    itemHistoryStack.length > 0 ? itemHistoryStack[itemHistoryStack.length - 1] : null;

  // Sincronizzazione con la history del browser per il tasto indietro nativo (Android / PWA)
  useEffect(() => {
    const handlePopState = () => {
      if (itemHistoryStack.length > 0) {
        setItemHistoryStack((prev) => prev.slice(0, -1));
        setSplitViewExpanded(false);
      } else if (
        activeTab === 'profile' ||
        activeTab === 'favorites' ||
        activeTab === 'search'
      ) {
        setActiveTab(preferences.tabOrder[0] || 'latest');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [itemHistoryStack.length, activeTab, preferences.tabOrder]);

  const openItem = useCallback(
    (args: ItemScreenArgs, pushToStack = false) => {
      window.history.pushState({ readerState: 'item' }, '');
      setItemHistoryStack((prev) => (pushToStack ? [...prev, args] : [args]));
      if (args.item.type !== 'comment') {
        const story = args.item as Story;
        recordLastReadStory(story);
        if (preferences.isMarkReadStoriesEnabled && preferences.storyMarkingMode === 'tap') {
          markStoryRead(story);
        }
      }
    },
    [
      preferences.isMarkReadStoriesEnabled,
      preferences.storyMarkingMode,
      markStoryRead,
      recordLastReadStory,
    ],
  );

  const goBackItem = useCallback(() => {
    if (window.history.state) {
      window.history.back();
    } else {
      setItemHistoryStack((prev) => prev.slice(0, -1));
    }
  }, []);

  const closeItem = useCallback(() => {
    if (itemHistoryStack.length > 0 && window.history.state) {
      window.history.back();
    } else {
      setItemHistoryStack([]);
      setSplitViewExpanded(false);
    }
  }, [itemHistoryStack.length]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      selectedItemArgs,
      itemHistoryStack,
      splitViewExpanded,
      setSplitViewExpanded,
      openItem,
      goBackItem,
      closeItem,
      userDialogUsername,
      openUserDialog: setUserDialogUsername,
    }),
    [
      activeTab,
      selectedItemArgs,
      itemHistoryStack,
      splitViewExpanded,
      openItem,
      goBackItem,
      closeItem,
      userDialogUsername,
    ],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside NavigationProvider');
  return ctx;
}
