# NewsReader --- Piano di modifica 1

## Risoluzione della generazione podcast TTS e configurazione dei parametri AI

**Destinazione:** Google AI Studio\
**Repository di riferimento:** `FrancescoMammana/NewsReader`\
**Stato:** specifica iniziale da implementare\
**Ambito:** risoluzione dell'errore TTS e introduzione delle
impostazioni utente concordate.

> **Vincolo operativo:** questa è una specifica per Google AI Studio.
> Non autorizza modifiche dirette al repository durante la fase di
> analisi. Prima di implementare, verificare nuovamente il codice
> attuale e rispettare le istruzioni presenti in `AGENTS.md`.

------------------------------------------------------------------------

## 1. Obiettivo

Risolvere il problema per cui la generazione del podcast fallisce quando
si utilizza Gemini TTS tramite OpenRouter e rendere configurabili
dall'app le opzioni concordate, mantenendo la compatibilità con Gemini
nativo, OpenAI e OpenRouter.

L'intervento deve essere il più circoscritto possibile: correggere la
richiesta TTS e la gestione dell'audio lato server, evitando modifiche
non necessarie al player, a Blob e al salvataggio in IndexedDB.

## 2. Comportamento attuale da verificare

Dall'analisi precedente del repository risultano questi punti, da
ricontrollare sul branch aggiornato prima di intervenire:

-   `server/aiProvider.ts` seleziona Gemini nativo quando
    `GEMINI_API_KEY` è valorizzata; in sua assenza utilizza il client
    OpenAI-compatible, se sono configurate le relative credenziali e
    l'endpoint.
-   Nel ramo OpenAI-compatible la richiesta TTS imposta attualmente
    `voice: 'alloy'` e `response_format: 'mp3'` in modo fisso.
-   Nel ramo Gemini nativo la voce risulta impostata direttamente nel
    codice (in precedenza individuata come `Kore`).
-   Il client podcast ha un timeout di 90 secondi.
-   Il server valida e restituisce i dati audio; il frontend costruisce
    un Blob e lo passa al player.

Questa impostazione fissa di voce e formato può essere incompatibile con
il modello TTS effettivamente selezionato. In particolare, il percorso
Gemini TTS attraverso OpenRouter non deve essere trattato
automaticamente come un normale endpoint MP3: la documentazione
consultata in precedenza indica una risposta PCM per quel
modello/percorso. Verificare nuovamente il contratto API e il
comportamento reale prima di fissare i parametri.

## 3. Selezione del provider

Mantenere per questa prima fase l'architettura esistente: **un solo
provider attivo contemporaneamente per la generazione del testo e
dell'audio**. Non introdurre ora una configurazione indipendente dei
provider Text e Audio.

La selezione avviene sul server in base alle credenziali presenti:

1.  Se è presente `GEMINI_API_KEY`, utilizzare il protocollo Gemini
    nativo.
2.  Se `GEMINI_API_KEY` non è presente e sono disponibili le credenziali
    OpenAI-compatible, utilizzare il relativo client e l'URL
    configurato.
3.  Se non è disponibile una configurazione valida, restituire un errore
    esplicito e comprensibile.

Provider da supportare tramite i due percorsi già previsti:

-   Google Gemini tramite API nativa.
-   OpenAI tramite API OpenAI-compatible.
-   OpenRouter tramite API OpenAI-compatible.

Non aggiungere in questa fase protocolli proprietari ulteriori, come un
adattatore specifico per DeepSeek TTS.

Non esporre mai le chiavi API al browser e non restituirle nelle API di
lettura delle impostazioni.

## 4. Impostazioni visibili nell'app

Spostare dalle variabili d'ambiente alle impostazioni utente i parametri
non segreti concordati, mantenendo le chiavi API esclusivamente nelle
variabili d'ambiente del server.

### 4.1 Campi sempre visibili

