import React, { useEffect, useState } from 'react';
import { Heart, Moon, Newspaper, Plus, Search, SlidersHorizontal, Sun } from 'lucide-react';
import { type FontOption } from './types/tmw';
import { useApp } from './context/AppContext';
import { ItemView } from './components/ItemView';
import {
  AddRssFeedModal,
  CountdownReminder,
  ExportQrModal,
  ImportFavsModal,
  ToastContainer,
} from './components/Modals';
import { ProfileView } from './components/ProfileView';
import { SearchView } from './components/SearchView';
import { FavoritesFeed } from './components/FavoritesFeed';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { PodcastPlayer } from './components/PodcastPlayer';
import { StoriesFeed } from './components/StoriesFeed';
import { LogoIcon } from './components/LogoIcon';
import { SplashScreen } from './components/SplashScreen';

const FONT_STACK: Record<FontOption, string> = {
  RobotoSlab: '"RobotoSlab", Georgia, serif',
  Ubuntu: '"Ubuntu", system-ui, sans-serif',
  UbuntuMono: '"UbuntuMono", ui-monospace, monospace',
  NotoSerif: '"NotoSerif", Georgia, serif',
  Exo2: '"Exo2", system-ui, sans-serif',
  AtkinsonHyperlegible: '"AtkinsonHyperlegible", system-ui, sans-serif',
  System: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export const App: React.FC = () => {
  const {
    preferences,
    updatePreference,
    accentHex,
    isDarkActive,
    activeTab,
    setActiveTab,
    getFeedLabel,
    selectedItemArgs,
    splitViewExpanded,
    setSplitViewExpanded,
  } = useApp();

  const isDesktop = useIsDesktop();
  const [exportQrOpen, setExportQrOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addRssOpen, setAddRssOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * preferences.textScaleFactor}px`;
  }, [preferences.textScaleFactor]);

  useEffect(() => {
    if (
      activeTab !== 'profile' &&
      activeTab !== 'favorites' &&
      activeTab !== 'search' &&
      !preferences.tabOrder.includes(activeTab)
    ) {
      setActiveTab(preferences.tabOrder[0] || 'profile');
    }
  }, [activeTab, preferences.tabOrder, setActiveTab]);

  useEffect(() => {
    if (!isDesktop && splitViewExpanded) {
      setSplitViewExpanded(false);
    }
  }, [isDesktop, splitViewExpanded, setSplitViewExpanded]);

  const surfaceClass =
    isDarkActive && preferences.isTrueDarkModeEnabled
      ? 'bg-black text-neutral-100'
      : 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100';

  const showLeftPane = isDesktop
    ? !(splitViewExpanded && selectedItemArgs !== null)
    : selectedItemArgs === null;

  const showRightPane = isDesktop || selectedItemArgs !== null;

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col ${surfaceClass}`}
      style={{ fontFamily: FONT_STACK[preferences.font] }}
    >
      <SplashScreen />
      <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left Pane: Tab Bar + Stories Feed / Profile (kept mounted so mobile preserves scroll & search state) */}
      <aside
        aria-hidden={!showLeftPane}
        className={`${showLeftPane ? 'flex' : 'hidden'} flex-col h-full ${
          isDesktop
            ? 'w-[400px] lg:w-[440px] shrink-0 border-r border-neutral-200 dark:border-neutral-800'
            : 'w-full'
        }`}
      >
          {/* Top Navigation Bar with Wrapping Feed Pills */}
          <header className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur">
            <div className="px-3 py-2 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (preferences.tabOrder[0]) {
                      setActiveTab(preferences.tabOrder[0]);
                    }
                  }}
                  disabled={preferences.tabOrder.length === 0}
                  title="Vai al primo feed"
                  className="flex items-center gap-2 min-w-0 cursor-pointer disabled:cursor-default hover:opacity-80 transition-opacity text-left"
                >
                  <LogoIcon className="w-5 h-5 rounded-md shrink-0 shadow-xs" />
                  <span className="text-sm font-semibold tracking-wide text-neutral-800 dark:text-neutral-100 truncate">
                    NewsReader
                  </span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    title="Ricerca"
                    aria-label="Ricerca"
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      activeTab === 'search'
                        ? 'text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                    }`}
                    style={activeTab === 'search' ? { backgroundColor: accentHex, color: '#ffffff' } : undefined}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('favorites')}
                    title="Preferiti"
                    aria-label="Preferiti"
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      activeTab === 'favorites'
                        ? 'text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                    }`}
                    style={activeTab === 'favorites' ? { backgroundColor: accentHex, color: '#ffffff' } : undefined}
                  >
                    <Heart className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePreference('themeMode', isDarkActive ? 'light' : 'dark')}
                    title={isDarkActive ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
                    aria-label={isDarkActive ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
                    className="h-8 w-8 rounded-md flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors"
                  >
                    {isDarkActive ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddRssOpen(true)}
                    title="Aggiungi feed RSS / Atom"
                    aria-label="Aggiungi feed RSS / Atom"
                    className="h-8 w-8 rounded-md flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <PWAInstallButton compact />
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    title="Impostazioni"
                    aria-label="Impostazioni"
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                    }`}
                    style={activeTab === 'profile' ? { backgroundColor: accentHex, color: '#ffffff' } : undefined}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <nav
                className="flex flex-wrap items-center gap-1.5 pt-0.5"
                aria-label="Feed e RSS"
              >
                {preferences.tabOrder.map((tab) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                        active
                          ? 'border-transparent text-white shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                      style={active ? { backgroundColor: accentHex, borderColor: accentHex } : undefined}
                    >
                      {getFeedLabel(tab)}
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          {/* Feed or Profile Body */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === 'profile' ? (
              <ProfileView
                onOpenExportQr={() => setExportQrOpen(true)}
                onOpenImportModal={() => setImportModalOpen(true)}
                isVisible={showLeftPane}
              />
            ) : activeTab === 'favorites' ? (
              <FavoritesFeed isVisible={showLeftPane} />
            ) : activeTab === 'search' ? (
              <SearchView isVisible={showLeftPane} />
            ) : preferences.tabOrder.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Nessun feed configurato
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
                  Aggiungi un feed RSS / Atom personalizzato o ripristina i feed predefiniti dalle
                  Impostazioni.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddRssOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1"
                    style={{ backgroundColor: accentHex }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi feed RSS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
                  >
                    Apri Menu
                  </button>
                </div>
              </div>
            ) : (
              <StoriesFeed storyType={activeTab} isVisible={showLeftPane} />
            )}
          </div>

          <CountdownReminder />
        </aside>

      {/* Right Pane: Article Reader & Notes */}
      {showRightPane && (
        <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {selectedItemArgs ? (
            <ItemView args={selectedItemArgs} isSplitView={isDesktop} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center mb-4">
                <Newspaper className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Seleziona un articolo per leggerlo.
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-xs">
                Sfoglia i feed configurati, aggiungi nuove sorgenti RSS con + oppure usa le icone
                per ricerca, preferiti e impostazioni.
              </p>
            </div>
          )}
        </main>
      )}
      </div>

      <PodcastPlayer />

      {/* Global Modals, Offline Status & Toasts */}
      <AddRssFeedModal open={addRssOpen} onClose={() => setAddRssOpen(false)} />
      <ExportQrModal open={exportQrOpen} onClose={() => setExportQrOpen(false)} />
      <ImportFavsModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
      <OfflineIndicator />
      <ToastContainer />
    </div>
  );
};

export default App;
