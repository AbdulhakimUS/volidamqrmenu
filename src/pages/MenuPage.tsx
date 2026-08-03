import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { useMenu } from '../context/MenuContext';
import type { Lang, MenuItem } from '../types';
import { TrayIcon, SearchIcon, EmptyIcon, SunIcon, MoonIcon } from '../components/Icons';
import ItemCard from '../components/ItemCard';
import ItemModal from '../components/ItemModal';

interface NavState {
  sectionId?: number;
}

export default function MenuPage() {
  const { lang, setLang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { items, categories, sections, loading, loadError } = useMenu();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const categoryRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const langs: Lang[] = ['ru', 'uz', 'en'];

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((i) => (i.title[lang] || '').toLowerCase().includes(q));
  }, [items, query, lang]);

  const grouped = useMemo(() => {
    const g = new Map<number, MenuItem[]>();
    filtered.forEach((it) => {
      if (!g.has(it.category_id)) g.set(it.category_id, []);
      g.get(it.category_id)!.push(it);
    });
    return g;
  }, [filtered]);

  const activeCats = categories
    .filter((c) => items.some((i) => i.category_id === c.id))
    .sort((a, b) => a.sort_order - b.sort_order);

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  // Scroll to the section requested from the Welcome screen, once it exists.
  useEffect(() => {
    const state = location.state as NavState | null;
    const sectionId = state?.sectionId;
    if (sectionId == null) return;
    const raf = requestAnimationFrame(() => {
      const el = sectionRefs.current.get(sectionId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 132;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, items.length]);

  const scrollToCategory = (id: number | 'all') => {
    if (id === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = categoryRefs.current.get(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 132;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-mini">
            <TrayIcon className="tray" />
            <span className="word">Volidam</span>
          </div>
          <div className="top-actions">
            <div className="lang-switch">
              {langs.map((l) => (
                <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="toggle theme">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
        <div className="search-row">
          <div className="search-box">
            <SearchIcon />
            <input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="cat-row">
          <button className="chip" onClick={() => scrollToCategory('all')}>
            {t('all')}
          </button>
          {activeCats.map((c) => (
            <button key={c.id} className="chip" onClick={() => scrollToCategory(c.id)}>
              {c.name[lang]}
            </button>
          ))}
        </div>
      </header>

      <div className="menu-wrap">
        {loading ? (
          <div className="loading-row">{t('loading')}</div>
        ) : loadError ? (
          <div className="empty-state">
            <EmptyIcon />
            <div>{t('loadError')}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <EmptyIcon />
            <div>{t('empty')}</div>
          </div>
        ) : (
          sortedSections.map((section) => {
            const catsInSection = activeCats.filter((c) => c.section_id === section.id && grouped.get(c.id)?.length);
            if (catsInSection.length === 0) return null;
            return (
              <div
                key={section.id}
                ref={(el) => {
                  if (el) sectionRefs.current.set(section.id, el);
                }}
              >
                <div className="group-title">
                  {section.name[lang]}
                  <span className="bar" />
                </div>
                {catsInSection.map((c) => (
                  <div
                    key={c.id}
                    ref={(el) => {
                      if (el) categoryRefs.current.set(c.id, el);
                    }}
                  >
                    <div className="section-title">{c.name[lang]}</div>
                    <div className="grid">
                      {grouped.get(c.id)!.map((it) => (
                        <ItemCard key={it.id} item={it} onClick={() => setActiveItem(it)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div className="site-footer">
        Volidam · Algoritm &nbsp;·&nbsp; <Link to="/admin">{t('admin')}</Link>
      </div>

      {activeItem && <ItemModal item={activeItem} onClose={() => setActiveItem(null)} />}
    </div>
  );
}
