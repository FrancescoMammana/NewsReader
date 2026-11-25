# NewsReader — RSS & News Reader PWA

[English](#english) | [Italiano](#italiano)

---

## English

A modern, responsive Progressive Web Application (PWA) built with **React**, **TypeScript**, **Tailwind CSS**, and **Express** designed to aggregate, manage, and read any RSS or Atom feed with offline support.

### Features
- **Universal RSS / Atom Feed Management**: Add, remove, and reorder any external RSS or Atom feed URL as dedicated tabs.
- **Responsive Split-View**: Dual-pane news feed and full article reader on desktop/tablet with expand/restore toggle, and stacked navigation on mobile.
- **Automatic Offline Reading & Status**: Automatically caches the latest 15 articles per updated feed and all Favorites in IndexedDB, with a visual status icon showing whether each article is saved offline.
- **Article AI Q&A Assistant**: Floating assistant inside the article reader (`POST /api/gemini/qa`) to ask questions about the article and request deeper explanations.
- **Multi-Source Search & Favorites**: Search across all loaded feeds and cached offline articles by keyword or date range, manage favorites, and export/import bookmarks.
- **Customizable Typography & Themes**: Choose from multiple font families, text scale factors, accent colors, and Light/Dark Mode toggle.
- **PWA Installable**: Install as a native-like app on desktop and mobile devices.
- **Italian AI Audio Podcast & In-App Model Settings**: When `GEMINI_API_KEY` or `OPENAI_API_KEY` is configured on the server, a **Podcast** button appears in every feed tab. Configure text model, audio model, voice, and (for OpenAI-compatible providers) base URL and audio format directly in **Settings -> Podcast e Assistente AI**. Raw PCM (`audio/l16`, `audio/pcm`) streams are automatically wrapped into a valid RIFF/WAVE container (`audio/wav`) server-side for cross-browser playback and **Scarica audio** downloads.

### AI Configuration (Gemini & OpenAI-Compatible)
Keep API keys out of Git (`.env` is gitignored; `.env.example` provides the template). API keys are configured exclusively on the server and are never exposed to the browser:

```env
GEMINI_API_KEY=
OPENAI_API_KEY=

# Optional environment overrides (fallback/override for non-customized model fields)
TEXT_MODEL=
AUDIO_MODEL=
```

- **Provider Priority**: If `GEMINI_API_KEY` is set, the server always uses Google Gemini (`@google/genai`) and ignores `OPENAI_API_KEY`. Otherwise, `OPENAI_API_KEY` enables the OpenAI-compatible SDK (`openai`).
- **Built-in Economic Defaults**:
  - **Gemini**: `textModel = gemini-3.1-flash-lite`, `audioModel = gemini-3.8-flash-lite-tts`, `voice = Kore`, format `wav`.
  - **OpenAI-compatible / OpenRouter**: `baseUrl = https://openrouter.ai/api/v1` (configurable in Settings), `textModel = google/gemma-4-26b-a4b-it:free`, `audioModel = hexgrad/kokoro-82m`, `voice = if_sara`, `audioFormat = mp3`.
- **In-App Settings & Hybrid Persistence**: Non-secret model, voice, URL, and format settings are stored per active provider on disk (`data/ai-settings.json`, or `AI_SETTINGS_PATH`) and synced with browser `localStorage` (`tmw_ai_settings_v1`) so custom selections survive server redeploys. Use **Ripristina valori predefiniti** inside Settings to reset only the active provider.
- **Local / VPS**: Copy `.env.example` to `.env`, set either `GEMINI_API_KEY` or `OPENAI_API_KEY`, and restart the server.
- **Render**: Open your Web Service -> **Environment -> Environment Variables**, add `GEMINI_API_KEY` or `OPENAI_API_KEY`, and save/redeploy.

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

---

## Italiano

Una Progressive Web Application (PWA) moderna e reattiva, sviluppata con **React**, **TypeScript**, **Tailwind CSS** e **Express**, progettata per aggregare, gestire e leggere qualsiasi feed RSS o Atom con supporto completo per la lettura offline.

### Funzionalità
- **Gestione Universale Feed RSS / Atom**: Aggiungi, rimuovi e riordina qualsiasi URL di feed RSS o Atom esterno come scheda dedicata.
- **Vista Split-View Reattiva**: Doppia colonna con elenco notizie e lettore di articoli su desktop/tablet con espansione/riduzione, e navigazione a schede su dispositivi mobili.
- **Lettura Offline Automatica e Indicatore di Stato**: Memorizza automaticamente in IndexedDB gli ultimi 15 articoli per ogni feed aggiornato e tutti i Preferiti, con un'icona che indica subito se ogni articolo è salvato offline.
- **Assistente AI Q&A sugli Articoli**: Assistente flottante integrato nella vista articolo (`POST /api/gemini/qa`) per fare domande sul testo e ottenere approfondimenti.
- **Ricerca Multi-Fonte e Preferiti**: Cerca tra tutti i feed caricati e gli articoli salvati offline per parola chiave o intervallo di date, gestisci i preferiti ed esporta/importa i segnalibri.
- **Tipografia e Temi Personalizzabili**: Scegli tra diversi font, fattori di scala del testo, colori di accento e attivazione rapida del tema Chiaro / Scuro.
- **Installabile come PWA**: Installabile come applicazione nativa su desktop e dispositivi mobili.
- **Podcast Audio AI in Italiano e Impostazioni Modelli in App**: Quando `GEMINI_API_KEY` o `OPENAI_API_KEY` è configurata sul server, in ogni feed appare il pulsante **Podcast**. Puoi configurare modello testo, modello audio, voce e (solo per OpenAI-compatible) URL provider e formato audio direttamente da **Impostazioni -> Podcast e Assistente AI**. Eventuali flussi audio PCM grezzi (`audio/l16`, `audio/pcm`) vengono incapsulati automaticamente lato server in un contenitore RIFF/WAVE (`audio/wav`) riproducibile su tutti i browser e scaricabile con **Scarica audio**.

### Configurazione AI (Gemini e OpenAI-Compatible)
Non inserire mai le chiavi API su Git (`.env` è già ignorato da Git; `.env.example` funge da modello). Le chiavi restano sempre e solo sul server e non vengono mai esposte al browser:

```env
GEMINI_API_KEY=
OPENAI_API_KEY=

# Override opzionali via ambiente per i modelli (per campi non personalizzati in app)
TEXT_MODEL=
AUDIO_MODEL=
```

- **Precedenza dei Provider**: Se `GEMINI_API_KEY` è valorizzata, il server usa esclusivamente Google Gemini (`@google/genai`) ignorando `OPENAI_API_KEY`. Se assente, `OPENAI_API_KEY` attiva il provider OpenAI-compatible tramite SDK ufficiale `openai`.
- **Valori Predefiniti Economici Integrati**:
  - **Gemini**: `textModel = gemini-3.1-flash-lite`, `audioModel = gemini-3.8-flash-lite-tts`, `voice = Kore`, formato `wav`.
  - **OpenAI-compatible / OpenRouter**: `baseUrl = https://openrouter.ai/api/v1` (configurabile nelle Impostazioni), `textModel = google/gemma-4-26b-a4b-it:free`, `audioModel = hexgrad/kokoro-82m`, `voice = if_sara`, formato `mp3`.
- **Impostazioni in App e Persistenza Ibrida**: I parametri non segreti (modelli, voce, URL e formato) sono salvati per singolo provider su file server (`data/ai-settings.json` o `AI_SETTINGS_PATH`) e sincronizzati con il browser (`tmw_ai_settings_v1`) per sopravvivere ai redeploy (es. Render). Il pulsante **Ripristina valori predefiniti** ripristina solo il provider attualmente attivo.
- **Locale / VPS**: Copia `.env.example` in `.env`, imposta `GEMINI_API_KEY` oppure `OPENAI_API_KEY` e avvia il server.
- **Render**: Apri il Web Service su Render -> **Environment -> Environment Variables**, aggiungi `GEMINI_API_KEY` oppure `OPENAI_API_KEY` e salva/riavvia.

### Sviluppo
```bash
npm install
npm run dev
```

### Build di Produzione
```bash
npm run build
npm start
```
