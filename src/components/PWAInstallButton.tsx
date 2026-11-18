import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { accentHex } = useApp();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Installa app (PWA)"
        className={
          compact
            ? 'px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-90'
            : 'flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 w-full'
        }
        style={{ backgroundColor: accentHex }}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Installa' : 'Installa App (PWA)'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Installa su iPhone / iPad"
          className={
            compact
              ? 'px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center gap-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0'
              : 'flex items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 w-full'
          }
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{compact ? 'Installa' : 'Installa su iPhone / iPad'}</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt="TMW Reader"
                  className="w-10 h-10 rounded-lg shrink-0"
                />
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Installa su iPhone / iPad
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Accesso rapido e lettura offline
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-2 leading-relaxed">
                <p className="flex items-center gap-1.5">
                  <span>1. Tocca</span>
                  <Share className="w-3.5 h-3.5 inline shrink-0" style={{ color: accentHex }} />
                  <span>
                    <strong>Condividi</strong> nella barra di Safari.
                  </span>
                </p>
                <p>
                  2. Scorri e seleziona <strong>Aggiungi alla schermata Home</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: accentHex }}
              >
                Chiudi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { isOfflineReading, toggleOfflineMode } = useApp();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Sei offline — uso cache e articoli salvati</span>
      {!isOfflineReading && (
        <button
          type="button"
          onClick={() => toggleOfflineMode(true)}
          className="ml-1 underline font-semibold hover:opacity-85"
        >
          Modalità Offline
        </button>
      )}
    </div>
  );
};
