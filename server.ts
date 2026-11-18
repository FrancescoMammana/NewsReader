import express, { type Request, type Response } from 'express';
import * as cheerio from 'cheerio';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isDev = process.env.NODE_ENV === 'development';
const PORT = isDev ? 3000 : Number(process.env.PORT) || 3000;
const TMW_BASE = 'https://www.tuttomercatoweb.com';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

app.use(express.json({ limit: '1mb' }));

interface CachedPreview {
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
  fetchedAt: number;
}

interface TmwStoryDto {
  id: number;
  time: number;
  score: number;
  parent: number;
  descendants: number;
  deleted: boolean;
  dead: boolean;
  hidden: boolean;
  by: string;
  text: string;
  url: string;
  title: string;
  type: 'story';
  kids: number[];
  parts: number[];
  image?: string;
  category?: string;
  label?: string;
  subtitle?: string;
  related?: TmwStoryDto[];
}

const previewCache = new Map<string, CachedPreview>();
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

const TMW_MONTHS: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

function resolveUrl(base: string, relative?: string): string | undefined {
  if (!relative) return undefined;
  const trimmed = relative.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return undefined;
  }
}

function extractArticleId(url: string): number {
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

function parseTmwDayAndTime(dayLabel: string, hhmm: string): number {
  const now = new Date();
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const normalizedDay = dayLabel.trim().toLowerCase();

  if (normalizedDay === 'ieri') {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (normalizedDay && normalizedDay !== 'oggi') {
    const parts = normalizedDay.split(/\s+/);
    // e.g. "lunedì 16 novembre" or "16 novembre"
    const dayNum = parts.find((p) => /^\d{1,2}$/.test(p));
    const monthName = parts.find((p) => p in TMW_MONTHS);
    if (dayNum && monthName) {
      const mIdx = TMW_MONTHS[monthName];
      const dNum = Number(dayNum);
      let year = now.getFullYear();
      if (mIdx > now.getMonth() + 1) {
        year -= 1;
      }
      targetDate = new Date(year, mIdx, dNum);
    }
  }

  const timeMatch = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    targetDate.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }

  return Math.floor(targetDate.getTime() / 1000);
}

function upgradeThumbUrl(imgUrl?: string): string | undefined {
  return imgUrl;
}

function parseTmwListHtml(html: string): TmwStoryDto[] {
  const $ = cheerio.load(html);
  const stories: TmwStoryDto[] = [];
  const seenIds = new Set<number>();

  const listRoot = $('.tcc-list-news').first();
  if (listRoot.length === 0) return stories;

  let currentDay = 'Oggi';

  listRoot.children().each((_, child) => {
    const el = $(child);
    if (el.hasClass('row') && !el.is('a')) {
      const dayText = el.find('.hh.fw-bold').first().text().trim();
      if (dayText) currentDay = dayText;
      return;
    }

    if (!el.is('a.list-item')) return;
    const href = el.attr('href');
    const fullUrl = resolveUrl(TMW_BASE, href);
    if (!fullUrl) return;

    const id = extractArticleId(fullUrl);
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const timeText =
      el.find('.hh.serif').first().text().trim() ||
      el.find('.sez').first().text().trim().match(/\d{1,2}:\d{2}/)?.[0] ||
      '';

    const label = el.find('.tcc-label').first().text().replace(/\s+/g, ' ').trim() || undefined;

    // Extract section name from mobile .sez or URL path
    let category = '';
    const sezClone = el.find('.sez').first().clone();
    sezClone.find('.tcc-label').remove();
    const sezRaw = sezClone.text().replace(/\d{1,2}:\d{2}/, '').replace(/\s+/g, ' ').trim();
    if (sezRaw) {
      category = sezRaw;
    } else {
      const seg = new URL(fullUrl).pathname.split('/').filter(Boolean)[0] || '';
      category = seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const titleNode = el.find('.line-clamp-2').first().clone();
    titleNode.find('span').remove();
    const title = titleNode.text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const imgEl = el.find('img').first();
    const rawImg = imgEl.attr('src') || imgEl.attr('data-src');
    const image = upgradeThumbUrl(resolveUrl(TMW_BASE, rawImg));

    stories.push({
      id,
      time: parseTmwDayAndTime(currentDay, timeText),
      score: 0,
      parent: 0,
      descendants: 0,
      deleted: false,
      dead: false,
      hidden: false,
      by: label ? `${category} · ${label}` : category || 'TUTTOmercatoWEB',
      text: '',
      url: fullUrl,
      title,
      type: 'story',
      kids: [],
      parts: [],
      image,
      category: category || 'Calcio',
      label,
    });
  });

  return stories;
}

async function fetchTmwRssMap(): Promise<Map<number, { text: string; image?: string; time?: number; category?: string }>> {
  const map = new Map<number, { text: string; image?: string; time?: number; category?: string }>();
  try {
    const r = await fetch(`${TMW_BASE}/rss/`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!r.ok) return map;
    const xml = await r.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').each((_, itemEl) => {
      const item = $(itemEl);
      const link = item.find('link').text().trim();
      if (!link) return;
      const id = extractArticleId(link);
      const desc = item.find('description').text().replace(/\s+/g, ' ').trim();
      const image = item.find('enclosure').attr('url') || undefined;
      const pubDate = item.find('pubDate').text().trim();
      const category = item.find('category').first().text().trim() || undefined;
      const parsedTime = pubDate ? Math.floor(Date.parse(pubDate) / 1000) : undefined;
      map.set(id, {
        text: desc,
        image,
        time: parsedTime && !Number.isNaN(parsedTime) ? parsedTime : undefined,
        category,
      });
    });
  } catch {
    // Non-fatal; HTML list still provides full headlines
  }
  return map;
}

