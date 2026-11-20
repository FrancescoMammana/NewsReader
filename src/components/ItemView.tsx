import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { FONT_SIZE_OPTIONS, type FontSizeOption, type ItemScreenArgs } from '../types/tmw';
import { useLibrary, useNavigation, usePreferences, useToasts } from '../context/AppContext';
import { useArticleLoader } from '../hooks/useArticleLoader';
import { useArticleNotes } from '../hooks/useArticleNotes';
import { formatTimestamp, getReadableUrl } from '../utils/formatting';
import { ItemNotesSection, NoteComposer } from './ItemNotesSection';
import { ItemText } from './ItemText';
import { ItemToolbar } from './ItemToolbar';

interface ItemViewProps {
  args: ItemScreenArgs;
  isSplitView: boolean;
}

export const ItemView: React.FC<ItemViewProps> = ({ args, isSplitView }) => {
  const { preferences, updatePreference, accentHex } = usePreferences();
  const { isFav, toggleFav, isPinned, togglePin, isOfflineCached, cacheArticleOffline } =
    useLibrary();
  const {
    openItem,
    goBackItem,
    closeItem,
    itemHistoryStack,
    splitViewExpanded,
    setSplitViewExpanded,
  } = useNavigation();
  const { showToast } = useToasts();

  const [searchOpen, setSearchOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { article, loading, imgFailed, setImgFailed, reloadArticle } = useArticleLoader({
    item: args.item,
    cacheArticleOffline,
  });

  const notesState = useArticleNotes({
    articleId: args.item.id,
    isAutoScrollEnabled: preferences.isAutoScrollEnabled,
    showToast,
  });

  useEffect(() => {
    setSearchOpen(false);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [args]);

  const activeFontSizePx = useMemo(() => {
    return FONT_SIZE_OPTIONS.find((f) => f.id === preferences.fontSize)?.px ?? 15;
  }, [preferences.fontSize]);

  const domain = getReadableUrl(article.url);
  const faved = isFav(article.id);
  const pinned = isPinned(article.id);
  const offlineReady = isOfflineCached(article.id, article.url);

  return (
    <div className="relative flex flex-col h-full bg-white dark:bg-neutral-950">
      <ItemToolbar
        isSplitView={isSplitView}
        historyCount={itemHistoryStack.length}
        splitViewExpanded={splitViewExpanded}
        onToggleExpand={() => setSplitViewExpanded(!splitViewExpanded)}
        onBack={() => (itemHistoryStack.length > 1 ? goBackItem() : closeItem())}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        searchQuery={notesState.searchQuery}
        onSearchQueryChange={notesState.setSearchQuery}
        onCloseSearch={() => {
          notesState.setSearchQuery('');
          setSearchOpen(false);
        }}
        matchCount={notesState.matchedNoteIds.size}
        fontSize={preferences.fontSize}
        onSelectFontSize={(size: FontSizeOption) => updatePreference('fontSize', size)}
        pinned={pinned}
        onTogglePin={() => togglePin(article)}
        faved={faved}
        onToggleFav={() => toggleFav(article)}
        loading={loading}
        onReload={() => void reloadArticle()}
        offlineReady={offlineReady}
        accentHex={accentHex}
      />

      {/* Main Scrollable Article & Notes */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-3xl mx-auto px-4 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {article.category && (
                <span
                  className="px-2 py-0.5 rounded font-semibold uppercase tracking-wide text-[11px]"
                  style={{ backgroundColor: 'var(--tmw-accent-soft)', color: accentHex }}
                >
                  {article.category}
                </span>
              )}
              {article.label && (
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                  {article.label}
                </span>
              )}
              <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                {article.by || 'Redazione TMW'}
              </span>
            </div>
            <span className="text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
              {formatTimestamp(article.time, preferences.dateFormat)}
            </span>
          </div>

          {article.title && (
            <h1
              className="font-bold text-neutral-900 dark:text-neutral-100 leading-snug mb-2"
              style={{ fontSize: `${activeFontSizePx + 5}px` }}
            >
              {article.title}
            </h1>
          )}

          {article.subtitle && (
            <p
              className="text-neutral-600 dark:text-neutral-300 font-medium leading-snug mb-3"
              style={{ fontSize: `${activeFontSizePx}px` }}
            >
              {article.subtitle}
            </p>
          )}

          {article.image && !imgFailed && (
            <div className="my-3 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 max-h-80">
              <img
                src={article.image}
                alt={article.title}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full max-h-80 object-cover"
              />
            </div>
          )}

          {loading && !article.text && (
            <div className="py-10 text-center text-sm text-neutral-500">
              Caricamento articolo completo...
            </div>
          )}

          {article.text && (
            <div className="mt-4">
              <ItemText
                text={article.text}
                fontSizePx={activeFontSizePx}
                className="text-neutral-800 dark:text-neutral-200"
              />
            </div>
          )}

          {article.url && (
            <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between text-xs text-neutral-500">
              <span>Source: {domain || 'fonte originale'}</span>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline flex items-center gap-1"
                style={{ color: accentHex }}
              >
                <span>Leggi su {domain || 'sito originale'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Related Articles */}
        {article.related && article.related.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2.5">
              Notizie correlate
            </h2>
            <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              {article.related.slice(0, 6).map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => openItem({ item: rel }, true)}
                  className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/60 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">
                      {rel.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{rel.category}</div>
                  </div>
                  {rel.image && (
                    <img
                      src={rel.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <ItemNotesSection
          notesCount={notesState.notes.length}
          visibleRows={notesState.visibleRows}
          collapsedIds={notesState.collapsedIds}
          collapsedChildCounts={notesState.collapsedChildCounts}
          matchedNoteIds={notesState.matchedNoteIds}
          fontSizePx={activeFontSizePx}
          onToggleCollapse={notesState.toggleCollapse}
          onReply={notesState.startReply}
          onEdit={notesState.startEdit}
          onDelete={notesState.deleteNote}
        />
      </div>

      <NoteComposer
        replyingTo={notesState.replyingTo}
        editingNote={notesState.editingNote}
        composerText={notesState.composerText}
        composerExpanded={notesState.composerExpanded}
        accentHex={accentHex}
        onExpand={() => notesState.setComposerExpanded(true)}
        onChangeText={notesState.updateComposerText}
        onReset={notesState.resetComposer}
        onSave={notesState.saveNote}
      />
    </div>
  );
};
