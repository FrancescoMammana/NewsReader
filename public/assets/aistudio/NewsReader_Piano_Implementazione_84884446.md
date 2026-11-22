# Piano di implementazione — NewsReader: supporto Gemini e OpenAI-compatible

**Repository:** https://github.com/FrancescoMammana/NewsReader  
**Branch analizzato:** `main`  
**Data dell'analisi:** 20 novembre 2026  
**Destinazione:** Google AI Studio  
**Perimetro:** backend + adeguamento frontend limitato al download audio.

## 1. Obiettivo

Estendere il backend AI di NewsReader per supportare:

1. Gemini tramite SDK ufficiale Google `@google/genai`.
2. Provider OpenAI-compatible tramite SDK ufficiale Node.js `openai`, configurabile con una base URL personalizzata (ad esempio OpenRouter).

Le funzionalità interessate sono generazione del copione Podcast, sintesi vocale TTS e Q&A sugli articoli.

Il frontend deve rimanere sostanzialmente invariato. L'unico intervento UI approvato riguarda il download audio: etichetta neutra «Scarica audio» ed estensione del file determinata dal MIME type effettivo.

Non sono richiesti redesign, riscritture React o modifiche a funzionalità estranee.

## 2. Stato del repository verificato

L'analisi sul branch `main` ha individuato questi file e comportamenti:

| File | Stato verificato | Intervento previsto |
|---|---|---|
| `server/podcast.ts` | Generazione copione e TTS basati su Gemini | Supportare entrambi i provider |
| `server/aiQuestion.ts` | Q&A basato su Gemini | Supportare entrambi i provider |
| `server.ts` | Espone gli endpoint Podcast e monta il router Q&A | Stato dei servizi provider-agnostic |
| `package.json` | Presente `@google/genai`, assente `openai` | Aggiungere SDK OpenAI |
| `.env.example` | Contiene solo `GEMINI_API_KEY` | Documentare le cinque variabili |
| `src/services/tmwApi.ts` | Gestisce `audioBase64` e `mimeType`; fallback attuale WAV | Validare MIME type senza fallback ingannevole |
| `src/context/PodcastContext.tsx` | Crea il Blob usando il MIME type, con fallback WAV | Usare MIME type validato |
| `src/components/PodcastPlayer.tsx` | URL Blob per riproduzione; download sempre `.wav`; label «Scarica audio WAV» | Estensione dinamica e label neutre |
| `src/services/offlineDb.ts` | Salva e recupera l'episodio come oggetto in IndexedDB | Nessuna modifica prevista |
| `src/types/tmw.ts` | `PodcastEpisode` contiene `audioBlob: Blob` | Nessuna modifica prevista |

Riferimenti:
- https://github.com/FrancescoMammana/NewsReader/blob/main/server/podcast.ts
- https://github.com/FrancescoMammana/NewsReader/blob/main/server/aiQuestion.ts
- https://github.com/FrancescoMammana/NewsReader/blob/main/server.ts
- https://github.com/FrancescoMammana/NewsReader/blob/main/package.json
- https://github.com/FrancescoMammana/NewsReader/blob/main/.env.example
- https://github.com/FrancescoMammana/NewsReader/blob/main/src/services/tmwApi.ts
- https://github.com/FrancescoMammana/NewsReader/blob/main/src/context/PodcastContext.tsx
- https://github.com/FrancescoMammana/NewsReader/blob/main/src/components/PodcastPlayer.tsx
- https://github.com/FrancescoMammana/NewsReader/blob/main/src/services/offlineDb.ts
- https://github.com/FrancescoMammana/NewsReader/blob/main/src/types/tmw.ts

### Ulteriori criticità individuate

1. `server/podcast.ts` e `server/aiQuestion.ts` sono legati direttamente a Gemini.
2. Sono presenti identificativi di modelli hardcoded, da sostituire con `TEXT_MODEL` e `AUDIO_MODEL`.
3. Il backend restituisce attualmente `mimeType: 'audio/wav'` in modo statico.
4. Il player assegna sempre `.wav` al file scaricato e mostra «Scarica audio WAV» anche in `title` e `aria-label`.
5. `package.json` dichiara `tmw-reader` versione `1.0.0`, mentre il `package-lock.json` letto riporta `hacki` versione `2.8.1` e un insieme di dipendenze non allineato. Occorre riallineare il lockfile al manifest effettivo prima di aggiungere la dipendenza.
6. Gli script disponibili nel manifest sono `npm run build`, `npm run lint` e `npm run typecheck`. Non risulta uno script `npm test` né una configurazione di test dedicata nel manifest.

