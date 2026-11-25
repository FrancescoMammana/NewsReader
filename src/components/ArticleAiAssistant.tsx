import React, { useEffect, useRef, useState } from 'react';
import { Bot, Languages, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Story } from '../types/tmw';

interface ArticleAiAssistantProps {
  article: Story;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function detectIsForeignSource(article: Story): boolean {
  const textToCheck = `${article.url || ''} ${article.category || ''} ${article.by || ''} ${article.title || ''}`.toLowerCase();
  const domain = article.url ? new URL(article.url).hostname.toLowerCase() : '';

  const italianKeywords = ['tuttomercatoweb', 'gazzetta', 'corriere', 'repubblica', 'ansa', 'sportmediaset', 'tuttojuve', 'calciomercato'];
  if (italianKeywords.some((k) => domain.includes(k) || textToCheck.includes(k))) {
    return false;
  }

  const foreignDomains = ['.com', '.co.uk', '.es', '.fr', '.de', '.com.br', '.org', '.net', 'marca', 'as.com', 'lequipe', 'bbc', 'skysports', 'bild'];
  return foreignDomains.some((d) => domain.includes(d) || textToCheck.includes(d));
}

export const ArticleAiAssistant: React.FC<ArticleAiAssistantProps> = ({ article }) => {
  const { accentHex, podcastAvailable, aiSettings, activeAiOverrides } = useApp();
  const textAiAvailable = aiSettings ? aiSettings.textAvailable : podcastAvailable;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isForeign = detectIsForeignSource(article);

  useEffect(() => {
    setOpen(false);
    setMessages([]);
    setInput('');
    setLoading(false);
  }, [article.id]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  if (!textAiAvailable) {
    return null;
  }

  const executePrompt = async (questionText: string) => {
    if (!questionText.trim() || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: questionText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          text: article.text || article.subtitle || '',
          question: questionText,
          history: messages,
          aiConfig: activeAiOverrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore nella generazione della risposta.');
      }
      setMessages([...newMessages, { role: 'assistant', content: data.answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossibile completare la richiesta.';
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Errore: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    await executePrompt(q);
  };

  const handleTranslate = async () => {
    if (loading) return;
    await executePrompt('Traduci questo articolo in italiano in modo fluido, accurato e naturale.');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chiedi all'AI"
        title="Chiedi all'AI"
        className="absolute bottom-4 right-4 z-20 w-11 h-11 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        style={{ backgroundColor: accentHex }}
      >
        <Sparkles className="w-5 h-5" />
        {messages.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-neutral-950" />
        )}
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-30 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur shadow-2xl overflow-hidden flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: accentHex }} />
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 truncate">
            Chiedi all&apos;AI
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={loading}
              title="Nuova chat"
              aria-label="Nuova chat"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Chiudi"
            aria-label="Chiudi"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isForeign && (
        <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Fonte estera rilevata
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleTranslate()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: accentHex }}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Traduci in italiano</span>
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div
          ref={chatScrollRef}
          className="max-h-72 overflow-y-auto p-3 space-y-2.5 bg-neutral-50/70 dark:bg-neutral-950/40 text-xs leading-relaxed"
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white mt-0.5"
                  style={{ backgroundColor: accentHex }}
                >
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-neutral-400 italic text-xs py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentHex }} />
              <span>Elaborazione risposta...</span>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="p-2.5 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Chiedi all'AI..."
          disabled={loading}
          className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-current"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          aria-label="Invia domanda"
          className="p-2 rounded-xl text-white flex items-center justify-center disabled:opacity-40 shrink-0 shadow-sm transition-transform active:scale-95 cursor-pointer"
          style={{ backgroundColor: accentHex }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};
