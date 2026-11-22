import express, { type Request, type Response } from 'express';
import * as cheerio from 'cheerio';
import {
  USER_AGENT,
  type TmwStoryDto,
  extractArticleId,
  extractJsonLdArticleMeta,
  resolveUrl,
} from './htmlUtils.ts';

export const TMW_BASE = 'https://www.tuttomercatoweb.com';

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

const CATEGORY_PATHS: Record<string, string> = {
  latest: '/ricerca/',
  serieA: '/serie-a/',
  estero: '/calcio-estero/',
  serieB: '/serie-b/',
  editoriale: '/editoriale/',
};

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
      parent: 0,
      hidden: false,
      by: label ? `${category} · ${label}` : category || 'TUTTOmercatoWEB',
      text: '',
      url: fullUrl,
      title,
      type: 'story',
      image,
      category: category || 'Calcio',
      label,
    });
  });

  return stories;
}

async function fetchTmwRssMap(): Promise<
  Map<number, { text: string; image?: string; time?: number; category?: string }>
> {
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

export async function fetchTmwArticleDto(targetUrl: string): Promise<TmwStoryDto> {
  const response = await fetch(targetUrl, {
    signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch article');
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const initialHeadline = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const initialSubtitle = $('.articolo h2').first().text().replace(/\s+/g, ' ').trim();
  const initialImage = $('meta[property="og:image"]').attr('content')?.trim() || undefined;
  const jsonLd = extractJsonLdArticleMeta($, {
    articleTypes: ['NewsArticle'],
    includeImage: true,
    includeWebPageDescription: !initialSubtitle,
  });

  const headline = jsonLd.headline || initialHeadline;
  const subtitle = initialSubtitle || jsonLd.subtitle || '';
  const author = jsonLd.author || '';
  const category = jsonLd.category || '';
  const image = jsonLd.image || initialImage;
  const publishedTime = jsonLd.publishedTime || 0;

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
      parent: 0,
      hidden: false,
      by: relCat || 'TUTTOmercatoWEB',
      text: '',
      url: fullUrl,
      title: relTitle,
      type: 'story',
      image: upgradeThumbUrl(resolveUrl(TMW_BASE, rawImg)),
      category: relCat || 'Calcio',
    });
  });

  return {
    id: extractArticleId(targetUrl),
    time: publishedTime || Math.floor(Date.now() / 1000),
    parent: 0,
    hidden: false,
    by: author || category || 'Redazione TMW',
    text: bodyText,
    url: targetUrl,
    title: headline,
    subtitle,
    type: 'story',
    image,
    category: category || 'TUTTOmercatoWEB',
    related,
  };
}

export const tmwRouter = express.Router();

tmwRouter.get('/api/tmw/feed', async (req: Request, res: Response) => {
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

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ stories, nextStart: stories.length > 0 ? start + stories.length : null });
  } catch {
    res.status(502).json({ error: 'Failed to reach TuttoMercatoWeb' });
  }
});

tmwRouter.get('/api/tmw/article', async (req: Request, res: Response) => {
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

tmwRouter.get('/api/tmw/search', async (req: Request, res: Response) => {
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
