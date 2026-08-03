import React, { createContext, useCallback, useContext, useState } from 'react';
import { useLang } from './LangContext';

interface ConfirmState {
  message: string;
  resolve: (ok: boolean) => void;
}

interface ConfirmCtx {
  confirm: (message: string) => Promise<boolean>;
}

const Ctx = createContext<ConfirmCtx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="overlay confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) settle(false);
          }}
        >
          <div className="confirm-box" role="alertdialog" aria-modal="true">
            <div className="confirm-message">{state.message}</div>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary" onClick={() => settle(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={() => settle(true)} autoFocus>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx.confirm;
}
