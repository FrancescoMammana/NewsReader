import React, { useState } from 'react';
import { Rss, X } from 'lucide-react';
import { useFeeds, usePreferences } from '../../context/AppContext';

export const AddRssFeedModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { addCustomFeed } = useFeeds();
  const { accentHex } = usePreferences();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    const ok = await addCustomFeed(label, url);
    setSubmitting(false);
    if (ok) {
      setLabel('');
      setUrl('');
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Rss className="w-4 h-4" style={{ color: accentHex }} />
            <span>Aggiungi Feed RSS / Atom</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Inserisci l&apos;indirizzo XML di qualsiasi feed RSS o Atom: verrà aggiunto come nuova
          scheda nella barra superiore con supporto offline.
        </p>
        <div className="space-y-2.5 text-xs">
          <label className="block">
            <span className="text-neutral-500 dark:text-neutral-400">Nome scheda (opzionale)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="es. Gazzetta, ANSA Sport, Il Post..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-neutral-500 dark:text-neutral-400">URL Feed RSS / Atom</span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://esempio.it/rss.xml"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 text-xs pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={!url.trim() || submitting}
            className="px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: accentHex }}
          >
            {submitting ? 'Verifica...' : 'Aggiungi Feed'}
          </button>
        </div>
      </form>
    </div>
  );
};
