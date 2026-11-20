import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmwRouter } from './server/tmw.ts';
import { rssRouter } from './server/rss.ts';
import { linkPreviewRouter } from './server/linkPreview.ts';
import {
  generatePodcastArtifacts,
  isPodcastAvailable,
  podcastHttpError,
  preparePodcastArticles,
} from './server/podcast.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv(): void {
  const localEnvPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(localEnvPath)) return;
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

loadLocalEnv();

const app = express();
const isDev = process.env.NODE_ENV === 'development';
const PORT = isDev ? 3000 : Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

app.use(tmwRouter);
app.use(rssRouter);
app.use(linkPreviewRouter);

app.get('/api/podcast/status', (_req: Request, res: Response) => {
  res.json({ available: isPodcastAvailable() });
});

app.post('/api/podcast/generate', async (req: Request, res: Response) => {
  if (!isPodcastAvailable()) {
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
  const articles = preparePodcastArticles(body?.articles);
  if (articles.length === 0) {
    res.status(400).json({ error: 'Nessun articolo valido disponibile per creare il podcast.' });
    return;
  }

  try {
    res.json(await generatePodcastArtifacts(feedLabel, articles));
  } catch (err) {
    const { status, message } = podcastHttpError(err);
    res.status(status).json({ error: message });
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
