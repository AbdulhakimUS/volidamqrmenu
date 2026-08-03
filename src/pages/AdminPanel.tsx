import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { useMenu } from '../context/MenuContext';
import { useToast, type ToastType } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import type { AdminUser, Category, LocalizedText, MenuItem, Section } from '../types';
import { api } from '../api';
import { fmtPrice } from '../utils';
import { DishIcon, EditIcon, TrashIcon } from '../components/Icons';
import LocalizedInput from '../components/LocalizedInput';

function emptyLocalized(): LocalizedText {
  return { uz: '', ru: '', en: '' };
}

type ToastFn = (message: string, type?: ToastType) => void;

type Tab = 'menu' | 'categories' | 'sections' | 'admins';

export default function AdminPanel() {
  const { t } = useLang();
  const { currentUser, logout, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('menu');
  const { showToast } = useToast();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    api.health
      .check()
      .then((h) => setApiOnline(h.status === 'ok'))
      .catch(() => setApiOnline(false));
  }, []);

  if (!currentUser) {
    // Should not normally happen (route guard redirects), but keep as a safe fallback.
    return null;
  }

  return (
    <div className="admin-shell">
      <div className="admin-header">
        <h1>{t('menuManage')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: apiOnline ? 'var(--gold-light)' : 'var(--muted)' }}>
            {t('apiStatus')}: {apiOnline == null ? '…' : apiOnline ? t('apiOnline') : t('apiOffline')}
          </span>
          <Link to="/menu" className="btn-secondary">
            {t('backToMenu')}
          </Link>
          <button className="btn-secondary" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>
          {t('tabMenu')}
        </button>
        <button className={`admin-tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>
          {t('tabCategories')}
        </button>
        <button className={`admin-tab ${tab === 'sections' ? 'active' : ''}`} onClick={() => setTab('sections')}>
          {t('tabSections')}
        </button>
        <button className={`admin-tab ${tab === 'admins' ? 'active' : ''}`} onClick={() => setTab('admins')}>
          {t('tabUsers')}
        </button>
      </div>

      {tab === 'menu' && <MenuTab onToast={showToast} />}
      {tab === 'categories' && <CategoriesTab onToast={showToast} />}
      {tab === 'sections' && <SectionsTab onToast={showToast} />}
      {tab === 'admins' && <AdminsTab onToast={showToast} isSuperAdmin={isSuperAdmin} currentUserId={currentUser.id} />}
    </div>
  );
}

/* ============================= MENU TAB ============================= */

function emptyItemForm() {
  return { id: 0, title: emptyLocalized(), price: '', weight: '', category_id: '', photo: null as string | null };
}

function MenuTab({ onToast }: { onToast: ToastFn }) {
  const { t, lang } = useLang();
  const { items, categories, sections, loading, addItem, updateItem, deleteItem } = useMenu();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyItemForm());
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const editing = form.id !== 0;

  const startEdit = (it: MenuItem) => {
    setForm({
      id: it.id,
      title: it.title,
      price: String(it.price),
      weight: it.weight || '',
      category_id: String(it.category_id),
      photo: it.photo || null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetForm = () => setForm(emptyItemForm());

  const handlePhotoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setForm((f) => ({ ...f, photo: dataUrl }));
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.title[lang].trim() || form.title.ru.trim() || form.title.uz.trim();
    const price = Number(form.price);
    const category_id = Number(form.category_id);
    // The backend requires a photo on creation (it always tries to upload it) —
    // only allow skipping it when editing and not touching the photo field.
    if (!name || !price || !category_id || (!editing && !form.photo)) {
      setError(true);
      return;
    }
    setError(false);
    const payload = { title: form.title, price, weight: form.weight.trim(), category_id, photo: form.photo };
    const res = editing ? await updateItem(form.id, payload) : await addItem(payload);
    if (!res.ok) {
      onToast(res.error || t('fillRequired'), 'error');
      return;
    }
    onToast(t('saved'), 'success');
    resetForm();
  };

  const handleDelete = async (it: MenuItem) => {
    const name = it.title[lang] || it.title.ru || it.title.uz || it.title.en;
    const ok = await confirm(t('confirmDeleteNamed').replace('{name}', name));
    if (!ok) return;
    const res = await deleteItem(it.id);
    if (res.ok) onToast(t('deleted'), 'success');
    else onToast(res.error || t('notAuthorized'), 'error');
  };

  const list = items
    .filter((it) => !search.trim() || (it.title[lang] || '').toLowerCase().includes(search.trim().toLowerCase()))
    .slice()
    .sort((a, b) => a.category_id - b.category_id || (a.title[lang] || '').localeCompare(b.title[lang] || ''));

  const catLabel = (categoryId: number) => {
    const c = categories.find((c) => c.id === categoryId);
    return c ? c.name[lang] : '';
  };

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="admin-grid">
      <div className="panel-box">
        <h3>{editing ? t('editItem') : t('addItem')}</h3>
        {categories.length === 0 ? (
          <div className="field-error">{t('noCategoriesYet')}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <LocalizedInput label={`${t('name')} *`} value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <div className="field">
              <label>{t('price')} *</label>
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="45000"
              />
            </div>
            <div className="field">
              <label>{t('weightOpt')}</label>
              <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="250 гр" />
            </div>
            <div className="field">
              <label>{t('category')} *</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">{t('selectCategory')}</option>
                {sortedSections.map((s) => (
                  <optgroup key={s.id} label={s.name[lang]}>
                    {categories
                      .filter((c) => c.section_id === s.id)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name[lang]}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('photo')}</label>
              <div className="photo-upload" onClick={() => fileInput.current?.click()}>
                {form.photo && <img src={form.photo} alt="" />}
                <div>{t('uploadPhoto')}</div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoFile(file);
                  }}
                />
              </div>
              <input
                style={{ marginTop: 8 }}
                placeholder={t('photoUrl')}
                value={form.photo && form.photo.startsWith('http') ? form.photo : ''}
                onChange={(e) => setForm({ ...form, photo: e.target.value || null })}
              />
            </div>
            {error && <div className="field-error">{t('fillRequired')}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="submit" className="btn-primary">
                {t('save')}
              </button>
              {editing && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  {t('cancel')}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="panel-box">
        <h3>
          {t('allItems')} — {items.length} {t('itemsCount')}
        </h3>
        <div className="field admin-search">
          <input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="loading-row">{t('loading')}</div>
        ) : (
          <div className="admin-list">
            {list.map((it) => (
              <div className="admin-item" key={it.id}>
                <div className="thumb">{it.photo ? <img src={it.photo} alt="" /> : <DishIcon />}</div>
                <div className="info">
                  <div className="n">{it.title[lang]}</div>
                  <div className="m">
                    <span>{fmtPrice(it.price, lang)}</span>
                    <span>·</span>
                    <span>{catLabel(it.category_id)}</span>
                  </div>
                </div>
                <div className="acts">
                  <button className="icon-btn" title={t('edit')} onClick={() => startEdit(it)}>
                    <EditIcon />
                  </button>
                  <button className="icon-btn" title={t('delete')} onClick={() => handleDelete(it)}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= CATEGORIES TAB ============================= */

function emptyCategoryForm() {
  return { id: 0, name: emptyLocalized(), sort_order: '', section_id: '' };
}

function CategoriesTab({ onToast }: { onToast: ToastFn }) {
  const { t, lang } = useLang();
  const { categories, sections, loading, addCategory, updateCategory, deleteCategory } = useMenu();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyCategoryForm());
  const [error, setError] = useState(false);

  const editing = form.id !== 0;

  const startEdit = (c: Category) => {
    setForm({ id: c.id, name: c.name, sort_order: String(c.sort_order), section_id: String(c.section_id) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetForm = () => setForm(emptyCategoryForm());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name[lang].trim() || form.name.ru.trim() || form.name.uz.trim();
    const section_id = Number(form.section_id);
    const sort_order = Number(form.sort_order) || 0;
    if (!name || !section_id) {
      setError(true);
      return;
    }
    setError(false);
    const payload = { name: form.name, sort_order, section_id };
    const res = editing ? await updateCategory(form.id, payload) : await addCategory(payload);
    if (!res.ok) {
      onToast(res.error || t('fillRequired'), 'error');
      return;
    }
    onToast(t('saved'), 'success');
    resetForm();
  };

  const handleDelete = async (c: Category) => {
    const name = c.name[lang] || c.name.ru || c.name.uz || c.name.en;
    const ok = await confirm(t('confirmDeleteNamed').replace('{name}', name));
    if (!ok) return;
    const res = await deleteCategory(c.id);
    if (res.ok) onToast(t('deleted'), 'success');
    else onToast(res.error || t('notAuthorized'), 'error');
  };

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const sortedCategories = [...categories].sort((a, b) => a.section_id - b.section_id || a.sort_order - b.sort_order);
  const sectionLabel = (id: number) => sections.find((s) => s.id === id)?.name[lang] || '';

  return (
    <div className="admin-grid">
      <div className="panel-box">
        <h3>{editing ? t('editCategory') : t('addCategory')}</h3>
        {sections.length === 0 ? (
          <div className="field-error">{t('noSectionsYet')}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <LocalizedInput label={`${t('name')} *`} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div className="field">
              <label>{t('section')} *</label>
              <select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
                <option value="">{t('selectSection')}</option>
                {sortedSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name[lang]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('order')}</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="1" />
            </div>
            {error && <div className="field-error">{t('fillRequired')}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="submit" className="btn-primary">
                {t('save')}
              </button>
              {editing && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  {t('cancel')}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="panel-box">
        <h3>
          {t('allCategories')} — {categories.length}
        </h3>
        {loading ? (
          <div className="loading-row">{t('loading')}</div>
        ) : (
          <div className="admin-list">
            {sortedCategories.map((c) => (
              <div className="admin-item" key={c.id}>
                <div className="info">
                  <div className="n">{c.name[lang]}</div>
                  <div className="m">
                    <span>{sectionLabel(c.section_id)}</span>
                    <span>·</span>
                    <span>
                      {t('order')}: {c.sort_order}
                    </span>
                  </div>
                </div>
                <div className="acts">
                  <button className="icon-btn" title={t('edit')} onClick={() => startEdit(c)}>
                    <EditIcon />
                  </button>
                  <button className="icon-btn" title={t('delete')} onClick={() => handleDelete(c)}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= SECTIONS TAB ============================= */

function emptySectionForm() {
  return { id: 0, name: emptyLocalized(), sort_order: '' };
}

function SectionsTab({ onToast }: { onToast: ToastFn }) {
  const { t, lang } = useLang();
  const { sections, loading, addSection, updateSection, deleteSection } = useMenu();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptySectionForm());
  const [error, setError] = useState(false);

  const editing = form.id !== 0;

  const startEdit = (s: Section) => {
    setForm({ id: s.id, name: s.name, sort_order: String(s.sort_order) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetForm = () => setForm(emptySectionForm());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name[lang].trim() || form.name.ru.trim() || form.name.uz.trim();
    if (!name) {
      setError(true);
      return;
    }
    setError(false);
    const payload = { name: form.name, sort_order: Number(form.sort_order) || 0 };
    const res = editing ? await updateSection(form.id, payload) : await addSection(payload);
    if (!res.ok) {
      onToast(res.error || t('fillRequired'), 'error');
      return;
    }
    onToast(t('saved'), 'success');
    resetForm();
  };

  const handleDelete = async (s: Section) => {
    const name = s.name[lang] || s.name.ru || s.name.uz || s.name.en;
    const ok = await confirm(t('confirmDeleteNamed').replace('{name}', name));
    if (!ok) return;
    const res = await deleteSection(s.id);
    if (res.ok) onToast(t('deleted'), 'success');
    else onToast(res.error || t('notAuthorized'), 'error');
  };

  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="admin-grid">
      <div className="panel-box">
        <h3>{editing ? t('editSection') : t('addSection')}</h3>
        <form onSubmit={handleSubmit}>
          <LocalizedInput label={`${t('name')} *`} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <div className="field">
            <label>{t('sortOrder')}</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              placeholder="1"
            />
          </div>
          {error && <div className="field-error">{t('fillRequired')}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="submit" className="btn-primary">
              {t('save')}
            </button>
            {editing && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                {t('cancel')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel-box">
        <h3>
          {t('allSections')} — {sections.length}
        </h3>
        {loading ? (
          <div className="loading-row">{t('loading')}</div>
        ) : (
          <div className="admin-list">
            {sorted.map((s) => (
              <div className="admin-item" key={s.id}>
                <div className="info">
                  <div className="n">{s.name[lang]}</div>
                  <div className="m">
                    <span>
                      {t('sortOrder')}: {s.sort_order}
                    </span>
                  </div>
                </div>
                <div className="acts">
                  <button className="icon-btn" title={t('edit')} onClick={() => startEdit(s)}>
                    <EditIcon />
                  </button>
                  <button className="icon-btn" title={t('delete')} onClick={() => handleDelete(s)}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= ADMINS TAB ============================= */

function AdminsTab({
  onToast,
  isSuperAdmin,
  currentUserId,
}: {
  onToast: ToastFn;
  isSuperAdmin: boolean;
  currentUserId: number | undefined;
}) {
  const { t } = useLang();
  const { createAdmin, updateAdminUsername, updateAdminPassword, deleteAdmin, listAdmins } = useAuth();
  const confirm = useConfirm();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newStatus, setNewStatus] = useState('admin');
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const refreshAdmins = () => {
    if (!isSuperAdmin) return;
    setLoadingAdmins(true);
    listAdmins()
      .then(setAdmins)
      .catch(() => setAdmins([]))
      .finally(() => setLoadingAdmins(false));
  };

  useEffect(() => {
    refreshAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="admin-grid">
        <div className="panel-box">
          <div className="field-error">{t('onlySuperCanManage')}</div>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      setCreateError(t('fillAllFields'));
      return;
    }
    const res = await createAdmin(newUsername.trim(), newPassword, newStatus);
    if (!res.ok) {
      setCreateError(res.error || t('notAuthorized'));
      onToast(res.error || t('notAuthorized'), 'error');
      return;
    }
    setCreateError(null);
    setNewUsername('');
    setNewPassword('');
    onToast(t('userCreated'), 'success');
    refreshAdmins();
  };

  const startEdit = (a: AdminUser) => {
    setEditingId(a.id);
    setEditUsername(a.username);
    setEditPassword('');
  };

  const stopEdit = () => {
    setEditingId(null);
    setEditUsername('');
    setEditPassword('');
  };

  const handleSaveUsername = async (id: number) => {
    if (!editUsername.trim()) return;
    const res = await updateAdminUsername(id, editUsername.trim());
    if (res.ok) {
      onToast(t('usernameChanged'), 'success');
      refreshAdmins();
      // Change applied — close the edit row (turns off Apply/Cancel).
      stopEdit();
    } else {
      onToast(res.error || t('notAuthorized'), 'error');
    }
  };

  const handleSavePassword = async (id: number) => {
    if (!editPassword) return;
    const res = await updateAdminPassword(id, editPassword);
    if (res.ok) {
      onToast(t('passwordChanged'), 'success');
      // Change applied — close the edit row (turns off Apply/Cancel).
      stopEdit();
    } else {
      onToast(res.error || t('notAuthorized'), 'error');
    }
  };

  const handleDelete = async (a: AdminUser) => {
    if (a.id === currentUserId) {
      onToast(t('cannotDeleteSelf'), 'error');
      return;
    }
    const ok = await confirm(t('confirmDeleteNamed').replace('{name}', a.username));
    if (!ok) return;
    const res = await deleteAdmin(a.id);
    if (res.ok) {
      onToast(t('userDeleted'), 'success');
      refreshAdmins();
    } else {
      onToast(res.error || t('notAuthorized'), 'error');
    }
  };

  return (
    <div className="admin-grid">
      <div className="panel-box">
        <h3>{t('addUser')}</h3>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label>{t('newUsername')}</label>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('newPassword')}</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('adminStatus')}</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="admin">{t('roleAdmin')}</option>
              <option value="super">{t('roleSuper')}</option>
            </select>
          </div>
          {createError && <div className="field-error">{createError}</div>}
          <button type="submit" className="btn-primary">
            {t('createUser')}
          </button>
        </form>
      </div>

      <div className="panel-box">
        <h3>
          {t('users')} — {admins.length}
        </h3>
        {loadingAdmins ? (
          <div className="loading-row">{t('loading')}</div>
        ) : (
          admins.map((a) => (
            <div className="user-row" key={a.id} style={{ flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span className="uname">{a.username}</span>
                {a.id === currentUserId && <span className="you">({t('loggedInAs').split(' ').pop()})</span>}
                <span className="you" style={{ color: a.admin_status === 'super' ? 'var(--gold-light)' : 'var(--muted)' }}>
                  {' '}
                  · {a.admin_status === 'super' ? t('roleSuper') : t('roleAdmin')}
                </span>
              </div>
              {editingId === a.id ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                  <input
                    style={{ flex: 1, minWidth: 120 }}
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder={t('editUsername')}
                  />
                  <button type="button" className="btn-secondary" onClick={() => handleSaveUsername(a.id)}>
                    {t('apply')}
                  </button>
                  <input
                    style={{ flex: 1, minWidth: 120 }}
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder={t('editPassword')}
                  />
                  <button type="button" className="btn-secondary" onClick={() => handleSavePassword(a.id)}>
                    {t('apply')}
                  </button>
                  <button type="button" className="btn-secondary" onClick={stopEdit}>
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12.5 }} onClick={() => startEdit(a)}>
                    {t('edit')}
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(a)}>
                    {t('delete')}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
