import type { Story } from '../types/tmw';

/**
 * Unifica i metadati già presenti in lista/cache con i dettagli completi scaricati
 * dall'articolo, preservando il testo più ricco e l'etichetta della sorgente originale.
 */
export function mergeFullArticle(base: Story, full: Story): Story {
  const baseText = base.text || '';
  const fullText = full.text || '';
  return {
    ...base,
    ...full,
    id: base.id,
    url: base.url || full.url,
    title: full.title || base.title,
    text: fullText.length >= baseText.length ? fullText : baseText,
    image: full.image || base.image,
    category: full.category || base.category,
    label: base.label || full.label,
  };
}

export function mergeStoryRichness(existing: Story | undefined, incoming: Story): Story {
  if (!existing) return incoming;
  const existingTextLen = (existing.text || '').length;
  const incomingTextLen = (incoming.text || '').length;
  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    url: existing.url || incoming.url,
    title: incoming.title || existing.title,
    text: incomingTextLen >= existingTextLen ? incoming.text : existing.text,
    subtitle: incoming.subtitle || existing.subtitle,
    image: incoming.image || existing.image,
    category: incoming.category || existing.category,
    label: incoming.label || existing.label,
  };
}

