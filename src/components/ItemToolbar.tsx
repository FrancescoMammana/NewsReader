import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Heart,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  RefreshCw,
  Type,
} from 'lucide-react';
import { FONT_SIZE_OPTIONS, type FontSizeOption } from '../types/tmw';

interface ItemToolbarProps {
  isSplitView: boolean;
  historyCount: number;
  splitViewExpanded: boolean;
  onToggleExpand: () => void;
  onBack: () => void;
  fontSize: FontSizeOption;
  onSelectFontSize: (size: FontSizeOption) => void;
  pinned: boolean;
  onTogglePin: () => void;
  faved: boolean;
  onToggleFav: () => void;
  loading: boolean;
  onReload: () => void;
  offlineReady: boolean;
  accentHex: string;
}

export const ItemToolbar: React.FC<ItemToolbarProps> = ({
  isSplitView,
  historyCount,
  splitViewExpanded,
  onToggleExpand,
  onBack,
  fontSize,
  onSelectFontSize,
  pinned,
  onTogglePin,
  faved,
  onToggleFav,
  loading,
  onReload,
  offlineReady,
  accentHex,
}) => {
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-950/90 backdrop-blur">
      <div className="flex items-center gap-1">
        {(!isSplitView || historyCount > 1) && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {isSplitView && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            title={splitViewExpanded ? 'Restore split view' : 'Expand article'}
            aria-label={splitViewExpanded ? 'Restore split view' : 'Expand article'}
          >
            {splitViewExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFontMenuOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            title="Font size"
          >
            <Type className="w-4 h-4" />
          </button>
          {fontMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setFontMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-30 w-36 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1">
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelectFontSize(opt.id as FontSizeOption);
                      setFontMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                    style={{
                      fontSize: `${opt.px}px`,
                      color: fontSize === opt.id ? accentHex : undefined,
                    }}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onTogglePin}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          style={pinned ? { color: accentHex } : undefined}
          title={pinned ? 'Unpin article' : 'Pin article'}
        >
          {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleFav}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          title={faved ? 'Unfavorite' : 'Favorite'}
        >
          <Heart
            className={`w-4 h-4 ${faved ? 'fill-current' : ''}`}
            style={faved ? { color: accentHex } : undefined}
          />
        </button>

        <button
          type="button"
          onClick={onReload}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
          title="Reload article"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <span
          title={
            offlineReady
              ? 'Articolo scaricato e disponibile offline'
              : 'Articolo non ancora scaricato offline'
          }
          aria-label={offlineReady ? 'Disponibile offline' : 'Non scaricato offline'}
          className="p-2 flex items-center justify-center"
        >
          {offlineReady ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CircleDashed className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
          )}
        </span>
      </div>
    </div>
  );
};
