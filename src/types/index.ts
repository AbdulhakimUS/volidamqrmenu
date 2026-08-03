export type Lang = 'ru' | 'uz' | 'en';
export type ThemeMode = 'light' | 'dark';

// Every localized field the backend returns / expects looks like this.
export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export interface Section {
  id: number;
  name: LocalizedText;
  sort_order: number;
}

export interface Category {
  id: number;
  name: LocalizedText;
  sort_order: number;
  section_id: number;
}

export interface MenuItem {
  id: number;
  category_id: number;
  title: LocalizedText;
  photo?: string | null;
  weight?: string;
  price: number;
}

// The backend's admin_status is a free-form string, but 'super' is the
// documented value that unlocks admin-management endpoints.
export type AdminStatus = string;

export interface AdminUser {
  id: number;
  username: string;
  password?: string; // hashed value returned by the API — never shown/edited directly
  admin_status: AdminStatus;
}

// Decoded from the JWT payload returned by POST /api/auth/login — the API
// itself has no GET /api/auth/me, so the token is the only source of truth
// for "who am I" after logging in.
export interface CurrentUser {
  id?: number;
  username: string;
  admin_status?: AdminStatus;
}
