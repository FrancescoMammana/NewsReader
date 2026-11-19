import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  ExternalLink,
  Info,
  Plus,
  RotateCcw,
  Rss,
  Trash2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import {
  ACCENT_COLORS,
  type ConfiguredFeed,
  type DateDisplayFormat,
  DEFAULT_CONFIGURED_FEEDS,
  FONT_OPTIONS,
  type FontOption,
  type Story,
  type StoryMarkingMode,
  type ThemeMode,
} from '../types/tmw';
import { useApp } from '../context/AppContext';
import { formatTimestamp } from '../utils/formatting';
import { PWAInstallButton } from './PWAInstallButton';
import { StoryTile } from './StoryTile';

const PLACEHOLDER_STORY: Story = {
  id: 0,
  score: 0,
  descendants: 0,
  time: Math.floor(Date.now() / 1000) - 3600 * 2,
  by: 'Serie A · Focus TMW',
  category: 'Serie A',
  label: 'Focus TMW',
  title: 'Calciomercato Serie A: tutte le trattative e le notizie di giornata',
  url: 'https://www.tuttomercatoweb.com/serie-a/',
  kids: [],
  dead: false,
  parts: [],
  deleted: false,
  parent: 0,
  text: 'Aggiornamenti in tempo reale, esclusive, probabili formazioni e retroscena dal mondo del calcio.',
  type: 'story',
  hidden: false,
};

