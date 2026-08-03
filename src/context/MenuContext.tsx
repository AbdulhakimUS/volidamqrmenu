import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Category, LocalizedText, MenuItem, Section } from '../types';
import { api } from '../api';

interface Result {
  ok: boolean;
  error?: string;
}

interface MenuCtx {
  items: MenuItem[];
  categories: Category[];
  sections: Section[];
  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;

  addItem: (item: { category_id: number; title: LocalizedText; photo?: string | null; weight?: string; price: number }) => Promise<Result>;
  updateItem: (id: number, item: Partial<{ category_id: number; title: LocalizedText; photo?: string | null; weight?: string; price: number }>) => Promise<Result>;
  deleteItem: (id: number) => Promise<Result>;

  addCategory: (data: { name: LocalizedText; sort_order: number; section_id: number }) => Promise<Result>;
  updateCategory: (id: number, data: Partial<{ name: LocalizedText; sort_order: number; section_id: number }>) => Promise<Result>;
  deleteCategory: (id: number) => Promise<Result>;

  addSection: (data: { name: LocalizedText; sort_order: number }) => Promise<Result>;
  updateSection: (id: number, data: Partial<{ name: LocalizedText; sort_order: number }>) => Promise<Result>;
  deleteSection: (id: number) => Promise<Result>;
}

const Ctx = createContext<MenuCtx | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sec, cat, mi] = await Promise.all([api.sections.list(), api.categories.list(), api.menuItems.list()]);
      setSections(sec);
      setCategories(cat);
      setItems(mi);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'networkError');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const asResult = async (fn: () => Promise<unknown>): Promise<Result> => {
    try {
      await fn();
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'networkError' };
    }
  };

  const addItem: MenuCtx['addItem'] = (item) => asResult(() => api.menuItems.create(item));
  const updateItem: MenuCtx['updateItem'] = (id, item) => asResult(() => api.menuItems.update(id, item));
  const deleteItem: MenuCtx['deleteItem'] = (id) => asResult(() => api.menuItems.remove(id));

  const addCategory: MenuCtx['addCategory'] = (data) => asResult(() => api.categories.create(data));
  const updateCategory: MenuCtx['updateCategory'] = (id, data) => asResult(() => api.categories.update(id, data));
  const deleteCategory: MenuCtx['deleteCategory'] = (id) => asResult(() => api.categories.remove(id));

  const addSection: MenuCtx['addSection'] = (data) => asResult(() => api.sections.create(data));
  const updateSection: MenuCtx['updateSection'] = (id, data) => asResult(() => api.sections.update(id, data));
  const deleteSection: MenuCtx['deleteSection'] = (id) => asResult(() => api.sections.remove(id));

  return (
    <Ctx.Provider
      value={{
        items,
        categories,
        sections,
        loading,
        loadError,
        reload,
        addItem,
        updateItem,
        deleteItem,
        addCategory,
        updateCategory,
        deleteCategory,
        addSection,
        updateSection,
        deleteSection,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useMenu() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMenu must be used within MenuProvider');
  return ctx;
}
