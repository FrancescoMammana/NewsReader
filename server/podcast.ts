import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface PodcastInputArticle {
  id?: unknown;
  title?: unknown;
  by?: unknown;
  category?: unknown;
  subtitle?: unknown;
  text?: unknown;
}

export interface PreparedPodcastArticle {
  id: number;
  title: string;
  by: string;
  category: string;
  bodySnippet: string;
}

export interface PodcastArtifacts {
  episodeTitle: string;
  script: string;
  segments: Array<{ storyId: number; headline: string }>;
  audioBase64: string;
  mimeType: string;
  generatedAt: number;
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

export class PodcastError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const SCRIPT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
const MAX_SCRIPT_CHARS = 4500;

let client: GoogleGenAI | null | undefined;

function getGeminiClient(): GoogleGenAI | null {
  if (client !== undefined) return client;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  client = apiKey
    ? new GoogleGenAI({
        apiKey,
        apiVersion: 'v1beta',
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      })
    : null;
  return client;
}

export function isPodcastAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function cleanText(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function preparePodcastArticles(rawArticles: unknown): PreparedPodcastArticle[] {
  const articles = Array.isArray(rawArticles) ? (rawArticles as PodcastInputArticle[]) : [];
  return articles
    .slice(0, 15)
    .map((article, index) => {
      const id =
        typeof article?.id === 'number' && Number.isFinite(article.id) ? article.id : index + 1;
      const title = typeof article?.title === 'string' ? cleanText(article.title) : '';
      const by = typeof article?.by === 'string' ? cleanText(article.by) : '';
      const category = typeof article?.category === 'string' ? cleanText(article.category) : '';
      const subtitle = typeof article?.subtitle === 'string' ? cleanText(article.subtitle) : '';
      const text = typeof article?.text === 'string' ? cleanText(article.text) : '';
      return { id, title, by, category, bodySnippet: (text || subtitle).slice(0, 1200) };
    })
    .filter((article) => article.title.length > 0);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isNonRetriableAuthError(error: unknown): boolean {
  const err = error as { status?: number; message?: string };
  const status = typeof err?.status === 'number' ? err.status : 0;
  const message = typeof err?.message === 'string' ? err.message : '';
  return (
    status === 401 ||
    status === 403 ||
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED')
  );
}

async function withFallback<T>(
  stage: string,
  models: string[],
  run: (model: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    if (index > 0) {
      console.warn(`[podcast/${stage}] riprovo con ${model} tra 1 secondo`);
      await sleep(1000);
    }
    try {
      return await run(model);
    } catch (error) {
      lastError = error;
      if (isNonRetriableAuthError(error)) throw error;
      const err = error as { status?: number; message?: string };
      console.warn(
        `[podcast/${stage}] tentativo ${index + 1}/${models.length} (${model}) non riuscito:`,
        err?.status ?? 'ERR',
        typeof err?.message === 'string' ? err.message.slice(0, 140) : '',
      );
    }
  }
  throw lastError;
}

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

const SCRIPT_SYSTEM_INSTRUCTION =
  'Sei un giornalista radiofonico professionista di lingua madre italiana. Ricevi fino a 15 articoli che possono essere scritti in qualsiasi lingua (italiano, inglese, spagnolo, francese, tedesco, portoghese o altre) e devi tradurre, rielaborare e sintetizzare TUTTE le notizie in un unico bollettino audio scorrevole in ITALIANO perfetto. ' +
  'Lunghezza complessiva compatta tra 300 e 450 parole (circa 2-3 minuti di lettura naturale), dando risalto ai fatti principali e raggruppando con transizioni fluide le notizie correlate. ' +
  'Regole rigorose per il testo parlato: SOLO prosa naturale pronta per essere letta ad alta voce da uno speaker; NON includere mai URL, domini web, simboli markdown (*, **, #, >), elenchi puntati, parentesi tecniche o emoji. Scrivi eventuali sigle inglesi o nomi stranieri in forma chiara e scorrevole per una lettura italiana.';

async function generateScript(
  ai: GoogleGenAI,
  feedLabel: string,
  articles: PreparedPodcastArticle[],
): Promise<{ episodeTitle: string; fullScript: string; segments: PodcastArtifacts['segments'] }> {
  const articlesPromptBlock = articles
    .map(
      (article, index) =>
        `[${index + 1}] ID: ${article.id}\nTitolo: ${article.title}\nFonte/Categoria: ${article.category || article.by || feedLabel}\nContenuto: ${article.bodySnippet || article.title}`,
    )
    .join('\n\n---\n\n');

  const prompt = `Prepara una rassegna stampa audio in italiano per la sezione "${feedLabel}" basata su questi ${articles.length} articoli:\n\n${articlesPromptBlock}`;

  const response = await withFallback('script', SCRIPT_MODELS, (model) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        systemInstruction: SCRIPT_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: scriptResponseSchema,
      },
    }),
  );

