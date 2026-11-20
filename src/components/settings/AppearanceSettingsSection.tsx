import React from 'react';
import { Check } from 'lucide-react';
import {
  ACCENT_COLORS,
  type DateDisplayFormat,
  FONT_OPTIONS,
  type FontOption,
  type Story,
  type StoryMarkingMode,
  type ThemeMode,
} from '../../types/tmw';
import { useLibrary, usePreferences } from '../../context/AppContext';
import { formatTimestamp } from '../../utils/formatting';
import { StoryTile } from '../StoryTile';

const PLACEHOLDER_STORY: Story = {
  id: 0,
  time: Math.floor(Date.now() / 1000) - 3600 * 2,
  by: 'Serie A · Focus TMW',
  category: 'Serie A',
  label: 'Focus TMW',
  title: 'Calciomercato Serie A: tutte le trattative e le notizie di giornata',
  url: 'https://www.tuttomercatoweb.com/serie-a/',
  parent: 0,
  text: 'Aggiornamenti in tempo reale, esclusive, probabili formazioni e retroscena dal mondo del calcio.',
  type: 'story',
  hidden: false,
};

const DATE_FORMAT_LABELS: Record<DateDisplayFormat, string> = {
  timeAgo: 'Relativo (es. 5m fa)',
  yMd: 'Data numerica standard',
  yMEd: 'Con giorno della settimana',
  yMMMd: 'Con mese abbreviato',
  yMMMEd: 'Completo con giorno e mese',
};

export const AppearanceSettingsSection: React.FC = () => {
  const { preferences, updatePreference, accentHex } = usePreferences();
  const { clearReadStories } = useLibrary();

  const booleanToggles: Array<{
    key: keyof typeof preferences;
    title: string;
    subtitle: string;
  }> = [
    {
      key: 'isComplexStoryTileEnabled',
      title: 'Riquadro articolo avanzato',
      subtitle: 'Mostra miniatura e riassunto nel riquadro dell\'articolo.',
    },
    {
      key: 'isFaviconEnabled',
      title: 'Mostra Favicon',
      subtitle: 'Mostra l\'icona del sito nel riquadro articolo compatto.',
    },
    {
      key: 'isMetadataEnabled',
      title: 'Mostra Metadati',
      subtitle: 'Mostra categoria, tag e ora nel riquadro dell\'articolo.',
    },
    {
      key: 'isMarkReadStoriesEnabled',
      title: 'Segna articoli letti',
      subtitle: 'Sfuma gli articoli che hai già letto.',
    },
    {
      key: 'isAutoScrollEnabled',
      title: 'Scorrimento automatico alla chiusura',
      subtitle: 'Scorri automaticamente alla nota successiva quando la chiudi.',
    },
    {
      key: 'isTapAnywhereToCollapseEnabled',
      title: 'Tocca ovunque per chiudere',
      subtitle: 'Se disattivato, tocca l\'intestazione superiore della nota per chiuderla.',
    },
    {
      key: 'isManualPaginationEnabled',
      title: 'Paginazione manuale',
      subtitle: 'Carica la pagina successiva manualmente con un pulsante anziché con lo scorrimento automatico.',
    },
    {
      key: 'isEyeCandyEnabled',
      title: 'Effetti visivi (Eye Candy)',
      subtitle: 'Sfondi sfumati sottili per le note nidificate.',
    },
    {
      key: 'isTrueDarkModeEnabled',
      title: 'Modalità Scura Pura (True Dark)',
      subtitle: 'Superficie nera OLED pura in modalità scura.',
    },
  ];

  return (
    <>
      {/* Dropdowns & Layout */}
      <div className="p-4 space-y-4">
        <label className="block text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">Formato data e ora</span>
          <select
            value={preferences.dateFormat}
            onChange={(e) => updatePreference('dateFormat', e.target.value as DateDisplayFormat)}
            className="mt-1 w-full px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
          >
            {(['timeAgo', 'yMd', 'yMEd', 'yMMMd', 'yMMMEd'] as DateDisplayFormat[]).map((fmt) => (
              <option key={fmt} value={fmt} className="dark:bg-neutral-900">
                {DATE_FORMAT_LABELS[fmt]} ({formatTimestamp(Math.floor(Date.now() / 1000) - 86400 * 5, fmt)})
              </option>
            ))}
          </select>
        </label>

        {/* Text Scale Factor */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-500 dark:text-neutral-400">Dimensione testo</span>
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
        <div className="px-4 pt-2 text-xs text-neutral-400">Anteprima riquadro articolo</div>
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
                    <span className="text-neutral-500 dark:text-neutral-400">Segna come letto tramite</span>
                    <select
                      disabled={!preferences.isMarkReadStoriesEnabled}
                      value={preferences.storyMarkingMode}
                      onChange={(e) =>
                        updatePreference('storyMarkingMode', e.target.value as StoryMarkingMode)
                      }
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm disabled:opacity-50"
                    >
                      <option value="tap" className="dark:bg-neutral-900">
                        Tocco
                      </option>
                      <option value="scroll" className="dark:bg-neutral-900">
                        Scorrimento
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
          <span className="text-neutral-500 dark:text-neutral-400">Carattere (Font)</span>
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
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">Tema</div>
          <div className="grid grid-cols-3 gap-2 text-xs font-medium">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updatePreference('themeMode', mode)}
                className={`py-2 rounded-lg border transition-colors ${
                  preferences.themeMode === mode
                    ? 'text-white border-transparent'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                style={preferences.themeMode === mode ? { backgroundColor: accentHex } : undefined}
              >
                {mode === 'light' ? 'Chiaro' : mode === 'dark' ? 'Scuro' : 'Sistema'}
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
    </>
  );
};
