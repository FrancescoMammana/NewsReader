import { Type, type Schema } from '@google/genai';
import {
  AiProviderError,
  generateAiText,
  getMissingConfigMessage,
  isPodcastAvailable as isProviderPodcastAvailable,
  synthesizeAiSpeech,
  toAiHttpError,
  type AiRuntimeOverrides,
} from './aiProvider.ts';

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
  episodeTitle?: unknown;
  intro?: unknown;
  segments?: unknown;
  outro?: unknown;
}

const MAX_SCRIPT_CHARS = 4500;

export function isPodcastAvailable(overrides?: AiRuntimeOverrides): boolean {
  return isProviderPodcastAvailable(process.env, overrides);
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

const scriptResponseSchema: Schema = {
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
  'Lunghezza complessiva compatta tra 450 e 550 parole (circa 3-4 minuti di lettura naturale), coprendo in modo equilibrato tutte le notizie fornite e collegandole con transizioni fluide. ' +
  'Regole rigorose per il testo parlato: SOLO prosa naturale pronta per essere letta ad alta voce da uno speaker; NON includere mai URL, domini web, simboli markdown (*, **, #, >), elenchi puntati, parentesi tecniche o emoji. Scrivi eventuali sigle inglesi o nomi stranieri in forma chiara e scorrevole per una lettura italiana. ' +
  'Rispondi ESCLUSIVAMENTE con un oggetto JSON valido avente questa struttura esatta: {"episodeTitle":"string","intro":"string","segments":[{"storyId":123,"headline":"string","spokenText":"string"}],"outro":"string"}.';

function parseScriptJson(raw: string): GeneratedScriptPayload {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiProviderError(502, 'Risposta non valida dal modello di scrittura del copione.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiProviderError(502, 'Formato JSON del copione non valido.');
  }
  const obj = parsed as GeneratedScriptPayload;
  if (!Array.isArray(obj.segments) || obj.segments.length === 0) {
    throw new AiProviderError(502, 'Il copione generato non contiene segmenti validi.');
  }
  return obj;
}

async function generateScript(
  feedLabel: string,
  articles: PreparedPodcastArticle[],
  overrides?: AiRuntimeOverrides,
): Promise<{ episodeTitle: string; fullScript: string; segments: PodcastArtifacts['segments'] }> {
  const articlesPromptBlock = articles
    .map(
      (article, index) =>
        `[${index + 1}] ID: ${article.id}\nTitolo: ${article.title}\nFonte/Categoria: ${article.category || article.by || feedLabel}\nContenuto: ${article.bodySnippet || article.title}`,
    )
    .join('\n\n---\n\n');

  const prompt = `Prepara una rassegna stampa audio in italiano per la sezione "${feedLabel}" basata su questi ${articles.length} articoli:\n\n${articlesPromptBlock}`;

  const rawText = await generateAiText({
    systemInstruction: SCRIPT_SYSTEM_INSTRUCTION,
    prompt,
    jsonSchema: scriptResponseSchema,
    thinkingMinimalForGemini3: true,
    overrides,
  });

  const parsed = parseScriptJson(rawText);
  const validIds = new Set(articles.map((article) => article.id));
  const rawSegments = parsed.segments as Array<{
    storyId?: unknown;
    headline?: unknown;
    spokenText?: unknown;
  }>;

  const segments = rawSegments
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
        spokenText: cleanText(segment.spokenText as string),
      };
    });

  const intro = cleanText(typeof parsed.intro === 'string' ? parsed.intro : '');
  const outro = cleanText(typeof parsed.outro === 'string' ? parsed.outro : '');
  const titleRaw = typeof parsed.episodeTitle === 'string' ? parsed.episodeTitle.trim() : '';
  const episodeTitle = cleanText(titleRaw || `Rassegna ${feedLabel}`);
  const fullScript = [intro, ...segments.map((segment) => segment.spokenText), outro]
    .filter(Boolean)
    .join('\n\n');

  if (!fullScript || segments.length === 0) {
    throw new AiProviderError(502, 'Copione del podcast non valido.');
  }

  return { episodeTitle, fullScript, segments };
}

export async function generatePodcastArtifacts(
  feedLabel: string,
  articles: PreparedPodcastArticle[],
  overrides?: AiRuntimeOverrides,
): Promise<PodcastArtifacts> {
  if (!isPodcastAvailable(overrides)) {
    throw new AiProviderError(503, getMissingConfigMessage('podcast'), 'configurazione');
  }

  const { episodeTitle, fullScript, segments } = await generateScript(
    feedLabel,
    articles,
    overrides,
  );
  const { audioBase64, mimeType } = await synthesizeAiSpeech(
    fullScript.slice(0, MAX_SCRIPT_CHARS),
    overrides,
  );

  return {
    episodeTitle,
    script: fullScript,
    segments: segments.map(({ storyId, headline }) => ({ storyId, headline })),
    audioBase64,
    mimeType,
    generatedAt: Date.now(),
  };
}

export function podcastHttpError(error: unknown): { status: number; message: string } {
  return toAiHttpError(error, 'podcast');
}
