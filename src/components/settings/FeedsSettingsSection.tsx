import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, RotateCcw, Rss, Trash2 } from 'lucide-react';
import { type ConfiguredFeed, DEFAULT_CONFIGURED_FEEDS } from '../../types/tmw';
import { useFeeds, useNavigation, usePreferences, useToasts } from '../../context/AppContext';

export const FeedsSettingsSection: React.FC = () => {
  const { preferences, updatePreference, accentHex } = usePreferences();
  const { addCustomFeed, removeFeed, restoreDefaultTmwFeeds } = useFeeds();
  const { setActiveTab } = useNavigation();
  const { showToast } = useToasts();

  const [rssLabel, setRssLabel] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [addingRss, setAddingRss] = useState(false);

  const feedMap = new Map(preferences.configuredFeeds.map((f) => [f.id, f]));
  const orderedFeeds = preferences.tabOrder
    .map((id) => feedMap.get(id))
    .filter((f): f is ConfiguredFeed => Boolean(f));
  const hasMissingTmwFeeds = DEFAULT_CONFIGURED_FEEDS.some((df) => !feedMap.has(df.id));

  const moveTab = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= preferences.tabOrder.length) return;
    const copy = [...preferences.tabOrder];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    updatePreference('tabOrder', copy);
  };

  return (
    <div className="p-4 space-y-3">
      <div>
        <div className="text-sm font-medium flex items-center gap-2">
          <Rss className="w-4 h-4" style={{ color: accentHex }} />
          <span>Feed &amp; Sorgenti RSS</span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Gestisci tutti i feed configurati (TuttoMercatoWEB e RSS/Atom esterni), riordina le
          schede o rimuovili.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!rssUrl.trim() || addingRss) return;
          setAddingRss(true);
          void addCustomFeed(rssLabel, rssUrl).then((ok) => {
            setAddingRss(false);
            if (ok) {
              setRssLabel('');
              setRssUrl('');
            }
          });
        }}
        className="space-y-2 text-xs"
      >
        <input
          type="text"
          value={rssLabel}
          onChange={(e) => setRssLabel(e.target.value)}
          placeholder="Nome tab (es. Gazzetta, ANSA Sport)..."
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="url"
            required
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            placeholder="https://.../rss.xml"
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!rssUrl.trim() || addingRss}
            className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50 shrink-0"
            style={{ backgroundColor: accentHex }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addingRss ? 'Carico...' : 'Aggiungi'}</span>
          </button>
        </div>
      </form>

      {orderedFeeds.length > 0 ? (
        <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {orderedFeeds.map((feed, idx) => (
            <div
              key={feed.id}
              className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
            >
              <button
                type="button"
                onClick={() => setActiveTab(feed.id)}
                className="min-w-0 flex-1 text-left hover:underline"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {feed.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shrink-0">
                    {feed.kind === 'tmw' ? 'TMW' : 'RSS'}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 truncate">{feed.url}</div>
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(feed.url);
                    showToast('URL RSS copiato negli appunti');
                  }}
                  title={`Copia URL di ${feed.label}`}
                  className="p-1.5 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveTab(idx, -1)}
                  title="Sposta prima"
                  className="p-1.5 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === orderedFeeds.length - 1}
                  onClick={() => moveTab(idx, 1)}
                  title="Sposta dopo"
                  className="p-1.5 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFeed(feed.id)}
                  title={`Rimuovi ${feed.label}`}
                  className="p-1.5 rounded text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
          Nessun feed configurato. Aggiungi un URL RSS qui sopra oppure ripristina le sezioni
          predefinite.
        </div>
      )}

      {hasMissingTmwFeeds && (
        <button
          type="button"
          onClick={restoreDefaultTmwFeeds}
          className="w-full py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ripristina feed TuttoMercatoWEB predefiniti</span>
        </button>
      )}
    </div>
  );
};
