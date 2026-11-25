import express, { type Request, type Response } from 'express';
import {
  generateAiText,
  getMissingConfigMessage,
  isTextAiAvailable,
  toAiHttpError,
  type AiRuntimeOverrides,
} from './aiProvider.ts';

export const aiQuestionRouter = express.Router();

aiQuestionRouter.get('/api/gemini/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({ available: isTextAiAvailable() });
});

aiQuestionRouter.post('/api/gemini/qa', async (req: Request, res: Response) => {
  const body = req.body as {
    title?: unknown;
    text?: unknown;
    question?: unknown;
    history?: unknown;
    aiConfig?: AiRuntimeOverrides;
  };

  const overrides: AiRuntimeOverrides | undefined =
    body?.aiConfig && typeof body.aiConfig === 'object'
      ? {
          textModel: typeof body.aiConfig.textModel === 'string' ? body.aiConfig.textModel : undefined,
          baseUrl: typeof body.aiConfig.baseUrl === 'string' ? body.aiConfig.baseUrl : undefined,
        }
      : undefined;

  if (!isTextAiAvailable(process.env, overrides)) {
    res.status(503).json({ error: getMissingConfigMessage('text') });
    return;
  }

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!question) {
    res.status(400).json({ error: 'Domanda mancante.' });
    return;
  }

  const articleSnippet = rawText.slice(0, 5000);

  try {
    const chatHistory = history
      .slice(-6)
      .map((h: { role?: string; content?: string }) => `${h?.role === 'user' ? 'Utente' : 'Assistente'}: ${h?.content || ''}`)
      .join('\n');

    const prompt = `[Titolo Articolo]: ${title}\n[Testo Articolo]: ${articleSnippet}\n\n[Cronologia Chat]:\n${chatHistory}\n\nDomanda attuale dell'utente: ${question}`;

    const text = await generateAiText({
      systemInstruction:
        "Sei un assistente IA utile, conciso e diretto. L'articolo e il titolo forniti costituiscono il contesto e il punto di partenza della conversazione. Rispondi alle domande dell'utente in modo chiaro e pertinente: quando la domanda richiede spiegazioni, dettagli tecnici, contesti o approfondimenti non presenti direttamente nel testo (ad esempio tempi di recupero per un infortunio, requisiti hardware, definizioni o retroscena sui soggetti citati), rispondi usando liberamente le tue conoscenze generali. Mantieni sempre la risposta sintetica, focalizzata ed evita preamboli o convenevoli.",
      prompt,
      maxOutputTokens: 900,
      temperature: 0.5,
      thinkingMinimalForGemini3: true,
      overrides,
    });

    res.json({ answer: text || 'Nessuna risposta generata.' });
  } catch (err: unknown) {
    const { status, message } = toAiHttpError(err, 'qa');
    res.status(status).json({ error: message });
  }
});
