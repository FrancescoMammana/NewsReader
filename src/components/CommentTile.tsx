import React, { useState } from 'react';
import {
  Edit3,
  MessageSquare,
  MoreHorizontal,
  Reply,
  Trash2,
} from 'lucide-react';
import type { Comment } from '../types/hn';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '../utils/formatting';
import { ItemText } from './ItemText';

interface CommentTileProps {
  comment: Comment;
  index?: number;
  isCollapsed?: boolean;
  collapsedCount?: number;
  isSearchMatch?: boolean;
  fontSizePx?: number;
  onToggleCollapse?: () => void;
  onReply?: (comment: Comment) => void;
  onEdit?: (comment: Comment) => void;
  onDelete?: (comment: Comment) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 87;
  const b = parseInt(clean.slice(4, 6), 16) || 34;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const CommentTile: React.FC<CommentTileProps> = ({
  comment,
  index,
  isCollapsed = false,
  collapsedCount = 0,
  isSearchMatch = false,
  fontSizePx = 15,
  onToggleCollapse,
  onReply,
  onEdit,
  onDelete,
}) => {
  const {
    preferences,
    accentHex,
    isDarkActive,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const level = Math.max(0, comment.level || 0);
  const levelMod = level % 10;
  const borderAlpha = Math.min(1, Math.max(0.3, (10 - levelMod) / 10));
  const bgOpacity = isDarkActive ? 0.04 : 0.08;

  const handleContainerClick = () => {
    if (preferences.isTapAnywhereToCollapseEnabled && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (!preferences.isTapAnywhereToCollapseEnabled && onToggleCollapse) {
      e.stopPropagation();
      onToggleCollapse();
    }
  };

  const indentLevels = Array.from({ length: level }, (_, idx) => idx + 1);

  return (
    <div
      id={`comment-${comment.id}`}
      className={`border-b border-neutral-200/70 dark:border-neutral-800/80 transition-colors ${
        isSearchMatch ? 'ring-1 ring-inset' : ''
      }`}
      style={{
        backgroundColor:
          preferences.isEyeCandyEnabled && level > 0
            ? hexToRgba(accentHex, bgOpacity)
            : undefined,
        ...(isSearchMatch ? { boxShadow: `inset 0 0 0 2px ${accentHex}` } : {}),
      }}
    >
      <div className="flex">
        {indentLevels.map((lvl) => {
          const mod = lvl % 10;
          const alpha = Math.min(1, Math.max(0.3, (10 - mod) / 10));
          return (
            <div
              key={lvl}
              className="w-2.5 shrink-0 border-l"
              style={{
                marginLeft: lvl === 1 ? '4px' : '0px',
                borderLeftColor: hexToRgba(accentHex, alpha),
                borderLeftWidth: '1.5px',
              }}
            />
          );
        })}

        <div
          className="flex-1 min-w-0 px-3 py-2.5 cursor-pointer"
          onClick={handleContainerClick}
        >
          <div
            onClick={handleHeaderClick}
            className="flex items-center justify-between gap-2 text-xs mb-1.5"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold truncate" style={{ color: accentHex }}>
                {comment.by || 'Note'}
              </span>
              {typeof index === 'number' && (
                <span className="text-neutral-400 dark:text-neutral-500 tabular-nums">
                  #{index + 1}
                </span>
              )}
              {comment.parent !== 0 && <Reply className="w-3.5 h-3.5 text-neutral-400" />}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                {formatTimestamp(comment.time, preferences.dateFormat)}
              </span>

              <div
                className="relative flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {onReply && (
                  <button
                    type="button"
                    onClick={() => onReply(comment)}
                    title="Reply"
                    className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(comment)}
                    title="Edit note"
                    className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      title="More actions"
                      className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-7 z-30 w-36 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg py-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(comment);
                              setMenuOpen(false);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete note</span>
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {isCollapsed ? (
            <div
              className="py-1.5 text-center text-xs font-medium tabular-nums"
              style={{ color: hexToRgba(accentHex, borderAlpha) }}
            >
              collapsed ({collapsedCount + 1})
            </div>
          ) : (
            <ItemText
              text={comment.text}
              fontSizePx={fontSizePx}
              className="text-neutral-800 dark:text-neutral-200"
            />
          )}
        </div>
      </div>
    </div>
  );
};
