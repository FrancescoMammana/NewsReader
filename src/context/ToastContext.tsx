import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ToastMessage } from '../types/tmw';

export interface ToastOptions {
  variant?: 'default' | 'error' | 'success';
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (text: string, opts?: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastCounter = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((text: string, opts?: ToastOptions) => {
    const id = toastCounter.current++;
    setToasts((prev) => [...prev.slice(-2), { id, text, ...opts }]);
    const duration = opts?.variant === 'error' ? 7500 : 3600;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside ToastProvider');
  return ctx;
}
