import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
  Type,
  X,
} from 'lucide-react';
import {
  type Comment,
  FONT_SIZE_OPTIONS,
  type FontSizeOption,
  type ItemScreenArgs,
  type Story,
} from '../types/tmw';
import { useApp } from '../context/AppContext';
import { fetchTmwArticle } from '../services/tmwApi';
import { storage } from '../services/storage';
import { formatTimestamp, getReadableUrl } from '../utils/formatting';
import { CommentTile } from './CommentTile';
import { ItemText } from './ItemText';

interface ItemViewProps {
  args: ItemScreenArgs;
  isSplitView: boolean;
}

export const ItemView: React.FC<ItemViewProps> = ({ args, isSplitView }) => {
  const {
    preferences,
    updatePreference,
    accentHex,
    isOfflineReading,
    isFav,
    toggleFav,
    isPinned,
    togglePin,
    openItem,
    goBackItem,
    closeItem,
    itemHistoryStack,
    splitViewExpanded,
    setSplitViewExpanded,
    showToast,
  } = useApp();

  const [article, setArticle] = useState<Story>(args.item as Story);
  const [loading, setLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Local reader notes per article
  const [notes, setNotes] = useState<Comment[]>(() => storage.getArticleNotes(args.item.id));
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  // In-article search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Font size dropdown
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  // Note reply/edit composer
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [editingNote, setEditingNote] = useState<Comment | null>(null);
  const [composerText, setComposerText] = useState('');
  const [composerExpanded, setComposerExpanded] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeFontSizePx = useMemo(() => {
    return FONT_SIZE_OPTIONS.find((f) => f.id === preferences.fontSize)?.px ?? 15;
  }, [preferences.fontSize]);

  const loadArticle = useCallback(async () => {
    setImgFailed(false);
    const offlineArticles = storage.getOfflineArticles();
    const cached = offlineArticles[String(args.item.id)];
    const offlineOnly =
      isOfflineReading || (typeof navigator !== 'undefined' && !navigator.onLine);

    if (offlineOnly) {
      setArticle(cached ?? (args.item as Story));
      setLoading(false);
      return;
    }

    if (!args.item.url) {
      setArticle(args.item as Story);
      return;
    }

    setLoading(true);
    try {
      const full = await fetchTmwArticle(args.item.url);
      if (full) {
        const prevText = (args.item as Story).text || '';
        const nextText = full.text || '';
        const merged: Story = {
          ...(args.item as Story),
          ...full,
          title: full.title || args.item.title,
          text: nextText.length >= prevText.length ? nextText : prevText,
          image: full.image || (args.item as Story).image,
          category: full.category || (args.item as Story).category,
          label: (args.item as Story).label || full.label,
        };
        setArticle(merged);
        storage.saveOfflineArticles({
          ...storage.getOfflineArticles(),
          [String(args.item.id)]: merged,
        });
      } else if (cached) {
        setArticle(cached);
      }
    } catch {
      if (cached) {
        setArticle(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [args.item, isOfflineReading]);

  useEffect(() => {
    setArticle(args.item as Story);
    setNotes(storage.getArticleNotes(args.item.id));
    setCollapsedIds(new Set());
    setSearchOpen(false);
    setSearchQuery('');
    setReplyingTo(null);
    setEditingNote(null);
    setComposerText(storage.getDraft(args.item.id));
    setComposerExpanded(false);
    scrollContainerRef.current?.scrollTo({ top: 0 });
    void loadArticle();
  }, [args, loadArticle]);

  const { visibleRows, collapsedChildCounts } = useMemo(() => {
    const rows: Array<{ comment: Comment; index: number }> = [];
    const counts = new Map<number, number>();
    let skipUntilLevel: number | null = null;
    let collapsedParentId: number | null = null;

    notes.forEach((cmt, idx) => {
      if (skipUntilLevel !== null) {
        if (cmt.level > skipUntilLevel) {
          if (collapsedParentId !== null) {
            counts.set(collapsedParentId, (counts.get(collapsedParentId) ?? 0) + 1);
          }
          return;
        } else {
          skipUntilLevel = null;
          collapsedParentId = null;
        }
      }

      rows.push({ comment: cmt, index: idx });
      if (collapsedIds.has(cmt.id)) {
        skipUntilLevel = cmt.level;
        collapsedParentId = cmt.id;
        counts.set(cmt.id, 0);
      }
    });

    return { visibleRows: rows, collapsedChildCounts: counts };
  }, [notes, collapsedIds]);

  const toggleCollapse = (comment: Comment, rowIndex: number) => {
    const currentlyCollapsed = collapsedIds.has(comment.id);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (currentlyCollapsed) next.delete(comment.id);
      else next.add(comment.id);
      return next;
    });

    if (!currentlyCollapsed && preferences.isAutoScrollEnabled) {
      const nextSibling = visibleRows
        .slice(rowIndex + 1)
        .find((r) => r.comment.level <= comment.level);
      if (nextSibling) {
        setTimeout(() => {
          document.getElementById(`comment-${nextSibling.comment.id}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 80);
      }
    }
  };

  const matchedNoteIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<number>();
    return new Set(notes.filter((n) => n.text.toLowerCase().includes(q)).map((n) => n.id));
  }, [notes, searchQuery]);

  const handleSaveNote = () => {
    const trimmed = composerText.trim();
    if (!trimmed) return;

    if (editingNote) {
      const updated = notes.map((n) => (n.id === editingNote.id ? { ...n, text: trimmed } : n));
      setNotes(updated);
      storage.saveArticleNotes(article.id, updated);
      setEditingNote(null);
      setComposerText('');
      setComposerExpanded(false);
      showToast('Note updated', { variant: 'success' });
      return;
    }

    const newNote: Comment = {
      id: Date.now(),
      time: Math.floor(Date.now() / 1000),
      parent: replyingTo ? replyingTo.id : article.id,
      score: 1,
      by: 'Nota personale',
      text: trimmed,
      kids: [],
      dead: false,
      deleted: false,
      hidden: false,
      level: replyingTo ? replyingTo.level + 1 : 0,
      type: 'comment',
      title: '',
      url: '',
      descendants: 0,
      parts: [],
    };

    let updated: Comment[];
    if (!replyingTo) {
      updated = [newNote, ...notes];
    } else {
      const idx = notes.findIndex((c) => c.id === replyingTo.id);
      if (idx === -1) {
        updated = [newNote, ...notes];
      } else {
        updated = [...notes];
        updated.splice(idx + 1, 0, newNote);
      }
    }

    setNotes(updated);
    storage.saveArticleNotes(article.id, updated);
    storage.saveDraft(replyingTo?.id ?? article.id, '');
    setReplyingTo(null);
    setComposerText('');
    setComposerExpanded(false);
    showToast('Note saved', { variant: 'success' });
  };

  const handleDeleteNote = (note: Comment) => {
    const updated = notes.filter((n) => n.id !== note.id);
    setNotes(updated);
    storage.saveArticleNotes(article.id, updated);
    showToast('Note deleted');
  };

  const domain = getReadableUrl(article.url);
  const faved = isFav(article.id);
  const pinned = isPinned(article.id);

  return (
    <div className="relative flex flex-col h-full bg-white dark:bg-neutral-950">
      {/* Top Toolbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-950/90 backdrop-blur">
        <div className="flex items-center gap-1">
          {(!isSplitView || itemHistoryStack.length > 1) && (
            <button
              type="button"
              onClick={() => (itemHistoryStack.length > 1 ? goBackItem() : closeItem())}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {isSplitView && (
            <button
              type="button"
              onClick={() => setSplitViewExpanded(!splitViewExpanded)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
              title={splitViewExpanded ? 'Restore split view' : 'Expand article'}
              aria-label={splitViewExpanded ? 'Restore split view' : 'Expand article'}
            >
              {splitViewExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            style={searchOpen ? { color: accentHex } : undefined}
            title="Search in notes"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFontMenuOpen((v) => !v)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
              title="Font size"
            >
              <Type className="w-4 h-4" />
            </button>
            {fontMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setFontMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-30 w-36 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1">
                  {FONT_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        updatePreference('fontSize', opt.id as FontSizeOption);
                        setFontMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                      style={{
                        fontSize: `${opt.px}px`,
                        color: preferences.fontSize === opt.id ? accentHex : undefined,
                      }}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => togglePin(article)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            style={pinned ? { color: accentHex } : undefined}
            title={pinned ? 'Unpin article' : 'Pin article'}
          >
            {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => toggleFav(article)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            title={faved ? 'Unfavorite' : 'Favorite'}
          >
            <Heart
              className={`w-4 h-4 ${faved ? 'fill-current' : ''}`}
              style={faved ? { color: accentHex } : undefined}
            />
          </button>

          <button
            type="button"
            onClick={() => void loadArticle()}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
            title="Reload article"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
              title="Open on TuttoMercatoWeb"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && (
        <div className="px-3.5 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in notes..."
            className="flex-1 px-2.5 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-xs text-neutral-500 tabular-nums">
              {matchedNoteIds.size} match{matchedNoteIds.size === 1 ? '' : 'es'}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSearchOpen(false);
            }}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

        {/* Personal Notes Section */}
        <div className="max-w-3xl mx-auto">
          <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span className="font-semibold uppercase tracking-wider">
              Note sull&apos;articolo ({notes.length})
            </span>
          </div>

          {notes.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-400">
              No notes yet. Add a personal note below.
            </div>
          ) : (
            visibleRows.map(({ comment, index }, rowIdx) => (
              <CommentTile
                key={comment.id}
                comment={comment}
                index={index}
                isCollapsed={collapsedIds.has(comment.id)}
                collapsedCount={collapsedChildCounts.get(comment.id) ?? 0}
                isSearchMatch={matchedNoteIds.has(comment.id)}
                fontSizePx={activeFontSizePx}
                onToggleCollapse={() => toggleCollapse(comment, rowIdx)}
                onReply={(cmt) => {
                  setEditingNote(null);
                  setReplyingTo(cmt);
                  setComposerText(storage.getDraft(cmt.id));
                  setComposerExpanded(true);
                }}
                onEdit={(cmt) => {
                  setReplyingTo(null);
                  setEditingNote(cmt);
                  setComposerText(cmt.text);
                  setComposerExpanded(true);
                }}
                onDelete={handleDeleteNote}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom Note Composer */}
      <div className="sticky bottom-0 z-20 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2">
        {(replyingTo || editingNote) && (
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 px-1">
            <span className="truncate">
              {editingNote ? `Editing note #${editingNote.id}` : 'Replying to note'}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingNote(null);
                setReplyingTo(null);
                setComposerExpanded(false);
              }}
              className="hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Reset
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            rows={composerExpanded ? 3 : 1}
            value={composerText}
            onFocus={() => setComposerExpanded(true)}
            onChange={(e) => {
              const val = e.target.value;
              setComposerText(val);
              if (!editingNote) {
                storage.saveDraft(replyingTo?.id ?? article.id, val);
              }
            }}
            placeholder={
              editingNote ? 'Edit your note...' : replyingTo ? 'Reply to note...' : 'Add a note...'
            }
            className="flex-1 resize-none px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1"
            style={{ '--tw-ring-color': accentHex } as React.CSSProperties}
          />
          <button
            type="button"
            disabled={!composerText.trim()}
            onClick={handleSaveNote}
            className="p-2.5 rounded-lg text-white disabled:opacity-40 transition-opacity shrink-0"
            style={{ backgroundColor: accentHex }}
            title="Save note"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