const CATEGORY_PATHS: Record<string, string> = {
  latest: '/ricerca/',
  serieA: '/serie-a/',
  estero: '/calcio-estero/',
  serieB: '/serie-b/',
  editoriale: '/editoriale/',
};

app.get('/api/tmw/feed', async (req: Request, res: Response) => {
  const categoryKey = String(req.query.category || 'latest');
  const start = Math.max(0, Number(req.query.start) || 0);
  const basePath = CATEGORY_PATHS[categoryKey] || '/ricerca/';
  const targetUrl = `${TMW_BASE}${basePath}${start > 0 ? `?start=${start}` : ''}`;

  try {
    const [htmlRes, rssMap] = await Promise.all([
      fetch(targetUrl, {
        signal: AbortSignal.timeout(9000),
        headers: { 'User-Agent': USER_AGENT },
      }),
      start === 0 ? fetchTmwRssMap() : Promise.resolve(new Map()),
    ]);

    if (!htmlRes.ok) {
      res.status(502).json({ error: 'Failed to load TuttoMercatoWeb feed' });
      return;
    }

    const html = await htmlRes.text();
    const stories = parseTmwListHtml(html).map((s) => {
      const rss = rssMap.get(s.id);
      if (!rss) return s;
      return {
        ...s,
        text: rss.text || s.text,
        image: rss.image || s.image,
        time: rss.time || s.time,
        category: rss.category || s.category,
      };
    });

    res.json({ stories, nextStart: stories.length > 0 ? start + stories.length : null });
  } catch {
    res.status(502).json({ error: 'Failed to reach TuttoMercatoWeb' });
  }
});

app.get('/api/tmw/article', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl || !targetUrl.startsWith(TMW_BASE)) {
    res.status(400).json({ error: 'Invalid TuttoMercatoWeb article URL' });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Failed to fetch article' });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let headline = $('h1').first().text().replace(/\s+/g, ' ').trim();
    let subtitle = $('.articolo h2').first().text().replace(/\s+/g, ' ').trim();
    let author = '';
    let category = '';
    let image = $('meta[property="og:image"]').attr('content')?.trim() || undefined;
    let publishedTime = 0;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).text();
        const data = JSON.parse(raw) as { '@graph'?: Array<Record<string, unknown>> };
        const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data as Record<string, unknown>];
        for (const node of graph) {
          if (node['@type'] === 'NewsArticle') {
            if (typeof node.headline === 'string' && node.headline.trim()) {
              headline = node.headline.trim();
            }
            if (typeof node.articleSection === 'string' && node.articleSection.trim()) {
              category = node.articleSection.trim();
            }
            if (typeof node.datePublished === 'string') {
              const parsed = Date.parse(node.datePublished);
              if (!Number.isNaN(parsed)) {
                publishedTime = Math.floor(parsed / 1000);
              }
            }
            const authObj = node.author as { name?: string } | undefined;
            if (authObj?.name) {
              author = authObj.name.trim();
            }
            const imgObj = node.image as { url?: string } | string | undefined;
            if (typeof imgObj === 'string') {
              image = imgObj;
            } else if (imgObj && typeof imgObj.url === 'string') {
              image = imgObj.url;
            }
          } else if (node['@type'] === 'WebPage' && !subtitle && typeof node.description === 'string') {
            subtitle = node.description.trim();
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks
      }
    });

    const art = $('.articolo').first().clone();
    art.find('script, style, .adv-margin, .adv-width-box, .placeholder, [id^="inRead"], iframe, ins').remove();

    const blocks: string[] = [];
    const textContainer = art.find('.text').first();
    textContainer.children().each((_, child) => {
      const node = $(child);
      const tag = child.tagName?.toLowerCase();
      if (tag === 'div') return;

      // Convert links inline cleanly
      node.find('a').each((__, a) => {
        const anchor = $(a);
        const linkText = anchor.text().trim();
        const href = resolveUrl(TMW_BASE, anchor.attr('href'));
        if (linkText && href) {
          anchor.replaceWith(`${linkText} (${href})`);
        }
      });

      const content = node.text().replace(/\s+/g, ' ').trim();
      if (!content) return;
      if (tag === 'h2' || tag === 'h3') {
        blocks.push(`**${content}**`);
      } else {
        blocks.push(content);
      }
    });

    const bodyText =
      blocks.join('\n\n') ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';

    // Extract related stories on page
    const related: TmwStoryDto[] = [];
    const seenRelated = new Set<number>([extractArticleId(targetUrl)]);
    $('a.list-item, a.row.my-1[href]').each((_, el) => {
      if (related.length >= 12) return false;
      const itemEl = $(el);
      const rawHref = itemEl.attr('href') || '';
      if (!rawHref.startsWith('/') && !rawHref.startsWith(TMW_BASE)) return;
      if (!/-\d{5,9}(?:[/?#]|$)/.test(rawHref)) return;
      const fullUrl = resolveUrl(TMW_BASE, rawHref);
      if (!fullUrl) return;
      const id = extractArticleId(fullUrl);
      if (seenRelated.has(id)) return;
      seenRelated.add(id);

      const titleNode = itemEl.find('.line-clamp-2').first().clone();
      titleNode.find('span').remove();
      const relTitle = titleNode.text().replace(/\s+/g, ' ').trim();
      if (!relTitle) return;

      const timeText = itemEl.find('.hh.serif').first().text().trim() || '';
      const rawImg = itemEl.find('img').first().attr('src') || itemEl.find('img').first().attr('data-src');
      const seg = new URL(fullUrl).pathname.split('/').filter(Boolean)[0] || '';
      const relCat = seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      related.push({
        id,
        time: parseTmwDayAndTime('Oggi', timeText),
        score: 0,
        parent: 0,
        descendants: 0,
        deleted: false,
        dead: false,
        hidden: false,
        by: relCat || 'TUTTOmercatoWEB',
        text: '',
        url: fullUrl,
        title: relTitle,
        type: 'story',
        kids: [],
        parts: [],
        image: upgradeThumbUrl(resolveUrl(TMW_BASE, rawImg)),
        category: relCat || 'Calcio',
      });
    });

    const article: TmwStoryDto = {
      id: extractArticleId(targetUrl),
      time: publishedTime || Math.floor(Date.now() / 1000),
      score: 0,
      parent: 0,
      descendants: related.length,
      deleted: false,
      dead: false,
      hidden: false,
      by: author || category || 'Redazione TMW',
      text: bodyText,
      url: targetUrl,
      title: headline,
      subtitle,
      type: 'story',
      kids: [],
      parts: [],
      image,
      category: category || 'TUTTOmercatoWEB',
      related,
    };

    res.json({ article });
  } catch {
    res.status(502).json({ error: 'Failed to load article content' });
  }
});

