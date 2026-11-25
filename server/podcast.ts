import { Type, type Schema } from '@google/genai';
import {
  AiProviderError,
  generateAiText,
  getMissingConfigMessage,
  isPodcastAvailable as isProviderPodcastAvailable,
  isTextAiAvailable,
  synthesizeAiSpeechBuffer,
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
    .slice(0, 8)
    .map((article, index) => {
      const id =
        typeof article?.id === 'number' && Number.isFinite(article.id) ? article.id : index + 1;
      const title = typeof article?.title === 'string' ? cleanText(article.title) : '';
      const by = typeof article?.by === 'string' ? cleanText(article.by) : '';
      const category = typeof article?.category === 'string' ? cleanText(article.category) : '';
      const subtitle = typeof article?.subtitle === 'string' ? cleanText(article.subtitle) : '';
      const text = typeof article?.text === 'string' ? cleanText(article.text) : '';
      return { id, title, by, category, bodySnippet: (text || subtitle).slice(0, 350) };
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
  'Sei un giornalista radiofonico professionista di lingua madre italiana. Ricevi fino a 10 articoli che possono essere scritti in qualsiasi lingua (italiano, inglese, spagnolo, francese, tedesco, portoghese o altre) e devi tradurre, rielaborare e sintetizzare le notizie in un unico bollettino audio scorrevole in ITALIANO perfetto. ' +
  'Lunghezza complessiva compatta tra 300 e 420 parole (circa 2-3 minuti di lettura naturale), coprendo tutte le notizie fornite con transizioni fluide. ' +
  'Regole rigorose per il testo parlato: SOLO prosa naturale pronta per essere letta ad alta voce da uno speaker; NON includere mai URL, domini web, simboli markdown (*, **, #, >), elenchi puntati, parentesi tecniche o emoji. Scrivi eventuali sigle inglesi o nomi stranieri in forma chiara e scorrevole per una lettura italiana. ' +
  'Rispondi ESCLUSIVAMENTE con un oggetto JSON valido avente questa struttura esatta: {"episodeTitle":"string","intro":"string","segments":[{"storyId":123,"headline":"string","spokenText":"string"}],"outro":"string"}.';

function stripMarkdownAndThink(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const openThinkIdx = cleaned.search(/<think>/i);
  if (openThinkIdx >= 0) {
    const braceAfterThink = cleaned.indexOf('{', openThinkIdx);
    if (braceAfterThink > openThinkIdx) {
      cleaned = cleaned.slice(braceAfterThink);
    }
  }
  const closedFence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (closedFence) {
    return closedFence[1].trim();
  }
  return cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function unescapeJsonStringFragment(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

function extractTolerantScriptPayload(candidate: string): GeneratedScriptPayload | null {
  const keyPattern =
    /"(episodeTitle|intro|segments|storyId|headline|spokenText|outro)"\s*:/g;
  const keys: Array<{ name: string; valueStart: number; keyStart: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(candidate)) !== null) {
    keys.push({
      name: match[1],
      keyStart: match.index,
      valueStart: match.index + match[0].length,
    });
  }
  if (keys.length === 0) return null;

  const extractStringField = (idx: number): string => {
    const startRaw = keys[idx].valueStart;
    const endLimit = idx + 1 < keys.length ? keys[idx + 1].keyStart : candidate.length;
    const slice = candidate.slice(startRaw, endLimit);
    const firstQuote = slice.indexOf('"');
    if (firstQuote < 0) return '';
    const afterOpen = slice.slice(firstQuote + 1);
    const inner = afterOpen.replace(/"\s*[,}\]{[\s]*$/, '');
    return unescapeJsonStringFragment(inner);
  };

  let episodeTitle = '';
  let intro = '';
  let outro = '';
  const segments: Array<{ storyId?: number; headline?: string; spokenText: string }> = [];
  let pendingStoryId: number | undefined;
  let pendingHeadline: string | undefined;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.name === 'episodeTitle') {
      episodeTitle = extractStringField(i);
    } else if (key.name === 'intro') {
      intro = extractStringField(i);
    } else if (key.name === 'outro') {
      outro = extractStringField(i);
    } else if (key.name === 'storyId') {
      const endLimit = i + 1 < keys.length ? keys[i + 1].keyStart : candidate.length;
      const numMatch = candidate.slice(key.valueStart, endLimit).match(/\d+/);
      pendingStoryId = numMatch ? Number(numMatch[0]) : undefined;
    } else if (key.name === 'headline') {
      pendingHeadline = extractStringField(i);
    } else if (key.name === 'spokenText') {
      const spoken = extractStringField(i);
      if (spoken) {
        segments.push({
          storyId: pendingStoryId,
          headline: pendingHeadline,
          spokenText: spoken,
        });
      }
      pendingStoryId = undefined;
      pendingHeadline = undefined;
    }
  }

  if (segments.length === 0) return null;
  return { episodeTitle, intro, segments, outro };
}

export function parseScriptJson(raw: string): GeneratedScriptPayload {
  const candidate = stripMarkdownAndThink(raw);
  if (!candidate) {
    throw new AiProviderError(502, 'Risposta non valida dal modello di scrittura del copione.');
  }

  const tryParse = (text: string): unknown => {
    const cleanedJson = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleanedJson);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(candidate);
  if (!parsed) {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      parsed = tryParse(candidate.slice(firstBrace, lastBrace + 1));
    }
  }
  if (!parsed) {
    const firstBracket = candidate.indexOf('[');
    const lastBracket = candidate.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      parsed = tryParse(candidate.slice(firstBracket, lastBracket + 1));
    }
  }

  if (Array.isArray(parsed) && parsed.length > 0) {
    parsed = { segments: parsed };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const tolerant = extractTolerantScriptPayload(candidate);
    if (tolerant) {
      return tolerant;
    }
    throw new AiProviderError(502, 'Risposta non valida dal modello di scrittura del copione.');
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
    maxOutputTokens: 2400,
    jsonSchema: scriptResponseSchema,
    thinkingMinimalForGemini3: true,
    stream: true,
    overrides,
  });

  if (!rawText) {
    throw new AiProviderError(502, 'Il modello testo non ha restituito alcun copione.');
  }

  let parsed: GeneratedScriptPayload;
  try {
    parsed = parseScriptJson(rawText);
  } catch (err) {
    const plain = cleanText(stripMarkdownAndThink(rawText));
    const looksLikeTruncatedJson = plain.startsWith('{') || plain.startsWith('[');
    if (!looksLikeTruncatedJson && plain.length >= 120) {
      const firstArticle = articles[0];
      return {
        episodeTitle: `Rassegna ${feedLabel}`,
        fullScript: plain,
        segments: [
          {
            storyId: firstArticle.id,
            headline: firstArticle.title,
          },
        ],
      };
    }
    console.warn('[podcast/script] risposta non JSON valida:', rawText.slice(0, 320));
    throw err;
  }

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
      const numericId =
        typeof segment.storyId === 'number'
          ? segment.storyId
          : typeof segment.storyId === 'string'
            ? Number(segment.storyId)
            : NaN;
      return {
        storyId: Number.isFinite(numericId) && validIds.has(numericId) ? numericId : fallback.id,
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

export async function generatePodcastScript(
  feedLabel: string,
  articles: PreparedPodcastArticle[],
  overrides?: AiRuntimeOverrides,
): Promise<{
  episodeTitle: string;
  script: string;
  segments: PodcastArtifacts['segments'];
}> {
  if (!isTextAiAvailable(process.env, overrides)) {
    throw new AiProviderError(503, getMissingConfigMessage('text'), 'configurazione');
  }
  const { episodeTitle, fullScript, segments } = await generateScript(
    feedLabel,
    articles,
    overrides,
  );
  return {
    episodeTitle,
    script: fullScript,
    segments: segments.map(({ storyId, headline }) => ({ storyId, headline })),
  };
}

export async function generatePodcastAudio(
  script: string,
  overrides?: AiRuntimeOverrides,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isPodcastAvailable(overrides)) {
    throw new AiProviderError(503, getMissingConfigMessage('podcast'), 'configurazione');
  }
  const trimmed = cleanText(script).slice(0, MAX_SCRIPT_CHARS);
  if (!trimmed) {
    throw new AiProviderError(400, 'Copione del podcast vuoto o non valido.', 'validazione');
  }
  return synthesizeAiSpeechBuffer(script.slice(0, MAX_SCRIPT_CHARS), overrides);
}

export async function generatePodcastArtifacts(
  feedLabel: string,
  articles: PreparedPodcastArticle[],
  overrides?: AiRuntimeOverrides,
): Promise<PodcastArtifacts> {
  if (!isPodcastAvailable(overrides)) {
    throw new AiProviderError(503, getMissingConfigMessage('podcast'), 'configurazione');
  }

  const { episodeTitle, script, segments } = await generatePodcastScript(
    feedLabel,
    articles,
    overrides,
  );
  const { buffer, mimeType } = await generatePodcastAudio(script, overrides);

  return {
    episodeTitle,
    script,
    segments,
    audioBase64: buffer.toString('base64'),
    mimeType,
    generatedAt: Date.now(),
  };
}

export function podcastHttpError(error: unknown): { status: number; message: string } {
  return toAiHttpError(error, 'podcast');
}
