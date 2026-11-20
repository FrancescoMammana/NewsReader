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
