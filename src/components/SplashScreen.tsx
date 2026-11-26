import React, { useEffect, useState } from 'react';
import { ACCENT_COLORS } from '../types/tmw';
import { storage } from '../services/storage';
import { usePreferences } from '../context/AppContext';
import { LogoIcon } from './LogoIcon';

interface ThemeSnapshot {
  accentHex: string;
  isDarkActive: boolean;
  isTrueDarkModeEnabled: boolean;
}

export function readInitialThemeSnapshot(): ThemeSnapshot {
  if (typeof window === 'undefined') {
    return {
      accentHex: '#FF5722',
      isDarkActive: false,
      isTrueDarkModeEnabled: true,
    };
  }
  const prefs = storage.getPreferences();
  const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const isDarkActive =
    prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && sysDark);
  const accentHex =
    ACCENT_COLORS.find((c) => c.id === prefs.appColorId)?.hex ?? '#FF5722';

  return {
    accentHex,
    isDarkActive,
    isTrueDarkModeEnabled: prefs.isTrueDarkModeEnabled,
  };
}

export const SplashScreen: React.FC = () => {
  const { preferences, accentHex, isDarkActive } = usePreferences();
  const [initialSnapshot] = useState<ThemeSnapshot>(() => readInitialThemeSnapshot());
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const effectiveDark = isDarkActive ?? initialSnapshot.isDarkActive;
  const effectiveTrueDark =
    preferences.isTrueDarkModeEnabled ?? initialSnapshot.isTrueDarkModeEnabled;
  const effectiveHex = accentHex || initialSnapshot.accentHex;

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;

    const rafId = requestAnimationFrame(() => {
      fadeTimer = setTimeout(() => {
        setFading(true);
        removeTimer = setTimeout(() => {
          setDismissed(true);
        }, 200);
      }, 120);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, []);

  if (dismissed) return null;

  const surfaceClass = effectiveDark
    ? effectiveTrueDark
      ? 'bg-black text-neutral-100'
      : 'bg-neutral-950 text-neutral-100'
    : 'bg-white text-neutral-900';

  return (
    <div
      role="status"
      aria-label="Caricamento NewsReader"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 transition-opacity duration-200 ${surfaceClass} ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ '--tmw-accent': effectiveHex } as React.CSSProperties}
    >
      <LogoIcon className="w-[72px] h-[72px] rounded-2xl shadow-sm" />
      <span className="text-sm font-semibold tracking-wide opacity-90">NewsReader</span>
    </div>
  );
};
