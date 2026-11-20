import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Comment } from '../types/tmw';
import { storage } from '../services/storage';
import type { ToastOptions } from '../context/ToastContext';

interface UseArticleNotesParams {
  articleId: number;
  isAutoScrollEnabled: boolean;
  showToast: (text: string, opts?: ToastOptions) => void;
}

export function useArticleNotes({
  articleId,
  isAutoScrollEnabled,
  showToast,
}: UseArticleNotesParams) {
  const [notes, setNotes] = useState<Comment[]>(() => storage.getArticleNotes(articleId));
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [editingNote, setEditingNote] = useState<Comment | null>(null);
  const [composerText, setComposerText] = useState(() => storage.getDraft(articleId));
  const [composerExpanded, setComposerExpanded] = useState(false);

  useEffect(() => {
    setNotes(storage.getArticleNotes(articleId));
    setCollapsedIds(new Set());
    setSearchQuery('');
    setReplyingTo(null);
    setEditingNote(null);
    setComposerText(storage.getDraft(articleId));
    setComposerExpanded(false);
  }, [articleId]);

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
        }
        skipUntilLevel = null;
        collapsedParentId = null;
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

  const matchedNoteIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<number>();
    return new Set(notes.filter((n) => n.text.toLowerCase().includes(q)).map((n) => n.id));
  }, [notes, searchQuery]);

  const toggleCollapse = useCallback(
    (comment: Comment, rowIndex: number) => {
      const currentlyCollapsed = collapsedIds.has(comment.id);
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (currentlyCollapsed) next.delete(comment.id);
        else next.add(comment.id);
        return next;
      });

      if (!currentlyCollapsed && isAutoScrollEnabled) {
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
    },
    [collapsedIds, isAutoScrollEnabled, visibleRows],
  );

  const saveNote = useCallback(() => {
    const trimmed = composerText.trim();
    if (!trimmed) return;

    if (editingNote) {
      const updated = notes.map((n) => (n.id === editingNote.id ? { ...n, text: trimmed } : n));
      setNotes(updated);
      storage.saveArticleNotes(articleId, updated);
      setEditingNote(null);
      setComposerText('');
      setComposerExpanded(false);
      showToast('Note updated', { variant: 'success' });
      return;
    }

    const newNote: Comment = {
      id: Date.now(),
      time: Math.floor(Date.now() / 1000),
      parent: replyingTo ? replyingTo.id : articleId,
      by: 'Nota personale',
      text: trimmed,
      hidden: false,
      level: replyingTo ? replyingTo.level + 1 : 0,
      type: 'comment',
      title: '',
      url: '',
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
    storage.saveArticleNotes(articleId, updated);
    storage.saveDraft(replyingTo?.id ?? articleId, '');
    setReplyingTo(null);
    setComposerText('');
    setComposerExpanded(false);
    showToast('Note saved', { variant: 'success' });
  }, [articleId, composerText, editingNote, notes, replyingTo, showToast]);

  const deleteNote = useCallback(
    (note: Comment) => {
      const updated = notes.filter((n) => n.id !== note.id);
      setNotes(updated);
      storage.saveArticleNotes(articleId, updated);
      showToast('Note deleted');
    },
    [articleId, notes, showToast],
  );

  const startReply = useCallback((cmt: Comment) => {
    setEditingNote(null);
    setReplyingTo(cmt);
    setComposerText(storage.getDraft(cmt.id));
    setComposerExpanded(true);
  }, []);

  const startEdit = useCallback((cmt: Comment) => {
    setReplyingTo(null);
    setEditingNote(cmt);
    setComposerText(cmt.text);
    setComposerExpanded(true);
  }, []);

  const updateComposerText = useCallback(
    (val: string) => {
      setComposerText(val);
      if (!editingNote) {
        storage.saveDraft(replyingTo?.id ?? articleId, val);
      }
    },
    [articleId, editingNote, replyingTo],
  );

  const resetComposer = useCallback(() => {
    setEditingNote(null);
    setReplyingTo(null);
    setComposerExpanded(false);
  }, []);

  return {
    notes,
    collapsedIds,
    visibleRows,
    collapsedChildCounts,
    searchQuery,
    setSearchQuery,
    matchedNoteIds,
    replyingTo,
    editingNote,
    composerText,
    composerExpanded,
    setComposerExpanded,
    toggleCollapse,
    saveNote,
    deleteNote,
    startReply,
    startEdit,
    updateComposerText,
    resetComposer,
  };
}