## 3. Configurazione: esattamente cinque variabili d'ambiente

Non introdurre `AI_PROVIDER` o altre variabili di configurazione.

```env
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=
TEXT_MODEL=
AUDIO_MODEL=
```

### Priorità dei provider

**Se `GEMINI_API_KEY` è valorizzata:**
- Usare esclusivamente `@google/genai`.
- Ignorare completamente `OPENAI_API_KEY` e `OPENAI_BASE_URL`.
- Usare `TEXT_MODEL` per copione e Q&A.
- Usare `AUDIO_MODEL` per TTS.
- Non inizializzare il client OpenAI.

**Se `GEMINI_API_KEY` è assente:**
- Richiedere sia `OPENAI_API_KEY` sia `OPENAI_BASE_URL`.
- Usare l'SDK ufficiale `openai`, configurato con `apiKey` e `baseURL`.
- Usare `TEXT_MODEL` per copione e Q&A.
- Usare `AUDIO_MODEL` per TTS.
- Se mancano le credenziali, restituire un errore di configurazione chiaro.

Esempio OpenRouter:

```env
GEMINI_API_KEY=
OPENAI_API_KEY=LA_TUA_CHIAVE_OPENROUTER
OPENAI_BASE_URL=https://openrouter.ai/api/v1
TEXT_MODEL=MODELLO_TESTUALE_SUPPORTATO
AUDIO_MODEL=MODELLO_TTS_SUPPORTATO
```

Gli identificativi dei modelli devono essere scelti tra quelli realmente disponibili e compatibili con gli endpoint richiesti.

## 4. Architettura backend

### 4.1 Modulo centralizzato

Introdurre un modulo, ad esempio `server/aiProvider.ts`, con responsabilità di:

- leggere e validare le cinque variabili;
- determinare il provider attivo secondo la precedenza stabilita;
- inizializzare i client in modo lazy;
- esporre lo stato di disponibilità AI;
- fornire ai servizi Podcast e Q&A l'accesso al provider e ai modelli configurati.

La lettura della configurazione deve avvenire quando il servizio viene utilizzato, non durante l'inizializzazione statica dei moduli. `server.ts` carica il file `.env` tramite `loadLocalEnv()`: evitare quindi di leggere troppo presto le variabili.

### 4.2 SDK

Dipendenze previste:

- `@google/genai` (già presente);
- `openai` (da aggiungere).

