import React from 'react';
import { WifiOff } from 'lucide-react';
import { useLibrary } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { AiSettingsSection } from './settings/AiSettingsSection';
import { AppearanceSettingsSection } from './settings/AppearanceSettingsSection';
import { FeedsSettingsSection } from './settings/FeedsSettingsSection';
import { FiltersSettingsSection } from './settings/FiltersSettingsSection';
import { StorageAndAboutSection } from './settings/StorageAndAboutSection';

interface SettingsViewProps {
  onOpenExportQr: () => void;
  onOpenImportModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenExportQr,
  onOpenImportModal,
}) => {
  const { offlineArticleCount } = useLibrary();

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

      <FeedsSettingsSection />
      <AiSettingsSection />
      <AppearanceSettingsSection />
      <FiltersSettingsSection />
      <StorageAndAboutSection
        onOpenExportQr={onOpenExportQr}
        onOpenImportModal={onOpenImportModal}
      />
    </div>
  );
};
