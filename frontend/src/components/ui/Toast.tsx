import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

interface ToastMethods {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

function dispatch(type: ToastType, title: string, message?: string) {
  const ctx = document.querySelector('[data-toast-provider]');
  if (ctx) {
    ctx.dispatchEvent(new CustomEvent('add-toast', { detail: { type, title, message } }));
  }
}

// Convenience methods
export const toast: ToastMethods = {
  success: (title, message) => dispatch('success', title, message),
  error: (title, message) => dispatch('error', title, message),
  warning: (title, message) => dispatch('warning', title, message),
  info: (title, message) => dispatch('info', title, message),
};

const ICON_MAP: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'text-success-500 bg-success-500/10 border-success-500/20',
  error: 'text-danger-500 bg-danger-500/10 border-danger-500/20',
  warning: 'text-warning-500 bg-warning-500/10 border-warning-500/20',
  info: 'text-info-500 bg-info-500/10 border-info-500/20',
};

function ToastItemDisplay({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const Icon = ICON_MAP[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-full max-w-sm p-4 rounded-xl border backdrop-blur-xl shadow-lg',
        'bg-white/80 dark:bg-slate-900/80',
        'animate-in slide-in-from-right-full fade-in duration-300',
        COLOR_MAP[toast.type]
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for custom events (for use outside React tree)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast(detail.type, detail.title, detail.message, detail.duration);
    };
    const el = document.querySelector('[data-toast-provider]');
    el?.addEventListener('add-toast', handler as EventListener);
    return () => el?.removeEventListener('add-toast', handler as EventListener);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <div data-toast-provider>
        {children}
      </div>
      {createPortal(
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItemDisplay toast={t} onRemove={removeToast} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