interface SettingsViewProps {
  onOpenExportQr: () => void;
  onOpenImportModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenExportQr,
  onOpenImportModal,
}) => {
  const {
    preferences,
    updatePreference,
    accentHex,
    offlineArticleCount,
    clearOfflineCache,
    clearReadStories,
    filterKeywords,
    addFilterKeyword,
    removeFilterKeyword,
    clearFavs,
    addCustomFeed,
    removeFeed,
    restoreDefaultTmwFeeds,
    setActiveTab,
  } = useApp();

  const [newKeyword, setNewKeyword] = useState('');
  const [rssLabel, setRssLabel] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [addingRss, setAddingRss] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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

  const booleanToggles: Array<{
    key: keyof typeof preferences;
    title: string;
    subtitle: string;
    dividerAfter?: boolean;
  }> = [
    {
      key: 'isComplexStoryTileEnabled',
      title: 'Complex Article Tile',
      subtitle: 'Show thumbnail and excerpt in article tile.',
    },
    {
      key: 'isFaviconEnabled',
      title: 'Show Favicon',
      subtitle: 'Show site icon in compact article tile.',
    },
    {
      key: 'isMetadataEnabled',
      title: 'Show Metadata',
      subtitle: 'Show category, tag, and timestamp in article tile.',
    },
    {
      key: 'isUrlEnabled',
      title: 'Show Domain',
      subtitle: 'Show source domain in article tile.',
      dividerAfter: true,
    },
    {
      key: 'isMarkReadStoriesEnabled',
      title: 'Mark Read Articles',
      subtitle: 'Grey out articles you have read.',
      dividerAfter: true,
    },
    {
      key: 'isAutoScrollEnabled',
      title: 'Auto-scroll on Collapsing',
      subtitle: 'Automatically scroll to next note when collapsing.',
    },
    {
      key: 'isTapAnywhereToCollapseEnabled',
      title: 'Tap Anywhere to Collapse',
      subtitle: 'If disabled, tap on the top header of note tile to collapse.',
    },
    {
      key: 'isManualPaginationEnabled',
      title: 'Manual Pagination',
      subtitle: 'Load next page manually with a button instead of auto-scrolling.',
    },
    {
      key: 'isEyeCandyEnabled',
      title: 'Eye Candy',
      subtitle: 'Subtle tinted note nesting backgrounds.',
    },
    {
      key: 'isTrueDarkModeEnabled',
      title: 'True Dark Mode',
      subtitle: 'Pure OLED black surface in dark mode.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 pb-12">
      {/* PWA & Offline Cache */}
      <div className="py-1">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-neutral-500" />
              <span>Lettura Offline Automatica</span>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {offlineArticleCount} articoli completi in cache (ultimi 15 per feed aggiornato +
              Preferiti).
            </div>
          </div>
        </div>

        <div className="px-4 pb-2">
          <PWAInstallButton />
        </div>
      </div>

      {/* Configured Feeds (TuttoMercatoWEB + Custom RSS/Atom) */}
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

      {/* Dropdowns & Layout */}
      <div className="p-4 space-y-4">
        <label className="block text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">Date time display</span>
          <select
            value={preferences.dateFormat}
            onChange={(e) => updatePreference('dateFormat', e.target.value as DateDisplayFormat)}
            className="mt-1 w-full px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
          >
            {(['timeAgo', 'yMd', 'yMEd', 'yMMMd', 'yMMMEd'] as DateDisplayFormat[]).map((fmt) => (
              <option key={fmt} value={fmt} className="dark:bg-neutral-900">
                {fmt} ({formatTimestamp(Math.floor(Date.now() / 1000) - 86400 * 5, fmt)})
              </option>
            ))}
          </select>
        </label>

        {/* Text Scale Factor */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-500 dark:text-neutral-400">Text Scale Factor</span>
            <span className="tabular-nums font-medium">{preferences.textScaleFactor.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.85}
            max={1.35}
            step={0.05}
            value={preferences.textScaleFactor}
            onChange={(e) => updatePreference('textScaleFactor', Number(e.target.value))}
            className="w-full accent-current"
            style={{ color: accentHex }}
          />
        </div>
      </div>

      {/* Live StoryTile Preview */}
      <div>
        <div className="px-4 pt-2 text-xs text-neutral-400">Article Tile Preview</div>
        <StoryTile
          story={PLACEHOLDER_STORY}
          onTap={() => window.open(PLACEHOLDER_STORY.url, '_blank', 'noopener,noreferrer')}
          showWebPreview={preferences.isComplexStoryTileEnabled}
          showMetadata={preferences.isMetadataEnabled}
          showFavicon={preferences.isFaviconEnabled}
          showUrl={preferences.isUrlEnabled}
          disableActions
        />
      </div>

      {/* Boolean Switches */}
      <div className="py-1">
        {booleanToggles.map((item) => {
          const checked = Boolean(preferences[item.key]);
          return (
            <React.Fragment key={item.key}>
              <label className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const val = e.target.checked;
                    updatePreference(item.key, val as never);
                    if (item.key === 'isMarkReadStoriesEnabled' && !val) {
                      clearReadStories();
                    }
                  }}
                  className="w-4 h-4 shrink-0 accent-current"
                  style={{ color: accentHex }}
                />
              </label>

              {item.key === 'isMarkReadStoriesEnabled' && (
                <div className="px-4 pb-3">
                  <label className="block text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">Mark as Read on</span>
                    <select
                      disabled={!preferences.isMarkReadStoriesEnabled}
                      value={preferences.storyMarkingMode}
                      onChange={(e) =>
                        updatePreference('storyMarkingMode', e.target.value as StoryMarkingMode)
                      }
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm disabled:opacity-50"
                    >
                      <option value="tap" className="dark:bg-neutral-900">
                        Tap
                      </option>
                      <option value="scroll" className="dark:bg-neutral-900">
                        Scroll
                      </option>
                    </select>
                  </label>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Appearance: Font, Theme, Accent Color */}
      <div className="p-4 space-y-4">
        <label className="block text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">Font</span>
          <select
            value={preferences.font}
            onChange={(e) => updatePreference('font', e.target.value as FontOption)}
            className="mt-1 w-full px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} className="dark:bg-neutral-900">
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">Theme</div>
          <div className="grid grid-cols-3 gap-2 text-xs font-medium">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updatePreference('themeMode', mode)}
                className={`py-2 rounded-lg border capitalize transition-colors ${
                  preferences.themeMode === mode
                    ? 'text-white border-transparent'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                style={preferences.themeMode === mode ? { backgroundColor: accentHex } : undefined}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Accent Color</div>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((c) => {
              const selected = preferences.appColorId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => updatePreference('appColorId', c.id)}
                  title={c.label}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                >
                  {selected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Keywords */}
      <div className="p-4 space-y-2.5">
        <div className="text-sm font-medium">Filter Keywords</div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Articles containing any of these keywords will be hidden.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newKeyword.trim()) {
              addFilterKeyword(newKeyword);
              setNewKeyword('');
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Add keyword (e.g. Serie C)..."
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1"
            style={{ backgroundColor: accentHex }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
        {filterKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filterKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => removeFilterKeyword(kw)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Data Management & About */}
      <div className="py-1 text-sm">
        <button
          type="button"
          onClick={onOpenExportQr}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <span>Export Favorites</span>
          <Upload className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={onOpenImportModal}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <span>Import Favorites</span>
          <Download className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={() => void clearOfflineCache()}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <div>
            <div>Svuota articoli offline</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Rimuove le copie salvate in cache mantenendo i Preferiti
            </div>
          </div>
          <Trash2 className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={clearReadStories}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <div>
            <div>Azzera articoli letti</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Ripristina lo stato non letto per tutti gli articoli
            </div>
          </div>
          <Trash2 className="w-4 h-4 text-neutral-500" />
        </button>
        <button
          type="button"
          onClick={clearFavs}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left text-red-600 dark:text-red-400"
        >
          <span>Svuota preferiti</span>
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-left"
        >
          <div>
            <div>About</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              NewsReader · RSS &amp; News PWA
            </div>
          </div>
          <Info className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {/* About Dialog */}
      {aboutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <img
                src="/pwa-192x192.png"
                alt="TMW Reader"
                className="w-12 h-12 rounded-xl"
              />
              <div>
                <h3 className="text-base font-bold">TMW Reader · TUTTOmercatoWEB</h3>
                <p className="text-xs text-neutral-500">v1.0.0 · Calcio &amp; Calciomercato</p>
              </div>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Split-view reader powered by live feeds, articles, and search from
              tuttomercatoweb.com, featuring offline caching, customizable typography, keyword
              filters, and personal article notes.
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <a
                href="https://www.tuttomercatoweb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <ExternalLink className="w-4 h-4" />
                <span>TUTTOmercatoWEB.com</span>
              </a>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: accentHex }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
