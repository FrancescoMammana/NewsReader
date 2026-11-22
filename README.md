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
- **Italian AI Audio Podcast (Optional / Self-Hosted)**: When AI is configured on the server, a **Podcast** button automatically appears in every feed tab. It reads up to the latest 15 articles (automatically translating foreign-language sources into natural Italian), synthesizes speech without server-side transcoding, caches audio blobs and transcripts in IndexedDB for offline replay, and provides a persistent mini-player with speed controls, transcript, and dynamic-extension **Scarica audio** download.

### AI Configuration (Gemini & OpenAI-Compatible)
Keep your API keys out of Git (`.env` is gitignored; `.env.example` provides the template). Configuration uses **five environment variables** (no `AI_PROVIDER` variable):

```env
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=
TEXT_MODEL=
AUDIO_MODEL=
```

- **Provider Priority**: If `GEMINI_API_KEY` is set, the server always uses Google Gemini (`@google/genai`) and ignores `OPENAI_API_KEY` and `OPENAI_BASE_URL`. When `GEMINI_API_KEY` is empty, both `OPENAI_API_KEY` and `OPENAI_BASE_URL` are required via the official `openai` SDK.
- **Models**: `TEXT_MODEL` powers podcast script generation and article Q&A; `AUDIO_MODEL` powers TTS synthesis.
- **Example (OpenRouter)**:
  - `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
  - `TEXT_MODEL=<supported_chat_model>`
  - `AUDIO_MODEL=<supported_tts_model>`
- **TTS Requirements & Limits**: Not all OpenAI-compatible models support Chat `response_format` JSON or `/audio/speech` TTS. The server streams the provider's original audio bytes without transcoding and derives the download extension from the actual MIME type (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`). Raw unplayable PCM streams or non-audio payloads are rejected explicitly.
- **Local / VPS**: Copy `.env.example` to `.env`, fill in your provider credentials plus `TEXT_MODEL` and `AUDIO_MODEL`, and restart the server.
- **Render**: Open your Web Service -> **Environment -> Environment Variables**, add the variables above, and save/redeploy.

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
- **Podcast Audio AI in Italiano (Opzionale / Self-Hosted)**: Se il backend AI è configurato, in ogni feed appare il pulsante **Podcast**. Legge fino agli ultimi 15 articoli (traducendo automaticamente in italiano naturale eventuali notizie in altre lingue), salva audio e trascrizione in IndexedDB per il riascolto offline e offre un mini-player persistente con velocità regolabile, trascrizione cliccabile e pulsante **Scarica audio** con estensione dinamica basata sul MIME type reale.

### Configurazione AI (Gemini e OpenAI-Compatible)
Non inserire mai le chiavi API su Git (`.env` è già ignorato da Git; `.env.example` funge da modello). La configurazione usa **cinque variabili d'ambiente** (nessuna variabile `AI_PROVIDER`):

```env
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=
TEXT_MODEL=
AUDIO_MODEL=
```

- **Precedenza dei Provider**: Se `GEMINI_API_KEY` è valorizzata, il server usa esclusivamente Google Gemini (`@google/genai`) ignorando `OPENAI_API_KEY` e `OPENAI_BASE_URL`. Se `GEMINI_API_KEY` è assente, sono richieste sia `OPENAI_API_KEY` sia `OPENAI_BASE_URL` tramite SDK ufficiale `openai`.
- **Modelli**: `TEXT_MODEL` gestisce la scrittura del copione Podcast e il Q&A sugli articoli; `AUDIO_MODEL` gestisce la sintesi vocale TTS.
- **Esempio OpenRouter**:
  - `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
  - `TEXT_MODEL=<modello_testuale_supportato>`
  - `AUDIO_MODEL=<modello_tts_supportato>`
- **Requisiti e Limiti TTS**: Non tutti i provider o modelli OpenAI-compatible supportano TTS (`/audio/speech`) o `response_format` JSON. Il server restituisce i byte originali senza conversione audio e il client usa il MIME type reale (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`). Flussi PCM grezzi o risposte non audio vengono segnalati esplicitamente.
- **Locale / VPS**: Copia `.env.example` in `.env`, imposta credenziali e modelli e avvia il server.
- **Render**: Apri il Web Service su Render -> **Environment -> Environment Variables**, aggiungi le variabili e salva/riavvia.

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