app.get('/api/tmw/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const categoryFilter = String(req.query.category || '').trim().toLowerCase();
  const start = Math.max(0, Number(req.query.start) || 0);

  try {
    const searchUrl = q
      ? `${TMW_BASE}/?action=searchform&word=${encodeURIComponent(q)}&send=Cerca${start > 0 ? `&start=${start}` : ''}`
      : `${TMW_BASE}/ricerca/${start > 0 ? `?start=${start}` : ''}`;

    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Search failed on TuttoMercatoWeb' });
      return;
    }

    const html = await response.text();
    let stories = parseTmwListHtml(html);

    if (categoryFilter) {
      stories = stories.filter((s) => {
        const hay = `${s.url} ${s.category || ''} ${s.label || ''} ${s.title}`.toLowerCase();
        if (categoryFilter === 'esclusiva') return hay.includes('esclusiv');
        return hay.includes(categoryFilter);
      });
    }

    res.json({ stories });
  } catch {
    res.status(502).json({ error: 'Search failed' });
  }
});

app.get('/api/link-preview', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  const cached = previewCache.get(targetUrl);
  if (cached && Date.now() - cached.fetchedAt < PREVIEW_TTL_MS) {
    res.json(cached);
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      const info: CachedPreview = { image: targetUrl, fetchedAt: Date.now() };
      previewCache.set(targetUrl, info);
      res.json(info);
      return;
    }

    if (!response.ok || !contentType.includes('text/html')) {
      res.json({ fetchedAt: Date.now() });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || $('title').first().text().trim();
    const rawDesc =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[name="Description"]').attr('content')?.trim();

    const description =
      rawDesc && !rawDesc.includes('JavaScript is disabled in your browser')
        ? rawDesc
        : undefined;

    const ogImage = resolveUrl(
      targetUrl,
      $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content'),
    );

    let iconHref =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href');
    if (iconHref && iconHref.toLowerCase().includes('.svg')) {
      iconHref = undefined;
    }
    const icon = resolveUrl(targetUrl, iconHref);

    const info: CachedPreview = {
      title: ogTitle || undefined,
      description,
      image: ogImage,
      icon,
      fetchedAt: Date.now(),
    };

    if (previewCache.size > 500) {
      const firstKey = previewCache.keys().next().value;
      if (firstKey) previewCache.delete(firstKey);
    }
    previewCache.set(targetUrl, info);
    res.json(info);
  } catch {
    res.json({ fetchedAt: Date.now() });
  }
});

async function startServer() {
  if (!isDev) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hacki server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
