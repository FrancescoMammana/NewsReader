import React from 'react';
import { usePreferences } from '../context/AppContext';

export const LogoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 rounded-md' }) => {
  const { accentHex } = usePreferences();

  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      style={{ backgroundColor: accentHex }}
      aria-label="NewsReader Logo"
    >
      {/* Clean standard Sans-Serif Letter N */}
      <path
        fill="#ffffff"
        d="M 120 96 L 200 96 L 312 336 L 312 96 L 392 96 L 392 416 L 312 416 L 200 176 L 200 416 L 120 416 Z"
      />
    </svg>
  );
};
