import type { Lang } from './types';

export function fmtPrice(price: number, lang: Lang): string {
  const n = Number(price) || 0;
  const s = n.toLocaleString('ru-RU').replace(/,/g, ' ');
  const suf = lang === 'uz' ? "so'm" : lang === 'en' ? 'UZS' : 'сум';
  return `${s} ${suf}`;
}

// Decodes the payload of a JWT without verifying its signature — verification
// happens server-side on every protected request. This is only used so the
// UI knows who is logged in (id / username / admin_status), since the API
// has no GET /api/auth/me endpoint and only returns a token on login.
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}
