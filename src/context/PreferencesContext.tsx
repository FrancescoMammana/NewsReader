import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ACCENT_COLORS, type Preferences } from '../types/tmw';
import { storage } from '../services/storage';

export interface PreferencesContextValue {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  accentHex: string;
  isDarkActive: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(() => storage.getPreferences());

  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDarkActive =
    preferences.themeMode === 'dark' || (preferences.themeMode === 'system' && systemDark);

  const accentHex = useMemo(() => {
    return ACCENT_COLORS.find((c) => c.id === preferences.appColorId)?.hex ?? '#FF5722';
  }, [preferences.appColorId]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkActive) {
      root.classList.add('dark');
      root.style.backgroundColor = preferences.isTrueDarkModeEnabled ? '#000000' : '#0a0a0a';
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#ffffff';
    }
    root.style.setProperty('--tmw-accent', accentHex);
    root.style.setProperty('--tmw-accent-soft', `${accentHex}24`);

    const cleanHex = accentHex.replace(/^#/, '').toUpperCase();
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', `#${cleanHex}`);
    }
    const statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusMeta) {
      statusMeta.setAttribute('content', isDarkActive ? 'black-translucent' : 'default');
    }

    const iconLink = document.querySelector('link[rel="icon"]');
    if (iconLink) {
      iconLink.setAttribute('href', `/api/pwa/icon.png?color=${cleanHex}&size=192`);
    }
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleIcon) {
      appleIcon.setAttribute('href', `/api/pwa/icon.png?color=${cleanHex}&size=180`);
    }

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute(
      'href',
      `/api/pwa/manifest.webmanifest?color=${cleanHex}&dark=${isDarkActive ? '1' : '0'}`,
    );
  }, [isDarkActive, accentHex, preferences.isTrueDarkModeEnabled]);

  const updatePreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      storage.savePreferences(next);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreferences,
      updatePreference,
      accentHex,
      isDarkActive,
    }),
    [preferences, updatePreference, accentHex, isDarkActive],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