  let parsed: GeneratedScriptPayload;
  try {
    parsed = JSON.parse(response.text ?? '') as GeneratedScriptPayload;
  } catch {
    throw new PodcastError(502, 'Risposta non valida dal modello di scrittura del copione.');
  }

  const validIds = new Set(articles.map((article) => article.id));
  const segments = (Array.isArray(parsed.segments) ? parsed.segments : [])
    .filter((segment) => typeof segment?.spokenText === 'string' && segment.spokenText.trim())
    .map((segment, index) => {
      const fallback = articles[Math.min(index, articles.length - 1)];
      return {
        storyId:
          typeof segment.storyId === 'number' && validIds.has(segment.storyId)
            ? segment.storyId
            : fallback.id,
        headline: cleanText(
          typeof segment.headline === 'string' && segment.headline.trim()
            ? segment.headline
            : fallback.title,
        ),
        spokenText: cleanText(segment.spokenText ?? ''),
      };
    });

  const intro = cleanText(parsed.intro ?? '');
  const outro = cleanText(parsed.outro ?? '');
  const episodeTitle = cleanText(parsed.episodeTitle?.trim() || `Rassegna ${feedLabel}`);
  const fullScript = [intro, ...segments.map((segment) => segment.spokenText), outro]
    .filter(Boolean)
    .join('\n\n');

  if (!fullScript) throw new PodcastError(502, 'Copione del podcast non valido.');

  return { episodeTitle, fullScript, segments };
}

async function synthesize(ai: GoogleGenAI, script: string): Promise<string> {
  const text = script.slice(0, MAX_SCRIPT_CHARS);
  const response = await withFallback('tts', TTS_MODELS, (model) =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
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
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    }),
  );

  const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) {
    throw new PodcastError(502, 'Il modello audio non ha restituito tracce vocali.');
  }
  return audioBase64;
}

export async function generatePodcastArtifacts(
  feedLabel: string,
  articles: PreparedPodcastArticle[],
): Promise<PodcastArtifacts> {
  const ai = getGeminiClient();
  if (!ai) throw new PodcastError(503, 'Chiave GEMINI_API_KEY non configurata.');

  const { episodeTitle, fullScript, segments } = await generateScript(ai, feedLabel, articles);
  const audioBase64 = await synthesize(ai, fullScript);

  return {
    episodeTitle,
    script: fullScript,
    segments: segments.map(({ storyId, headline }) => ({ storyId, headline })),
    audioBase64,
    mimeType: 'audio/wav',
    generatedAt: Date.now(),
  };
}

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Richiesta AI non valida (400). Controlla gli articoli inviati.',
  403: 'Chiave GEMINI_API_KEY non valida o bloccata per chiamate da server esterno (403). Crea una nuova chiave gratuita su Google AI Studio senza restrizioni di dominio.',
  429: 'Quota gratuita Gemini temporaneamente esaurita (429): attendi 1 minuto e riprova.',
  502: 'Errore nella generazione del podcast AI.',
  503: 'I server Gemini sono momentaneamente sovraccarichi (503). Attendi qualche secondo e riprova.',
};

export function podcastHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof PodcastError) {
    return { status: error.statusCode, message: error.message };
  }

  const err = error as { status?: number; message?: string };
  const status = typeof err?.status === 'number' ? err.status : 502;
  const raw = typeof err?.message === 'string' ? err.message : '';
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    detail = parsed?.error?.message ?? raw;
  } catch {
    // Il messaggio è testo semplice.
  }
  detail = detail.slice(0, 180).trim();
  console.error('[podcast/generate]', status, detail || raw);

  const code =
    status === 429 || raw.includes('RESOURCE_EXHAUSTED')
      ? 429
      : status === 401 || status === 403 || raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')
        ? 403
        : status === 503 || raw.includes('UNAVAILABLE') || raw.includes('high demand')
          ? 503
          : status === 404 || raw.includes('NOT_FOUND')
            ? 502
            : status === 400
              ? 400
              : 502;
  const base = ERROR_MESSAGES[code];
  const extra = detail && code !== 403 ? `: ${detail}` : '';
  return { status: code, message: `${base}${extra}` };
}
