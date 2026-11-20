import React, { useState } from 'react';
import { Download, ExternalLink, Info, Trash2, Upload } from 'lucide-react';
import { useLibrary, usePreferences } from '../../context/AppContext';

interface StorageAndAboutSectionProps {
  onOpenExportQr: () => void;
  onOpenImportModal: () => void;
}

export const StorageAndAboutSection: React.FC<StorageAndAboutSectionProps> = ({
  onOpenExportQr,
  onOpenImportModal,
}) => {
  const { accentHex } = usePreferences();
  const { clearOfflineCache, clearReadStories, clearFavs } = useLibrary();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <div className="py-1 text-sm">
        <button
          type="button"
          onClick={onOpenExportQr}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <span>Export Favorites</span>
          <Upload className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={onOpenImportModal}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <span>Import Favorites</span>
          <Download className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={() => void clearOfflineCache()}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <div>
            <div>Svuota articoli offline</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Rimuove le copie salvate in cache mantenendo i Preferiti
            </div>
          </div>
          <Trash2 className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={clearReadStories}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <div>
            <div>Azzera articoli letti</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Ripristina lo stato non letto per tutti gli articoli
            </div>
          </div>
          <Trash2 className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={clearFavs}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left text-red-600 dark:text-red-400"
        >
          <span>Svuota preferiti</span>
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <div>
            <div>About</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              NewsReader · RSS &amp; News PWA
            </div>
          </div>
          <Info className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {aboutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <img
                src="/pwa-192x192.png"
                alt="TMW Reader"
                className="w-12 h-12 rounded-xl"
              />
              <div>
                <h3 className="text-base font-bold">TMW Reader · TUTTOmercatoWEB</h3>
                <p className="text-xs text-neutral-500">v1.0.0 · Calcio &amp; Calciomercato</p>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Split-view reader powered by live feeds, articles, and search from
              tuttomercatoweb.com, featuring offline caching, customizable typography, keyword
              filters, and personal article notes.
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <a
                href="https://www.tuttomercatoweb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <ExternalLink className="w-4 h-4" />
                <span>TUTTOmercatoWEB.com</span>
              </a>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: accentHex }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
