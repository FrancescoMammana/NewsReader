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
