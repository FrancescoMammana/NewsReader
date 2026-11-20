import React from 'react';
import { Send } from 'lucide-react';
import type { Comment } from '../types/tmw';
import { CommentTile } from './CommentTile';

interface ItemNotesSectionProps {
  notesCount: number;
  visibleRows: Array<{ comment: Comment; index: number }>;
  collapsedIds: Set<number>;
  collapsedChildCounts: Map<number, number>;
  matchedNoteIds: Set<number>;
  fontSizePx: number;
  onToggleCollapse: (comment: Comment, rowIdx: number) => void;
  onReply: (comment: Comment) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

export const ItemNotesSection: React.FC<ItemNotesSectionProps> = ({
  notesCount,
  visibleRows,
  collapsedIds,
  collapsedChildCounts,
  matchedNoteIds,
  fontSizePx,
  onToggleCollapse,
  onReply,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
        <span className="font-semibold uppercase tracking-wider">
          Note sull&apos;articolo ({notesCount})
        </span>
      </div>

      {notesCount === 0 ? (
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
            fontSizePx={fontSizePx}
            onToggleCollapse={() => onToggleCollapse(comment, rowIdx)}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};

interface NoteComposerProps {
  replyingTo: Comment | null;
  editingNote: Comment | null;
  composerText: string;
  composerExpanded: boolean;
  accentHex: string;
  onExpand: () => void;
  onChangeText: (val: string) => void;
  onReset: () => void;
  onSave: () => void;
}

export const NoteComposer: React.FC<NoteComposerProps> = ({
  replyingTo,
  editingNote,
  composerText,
  composerExpanded,
  accentHex,
  onExpand,
  onChangeText,
  onReset,
  onSave,
}) => {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2">
      {(replyingTo || editingNote) && (
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 px-1">
          <span className="truncate">
            {editingNote ? `Editing note #${editingNote.id}` : 'Replying to note'}
          </span>
          <button
            type="button"
            onClick={onReset}
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
          onFocus={onExpand}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={
            editingNote ? 'Edit your note...' : replyingTo ? 'Reply to note...' : 'Add a note...'
          }
          className="flex-1 resize-none px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1"
          style={{ '--tw-ring-color': accentHex } as React.CSSProperties}
        />
        <button
          type="button"
          disabled={!composerText.trim()}
          onClick={onSave}
          className="p-2.5 rounded-lg text-white disabled:opacity-40 transition-opacity shrink-0"
          style={{ backgroundColor: accentHex }}
          title="Save note"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
