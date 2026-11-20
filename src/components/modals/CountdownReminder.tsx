import React from 'react';
import { X } from 'lucide-react';
import { useLibrary, useNavigation, usePreferences } from '../../context/AppContext';

export const CountdownReminder: React.FC = () => {
  const { lastReadStory, dismissReminder } = useLibrary();
  const { selectedItemArgs, openItem } = useNavigation();
  const { accentHex } = usePreferences();

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
