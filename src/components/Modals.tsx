import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Rss, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ExportQrModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { favIds, accentHex, showToast } = useApp();
  if (!open) return null;

  const payload = favIds.join('\n');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Export Favorites ({favIds.length})</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {favIds.length === 0 ? (
          <p className="text-xs text-neutral-500 py-6">You don&apos;t have any favorite articles yet.</p>
        ) : (
          <>
            <div className="inline-block p-3 bg-white rounded-xl border border-neutral-200">
              <QRCodeSVG value={payload.slice(0, 1200)} size={180} />
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(payload);
                showToast('Ids of favorites have been copied to clipboard.');
              }}
              className="w-full py-2 rounded-lg text-white text-xs font-medium flex items-center justify-center gap-2"
              style={{ backgroundColor: accentHex }}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Favorite IDs to Clipboard</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export const ImportFavsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { importFavIds, accentHex } = useApp();
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

export const CountdownReminder: React.FC = () => {
  const { lastReadStory, selectedItemArgs, dismissReminder, openItem, accentHex } = useApp();

  if (!lastReadStory || selectedItemArgs) return null;

  return (
    <div className="mx-3 mb-3 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md flex items-center justify-between gap-2 text-xs">
      <button
        type="button"
        onClick={() => openItem({ item: lastReadStory })}
        className="flex-1 min-w-0 text-left truncate"
      >
        <span className="font-semibold mr-1.5" style={{ color: accentHex }}>
          Pick up where you left off:
        </span>
        <span className="text-neutral-700 dark:text-neutral-200">{lastReadStory.title}</span>
      </button>
      <button
        type="button"
        onClick={dismissReminder}
        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
        aria-label="Dismiss reminder"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const AddRssFeedModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { addCustomFeed, accentHex } = useApp();
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

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast, accentHex } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-3.5 py-2.5 rounded-lg shadow-lg border text-xs flex items-center justify-between gap-3 ${
            t.variant === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : 'bg-neutral-900 dark:bg-neutral-800 text-white border-neutral-700'
          }`}
        >
          <span>{t.text}</span>
          <div className="flex items-center gap-2 shrink-0">
            {t.actionLabel && t.onAction && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismissToast(t.id);
                }}
                className="font-semibold underline"
                style={{ color: t.variant === 'error' ? '#fff' : accentHex }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
