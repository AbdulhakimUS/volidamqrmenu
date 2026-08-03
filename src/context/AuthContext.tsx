import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { AdminStatus, AdminUser, CurrentUser } from '../types';
import { api, clearToken, clearUsername, getToken, getUsername, onUnauthorized, setToken, setUsername } from '../api';
import { decodeJwtPayload } from '../utils';
import { useLang } from './LangContext';
import { useToast } from './ToastContext';

// The real backend's JWT payload only carries { id, status } — no username
// (there's no GET /api/auth/me either). We combine that with the username
// remembered from login (see api.ts) to reconstruct who's logged in.
function userFromToken(token: string, fallbackUsername?: string): CurrentUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const id = (payload.id as number) ?? undefined;
  if (id === undefined) return null;
  const username = fallbackUsername ?? getUsername() ?? '';
  return {
    id,
    username,
    admin_status: (payload.status as AdminStatus) ?? undefined,
  };
}

interface Result {
  ok: boolean;
  error?: string;
}

interface AuthCtx {
  currentUser: CurrentUser | null;
  isSuperAdmin: boolean;
  ready: boolean;
  login: (username: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  // Admin management — the API requires "main-admin" (super) rights for
  // every one of these, so they will fail with a server error for anyone
  // else. That failure is surfaced via the returned Result.
  listAdmins: () => Promise<AdminUser[]>;
  createAdmin: (username: string, password: string, admin_status: AdminStatus) => Promise<Result>;
  updateAdminUsername: (id: number, username: string) => Promise<Result>;
  updateAdminPassword: (id: number, password: string) => Promise<Result>;
  deleteAdmin: (id: number) => Promise<Result>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const handlingExpiryRef = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (token) setCurrentUser(userFromToken(token));
    setReady(true);
  }, []);

  // The backend controls how long a token stays valid (currently ~2h, but
  // that's its call to change, not ours) — we just react whenever a request
  // that carried a token comes back 401, meaning the token was rejected.
  useEffect(() => {
    onUnauthorized(() => {
      if (handlingExpiryRef.current) return;
      handlingExpiryRef.current = true;
      clearToken();
      clearUsername();
      setCurrentUser(null);
      showToast(t('sessionExpired'), 'error');
      if (!window.location.hash.startsWith('#/admin')) {
        window.location.hash = '#/admin';
      }
      window.setTimeout(() => {
        handlingExpiryRef.current = false;
      }, 2000);
    });
  }, [showToast, t]);

  const isSuperAdmin = currentUser?.admin_status === 'super';

  const login: AuthCtx['login'] = async (username, password) => {
    try {
      const { token } = await api.auth.login(username, password);
      setToken(token);
      setUsername(username);
      setCurrentUser(userFromToken(token, username));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'networkError' };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      /* best-effort — clear the local session regardless */
    }
    clearToken();
    clearUsername();
    setCurrentUser(null);
  };

  const listAdmins: AuthCtx['listAdmins'] = () => api.admins.list();

  const createAdmin: AuthCtx['createAdmin'] = async (username, password, admin_status) => {
    try {
      await api.admins.create({ username, password, admin_status });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'notAuthorized' };
    }
  };

  const updateAdminUsername: AuthCtx['updateAdminUsername'] = async (id, username) => {
    try {
      const updated = await api.admins.updateUsername(id, username);
      if (currentUser?.id === id) {
        setUsername(updated.username);
        setCurrentUser({ ...currentUser, username: updated.username });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'notAuthorized' };
    }
  };

  const updateAdminPassword: AuthCtx['updateAdminPassword'] = async (id, password) => {
    try {
      await api.admins.updatePassword(id, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'notAuthorized' };
    }
  };

  const deleteAdmin: AuthCtx['deleteAdmin'] = async (id) => {
    try {
      await api.admins.remove(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'notAuthorized' };
    }
  };

  return (
    <Ctx.Provider
      value={{
        currentUser,
        isSuperAdmin,
        ready,
        login,
        logout,
        listAdmins,
        createAdmin,
        updateAdminUsername,
        updateAdminPassword,
        deleteAdmin,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
