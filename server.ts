import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmwRouter } from './server/tmw.ts';
import { rssRouter } from './server/rss.ts';
import { linkPreviewRouter } from './server/linkPreview.ts';
import { aiQuestionRouter } from './server/aiQuestion.ts';
import { getMissingConfigMessage, type AiRuntimeOverrides } from './server/aiProvider.ts';
import {
  getPublicAiSettingsPayload,
  resetStoredSettingsForActiveProvider,
  updateStoredSettingsForActiveProvider,
} from './server/aiSettings.ts';
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
app.use(aiQuestionRouter);

function extractSafeAiOverrides(raw: unknown): AiRuntimeOverrides | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const overrides: AiRuntimeOverrides = {};
  if (typeof obj.textModel === 'string' && obj.textModel.trim()) {
    overrides.textModel = obj.textModel.trim();
  }
  if (typeof obj.audioModel === 'string' && obj.audioModel.trim()) {
    overrides.audioModel = obj.audioModel.trim();
  }
  if (typeof obj.voice === 'string' && obj.voice.trim()) {
    overrides.voice = obj.voice.trim();
  }
  if (typeof obj.baseUrl === 'string' && obj.baseUrl.trim()) {
    overrides.baseUrl = obj.baseUrl.trim();
  }
  if (typeof obj.audioFormat === 'string' && obj.audioFormat.trim()) {
    overrides.audioFormat = obj.audioFormat.trim();
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

app.get('/api/ai/settings', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(await getPublicAiSettingsPayload());
});

app.put('/api/ai/settings', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const safePatch = extractSafeAiOverrides(body) ?? {};
  updateStoredSettingsForActiveProvider(safePatch);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(await getPublicAiSettingsPayload());
});

app.post('/api/ai/settings/reset', async (_req: Request, res: Response) => {
  resetStoredSettingsForActiveProvider();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(await getPublicAiSettingsPayload());
});

app.get('/api/podcast/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({ available: isPodcastAvailable() });
});

app.post('/api/podcast/generate', async (req: Request, res: Response) => {
  const body = req.body as {
    feedLabel?: unknown;
    articles?: unknown;
    aiConfig?: unknown;
  };
  const overrides = extractSafeAiOverrides(body?.aiConfig);

  if (!isPodcastAvailable(overrides)) {
    res.status(503).json({
      error: getMissingConfigMessage('podcast'),
    });
    return;
  }

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
    res.json(await generatePodcastArtifacts(feedLabel, articles, overrides));
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
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.type = 'text/css';
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`);
    });
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
