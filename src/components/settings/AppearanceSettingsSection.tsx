import React from 'react';
import { ACCENT_COLORS, FONT_OPTIONS, type FontOption, type ThemeMode } from '../../types/tmw';
import { usePreferences } from '../../context/AppContext';

export const AppearanceSettingsSection: React.FC = () => {
  const { preferences, updatePreference, accentHex } = usePreferences();

  return (
    <div className="p-4 space-y-4">
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

      {/* Font */}
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

      {/* Theme */}
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

      {/* Accent Color */}
      <div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Colore Accento</div>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => {
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => updatePreference('appColorId', c.id)}
                title={c.label}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
