import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { type ProfileSubPage, type Story } from '../types/tmw';
import { useApp } from '../context/AppContext';
import { SearchView } from './SearchView';
import { SettingsView } from './SettingsView';
import { StoryTile } from './StoryTile';

interface ProfileViewProps {
  onOpenExportQr: () => void;
  onOpenImportModal: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenExportQr,
  onOpenImportModal,
}) => {
  const {
    preferences,
    accentHex,
    favItems,
    removeFav,
    openItem,
  } = useApp();

  const [subPage, setSubPage] = useState<ProfileSubPage>('settings');

  const tabs: Array<{ id: ProfileSubPage; label: string }> = [
    { id: 'search', label: 'Search' },
    { id: 'fav', label: `Favorite (${favItems.length})` },
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
      {subPage === 'fav' && (
        <div className="flex-1 overflow-y-auto">
          {favItems.length === 0 ? (
            <div className="py-20 px-6 text-center text-sm text-neutral-400">
              Your favorite TuttoMercatoWeb articles will show up here.
            </div>
          ) : (
            favItems.map((item) => (
              <div key={item.id} className="relative group">
                <StoryTile
                  story={item as Story}
                  onTap={() => openItem({ item })}
                  showWebPreview={preferences.isComplexStoryTileEnabled}
                  showMetadata={preferences.isMetadataEnabled}
                  showFavicon={preferences.isFaviconEnabled}
                  showUrl={preferences.isUrlEnabled}
                />
                <button
                  type="button"
                  onClick={() => removeFav(item.id)}
                  title="Remove from favorites"
                  className="absolute right-3 bottom-3 p-1.5 rounded bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {subPage === 'search' && <SearchView />}

      {subPage === 'settings' && (
        <SettingsView onOpenExportQr={onOpenExportQr} onOpenImportModal={onOpenImportModal} />
      )}
    </div>
  );
};
