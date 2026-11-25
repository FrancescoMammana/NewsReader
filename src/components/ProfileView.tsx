import React, { useState } from 'react';
import { type ProfileSubPage } from '../types/tmw';
import { useApp } from '../context/AppContext';
import { SearchView } from './SearchView';
import { SettingsView } from './SettingsView';

interface ProfileViewProps {
  onOpenExportQr: () => void;
  onOpenImportModal: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenExportQr,
  onOpenImportModal,
}) => {
  const { accentHex } = useApp();

  const [subPage, setSubPage] = useState<ProfileSubPage>('settings');

  const tabs: Array<{ id: ProfileSubPage; label: string }> = [
    { id: 'search', label: 'Search' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation chip bar */}
      <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const active = subPage === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubPage(t.id)}
              className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 transition-colors border-neutral-200 dark:border-neutral-700"
              style={
                active
                  ? {
                      borderColor: accentHex,
                      backgroundColor: 'var(--tmw-accent-soft)',
                      color: accentHex,
                    }
                  : undefined
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Subpage Content */}
      {subPage === 'search' && <SearchView />}

      {subPage === 'settings' && (
        <SettingsView onOpenExportQr={onOpenExportQr} onOpenImportModal={onOpenImportModal} />
      )}
    </div>
  );
};