Per il provider OpenAI-compatible usare il client ufficiale:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
```

Non sostituire gli SDK con client HTTP personalizzati o librerie alternative senza una necessità tecnica documentata.

### 4.3 Generazione testuale

Unificare l'accesso alla generazione testuale per:

- generazione del copione Podcast;
- domande e risposte sugli articoli.

Entrambe le funzionalità devono utilizzare `TEXT_MODEL`.

- Gemini: `models.generateContent()`.
- OpenAI-compatible: Chat Completions tramite SDK ufficiale.

Mantenere lo schema JSON del copione attuale:
- `episodeTitle`
- `intro`
- `segments`
- `outro`
- `storyId`
- `headline`
- `spokenText`

Validare il JSON prima di utilizzarlo. Verificare il supporto effettivo del modello alla modalità JSON/JSON Schema: non presumere che tutti i modelli compatibili offrano le stesse funzionalità.

Per il Q&A mantenere:
- contesto dell'articolo;
- domanda dell'utente;
- ultimi sei messaggi della conversazione;
- limite di output attualmente previsto;
- risposte basate sul contenuto dell'articolo.

Non cambiare il comportamento funzionale dell'assistente.

### 4.4 Sintesi vocale

Il TTS deve utilizzare `AUDIO_MODEL`.

**Gemini**
- Mantenere `@google/genai`.
- Utilizzare il MIME type effettivo restituito nei dati audio.
- Verificare se i byte sono già un contenitore WAV completo: non aggiungere una seconda intestazione WAV.

**OpenAI-compatible**
- Utilizzare l'endpoint TTS compatibile con OpenAI tramite l'SDK ufficiale.
- Per OpenRouter verificare l'endpoint documentato `POST /api/v1/audio/speech`.
- Inviare modello, testo (`input`), voce e formato supportati.
- Gestire la risposta come byte audio, non come JSON.
- Verificare status HTTP, contenuto audio e `Content-Type`.
- Codificare i byte in Base64 per mantenere il contratto API attuale.

Non tutti i provider OpenAI-compatible supportano TTS; non dedurre il supporto TTS dalla sola compatibilità Chat Completions. Verificare endpoint, modello, voce e formati specifici del provider.

Riferimenti da verificare durante l'implementazione:
- https://openrouter.ai/blog/announcements/announcing-audio-apis/
- https://openrouter.ai/blog/tutorials/text-to-speech/
- https://openrouter.ai/collections/text-to-speech-models/

## 5. Formato audio e contratto API

Mantenere la struttura della risposta Podcast:

```typescript
interface PodcastArtifacts {
  episodeTitle: string;
  script: string;
  segments: Array<{
    storyId: number;
    headline: string;
  }>;
  audioBase64: string;
  mimeType: string;
  generatedAt: number;
}
```

Il MIME type deve descrivere il formato effettivo restituito dal provider.

Mappatura indicativa per il download:

| MIME type | Estensione |
|---|---|
| `audio/mpeg` | `.mp3` |
| `audio/wav` | `.wav` |
| `audio/ogg` | `.ogg` |
| `audio/mp4` | `.m4a` |
| `audio/aac` | `.aac` |

Non convertire l'audio: restituire i byte originali. Se il provider restituisce PCM grezzo o un formato non riproducibile direttamente dal browser, non limitarsi ad assegnargli un MIME type diverso: gestire la limitazione con un errore esplicito o scegliere un formato supportato. Non dichiarare WAV per default se il contenuto non è WAV.

## 6. Modifiche frontend minime

### `src/services/tmwApi.ts`
- Mantenere `audioBase64` e `mimeType` nel contratto.
- Validare la presenza dell'audio e del MIME type.
- Eliminare fallback che dichiarino arbitrariamente `audio/wav`.

### `src/context/PodcastContext.tsx`
- Creare il Blob utilizzando il MIME type validato.
- Non cambiare la logica di generazione, recupero articoli, firma degli articoli o salvataggio offline.

### `src/components/PodcastPlayer.tsx`
- Determinare l'estensione dal MIME type di `activePodcast.audioBlob`.
- Sostituire il nome fisso `.wav` con un'estensione dinamica.
- Modificare tutte le diciture del download in «Scarica audio».
- Aggiornare anche `title` e `aria-label`.
- Non mostrare WAV, MP3 o altre estensioni nelle etichette visibili/accessibili.

### Nessuna modifica prevista
- Player HTML5 e `URL.createObjectURL()`.
- Controlli di riproduzione e velocità.
- Trascrizione e mini-player.
- `src/services/offlineDb.ts`.
- `src/types/tmw.ts`.

L'archiviazione IndexedDB è già basata su un Blob e non impone una conversione del formato.

## 7. Endpoint e compatibilità

Mantenere gli endpoint esistenti:

```text
GET  /api/podcast/status
POST /api/podcast/generate

GET  /api/gemini/status
POST /api/gemini/qa
```

Adeguare lo stato di disponibilità affinché sia provider-agnostic. Conservare gli endpoint `/api/gemini/...` per evitare modifiche non necessarie al frontend, anche se il provider attivo non è Gemini.

## 8. Dipendenze e documentazione

### `package.json` e `package-lock.json`
- Aggiungere `openai`.
- Mantenere `@google/genai`.
- Riallineare il lockfile al manifest effettivo.
- Evitare aggiornamenti indiscriminati di tutte le dipendenze.
- Verificare `npm ci`.

### `.env.example`

Aggiornare con queste cinque variabili e commenti esplicativi:

```env
# Gemini: se valorizzata, ha priorità assoluta
GEMINI_API_KEY=

