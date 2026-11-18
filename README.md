# Hacki × TUTTOmercatoWEB

A split-view news reader for [**tuttomercatoweb.com**](https://www.tuttomercatoweb.com/), built with **React**, **TypeScript**, and **Tailwind CSS**, backed by an **Express** proxy server.

## Features

- **Responsive Split-View**: Dual-pane news feed + full article reader on desktop/tablet with expand/restore toggle, and stacked navigation on mobile.
- **TuttoMercatoWeb Categories**: Browse **Ultime**, **Serie A**, **Estero**, **Serie B**, and **Editoriali** with customizable tab order, pinned articles, read-article tracking (on tap or scroll), keyword filtering, and "Pick up where you left off" reminder.
- **Full Article Reader**: Fetches full article headlines, subtitles, journalists, timestamps, cover images, body text, and clickable related articles (`Notizie correlate`).
- **Personal Reader Notes**: Add, reply to, edit, collapse, and search personal notes per article in local storage.
- **Offline Reading Mode**: Cache TuttoMercatoWeb feeds and full article bodies locally for offline reading.
- **Search & Favorites**: Search TuttoMercatoWeb articles by keyword, section tag (`serie-a`, `serie-b`, `calcio-estero`, `editoriale`, `rassegna-stampa`, `esclusiva`), and date range; save favorites with QR/clipboard export and ID import.
- **Customizable Appearance**: Choose font family (`Roboto Slab`, `Ubuntu`, `Ubuntu Mono`, `Noto Serif`, `Exo 2`, `Atkinson Hyperlegible`, `System Sans`), text scale factor, accent color, and `Light` / `Dark` / `System` / `True Dark Mode`.

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run start
```
