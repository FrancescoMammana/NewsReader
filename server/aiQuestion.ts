import express, { type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export const aiQuestionRouter = express.Router();

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

export function isGeminiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

aiQuestionRouter.get('/api/gemini/status', (_req: Request, res: Response) => {
  res.json({ available: isGeminiAvailable() });
});

aiQuestionRouter.post('/api/gemini/qa', async (req: Request, res: Response) => {
  const gemini = getGeminiClient();
  if (!gemini) {
    res.status(503).json({ error: 'Chiave GEMINI_API_KEY non configurata sul server.' });
    return;
  }

  const body = req.body as {
    title?: unknown;
    text?: unknown;
    question?: unknown;
    history?: unknown;
  };

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

    const response = await gemini.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction:
          "Sei un assistente IA sintetico e diretto. Rispondi alla domanda dell'utente basandoti ESCLUSIVAMENTE sul testo dell'articolo fornito. Se l'informazione non è nell'articolo, di' chiaramente che non è menzionata. Sii conciso e vai dritto al punto.",
        maxOutputTokens: 400,
        temperature: 0.2,
      },
    });

    const answer = response.text?.trim() || 'Nessuna risposta generata.';
    res.json({ answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore durante la generazione della risposta con Gemini.';
    res.status(502).json({ error: message });
  }
});
