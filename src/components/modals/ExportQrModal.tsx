import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X } from 'lucide-react';
import { useLibrary, usePreferences, useToasts } from '../../context/AppContext';

export const ExportQrModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { favIds } = useLibrary();
  const { accentHex } = usePreferences();
  const { showToast } = useToasts();
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
