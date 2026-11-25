import React, { useEffect, useMemo, useState } from 'react';
import { Bot, RotateCcw, Save } from 'lucide-react';
import { usePodcast, usePreferences, useToasts } from '../../context/AppContext';
import type { TtsModelProfile } from '../../types/tmw';

function matchProfile(profiles: TtsModelProfile[], audioModel: string): TtsModelProfile | null {
  const norm = audioModel.trim().toLowerCase();
  if (!norm) return null;
  const exact = profiles.find((p) => p.id.toLowerCase() === norm);
  if (exact) return exact;
  if (norm.startsWith('google/gemini-') && norm.includes('tts')) {
    return profiles.find((p) => p.id === 'google/gemini-3.8-flash-lite-tts') ?? null;
  }
  if (norm.startsWith('gemini-') && norm.includes('tts')) {
    return profiles.find((p) => p.id === 'gemini-3.8-flash-lite-tts') ?? null;
  }
  return null;
}

export const AiSettingsSection: React.FC = () => {
  const { accentHex } = usePreferences();
  const { showToast } = useToasts();
  const { aiSettings, refreshAiSettings, saveAiSettings, resetAiSettings } = usePodcast();

  const providerKind = aiSettings?.providerKind ?? null;
  const effective = aiSettings?.effective ?? null;
  const profiles = useMemo(() => aiSettings?.catalog.ttsProfiles ?? [], [aiSettings]);

  const [textModel, setTextModel] = useState('');
  const [audioModel, setAudioModel] = useState('');
  const [voice, setVoice] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [audioFormat, setAudioFormat] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshAiSettings();
  }, [refreshAiSettings]);

  useEffect(() => {
    if (!aiSettings) return;
    if (effective) {
      setTextModel(effective.textModel);
      setAudioModel(effective.audioModel);
      setVoice(effective.voice);
      setBaseUrl(effective.baseUrl ?? aiSettings.stored.openai.baseUrl);
      setAudioFormat(effective.audioFormat ?? aiSettings.stored.openai.audioFormat);
    } else {
      setTextModel(aiSettings.stored.openai.textModel);
      setAudioModel(aiSettings.stored.openai.audioModel);
      setVoice(aiSettings.stored.openai.voice);
      setBaseUrl(aiSettings.stored.openai.baseUrl);
      setAudioFormat(aiSettings.stored.openai.audioFormat);
    }
  }, [aiSettings, effective]);

  const selectedTtsProfile = useMemo(
    () => matchProfile(profiles, audioModel),
    [profiles, audioModel],
  );

  const allowedFormats = useMemo(() => {
    if (selectedTtsProfile && selectedTtsProfile.formats.length > 0) {
      return selectedTtsProfile.formats;
    }
    return ['mp3', 'wav', 'pcm', 'aac', 'opus'];
  }, [selectedTtsProfile]);

  const handleAudioModelChange = (nextModel: string) => {
    setAudioModel(nextModel);
    const nextProfile = matchProfile(profiles, nextModel);
    if (!nextProfile) return;
    if (nextProfile.voices.length > 0 && !nextProfile.voices.includes(voice)) {
      setVoice(nextProfile.voices[0]);
    }
    if (
      providerKind === 'openai' &&
      nextProfile.formats.length > 0 &&
      !nextProfile.formats.includes(audioFormat.toLowerCase())
    ) {
      setAudioFormat(nextProfile.formats[0]);
    }
  };

  const resolvedVoice =
    selectedTtsProfile &&
    selectedTtsProfile.voices.length > 0 &&
    !selectedTtsProfile.voices.includes(voice)
      ? selectedTtsProfile.voices[0]
      : voice;

  const resolvedAudioFormat =
    providerKind === 'openai' &&
    selectedTtsProfile &&
    selectedTtsProfile.formats.length > 0 &&
    !selectedTtsProfile.formats.includes(audioFormat.toLowerCase())
      ? selectedTtsProfile.formats[0]
      : audioFormat;

  const savedOpenAiBaseUrl = aiSettings?.stored.openai.baseUrl ?? '';
  const hasChanges = Boolean(
    aiSettings &&
      (effective
        ? textModel.trim() !== effective.textModel ||
          audioModel.trim() !== effective.audioModel ||
          resolvedVoice.trim() !== effective.voice ||
          baseUrl.trim().replace(/\/+$/, '') !==
            (effective.baseUrl ?? savedOpenAiBaseUrl).trim().replace(/\/+$/, '') ||
          (providerKind === 'openai' &&
            resolvedAudioFormat.trim().toLowerCase() !==
              (effective.audioFormat ?? '').toLowerCase())
        : baseUrl.trim().replace(/\/+$/, '') !== savedOpenAiBaseUrl.trim().replace(/\/+$/, '')),
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSettings || saving) return;
    setSaving(true);
    try {
      await saveAiSettings(
        providerKind === 'gemini'
          ? { textModel, audioModel, voice: resolvedVoice, baseUrl }
          : {
              textModel,
              audioModel,
              voice: resolvedVoice,
              baseUrl,
              audioFormat: resolvedAudioFormat,
            },
      );
      showToast('Impostazioni AI salvate.', { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore nel salvataggio delle impostazioni AI.';
      showToast(msg, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!providerKind || saving) return;
    setSaving(true);
    try {
      await resetAiSettings();
      showToast('Valori predefiniti AI ripristinati.', { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore nel ripristino dei valori predefiniti.';
      showToast(msg, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!aiSettings) {
    return null;
  }

  const defaultPreview =
    providerKind === 'gemini' ? aiSettings.defaults.gemini : aiSettings.defaults.openai;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium">Podcast e Assistente AI</span>
        </div>
        {providerKind && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
            {providerKind === 'gemini' ? 'Google Gemini' : 'OpenAI-compatible'}
          </span>
        )}
      </div>

      {!providerKind || !effective ? (
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Nessuna chiave API AI rilevata sul server. Configura{' '}
            <code className="font-mono">GEMINI_API_KEY</code> o{' '}
            <code className="font-mono">OPENAI_API_KEY</code> nelle variabili ambiente del server per
            abilitare Podcast e Assistente AI.
          </p>
          <label className="block text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">
              OpenAI Base URL (URL provider)
            </span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={aiSettings.defaults.openai.baseUrl}
              required
              className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: accentHex }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Salvataggio...' : 'Salva URL'}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Provider selezionato automaticamente dalle variabili ambiente del server (le chiavi API
            non lasciano mai il server).
          </p>

          <label className="block text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">
              OpenAI Base URL (URL provider)
            </span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={aiSettings.defaults.openai.baseUrl}
              required
              className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
            />
            {providerKind === 'gemini' && (
              <span className="mt-1 block text-[11px] text-neutral-400 dark:text-neutral-500">
                Predefinito OpenRouter; usato quando il provider attivo è OpenAI-compatible (ora è attivo Google Gemini).
              </span>
            )}
          </label>

          <label className="block text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">Modello testo (Q&amp;A e copione)</span>
            <input
              type="text"
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              placeholder={defaultPreview.textModel}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
            />
          </label>

          <label className="block text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">Modello audio (TTS Podcast)</span>
            <input
              type="text"
              value={audioModel}
              onChange={(e) => handleAudioModelChange(e.target.value)}
              placeholder={defaultPreview.audioModel}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
            />
          </label>

          <div className={providerKind === 'openai' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <label className="block text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Voce</span>
              {selectedTtsProfile && selectedTtsProfile.voices.length > 0 ? (
                <select
                  value={resolvedVoice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
                >
                  {selectedTtsProfile.voices.map((v) => (
                    <option key={v} value={v} className="dark:bg-neutral-900">
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  placeholder={defaultPreview.voice}
                  required
                  className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
                />
              )}
            </label>

            {providerKind === 'openai' && (
              <label className="block text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Formato audio</span>
                <select
                  value={resolvedAudioFormat.toLowerCase()}
                  onChange={(e) => setAudioFormat(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm"
                >
                  {allowedFormats.map((fmt) => (
                    <option key={fmt} value={fmt} className="dark:bg-neutral-900">
                      {fmt === 'pcm' ? 'pcm (convertito in WAV)' : fmt}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !hasChanges}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: accentHex }}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Salvataggio...' : 'Salva impostazioni'}</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleReset()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ripristina valori predefiniti</span>
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
            Predefiniti ({providerKind === 'gemini' ? 'Gemini' : 'OpenRouter'}):{' '}
            {providerKind === 'openai' && (
              <>
                <span className="font-mono">{aiSettings.defaults.openai.baseUrl}</span> ·{' '}
              </>
            )}
            <span className="font-mono">{defaultPreview.textModel}</span> ·{' '}
            <span className="font-mono">{defaultPreview.audioModel}</span> ·{' '}
            <span className="font-mono">{defaultPreview.voice}</span>
            {providerKind === 'openai' ? ` (${aiSettings.defaults.openai.audioFormat})` : ' (wav)'}.
          </p>
        </form>
      )}
    </div>
  );
};
