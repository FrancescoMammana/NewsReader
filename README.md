# NewsReader — RSS & News Reader PWA

[English](#english) | [Italiano](#italiano)

---

## English

A modern, responsive Progressive Web Application (PWA) built with **React**, **TypeScript**, **Tailwind CSS**, and **Express** designed to aggregate, manage, and read any RSS or Atom feed with offline support.

### Features
- **Universal RSS / Atom Feed Management**: Add, remove, and reorder any external RSS or Atom feed URL as dedicated tabs.
- **Responsive Split-View**: Dual-pane news feed and full article reader on desktop/tablet with expand/restore toggle, and stacked navigation on mobile.
- **Automatic Offline Reading & Status**: Automatically caches the latest 15 articles per updated feed and all Favorites in IndexedDB, with a visual status icon showing whether each article is saved offline.
- **Personal Article Notes & Comments**: Add personal notes, annotations, and comments to any article, stored securely in local storage.
- **Multi-Source Search & Favorites**: Search across all loaded feeds and cached offline articles by keyword or date range, manage favorites, and export/import bookmarks.
- **Customizable Typography & Themes**: Choose from multiple font families, text scale factors, accent colors, and Light/Dark Mode toggle.
- **PWA Installable**: Install as a native-like app on desktop and mobile devices.
- **Italian AI Audio Podcast (Optional / Self-Hosted)**: When `GEMINI_API_KEY` is configured on the server, a **Podcast** button automatically appears in every feed tab. It reads up to the latest 15 articles (automatically translating any foreign-language source into natural Italian), generates a WAV radio bulletin using free-tier Gemini models with automatic retry and fallback on temporary load spikes, caches audio and transcripts in IndexedDB for offline replay, and provides a persistent mini-player with speed controls, transcript, and `.wav` download. When `GEMINI_API_KEY` is not set, the Podcast button stays completely hidden.

### AI Podcast Setup (Self-Hosted & Render)
Keep your API key out of Git (`.env` is gitignored; `.env.example` is provided as a template):
- **Local / VPS**: Copy `.env.example` to `.env` and set `GEMINI_API_KEY=your_key_here`.
- **Render**: Open your Web Service on Render, go to **Environment -> Environment Variables**, add `GEMINI_API_KEY` with your Google AI Studio key, and save/redeploy. The **Podcast** button will appear automatically once the server restarts.
- **Automatic Retry & Model Fallback**: During podcast creation, both the script writer (`gemini-3.1-flash-lite` → `gemini-3.5-flash-lite`) and the audio synthesizer (`gemini-3.8-flash-lite-tts` → `gemini-3.8-flash-tts`) automatically pause for 1 second and retry on the fallback model whenever a temporary upstream error occurs (such as HTTP `503` high demand or `429`). Non-retriable authentication/key errors (`401` / `403`) fail immediately and surface a clear message in the UI.

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
- **Note Personali e Commenti**: Aggiungi note, annotazioni e commenti personali a qualsiasi articolo, salvati in modo sicuro nella memoria locale.
- **Ricerca Multi-Fonte e Preferiti**: Cerca tra tutti i feed caricati e gli articoli salvati offline per parola chiave o intervallo di date, gestisci i preferiti ed esporta/importa i segnalibri.
- **Tipografia e Temi Personalizzabili**: Scegli tra diversi font, fattori di scala del testo, colori di accento e attivazione rapida del tema Chiaro / Scuro.
- **Installabile come PWA**: Installabile come applicazione nativa su desktop e dispositivi mobili.
- **Podcast Audio AI in Italiano (Opzionale / Self-Hosted)**: Se la variabile `GEMINI_API_KEY` è configurata sul server, in ogni feed appare automaticamente il pulsante **Podcast**. Legge fino agli ultimi 15 articoli della scheda attiva (traducendo automaticamente in italiano naturale anche eventuali notizie in altre lingue), genera un notiziario audio WAV con modelli Gemini gratuiti con retry automatico e fallback in caso di picchi temporanei, salva audio e trascrizione in IndexedDB per il riascolto offline e offre un mini-player persistente con controllo velocità, trascrizione cliccabile e download `.wav`. Se `GEMINI_API_KEY` non è impostata, il pulsante non viene mostrato.

### Configurazione Podcast AI (Self-Hosted e Render)
Non inserire mai la chiave API su GitHub (`.env` è già ignorato da Git; `.env.example` funge da modello senza segreti):
- **Locale / Server privato**: Copia `.env.example` in `.env` e imposta `GEMINI_API_KEY=la_tua_chiave`.
- **Render**: Apri il tuo Web Service su Render, vai su **Environment -> Environment Variables**, aggiungi la variabile `GEMINI_API_KEY` con la tua chiave di Google AI Studio e salva/riavvia il servizio. Il pulsante **Podcast** comparirà automaticamente in ogni feed.
- **Retry Automatico e Fallback Modelli**: Durante la creazione del podcast, sia la generazione del copione (`gemini-3.1-flash-lite` → `gemini-3.5-flash-lite`) sia la sintesi vocale TTS (`gemini-3.8-flash-lite-tts` → `gemini-3.8-flash-tts`) attendono automaticamente 1 secondo e riprovano sul modello alternativo in caso di errori temporanei o sovraccarico dei server (`503` / `429`). Solo gli errori di autenticazione o chiave non valida (`401` / `403`) interrompono subito la richiesta mostrando il dettaglio nell'interfaccia.

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
