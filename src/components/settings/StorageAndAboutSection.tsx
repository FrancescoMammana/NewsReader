import React, { useState } from 'react';
import { Download, Info, Trash2, Upload } from 'lucide-react';
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
          <span>Esporta preferiti</span>
          <Upload className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={onOpenImportModal}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <span>Importa preferiti</span>
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
            <div>Informazioni sull'app</div>
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
                alt="NewsReader"
                className="w-12 h-12 rounded-xl"
              />
              <div>
                <h3 className="text-base font-bold">NewsReader · RSS &amp; News PWA</h3>
                <p className="text-xs text-neutral-500">v1.0.0 · Lettore Universale Offline</p>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Una Progressive Web Application (PWA) moderna e reattiva per aggregare, gestire e leggere
              qualsiasi feed RSS o Atom con supporto completo per la lettura offline, note personali,
              ricerca avanzata, tipografia personalizzabile e podcast audio AI.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: accentHex }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
