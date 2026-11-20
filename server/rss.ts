import express, { type Request, type Response } from 'express';
import * as cheerio from 'cheerio';
import {
  USER_AGENT,
  type TmwStoryDto,
  extractArticleId,
  extractJsonLdArticleMeta,
  htmlToReadableBlocks,
  isAllowedPublicUrl,
  resolveUrl,
} from './htmlUtils.ts';
import { TMW_BASE, fetchTmwArticleDto } from './tmw.ts';

export const rssRouter = express.Router();

rssRouter.get('/api/rss/feed', async (req: Request, res: Response) => {
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

rssRouter.get('/api/rss/article', async (req: Request, res: Response) => {
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

    const initialHeadline =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().replace(/\s+/g, ' ').trim() ||
      $('title').first().text().trim();
    const subtitle =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';
    const initialAuthor = $('meta[name="author"]').attr('content')?.trim() || '';
    const initialCategory = $('meta[property="article:section"]').attr('content')?.trim() || '';
    const image = resolveUrl(
      targetUrl,
      $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content'),
    );
    const pubMeta = $('meta[property="article:published_time"]').attr('content')?.trim();
    const initialPublishedTime =
      pubMeta && !Number.isNaN(Date.parse(pubMeta)) ? Math.floor(Date.parse(pubMeta) / 1000) : 0;

    const jsonLd = extractJsonLdArticleMeta($, {
      articleTypes: ['NewsArticle', 'Article', 'BlogPosting'],
    });
    const headline = jsonLd.headline || initialHeadline;
    const author = jsonLd.author || initialAuthor;
    const category = jsonLd.category || initialCategory;
    const publishedTime = jsonLd.publishedTime || initialPublishedTime;

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
