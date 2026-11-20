import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLibrary, usePreferences } from '../../context/AppContext';

export const FiltersSettingsSection: React.FC = () => {
  const { accentHex } = usePreferences();
  const { filterKeywords, addFilterKeyword, removeFilterKeyword } = useLibrary();
  const [newKeyword, setNewKeyword] = useState('');

  return (
    <div className="p-4 space-y-2.5">
      <div className="text-sm font-medium">Parole chiave filtro</div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Gli articoli contenenti queste parole chiave verranno nascosti.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newKeyword.trim()) {
            addFilterKeyword(newKeyword);
            setNewKeyword('');
          }
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="Aggiungi parola chiave (es. Calciomercato)..."
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent focus:outline-none"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1"
          style={{ backgroundColor: accentHex }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Aggiungi</span>
        </button>
      </form>
      {filterKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {filterKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800"
            >
              <span>{kw}</span>
              <button
                type="button"
                onClick={() => removeFilterKeyword(kw)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
