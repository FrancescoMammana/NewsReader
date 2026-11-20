import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import type { Story } from '../types/tmw';
import { usePreferences } from '../context/AppContext';

interface ArticleAiAssistantProps {
  article: Story;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const ArticleAiAssistant: React.FC<ArticleAiAssistantProps> = ({ article }) => {
  const { accentHex } = usePreferences();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/gemini/status')
      .then((res) => res.json())
      .then((data: { available?: boolean }) => {
        if (mounted) {
          setAvailable(Boolean(data?.available));
        }
      })
      .catch(() => {
        if (mounted) setAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (available === null || available === false) {
    return null;
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          text: article.text || article.subtitle || '',
          question: q,
          history: messages,
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

  return (
    <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800 pt-4 px-1">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: accentHex }} />
        <span className="text-xs font-semibold tracking-wide uppercase text-neutral-600 dark:text-neutral-300">
          Assistente IA · Chiedi sull'articolo
        </span>
      </div>

      {messages.length > 0 && (
        <div
          ref={chatScrollRef}
          className="max-h-72 overflow-y-auto space-y-3 mb-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-xs leading-relaxed"
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white"
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
              <span>L'IA sta elaborando la risposta...</span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fai una domanda su questo articolo..."
          disabled={loading}
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-current"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2 rounded-xl text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 shrink-0 shadow-sm transition-transform active:scale-95"
          style={{ backgroundColor: accentHex }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Invia</span>
        </button>
      </form>
    </div>
  );
};