I seguenti campi devono essere disponibili indipendentemente dal fatto
che sia attiva la chiave Gemini oppure una chiave OpenAI-compatible:

  -----------------------------------------------------------------------
  Campo                               Descrizione
  ----------------------------------- -----------------------------------
  Modello testo                       Identificativo del modello
                                      utilizzato per generare il testo
                                      del podcast e le altre elaborazioni
                                      testuali previste

  Modello audio                       Identificativo del modello TTS
                                      utilizzato per sintetizzare il
                                      podcast

  Voce                                Voce richiesta al modello TTS
  -----------------------------------------------------------------------

La voce deve essere configurabile anche con Gemini nativo: non
nasconderla quando è attiva `GEMINI_API_KEY`. Le opzioni o i valori
ammessi devono essere coerenti con il modello selezionato. Se non esiste
un endpoint affidabile per ottenere l'elenco delle voci, utilizzare un
campo selezionabile con valori documentati o un campo testuale validato
lato server.

### 4.2 Campi visibili solo con OpenAI-compatible

Mostrare questi campi soltanto quando il server sta utilizzando il
percorso OpenAI-compatible, cioè quando Gemini nativo non è selezionato:

  -----------------------------------------------------------------------
  Campo                               Descrizione
  ----------------------------------- -----------------------------------
  URL provider                        Base URL/endpoint del servizio
                                      OpenAI-compatible

  Formato audio                       Formato richiesto al servizio,
                                      limitato ai formati effettivamente
                                      supportati dal provider e dal
                                      modello
  -----------------------------------------------------------------------

Con Gemini nativo questi due campi non devono essere mostrati perché non
vengono utilizzati dal relativo percorso API.

Non aggiungere una selezione manuale del protocollo/provider
nell'interfaccia: in questa fase la scelta continua a dipendere dalle
chiavi configurate sul server.

## 5. Valori predefiniti e ripristino

I valori iniziali devono dipendere dal percorso provider effettivamente
attivo sul server.

### 5.1 Default Gemini

-   Recuperare dal codice attuale i valori Gemini già funzionanti.
-   Non inventare o sostituire i valori predefiniti Gemini senza una
    verifica.
-   Mantenere selezionabili e modificabili modello testo, modello audio
    e voce.
-   Non mostrare URL provider e formato audio nel percorso Gemini
    nativo.

### 5.2 Default OpenAI-compatible

Definire valori iniziali coerenti con il provider/modello configurato.
Non riutilizzare automaticamente `alloy` o `mp3` per qualsiasi modello:
verificare prima che voce e formato siano supportati.

Per OpenRouter con Gemini TTS, verificare in particolare il formato
richiesto dal modello e la voce ammessa. La documentazione consultata in
precedenza indica `pcm` e include `Zephyr` tra gli esempi di voce;
entrambi i dettagli devono essere riconfermati sulla documentazione
aggiornata e con una richiesta di prova.

### 5.3 Ripristino dei valori predefiniti

Prevedere un'azione **Ripristina valori predefiniti**.

-   Deve ripristinare i valori predefiniti del percorso provider
    attualmente attivo.
-   Non deve ripristinare valori di un provider diverso.
-   Deve aggiornare i valori persistiti in modo esplicito, dopo l'azione
    dell'utente.
-   Deve essere chiaro all'utente quali campi verranno ripristinati.

### 5.4 Persistenza e aggiornamenti dell'app

Le impostazioni devono essere persistenti lato server/database, non
reinizializzate a ogni avvio o deploy.

-   Al primo avvio, inizializzare le impostazioni con i default del
    provider attivo.
-   Quando l'utente salva una modifica, persistere la sua scelta.
-   Un aggiornamento del codice o un nuovo deploy non deve cancellare le
    preferenze salvate.
-   Se in una versione futura cambiano i default, applicarli soltanto
    alle impostazioni che risultano ancora gestite dal default, senza
    sovrascrivere le personalizzazioni.
