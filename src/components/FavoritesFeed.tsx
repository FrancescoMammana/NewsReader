import React from 'react';
import { Trash2 } from 'lucide-react';
import { type Story } from '../types/tmw';
import { useApp } from '../context/AppContext';
import { StoryTile } from './StoryTile';

export const FavoritesFeed: React.FC = () => {
  const { preferences, favItems, removeFav, openItem, selectedItemArgs } = useApp();

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain">
      {favItems.length === 0 ? (
        <div className="py-20 px-6 text-center text-sm text-neutral-400">
          Your favorite TuttoMercatoWeb articles will show up here.
        </div>
      ) : (
        favItems.map((item) => (
          <div key={`fav-story-${item.id}`} className="relative group">
            <StoryTile
              story={item as Story}
              onTap={() => openItem({ item })}
              isSelected={selectedItemArgs?.item.id === item.id}
              showWebPreview={preferences.isComplexStoryTileEnabled}
              showMetadata={preferences.isMetadataEnabled}
              showFavicon={preferences.isFaviconEnabled}
              showUrl={preferences.isUrlEnabled}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFav(item.id);
              }}
              title="Remove from favorites"
              className="absolute right-3 bottom-3 p-1.5 rounded bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 cursor-pointer shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );
};
