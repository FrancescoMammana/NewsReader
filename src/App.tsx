import React, { useEffect, useState } from 'react';
import { Newspaper, SlidersHorizontal } from 'lucide-react';
import { type FontOption, STORY_TYPE_META } from './types/hn';
import { useApp } from './context/AppContext';
import { ItemView } from './components/ItemView';
import {
  CountdownReminder,
  ExportQrModal,
  ImportFavsModal,
  ToastContainer,
} from './components/Modals';
import { ProfileView } from './components/ProfileView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { StoriesFeed } from './components/StoriesFeed';

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
    accentHex,
    isDarkActive,
    activeTab,
    setActiveTab,
    selectedItemArgs,
    splitViewExpanded,
    setSplitViewExpanded,
  } = useApp();

  const isDesktop = useIsDesktop();
  const [exportQrOpen, setExportQrOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * preferences.textScaleFactor}px`;
  }, [preferences.textScaleFactor]);

  useEffect(() => {
    if (activeTab !== 'profile' && !preferences.tabOrder.includes(activeTab)) {
      setActiveTab(preferences.tabOrder[0] || 'latest');
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
      className={`h-screen w-screen overflow-hidden flex ${surfaceClass}`}
      style={{ fontFamily: FONT_STACK[preferences.font] }}
    >
      {/* Left Pane: Tab Bar + Stories Feed / Profile */}
      {showLeftPane && (
        <aside
          className={`flex flex-col h-full ${
            isDesktop
              ? 'w-[400px] lg:w-[440px] shrink-0 border-r border-neutral-200 dark:border-neutral-800'
              : 'w-full'
          }`}
        >
          {/* Top Navigation Tab Bar */}
          <header className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur">
            <div className="flex items-center justify-between px-2 h-11 gap-1">
              <nav
                className="flex items-center gap-0.5 overflow-x-auto no-scrollbar"
                aria-label="TuttoMercatoWeb feeds"
              >
                {preferences.tabOrder.map((tab) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-2 py-2 text-[11px] font-semibold tracking-wide whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'text-neutral-900 dark:text-white'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                      style={active ? { color: accentHex } : undefined}
                    >
                      {STORY_TYPE_META[tab].label}
                      {active && (
                        <span
                          className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full"
                          style={{ backgroundColor: accentHex }}
                        />
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="flex items-center gap-1 shrink-0">
                <PWAInstallButton compact />
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  title="Search, Favorites & Settings"
                  className={`px-2 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  style={activeTab === 'profile' ? { color: accentHex } : undefined}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Menu</span>
                </button>
              </div>
            </div>
          </header>

          {/* Feed or Profile Body */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === 'profile' ? (
              <ProfileView
                onOpenExportQr={() => setExportQrOpen(true)}
                onOpenImportModal={() => setImportModalOpen(true)}
              />
            ) : (
              <StoriesFeed storyType={activeTab} />
            )}
          </div>

          <CountdownReminder />
        </aside>
      )}

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
                Seleziona una notizia da TUTTOmercatoWEB per leggerla.
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-xs">
                Sfoglia Ultime, Serie A, Estero, Serie B ed Editoriali oppure usa Menu per ricerca,
                preferiti e impostazioni.
              </p>
            </div>
          )}
        </main>
      )}

      {/* Global Modals, Offline Status & Toasts */}
      <ExportQrModal open={exportQrOpen} onClose={() => setExportQrOpen(false)} />
      <ImportFavsModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
      <OfflineIndicator />
      <ToastContainer />
    </div>
  );
};

export default App;