-   Tenere traccia dell'origine o dello stato personalizzato per ciascun
    campo, oppure adottare un meccanismo equivalente.
-   Il cambio delle credenziali/provider non deve sovrascrivere
    silenziosamente le scelte personalizzate.

Prima di definire migrazioni o nuovi flag, verificare come il progetto
salva già le impostazioni e riutilizzare il meccanismo esistente quando
possibile.

## 6. Correzione della richiesta TTS

Modificare la logica server in modo che la richiesta utilizzi i
parametri configurati e realmente supportati dal modello.

Requisiti:

1.  Non forzare universalmente `voice: 'alloy'`.
2.  Non forzare universalmente `response_format: 'mp3'`.
3.  Passare la voce configurata nel formato richiesto dal protocollo
    attivo.
4.  Inviare il formato richiesto dal provider soltanto se supportato.
5.  Distinguere il formato restituito dal provider dal formato finale
    desiderato per il player.
6.  Gestire in modo esplicito le risposte PCM, WAV, MP3 e gli altri
    formati che saranno effettivamente supportati.
7.  Restituire al frontend un MIME coerente con i byte audio
    effettivamente prodotti.

### 6.1 Caso prioritario: Gemini TTS tramite OpenRouter

Verificare la richiesta effettiva per il modello
`google/gemini-3.8-flash-tts` tramite OpenRouter.

La documentazione precedentemente consultata indicava
`response_format: "pcm"` e una voce Google, ad esempio `Zephyr`, mentre
la richiesta attuale del progetto forza MP3 e `alloy`. Confermare questi
requisiti con la documentazione corrente e con una chiamata di test.

**Importante sul formato MP3:** non mostrare o accettare MP3 come
formato richiesto al provider se quel modello non lo supporta. Se
l'utente desidera MP3 come formato finale, valutare una conversione
server-side dal PCM ricevuto a MP3, ma soltanto se il progetto dispone
di una soluzione di conversione affidabile e testabile. In alternativa
produrre WAV valido, compatibile con il player. Non dichiarare risolto
il caso promettendo un MP3 che il provider non restituisce e che il
server non converte.

La scelta dell'utente deve quindi essere rispettata nei limiti delle
capacità reali: distinguere chiaramente il formato di risposta
supportato dall'API dal formato finale consegnato al player, se si
decide di esporre entrambi.

## 7. Diagnostica e timeout

Il problema `signal timeout` segnalato durante una prova deve essere
investigato separatamente dall'incompatibilità tra voce/formato e
modello.

-   Verificare timeout del client, timeout del server e timeout del
    provider.
-   Il client attualmente analizzato usa un timeout di 90 secondi:
    confermare che sia ancora così.
-   Evitare retry automatici inutili su timeout o errori non
    recuperabili.
-   Distinguere le fasi: invio richiesta, risposta HTTP, ricezione byte,
    validazione/conversione, risposta al client.
-   Restituire messaggi leggibili e specifici, senza esporre credenziali
    o dettagli sensibili.
-   Sostituire o integrare il toast effimero con una visualizzazione
    dell'errore che rimanga leggibile fino alla chiusura o a un nuovo
    tentativo.

## 8. Compatibilità frontend e minimizzazione delle modifiche

Mantenere invariati, se non è dimostrato che serva intervenire:

-   `PodcastPlayer`;
-   gestione Blob e URL temporanei;
-   salvataggio e lettura IndexedDB;
-   flusso di download del podcast.

Il server deve normalizzare e validare l'audio prima di restituirlo,
così il frontend continua a ricevere un file audio riproducibile con
MIME corretto.

Non modificare componenti non pertinenti alla generazione podcast.

## 9. Test e criteri di accettazione

Eseguire almeno i seguenti test:

### Provider e configurazione

