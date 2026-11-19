import express, { type Request, type Response } from 'express';
import * as cheerio from 'cheerio';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load optional .env file for local self-hosting without overriding cloud/system env vars
const localEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(localEnvPath)) {
  try {
    const rawEnv = fs.readFileSync(localEnvPath, 'utf8');
    for (const line of rawEnv.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore unreadable .env file
  }
}

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

async function fetchTmwArticleDto(targetUrl: string): Promise<TmwStoryDto> {
  const response = await fetch(targetUrl, {
    signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch article');
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

  return {
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
}

function isAllowedPublicUrl(rawUrl: string): boolean {
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

function htmlToReadableBlocks(rawHtml: string, baseUrl: string): {
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

app.get('/api/tmw/article', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl || !targetUrl.startsWith(TMW_BASE)) {
    res.status(400).json({ error: 'Invalid TuttoMercatoWeb article URL' });
    return;
  }

  try {
    const article = await fetchTmwArticleDto(targetUrl);
    res.json({ article });
  } catch {
    res.status(502).json({ error: 'Failed to load article content' });
  }
});

app.get('/api/rss/feed', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  const customLabel = String(req.query.label || '').trim();
  if (!isAllowedPublicUrl(targetUrl)) {
    res.status(400).json({ error: 'URL RSS/Atom non valido' });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!response.ok) {
      res.status(502).json({ error: `Errore HTTP ${response.status} nel recupero del feed` });
      return;
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const isAtom = $('feed > entry').length > 0;
    const isRss = $('item').length > 0;
    if (!isAtom && !isRss) {
      res.status(422).json({ error: 'Il link non sembra un feed RSS o Atom valido' });
      return;
    }

    const decodeEntities = (raw: string): string => {
      if (!raw || !raw.includes('&')) return raw;
      return cheerio.load(`<span>${raw}</span>`).text().replace(/\s+/g, ' ').trim();
    };

    const feedTitle =
      decodeEntities(
        (isAtom
          ? $('feed > title').first().text().trim()
          : $('channel > title').first().text().trim()),
      ) ||
      customLabel ||
      new URL(targetUrl).hostname.replace(/^www\./, '');

    const stories: TmwStoryDto[] = [];
    const seenIds = new Set<number>();

    const entries = isAtom ? $('feed > entry') : $('item');
    entries.each((_, el) => {
      const node = $(el);
      const title = decodeEntities(node.find('title').first().text().replace(/\s+/g, ' ').trim());
      if (!title) return;

      let rawLink = '';
      if (isAtom) {
        rawLink =
          node.find('link[rel="alternate"]').first().attr('href') ||
          node.find('link[href]').first().attr('href') ||
          '';
      } else {
        rawLink = node.find('link').first().text().trim() || node.find('guid').first().text().trim();
      }
      const link = resolveUrl(targetUrl, rawLink) || targetUrl;
      const guid = node.find(isAtom ? 'id' : 'guid').first().text().trim();
      // Derive ID from canonical article URL when available so feed and full-article endpoints share identical IDs
      const idSource = rawLink && link !== targetUrl ? link : guid || `${link}#${title}`;
      const id = extractArticleId(idSource);
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const dateStr = (
        node.find('pubDate').first().text() ||
        node.find('dc\\:date').first().text() ||
        node.find('published').first().text() ||
        node.find('updated').first().text()
      ).trim();
      const parsedMs = dateStr ? Date.parse(dateStr) : NaN;
      const time = !Number.isNaN(parsedMs) ? Math.floor(parsedMs / 1000) : Math.floor(Date.now() / 1000);

      const author = decodeEntities(
        (
          node.find('dc\\:creator').first().text() ||
          node.find('author > name').first().text() ||
          node.find('author').first().text()
        )
          .replace(/\s+/g, ' ')
          .trim(),
      );

      const catEl = node.find('category').first();
      const category = decodeEntities(
        (catEl.attr('term') || catEl.text() || customLabel || feedTitle).replace(/\s+/g, ' ').trim(),
      );

      const encoded =
        node.find('content\\:encoded').first().text() ||
        node.find('content').first().text() ||
        '';
      const summary =
        node.find('description').first().text() ||
        node.find('summary').first().text() ||
        '';

      const parsedContent = htmlToReadableBlocks(encoded || summary, link);
      const mediaImg =
        node.find('enclosure[type^="image"]').first().attr('url') ||
        node.find('enclosure').first().attr('url') ||
        node.find('media\\:content').first().attr('url') ||
        node.find('media\\:thumbnail').first().attr('url') ||
        parsedContent.firstImage;

      stories.push({
        id,
        time,
        score: 0,
        parent: 0,
        descendants: 0,
        deleted: false,
        dead: false,
        hidden: false,
        by: author || feedTitle,
        text: parsedContent.text,
        subtitle: parsedContent.excerpt,
        url: link,
        title,
        type: 'story',
        kids: [],
        parts: [],
        image: resolveUrl(link, mediaImg),
        category,
        label: customLabel || feedTitle,
      });
    });

    res.json({ feedTitle, stories: stories.slice(0, 60) });
  } catch {
    res.status(502).json({ error: 'Impossibile raggiungere o leggere il feed RSS' });
  }
});

app.get('/api/rss/article', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!isAllowedPublicUrl(targetUrl)) {
    res.status(400).json({ error: 'Invalid article URL' });
    return;
  }

  if (targetUrl.startsWith(TMW_BASE)) {
    try {
      const article = await fetchTmwArticleDto(targetUrl);
      res.json({ article });
    } catch {
      res.status(502).json({ error: 'Failed to load article content' });
    }
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(9000),
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Failed to fetch article' });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let headline =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().replace(/\s+/g, ' ').trim() ||
      $('title').first().text().trim();
    const subtitle =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';
    let author = $('meta[name="author"]').attr('content')?.trim() || '';
    let category = $('meta[property="article:section"]').attr('content')?.trim() || '';
    const image = resolveUrl(
      targetUrl,
      $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content'),
    );
    const pubMeta = $('meta[property="article:published_time"]').attr('content')?.trim();
    let publishedTime = pubMeta && !Number.isNaN(Date.parse(pubMeta)) ? Math.floor(Date.parse(pubMeta) / 1000) : 0;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).text();
        const data = JSON.parse(raw) as { '@graph'?: Array<Record<string, unknown>> };
        const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data as Record<string, unknown>];
        for (const node of graph) {
          const t = node['@type'];
          if (t === 'NewsArticle' || t === 'Article' || t === 'BlogPosting') {
            if (typeof node.headline === 'string' && node.headline.trim()) {
              headline = node.headline.trim();
            }
            if (typeof node.articleSection === 'string' && node.articleSection.trim()) {
              category = node.articleSection.trim();
            }
            if (typeof node.datePublished === 'string') {
              const parsed = Date.parse(node.datePublished);
              if (!Number.isNaN(parsed)) publishedTime = Math.floor(parsed / 1000);
            }
            const authObj = node.author as { name?: string } | Array<{ name?: string }> | undefined;
            if (Array.isArray(authObj) && authObj[0]?.name) {
              author = authObj[0].name.trim();
            } else if (authObj && !Array.isArray(authObj) && authObj.name) {
              author = authObj.name.trim();
            }
          }
        }
      } catch {
        // Ignore malformed JSON-LD
      }
    });

    const container =
      $('article').first().length > 0
        ? $('article').first().clone()
        : $('main, [role="main"], .post-content, .entry-content, .article-body').first().length > 0
          ? $('main, [role="main"], .post-content, .entry-content, .article-body').first().clone()
          : $('body').first().clone();

    container
      .find('script, style, nav, aside, footer, header, form, iframe, ins, [class*="cookie"], [class*="banner"]')
      .remove();

    const blocks: string[] = [];
    container.find('p, h2, h3, blockquote, li').each((_, el) => {
      const node = $(el);
      const tag = el.tagName?.toLowerCase();
      const content = node.text().replace(/\s+/g, ' ').trim();
      if (!content || content.length < 18) return;
      if (tag === 'h2' || tag === 'h3') {
        blocks.push(`**${content}**`);
      } else if (tag === 'blockquote') {
        blocks.push(`> ${content}`);
      } else {
        blocks.push(content);
      }
    });

    const bodyText = Array.from(new Set(blocks)).join('\n\n') || subtitle;
    const host = new URL(targetUrl).hostname.replace(/^www\./, '');

    const article: TmwStoryDto = {
      id: extractArticleId(targetUrl),
      time: publishedTime || Math.floor(Date.now() / 1000),
      score: 0,
      parent: 0,
      descendants: 0,
      deleted: false,
      dead: false,
      hidden: false,
      by: author || host,
      text: bodyText,
      url: targetUrl,
      title: headline,
      subtitle,
      type: 'story',
      kids: [],
      parts: [],
      image,
      category: category || host,
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

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanArticleTextForPodcast(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitScriptForTts(script: string, maxChars = 2100): string[] {
  const paragraphs = script
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sub = '';
      for (const sentence of sentences) {
        if (sub && sub.length + sentence.length + 1 > maxChars) {
          chunks.push(sub);
          sub = sentence;
        } else {
          sub = sub ? `${sub} ${sentence}` : sentence;
        }
      }
      if (sub) chunks.push(sub);
      continue;
    }

    if (current && current.length + para.length + 2 > maxChars) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function parseWavHeader(buf: Buffer): { headerPrefix: Buffer; pcmData: Buffer; dataSizeOffset: number } | null {
  if (buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      const dataStart = offset + 8;
      const dataEnd = Math.min(buf.length, dataStart + chunkSize);
      return {
        headerPrefix: buf.subarray(0, dataStart),
        pcmData: buf.subarray(dataStart, dataEnd),
        dataSizeOffset: offset + 4,
      };
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

function mergeWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  const firstParsed = parseWavHeader(buffers[0]);
  if (!firstParsed) {
    return Buffer.concat(buffers);
  }

  const pcmParts: Buffer[] = [firstParsed.pcmData];
  for (let i = 1; i < buffers.length; i++) {
    const parsed = parseWavHeader(buffers[i]);
    if (parsed) {
      pcmParts.push(parsed.pcmData);
    } else if (buffers[i].length > 44) {
      pcmParts.push(buffers[i].subarray(44));
    }
  }

  const combinedPcm = Buffer.concat(pcmParts);
  const header = Buffer.from(firstParsed.headerPrefix);
  header.writeUInt32LE(header.length - 8 + combinedPcm.length, 4);
  header.writeUInt32LE(combinedPcm.length, firstParsed.dataSizeOffset);
  return Buffer.concat([header, combinedPcm]);
}

interface PodcastInputArticle {
  id?: unknown;
  title?: unknown;
  by?: unknown;
  category?: unknown;
  subtitle?: unknown;
  text?: unknown;
}

interface GeneratedScriptPayload {
  episodeTitle?: string;
  intro?: string;
  segments?: Array<{
    storyId?: number;
    headline?: string;
    spokenText?: string;
  }>;
  outro?: string;
}

app.get('/api/podcast/status', (_req: Request, res: Response) => {
  res.json({ available: Boolean(process.env.GEMINI_API_KEY?.trim()) });
});

app.post('/api/podcast/generate', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'Servizio Podcast AI non attivo: imposta GEMINI_API_KEY nelle variabili ambiente del server.',
    });
    return;
  }

  const body = req.body as { feedLabel?: unknown; articles?: unknown };
  const feedLabel =
    typeof body?.feedLabel === 'string' && body.feedLabel.trim()
      ? body.feedLabel.trim().slice(0, 80)
      : 'Notiziario';
  const rawArticles = Array.isArray(body?.articles) ? (body.articles as PodcastInputArticle[]) : [];

  const articles = rawArticles
    .slice(0, 15)
    .map((art, idx) => {
      const id = typeof art.id === 'number' && Number.isFinite(art.id) ? art.id : idx + 1;
      const title = typeof art.title === 'string' ? cleanArticleTextForPodcast(art.title) : '';
      const by = typeof art.by === 'string' ? cleanArticleTextForPodcast(art.by) : '';
      const category = typeof art.category === 'string' ? cleanArticleTextForPodcast(art.category) : '';
      const subtitle = typeof art.subtitle === 'string' ? cleanArticleTextForPodcast(art.subtitle) : '';
      const text = typeof art.text === 'string' ? cleanArticleTextForPodcast(art.text) : '';
      const bodySnippet = (text || subtitle).slice(0, 1200);
      return { id, title, by, category, bodySnippet };
    })
    .filter((a) => a.title.length > 0);

  if (articles.length === 0) {
    res.status(400).json({ error: 'Nessun articolo valido disponibile per creare il podcast.' });
    return;
  }

  try {
    const articlesPromptBlock = articles
      .map(
        (a, index) =>
          `[${index + 1}] ID: ${a.id}\nTitolo: ${a.title}\nFonte/Categoria: ${a.category || a.by || feedLabel}\nContenuto: ${a.bodySnippet || a.title}`,
      )
      .join('\n\n---\n\n');

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const isNonRetriableAuthError = (err: unknown): boolean => {
      const e = err as { status?: number; message?: string };
      const st = typeof e?.status === 'number' ? e.status : 0;
      const msg = typeof e?.message === 'string' ? e.message : '';
      return (
        st === 401 ||
        st === 403 ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED')
      );
    };

    const callWithRetryAndFallback = async <T>(
      stage: string,
      steps: Array<{ model: string; delayMs: number; run: () => Promise<T> }>,
    ): Promise<T> => {
      let lastErr: unknown;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.delayMs > 0) {
          await sleep(step.delayMs);
        }
        try {
          return await step.run();
        } catch (err) {
          lastErr = err;
          if (isNonRetriableAuthError(err)) {
            throw err;
          }
          const e = err as { status?: number; message?: string };
          console.warn(
            `[podcast/${stage}] attempt ${i + 1}/${steps.length} (${step.model}) failed:`,
            e?.status ?? 'ERR',
            typeof e?.message === 'string' ? e.message.slice(0, 140) : '',
          );
        }
      }
      throw lastErr;
    };

    const scriptPrompt = `Prepara una rassegna stampa audio in italiano per la sezione "${feedLabel}" basata su questi ${articles.length} articoli:\n\n${articlesPromptBlock}`;
    const scriptSystemInstruction =
      'Sei un giornalista radiofonico professionista di lingua madre italiana. Ricevi fino a 15 articoli che possono essere scritti in qualsiasi lingua (italiano, inglese, spagnolo, francese, tedesco, portoghese o altre) e devi tradurre, rielaborare e sintetizzare TUTTE le notizie in un unico bollettino audio scorrevole in ITALIANO perfetto. ' +
      'Lunghezza complessiva compatta tra 300 e 450 parole (circa 2-3 minuti di lettura naturale), dando risalto ai fatti principali e raggruppando con transizioni fluide le notizie correlate. ' +
      'Regole rigorose per il testo parlato: SOLO prosa naturale pronta per essere letta ad alta voce da uno speaker; NON includere mai URL, domini web, simboli markdown (*, **, #, >), elenchi puntati, parentesi tecniche o emoji. Scrivi eventuali sigle inglesi o nomi stranieri in forma chiara e scorrevole per una lettura italiana.';
    const scriptResponseSchema = {
      type: Type.OBJECT,
      properties: {
        episodeTitle: {
          type: Type.STRING,
          description: 'Titolo breve dell episodio del podcast in italiano.',
        },
        intro: {
          type: Type.STRING,
          description: 'Breve apertura da speaker radiofonico in italiano (1-2 frasi).',
        },
        segments: {
          type: Type.ARRAY,
          description: 'Segmenti del notiziario in italiano corrispondenti agli articoli forniti.',
          items: {
            type: Type.OBJECT,
            properties: {
              storyId: {
                type: Type.INTEGER,
                description: 'ID numerico originale dell articolo.',
              },
              headline: {
                type: Type.STRING,
                description: 'Titolo sintetico della notizia tradotto in italiano.',
              },
              spokenText: {
                type: Type.STRING,
                description: 'Testo parlato in italiano fluido per questa notizia (2-4 frasi).',
              },
            },
            required: ['storyId', 'headline', 'spokenText'],
          },
        },
        outro: {
          type: Type.STRING,
          description: 'Breve chiusura finale da speaker radiofonico in italiano (1-2 frasi).',
        },
      },
      required: ['episodeTitle', 'intro', 'segments', 'outro'],
    };

    const runScriptModel = (model: string, thinkingLevel: ThinkingLevel) =>
      ai.models.generateContent({
        model,
        contents: scriptPrompt,
        config: {
          thinkingConfig: { thinkingLevel },
          systemInstruction: scriptSystemInstruction,
          responseMimeType: 'application/json',
          responseSchema: scriptResponseSchema,
        },
      });

    const scriptResponse = await callWithRetryAndFallback('script', [
      { model: 'gemini-4-hydrogen', delayMs: 0, run: () => runScriptModel('gemini-4-hydrogen', ThinkingLevel.LOW) },
      { model: 'gemini-4-hydrogen', delayMs: 1200, run: () => runScriptModel('gemini-4-hydrogen', ThinkingLevel.LOW) },
      { model: 'gemini-3.1-flash-lite', delayMs: 1000, run: () => runScriptModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL) },
    ]);

    const rawJson = (scriptResponse.text ?? '')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    if (!rawJson) {
      res.status(502).json({ error: 'Risposta vuota dal modello di scrittura del copione.' });
      return;
    }

    const parsed = JSON.parse(rawJson) as GeneratedScriptPayload;
    const validIds = new Set(articles.map((a) => a.id));
    const segments = (Array.isArray(parsed.segments) ? parsed.segments : [])
      .filter((s) => typeof s?.spokenText === 'string' && s.spokenText.trim().length > 0)
      .map((s, idx) => ({
        storyId:
          typeof s.storyId === 'number' && validIds.has(s.storyId)
            ? s.storyId
            : articles[Math.min(idx, articles.length - 1)].id,
        headline: cleanArticleTextForPodcast(
          typeof s.headline === 'string' && s.headline.trim()
            ? s.headline
            : articles[Math.min(idx, articles.length - 1)].title,
        ),
        spokenText: cleanArticleTextForPodcast(s.spokenText ?? ''),
      }));

    const intro = cleanArticleTextForPodcast(parsed.intro ?? '');
    const outro = cleanArticleTextForPodcast(parsed.outro ?? '');
    const episodeTitle = cleanArticleTextForPodcast(
      parsed.episodeTitle?.trim() || `Rassegna ${feedLabel}`,
    );

    const scriptParts = [intro, ...segments.map((s) => s.spokenText), outro].filter(Boolean);
    const fullScript = scriptParts.join('\n\n');
    if (!fullScript) {
      res.status(502).json({ error: 'Copione del podcast non valido.' });
      return;
    }

    const ttsChunks = splitScriptForTts(fullScript, 3400);
    const wavBuffers: Buffer[] = [];

    const runTtsModel = (model: string, chunkText: string) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: chunkText,
                speechMetadata: {
                  style: 'Speaker radiofonico giornalistico italiano, tono chiaro, professionale e naturale',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

    for (const chunkText of ttsChunks) {
      const ttsResponse = await callWithRetryAndFallback('tts', [
        { model: 'gemini-3.8-flash-lite-tts', delayMs: 0, run: () => runTtsModel('gemini-3.8-flash-lite-tts', chunkText) },
        { model: 'gemini-3.8-flash-lite-tts', delayMs: 1200, run: () => runTtsModel('gemini-3.8-flash-lite-tts', chunkText) },
        { model: 'gemini-3.8-flash-tts', delayMs: 1000, run: () => runTtsModel('gemini-3.8-flash-tts', chunkText) },
      ]);

      const base64Part = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Part) {
        res.status(502).json({ error: 'Il modello audio non ha restituito tracce vocali.' });
        return;
      }
      wavBuffers.push(Buffer.from(base64Part, 'base64'));
    }

    const mergedWav = mergeWavBuffers(wavBuffers);
    res.json({
      episodeTitle,
      script: fullScript,
      segments,
      audioBase64: mergedWav.toString('base64'),
      mimeType: 'audio/wav',
      generatedAt: Date.now(),
    });
  } catch (err) {
    const errAny = err as { status?: number; message?: string };
    const status = typeof errAny?.status === 'number' ? errAny.status : 500;
    const rawMsg = typeof errAny?.message === 'string' ? errAny.message : '';
    let detail = rawMsg;
    try {
      const parsedErr = JSON.parse(rawMsg) as { error?: { message?: string; status?: string } };
      if (parsedErr?.error?.message) {
        detail = parsedErr.error.message;
      }
    } catch {
      // rawMsg is plain text
    }
    detail = detail.slice(0, 180).trim();
    console.error('[podcast/generate]', status, detail || rawMsg);

    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      res.status(429).json({
        error: 'Quota gratuita Gemini temporaneamente esaurita (429): attendi 1 minuto e riprova.',
      });
      return;
    }
    if (status === 503 || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
      res.status(503).json({
        error: 'I server Gemini sono momentaneamente sovraccarichi (503). Attendi qualche secondo e riprova.',
      });
      return;
    }
    if (
      status === 401 ||
      status === 403 ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED')
    ) {
      res.status(403).json({
        error:
          'Chiave GEMINI_API_KEY non valida o bloccata per chiamate da server esterno (403). Crea una nuova chiave gratuita su Google AI Studio senza restrizioni di dominio.',
      });
      return;
    }
    if (status === 404 || rawMsg.includes('NOT_FOUND')) {
      res.status(502).json({
        error: `Modello AI non disponibile per questa chiave (404)${detail ? `: ${detail}` : ''}`,
      });
      return;
    }
    if (status === 400) {
      res.status(400).json({
        error: `Richiesta AI non valida (400)${detail ? `: ${detail}` : ''}`,
      });
      return;
    }
    res.status(502).json({
      error: `Errore nella generazione del podcast AI (${status})${detail ? `: ${detail}` : ''}`,
    });
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
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TMW Reader server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
