import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  RefreshCw,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { offlineDb } from '../services/offlineDb';
import { getAudioExtensionFromMime } from '../utils/formatting';

const PLAYBACK_RATES = [1, 1.25, 1.5] as const;

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const PodcastPlayer: React.FC = () => {
  const {
    activePodcast,
    podcastGeneratingForFeed,
    generateFeedPodcast,
    closePodcastPlayer,
    accentHex,
    feeds,
    openItem,
  } = useApp();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const playbackRate = PLAYBACK_RATES[rateIndex];
  const isRegeneratingCurrent =
    activePodcast !== null && podcastGeneratingForFeed === activePodcast.feedId;

  useEffect(() => {
    if (!activePodcast?.audioBlob) {
      setAudioUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const url = URL.createObjectURL(activePodcast.audioBlob);
    setAudioUrl(url);
    setCurrentTime(0);
    setDuration(0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [activePodcast]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (!activePodcast || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const seek = (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(
        0,
        Math.min(audio.duration || Infinity, audio.currentTime + delta),
      );
    };
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void audioRef.current?.play()],
      ['pause', () => audioRef.current?.pause()],
      ['seekbackward', () => seek(-15)],
      ['seekforward', () => seek(15)],
      [
        'seekto',
        (details) => {
          if (audioRef.current && typeof details.seekTime === 'number') {
            audioRef.current.currentTime = details.seekTime;
          }
        },
      ],
    ];
    try {
      ms.metadata = new MediaMetadata({
        title: activePodcast.episodeTitle,
        artist: `NewsReader Podcast · ${activePodcast.feedLabel}`,
        album: 'Rassegna Audio AI in Italiano',
      });
      for (const [action, handler] of handlers) ms.setActionHandler(action, handler);
    } catch {
      // Azioni MediaSession non supportate dal browser.
    }
    return () => {
      try {
        for (const [action] of handlers) ms.setActionHandler(action, null);
      } catch {
        // Ignora errori di pulizia.
      }
    };
  }, [activePodcast]);

  const feedStoriesMap = useMemo(() => {
    if (!activePodcast) return new Map();
    const list = feeds[activePodcast.feedId]?.stories ?? [];
    return new Map(list.map((s) => [s.id, s]));
  }, [activePodcast, feeds]);

  if (!activePodcast) return null;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const skipBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxTime = Number.isFinite(audio.duration) ? audio.duration : duration;
    audio.currentTime = Math.max(0, Math.min(maxTime || 0, audio.currentTime + delta));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current && Number.isFinite(val)) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    const safeSlug = activePodcast.feedLabel.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    const ext = getAudioExtensionFromMime(activePodcast.audioBlob.type);
    a.download = `podcast-${safeSlug || 'notiziario'}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenSegmentArticle = async (storyId: number) => {
    const inMemory = feedStoriesMap.get(storyId);
    if (inMemory) {
      openItem({ item: inMemory });
      return;
    }
    const fromDb = await offlineDb.getArticle(storyId);
    if (fromDb) {
      openItem({ item: fromDb });
    }
  };

  return (
    <section
      aria-label="Lettore Podcast AI"
      className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-900/95 backdrop-blur z-30"
    >
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration)) {
              setDuration(e.currentTarget.duration);
            }
          }}
        />
      )}

      {/* Expandable Transcript & Article List */}
      {detailsOpen && (
        <div className="max-h-[45vh] overflow-y-auto border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 space-y-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Notizie nell&apos;episodio ({activePodcast.segments.length})
              </h3>
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                {activePodcast.segments.map((seg, idx) => (
                  <li key={`${seg.storyId}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => void handleOpenSegmentArticle(seg.storyId)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-start gap-2 cursor-pointer transition-colors"
                    >
                      <span
                        className="font-mono text-[11px] font-semibold shrink-0 mt-0.5 tabular-nums"
                        style={{ color: accentHex }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-neutral-800 dark:text-neutral-200 leading-snug">
                        {seg.headline}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Trascrizione in italiano</span>
              </h3>
              <div className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 space-y-2.5 whitespace-pre-line border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 bg-neutral-50/70 dark:bg-neutral-900/60">
                {activePodcast.script}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Compact Mini-Player Bar */}
      <div className="px-3 py-2 flex items-center gap-2 sm:gap-3">
        {/* Play / Pause (40x40 touch target) */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
          title={isPlaying ? 'Pausa' : 'Riproduci'}
          className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0 cursor-pointer shadow-xs transition-opacity hover:opacity-90"
          style={{ backgroundColor: accentHex }}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Skip -15s / +15s on sm+ */}
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => skipBy(-15)}
            aria-label="Indietro 15 secondi"
            title="-15s"
            className="h-9 w-9 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => skipBy(15)}
            aria-label="Avanti 15 secondi"
            title="+15s"
            className="h-9 w-9 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Seek Bar */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Headphones className="w-3.5 h-3.5 shrink-0" style={{ color: accentHex }} />
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {activePodcast.episodeTitle}
              </span>
              <span className="hidden md:inline text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">
                · {activePodcast.feedLabel}
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(currentTime, duration || 1)}
            onChange={handleSeek}
            aria-label="Avanzamento audio podcast"
            className="w-full h-1.5 cursor-pointer accent-current"
            style={{ color: accentHex }}
          />
        </div>

        {/* Utility Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setRateIndex((i) => (i + 1) % PLAYBACK_RATES.length)}
            title="Velocità di riproduzione"
            className="h-9 px-2 rounded-md text-xs font-mono font-semibold tabular-nums bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300/70 dark:hover:bg-neutral-700 cursor-pointer"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            disabled={isRegeneratingCurrent}
            onClick={() => void generateFeedPodcast(activePodcast.feedId, true)}
            title="Rigenera episodio con AI"
            aria-label="Rigenera episodio con AI"
            className="h-9 w-9 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
          >
            {isRegeneratingCurrent ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentHex }} />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Scarica audio"
            aria-label="Scarica audio"
            className="hidden sm:flex h-9 w-9 rounded-md items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            title={detailsOpen ? 'Nascondi trascrizione' : 'Mostra trascrizione e articoli'}
            aria-label={detailsOpen ? 'Nascondi trascrizione' : 'Mostra trascrizione e articoli'}
            className="h-9 w-9 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
          >
            {detailsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={closePodcastPlayer}
            title="Chiudi lettore podcast"
            aria-label="Chiudi lettore podcast"
            className="h-9 w-9 rounded-md flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