-   Gemini nativo selezionato quando `GEMINI_API_KEY` è presente.
-   OpenAI-compatible selezionato quando Gemini non è configurato e sono
    disponibili le relative credenziali.
-   Chiavi mai restituite al frontend o inserite nei log.
-   Modello testo, modello audio e voce visibili con entrambi i
    percorsi.
-   URL e formato visibili soltanto con OpenAI-compatible.
-   Impostazioni persistenti dopo riavvio e deploy.
-   Ripristino dei default relativo al provider attivo.
-   Aggiornamento dei default senza sovrascrivere preferenze
    personalizzate.

### TTS e audio

-   Test reale o mock fedele della richiesta Gemini TTS tramite
    OpenRouter.
-   Verifica della voce configurata e del formato richiesto.
-   Test di risposta MP3 quando il modello la supporta.
-   Test di risposta PCM e conversione in WAV o altro formato finale
    scelto.
-   Test di MIME errato, risposta vuota, JSON/HTML inatteso e byte audio
    non validi.
-   Verifica della riproduzione con il player esistente e del download.

### Timeout ed errori

-   Test dei timeout e degli errori HTTP del provider.
-   Verifica che i messaggi mostrati siano persistenti e comprensibili.
-   Verifica che retry e timeout non generino richieste duplicate non
    necessarie.

### Comandi di verifica

Eseguire gli script previsti dal repository e da `AGENTS.md`, inclusi
almeno:

``` bash
npm run build
npm run lint
```

Eseguire inoltre tutti i test unitari e di integrazione pertinenti.

**Criterio principale di accettazione:** con OpenRouter e
`google/gemini-3.8-flash-tts`, una configurazione compatibile di voce e
formato deve completare la richiesta, produrre un file audio valido e
riproducibile e non fallire per l'attuale forzatura universale di
`alloy`/MP3.

Il timeout deve avere una diagnosi separata e un esito di test
documentato.

## 10. Documentazione e workflow Git

Rispettare `AGENTS.md` e il workflow del repository:

1.  Creare o aggiornare una Issue che descriva il problema e l'ambito.
2.  Creare un branch dedicato.
3.  Implementare modifiche focalizzate.
4.  Aggiornare `README.md`, la documentazione Markdown pertinente e
    `CHANGELOG` secondo le convenzioni del progetto.
5.  Aggiornare `.gitignore` soltanto se necessario.
6.  Eseguire test, lint e build.
7.  Aprire una Pull Request con riepilogo, test eseguiti e limiti
    residui.
8.  Eseguire il merge soltanto dopo le verifiche e l'approvazione
    previste.

Usare nomi di branch, commit, PR e note di merge in italiano, come
richiesto da `AGENTS.md`.

## 11. Fuori ambito per questo primo piano

-   Separare i provider Text e Audio: per ora resta un unico provider
    determinato dalle chiavi server.
-   Aggiungere API proprietarie o adattatori dedicati a provider
    ulteriori.
-   Riscrivere il player podcast o il sistema IndexedDB senza una
    necessità dimostrata.
-   Esporre o gestire chiavi API nel frontend.
-   Aggiungere controlli di velocità se il modello/provider non li
    supporta.

## 12. Nota per l'implementazione

Prima di modificare il codice, Google AI Studio deve rileggere i file
interessati sul branch corrente, verificare `AGENTS.md`, controllare le
versioni e le API effettivamente utilizzate e confermare i parametri
supportati dal modello TTS scelto.

Se la documentazione del provider e il comportamento reale differiscono,
non procedere con supposizioni: documentare la discrepanza e scegliere
una soluzione verificata.

------------------------------------------------------------------------

**Risultato atteso:** NewsReader mantiene il comportamento Gemini
attuale come default, consente di configurare i parametri non segreti
concordati, supporta il percorso OpenAI-compatible per OpenAI e
OpenRouter e genera un audio valido anche quando il modello restituisce
PCM, senza imporre al provider un formato che non supporta.
