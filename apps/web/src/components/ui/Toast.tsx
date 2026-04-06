'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const DURATION = 4000;

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-brand-600 text-white',
  warning: 'bg-yellow-500 text-gray-900',
};

const variantIcons: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, DURATION);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-200 ${
        variantStyles[toast.variant]
      } ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
      role="alert"
    >
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
        {variantIcons[toast.variant]}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={handleDismiss}
        className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none shrink-0"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg: string) => addToast(msg, 'success'), [addToast]),
    error: useCallback((msg: string) => addToast(msg, 'error'), [addToast]),
    info: useCallback((msg: string) => addToast(msg, 'info'), [addToast]),
    warning: useCallback((msg: string) => addToast(msg, 'warning'), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
