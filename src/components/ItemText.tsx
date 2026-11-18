import React from 'react';
import { useApp } from '../context/AppContext';
import { fetchTmwArticle } from '../services/hnApi';
import { extractHnItemId } from '../utils/formatting';

interface ItemTextProps {
  text: string;
  fontSizePx?: number;
  className?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

function renderInlineFormatting(
  segment: string,
  keyPrefix: string,
  onUrlClick: (url: string, e: React.MouseEvent) => void,
): React.ReactNode[] {
  const parts = segment.split(URL_REGEX);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, idx) => {
    if (!part) return;
    if (/^https?:\/\//.test(part)) {
      nodes.push(
        <a
          key={`${keyPrefix}-url-${idx}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => onUrlClick(part, e)}
          className="underline break-all hover:opacity-80 transition-opacity"
          style={{ color: 'var(--hacki-accent)' }}
        >
          {part}
        </a>,
      );
      return;
    }

    // Handle inline code `...` and emphasis *...*
    const tokenRegex = /(`[^`]+`|\*[^*\n]+\*)/g;
    const subParts = part.split(tokenRegex);
    subParts.forEach((sub, sIdx) => {
      if (!sub) return;
      if (sub.startsWith('`') && sub.endsWith('`') && sub.length > 2) {
        nodes.push(
          <code
            key={`${keyPrefix}-code-${idx}-${sIdx}`}
            className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[0.9em]"
          >
            {sub.slice(1, -1)}
          </code>,
        );
      } else if (sub.startsWith('*') && sub.endsWith('*') && sub.length > 2) {
        nodes.push(
          <em key={`${keyPrefix}-em-${idx}-${sIdx}`} className="italic">
            {sub.slice(1, -1)}
          </em>,
        );
      } else {
        nodes.push(<React.Fragment key={`${keyPrefix}-txt-${idx}-${sIdx}`}>{sub}</React.Fragment>);
      }
    });
  });

  return nodes;
}

export const ItemText: React.FC<ItemTextProps> = ({ text, fontSizePx = 15, className = '' }) => {
  const { openItem, showToast } = useApp();

  if (!text) return null;

  const handleUrlClick = async (url: string, e: React.MouseEvent) => {
    const tmwId = extractHnItemId(url);
    if (tmwId) {
      e.preventDefault();
      e.stopPropagation();
      const article = await fetchTmwArticle(url);
      if (article) {
        openItem({ item: article }, true);
      } else {
        showToast('Could not load TuttoMercatoWeb article.', { variant: 'error' });
      }
    } else {
      e.stopPropagation();
    }
  };

  const blocks = text.split(/(<pre><code>[\s\S]*?<\/code><\/pre>)/gi);

  return (
    <div
      className={`leading-relaxed break-words space-y-3 ${className}`}
      style={{ fontSize: `${fontSizePx}px` }}
    >
      {blocks.map((block, bIdx) => {
        const codeMatch = block.match(/^<pre><code>([\s\S]*?)<\/code><\/pre>$/i);
        if (codeMatch) {
          return (
            <pre
              key={`blk-${bIdx}`}
              className="p-3 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[0.86em] font-mono leading-snug"
            >
              <code>{codeMatch[1]}</code>
            </pre>
          );
        }

        const paragraphs = block.split(/\n{2,}/).filter((p) => p.trim().length > 0);
        return paragraphs.map((para, pIdx) => {
          const trimmed = para.trim();
          if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
            return (
              <h3
                key={`blk-${bIdx}-h-${pIdx}`}
                className="font-bold text-neutral-900 dark:text-neutral-100 pt-2"
                style={{ fontSize: `${fontSizePx + 1.5}px` }}
              >
                {trimmed.slice(2, -2)}
              </h3>
            );
          }
          const isQuote = trimmed.startsWith('>');
          if (isQuote) {
            return (
              <p
                key={`blk-${bIdx}-p-${pIdx}`}
                className="pl-3 italic text-neutral-600 dark:text-neutral-400 border-l border-neutral-300 dark:border-neutral-700"
              >
                {renderInlineFormatting(trimmed, `${bIdx}-${pIdx}`, handleUrlClick)}
              </p>
            );
          }
          return (
            <p key={`blk-${bIdx}-p-${pIdx}`}>
              {renderInlineFormatting(trimmed, `${bIdx}-${pIdx}`, handleUrlClick)}
            </p>
          );
        });
      })}
    </div>
  );
};
