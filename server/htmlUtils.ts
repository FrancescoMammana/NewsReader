import * as cheerio from 'cheerio';

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface TmwStoryDto {
  id: number;
  time: number;
  parent: number;
  hidden: boolean;
  by: string;
  text: string;
  url: string;
  title: string;
  type: 'story';
  image?: string;
  category?: string;
  label?: string;
  subtitle?: string;
  related?: TmwStoryDto[];
}

export function resolveUrl(base: string, relative?: string): string | undefined {
  if (!relative) return undefined;
  const trimmed = relative.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return undefined;
  }
}

export function extractArticleId(url: string): number {
  const m = url.match(/-(\d{5,9})(?:[/?#]|$)/);
  if (m && m[1]) {
    const n = Number(m[1]);
    if (!Number.isNaN(n)) return n;
  }
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

export function isAllowedPublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^0\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function htmlToReadableBlocks(rawHtml: string, baseUrl: string): {
  text: string;
  excerpt: string;
  firstImage?: string;
} {
  if (!rawHtml) return { text: '', excerpt: '' };
  const $ = cheerio.load(rawHtml);
  const firstImgRaw = $('img').first().attr('src') || $('img').first().attr('data-src');
  const firstImage = resolveUrl(baseUrl, firstImgRaw);
  $('script, style, iframe, ins').remove();

  const blocks: string[] = [];
  const blockNodes = $('p, h1, h2, h3, h4, li, blockquote');
  if (blockNodes.length > 0) {
    blockNodes.each((_, el) => {
      const node = $(el);
      const tag = el.tagName?.toLowerCase();
      node.find('a').each((__, a) => {
        const anchor = $(a);
        const linkText = anchor.text().trim();
        const href = resolveUrl(baseUrl, anchor.attr('href'));
        if (linkText && href) {
          anchor.replaceWith(`${linkText} (${href})`);
        }
      });
      const content = node.text().replace(/\s+/g, ' ').trim();
      if (!content) return;
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        blocks.push(`**${content}**`);
      } else if (tag === 'blockquote') {
        blocks.push(`> ${content}`);
      } else {
        blocks.push(content);
      }
    });
  }

  const text = blocks.join('\n\n') || $.text().replace(/\s+/g, ' ').trim();
  const excerpt = $.text().replace(/\s+/g, ' ').trim().slice(0, 260);
  return { text, excerpt, firstImage };
}

export interface JsonLdArticleMeta {
  headline?: string;
  subtitle?: string;
  author?: string;
  category?: string;
  image?: string;
  publishedTime?: number;
  articleBody?: string;
}

export function extractJsonLdArticleMeta(
  $: cheerio.CheerioAPI,
  options?: {
    articleTypes?: string[];
    includeImage?: boolean;
    includeWebPageDescription?: boolean;
  },
): JsonLdArticleMeta {
  const allowedTypes = new Set(options?.articleTypes ?? ['NewsArticle']);
  const result: JsonLdArticleMeta = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).text();
      const data = JSON.parse(raw) as { '@graph'?: Array<Record<string, unknown>> };
      const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data as Record<string, unknown>];
      for (const node of graph) {
        const nodeType = typeof node['@type'] === 'string' ? node['@type'] : '';
        if (allowedTypes.has(nodeType)) {
          if (typeof node.headline === 'string' && node.headline.trim()) {
            result.headline = node.headline.trim();
          }
          if (typeof node.articleSection === 'string' && node.articleSection.trim()) {
            result.category = node.articleSection.trim();
          }
          if (typeof node.articleBody === 'string' && node.articleBody.trim()) {
            result.articleBody = node.articleBody.trim();
          }
          if (typeof node.datePublished === 'string') {
            const parsed = Date.parse(node.datePublished);
            if (!Number.isNaN(parsed)) {
              result.publishedTime = Math.floor(parsed / 1000);
            }
          }
          const authObj = node.author as { name?: string } | Array<{ name?: string }> | undefined;
          if (Array.isArray(authObj) && authObj[0]?.name) {
            result.author = authObj[0].name.trim();
          } else if (authObj && !Array.isArray(authObj) && authObj.name) {
            result.author = authObj.name.trim();
          }
          if (options?.includeImage) {
            const imgObj = node.image as { url?: string } | string | undefined;
            if (typeof imgObj === 'string') {
              result.image = imgObj;
            } else if (imgObj && typeof imgObj.url === 'string') {
              result.image = imgObj.url;
            }
          }
        } else if (
          options?.includeWebPageDescription &&
          nodeType === 'WebPage' &&
          !result.subtitle &&
          typeof node.description === 'string'
        ) {
          result.subtitle = node.description.trim();
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  });

  return result;
}
