import type { AdminStatus, AdminUser, Category, LocalizedText, MenuItem, Section } from './types';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const TOKEN_KEY = 'volidam-token';
// The backend's JWT payload only carries { id, status } (see AuthContext) —
// no username. We remember the username the person typed at login so it
// survives a page refresh.
const USERNAME_KEY = 'volidam-username';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}

export function setUsername(username: string) {
  try {
    localStorage.setItem(USERNAME_KEY, username);
  } catch {
    /* ignore */
  }
}

export function clearUsername() {
  try {
    localStorage.removeItem(USERNAME_KEY);
  } catch {
    /* ignore */
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Fired whenever a request that *did* carry a token comes back 401 — i.e. the
// token was rejected (expired or otherwise invalid), as opposed to a login
// attempt with wrong credentials (which also returns 401 but never carries a
// token in the first place). AuthContext subscribes to this to force the
// person back to the login screen. Deliberately not hardcoding the token's
// lifetime here — the backend owns that and can change it any time.
type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListener = listener;
}

// Every documented endpoint except /api/health replies with the
// { success, data } / { success: false, error } envelope described in
// API_DOCS.md. This helper unwraps that envelope and throws a plain Error
// (with the backend's Uzbek error message) on any failure.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('networkError');
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* some responses (e.g. 204) may have no body */
  }

  if (!res.ok || !body || body.success === false) {
    if (res.status === 401 && token) {
      unauthorizedListener?.();
    }
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body.data as T;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
}

export const api = {
  health: {
    // /api/health does NOT use the { success, data } envelope, so it is
    // fetched directly instead of going through request().
    check: async (): Promise<HealthStatus> => {
      const res = await fetch(`${API_BASE}/health`);
      return res.json();
    },
  },

  auth: {
    login: (username: string, password: string) =>
      request<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  },

  admins: {
    list: () => request<AdminUser[]>('/admins'),
    get: (id: number) => request<AdminUser>(`/admins/${id}`),
    create: (data: { username: string; password: string; admin_status: AdminStatus }) =>
      request<AdminUser>('/admins', { method: 'POST', body: JSON.stringify(data) }),
    updateUsername: (id: number, username: string) =>
      request<AdminUser>(`/admins/${id}/username`, {
        method: 'PUT',
        body: JSON.stringify({ username }),
      }),
    updatePassword: (id: number, password: string) =>
      request<AdminUser>(`/admins/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      }),
    remove: (id: number) => request<null>(`/admins/${id}`, { method: 'DELETE' }),
  },

  sections: {
    list: () => request<Section[]>('/sections'),
    get: (id: number) => request<Section>(`/sections/${id}`),
    create: (data: { name: LocalizedText; sort_order: number }) =>
      request<Section>('/sections', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: LocalizedText; sort_order: number }>) =>
      request<Section>(`/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<null>(`/sections/${id}`, { method: 'DELETE' }),
  },

  categories: {
    list: () => request<Category[]>('/categories'),
    get: (id: number) => request<Category>(`/categories/${id}`),
    create: (data: { name: LocalizedText; sort_order: number; section_id: number }) =>
      request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: LocalizedText; sort_order: number; section_id: number }>) =>
      request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<null>(`/categories/${id}`, { method: 'DELETE' }),
  },

  menuItems: {
    list: () => request<MenuItem[]>('/menu-items'),
    get: (id: number) => request<MenuItem>(`/menu-items/${id}`),
    create: (data: { category_id: number; title: LocalizedText; photo?: string | null; weight?: string; price: number }) =>
      request<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(data) }),
    update: (
      id: number,
      data: Partial<{ category_id: number; title: LocalizedText; photo?: string | null; weight?: string; price: number }>
    ) => request<MenuItem>(`/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<null>(`/menu-items/${id}`, { method: 'DELETE' }),
  },
};
