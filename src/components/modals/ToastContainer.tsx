import React from 'react';
import { X } from 'lucide-react';
import { usePreferences, useToasts } from '../../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToasts();
  const { accentHex } = usePreferences();
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
