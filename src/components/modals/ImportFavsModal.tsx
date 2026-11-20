import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLibrary, usePreferences } from '../../context/AppContext';

export const ImportFavsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { importFavIds } = useLibrary();
  const { accentHex } = usePreferences();
  const [raw, setRaw] = useState('');
  if (!open) return null;

  const handleImport = () => {
    const ids = raw
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    importFavIds(ids);
    setRaw('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Import Favorites</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Paste TuttoMercatoWeb article IDs separated by newlines or commas.
        </p>
        <textarea
          rows={5}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="e.g.&#10;2295040&#10;2295035"
          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent focus:outline-none"
        />
        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="px-4 py-1.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: accentHex }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};