# OpenAI-compatible: usate solo se Gemini non è configurato
OPENAI_API_KEY=
OPENAI_BASE_URL=

# Modello per generazione testi e Q&A
TEXT_MODEL=

# Modello per sintesi vocale
AUDIO_MODEL=
```

Mantenere `.env` escluso da Git e `.env.example` versionabile.

### `README.md`
Aggiornare le sezioni in italiano e inglese, documentando:
- i due provider;
- la precedenza di Gemini;
- le cinque variabili;
- esempio OpenRouter;
- configurazione locale/VPS e Render;
- requisiti e limitazioni TTS;
- gestione dei MIME type;
- dicitura neutra «Scarica audio».

Aggiornare anche eventuali documenti tecnici e changelog presenti. Non eliminare documentazione esistente non correlata.

## 9. Piano di esecuzione per fasi

### Fase 0 — Verifica e protezione
- [ ] Leggere `AGENTS.md` e rispettare le istruzioni del repository.
- [ ] Verificare branch e stato Git.
- [ ] Non sovrascrivere modifiche preesistenti.
- [ ] Ricontrollare i file e il codice attuali prima di modificarli.
- [ ] Verificare manifest e lockfile.
- [ ] Eseguire i controlli baseline disponibili.

### Fase 1 — Provider centralizzato
- [ ] Creare `server/aiProvider.ts`.
- [ ] Implementare le cinque variabili e la precedenza Gemini.
- [ ] Implementare modalità OpenAI-compatible.
- [ ] Validare credenziali e modelli.
- [ ] Inizializzare i client lazy.
- [ ] Esporre lo stato di disponibilità.
- [ ] Gestire errori di configurazione comprensibili.

### Fase 2 — Generazione testuale
- [ ] Adeguare il copione a `TEXT_MODEL`.
- [ ] Mantenere e validare lo schema JSON.
- [ ] Adeguare il Q&A a `TEXT_MODEL`.
- [ ] Conservare contesto, ultimi sei messaggi e comportamento attuale.
- [ ] Mantenere API e payload.
- [ ] Gestire gli errori dei provider.

### Fase 3 — TTS
- [ ] Adeguare Gemini a `AUDIO_MODEL`.
- [ ] Implementare TTS OpenAI-compatible con SDK ufficiale.
- [ ] Verificare endpoint, modello, voce e formato supportati.
- [ ] Leggere il MIME type reale.
- [ ] Restituire i byte originali, senza conversione.
- [ ] Codificare in Base64.
- [ ] Gestire risposte non audio e status HTTP di errore.

### Fase 4 — Stato servizi
- [ ] Rendere `/api/podcast/status` provider-agnostic.
- [ ] Rendere `/api/gemini/status` provider-agnostic.
- [ ] Mantenere invariati endpoint e payload.
- [ ] Verificare che il frontend rilevi correttamente la disponibilità AI.

### Fase 5 — Frontend
- [ ] Validare MIME type in `tmwApi.ts`.
- [ ] Usare il MIME type validato in `PodcastContext.tsx`.
- [ ] Implementare mapping MIME → estensione nel player.
- [ ] Rendere dinamico il nome del file scaricato.
- [ ] Sostituire label, title e aria-label con «Scarica audio».
- [ ] Cercare altre etichette che citino formati audio.
- [ ] Non modificare il resto della UI.

### Fase 6 — Documentazione
- [ ] Aggiornare `.env.example`.
- [ ] Aggiornare README italiano e inglese.
- [ ] Aggiornare documenti tecnici e changelog pertinenti.
- [ ] Verificare `.gitignore`.
- [ ] Documentare requisiti e limiti dei modelli TTS.

### Fase 7 — Test
Eseguire:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Aggiungere test mirati per:
- Gemini prioritario anche se sono presenti entrambe le chiavi;
- credenziali OpenAI ignorate in modalità Gemini;
- selezione OpenAI-compatible senza chiave Gemini;
- errore se mancano le credenziali OpenAI;
- generazione copione e Q&A con entrambi i provider;
- TTS con provider e modello realmente supportati;
- MIME type e Base64 corretti;
- download MP3 `.mp3` e WAV `.wav`;
- riproduzione nel browser;
- salvataggio e recupero Blob da IndexedDB;
- assenza di regressioni in player e trascrizione.

Non rendere obbligatorie chiamate a servizi a pagamento nella normale build. Se manca un framework di test, introdurre solo test strettamente necessari.

### Fase 8 — Controllo finale
- [ ] Controllare il diff per evitare modifiche fuori perimetro.
- [ ] Verificare assenza di segreti.
- [ ] Verificare contratti API.
- [ ] Verificare MIME type ed estensione.
- [ ] Verificare assenza di conversioni audio.
- [ ] Verificare etichette neutrali nel frontend.
- [ ] Verificare README e `.env.example`.
- [ ] Riportare solo test realmente eseguiti e risultati effettivi.
- [ ] Segnalare separatamente eventuali limitazioni dei provider.

## 10. Vincoli inderogabili

1. Non introdurre `AI_PROVIDER`.
2. Non aggiungere variabili oltre alle cinque concordate.
3. Gemini prevale sempre se `GEMINI_API_KEY` è valorizzata.
4. In modalità Gemini ignorare completamente le credenziali OpenAI.
5. Utilizzare gli SDK ufficiali `@google/genai` e `openai`.
6. Non convertire l'audio.
7. Non dichiarare un MIME type diverso da quello effettivo.
8. Non cambiare i contratti API se non strettamente necessario.
9. Non riscrivere il frontend.
10. Non modificare design/UI salvo etichette ed estensione del download audio.
11. Non modificare IndexedDB senza necessità dimostrata.
12. Non toccare funzionalità estranee.
13. Non eliminare retry esistenti senza motivazione.
14. Non hardcodare modelli al posto di `TEXT_MODEL` e `AUDIO_MODEL`.
15. Non inserire chiavi API nel codice o nei file versionati.

## 11. Criteri di accettazione

| Area | Risultato richiesto |
|---|---|
| Configurazione | Esattamente cinque variabili |
| Gemini | SDK ufficiale Google |
| OpenAI-compatible | SDK ufficiale OpenAI e base URL configurabile |
| Priorità | Gemini prevale sempre se configurato |
| Copione e Q&A | Usano `TEXT_MODEL` |
| TTS | Usa `AUDIO_MODEL` |
| Audio | Byte originali, senza conversione |
| MIME type | Corrisponde al contenuto effettivo |
| API | Contratti esistenti preservati |
| Download | Estensione dinamica |
| UI | Solo «Scarica audio», senza riferimenti al formato |
| IndexedDB | Riproduzione e archiviazione invariate |
| Documentazione | README e `.env.example` aggiornati |
| Qualità | Build, lint e typecheck superati |

## 12. Risultato atteso

NewsReader dovrà poter funzionare alternativamente con Gemini oppure con un provider OpenAI-compatible, ad esempio OpenRouter.

Dal punto di vista dell'utente, l'applicazione deve mantenere lo stesso comportamento:
- assistente AI sugli articoli;
- generazione Podcast;
- mini-player;
- trascrizione;
- archiviazione offline;
- download con estensione corretta;
- nessun riferimento al formato audio nelle etichette.

La scelta del provider deve rimanere trasparente al frontend.

## 13. Istruzione finale per Google AI Studio

Prima di scrivere codice, rileggere il repository e confrontare questo piano con lo stato corrente. I percorsi indicati sono riferimenti verificati alla data dell'analisi, ma il codice va sempre ricontrollato prima della modifica.

Procedere per fasi, con modifiche minime e focalizzate. Non avviare una riscrittura generale.

Se emerge una limitazione tecnica reale, fermarsi su quel punto, descrivere il problema e proporre la soluzione meno invasiva. Non introdurre conversioni audio, nuove variabili o modifiche UI non approvate.

Al termine fornire:
- elenco dei file modificati;
- descrizione delle modifiche;
- risultati dei test effettivamente eseguiti;
- eventuali limitazioni;
- configurazione finale delle variabili;
- istruzioni per avviare e verificare entrambe le modalità.

**Il perimetro autorizzato è esclusivamente quello descritto in questo piano.**
