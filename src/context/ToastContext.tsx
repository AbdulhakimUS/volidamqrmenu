import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoCircleIcon } from '../components/Icons';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

interface ToastCtx {
  showToast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const AUTO_DISMISS_MS = 3200;
const LEAVE_ANIM_MS = 220;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());

  const remove = useCallback((id: number) => {
    // Mark as leaving first so it can animate out, then actually drop it.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, LEAVE_ANIM_MS);
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, type }]);
      const timer = window.setTimeout(() => remove(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [remove]
  );

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type} ${t.leaving ? 'toast-leave' : 'toast-enter'}`}>
            <span className="toast-icon">
              {t.type === 'success' && <CheckCircleIcon />}
              {t.type === 'error' && <AlertCircleIcon />}
              {t.type === 'info' && <InfoCircleIcon />}
            </span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="close">
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
