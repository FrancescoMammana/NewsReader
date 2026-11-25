import React from 'react';
import { SettingsView } from './SettingsView';

interface ProfileViewProps {
  onOpenExportQr: () => void;
  onOpenImportModal: () => void;
  isVisible?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenExportQr,
  onOpenImportModal,
  isVisible = true,
}) => {
  return (
    <div className="flex flex-col h-full">
      <SettingsView
        onOpenExportQr={onOpenExportQr}
        onOpenImportModal={onOpenImportModal}
        isVisible={isVisible}
      />
    </div>
  );
};
