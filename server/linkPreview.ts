import express, { type Request, type Response } from 'express';
import * as cheerio from 'cheerio';
import { USER_AGENT, resolveUrl } from './htmlUtils.ts';

interface CachedPreview {
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
  fetchedAt: number;
}

const previewCache = new Map<string, CachedPreview>();
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export const linkPreviewRouter = express.Router();

linkPreviewRouter.get('/api/link-preview', async (req: Request, res: Response) => {
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
