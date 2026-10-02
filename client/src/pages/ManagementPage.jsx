import React, { useMemo, useState } from 'react';
import { Building2, Check, ChevronRight, CirclePlus, Edit3, Mail, MapPinned, MoreHorizontal, ShieldCheck, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { displayWard, t } from '../i18n';
import { api } from '../api';
import { Avatar, Button, EmptyState, Field, Modal, Spinner } from '../components/Shared';

const resourceMeta = {
  categories: { icon: Building2, title: 'categories', add: 'addCategory', empty: 'noCategories' },
  wards: { icon: MapPinned, title: 'wards', add: 'addWard', empty: 'noWards' },
  officers: { icon: ShieldCheck, title: 'officers', add: 'addOfficer', empty: 'noOfficers' },
  users: { icon: UsersRound, title: 'users', add: 'addUser', empty: 'noUsers' }
};
const categoryColors = ['#347a5c', '#3187a5', '#c29343', '#82649d', '#b97855', '#539489'];

export default function ManagementPage({ type, language, categories = [], wards = [], officers = [], users = [], loading, onRefresh, notify }) {
  const meta = resourceMeta[type] || resourceMeta.categories;
  const Icon = meta.icon;
  const records = type === 'categories' ? categories : type === 'wards' ? wards : type === 'officers' ? officers : users;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({});
  const kn = language === 'kn';
  const filtered = useMemo(() => records.filter((record) => {
    const value = [record.name_en, record.name_kn, record.full_name, record.email, record.role].join(' ').toLowerCase();
    return value.includes(query.toLowerCase());
  }), [records, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(type === 'categories' ? { name_en: '', name_kn: '', sla_days: 7, color: categoryColors[Math.floor(Math.random() * categoryColors.length)] }
      : type === 'wards' ? { name_en: '', name_kn: '' }
        : { full_name: '', email: '', phone: '', password: '', role: type === 'officers' ? 'official' : 'citizen', ward_id: '', is_active: 1 });
    setModalOpen(true);
  };
  const openEdit = (record) => {
    setEditing(record);
    setForm(type === 'categories' ? { name_en: record.name_en, name_kn: record.name_kn, sla_days: record.sla_days, color: record.color || '#347a5c' }
      : type === 'wards' ? { name_en: record.name_en, name_kn: record.name_kn }
        : { full_name: record.full_name, email: record.email, phone: record.phone || '', role: type === 'officers' ? 'official' : record.role, ward_id: record.ward_id || '', is_active: Number(record.is_active), password: '' });
    setModalOpen(true);
  };
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      if (type === 'categories') payload.sla_days = Number(payload.sla_days);
      if (type === 'officers') payload.role = 'official';
      let result;
      if (type === 'categories') result = await api(editing ? `/categories/${editing.id}` : '/categories', { method: editing ? 'PUT' : 'POST', body: payload });
      else if (type === 'wards') result = await api(editing ? `/wards/${editing.id}` : '/wards', { method: editing ? 'PUT' : 'POST', body: payload });
      else {
        if (!payload.password) delete payload.password;
        result = await api(editing ? `/users/${editing.id}` : '/users', { method: editing ? 'PUT' : 'POST', body: payload });
      }
      notify?.(editing ? (kn ? 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ.' : 'Changes saved.') : (kn ? 'ದಾಖಲೆ ಸೇರಿಸಲಾಗಿದೆ.' : 'Record added.'), 'success');
      setModalOpen(false); await onRefresh?.(result);
    } catch (error) { notify?.(error.message, 'error'); }
    finally { setBusy(false); }
  };

  const remove = async (record) => {
    const label = type === 'categories' ? record.name_en : type === 'wards' ? record.name_en : record.full_name;
    if (!window.confirm(`${type === 'users' || type === 'officers' ? t(language, 'confirmDisable') : t(language, 'confirmDelete')}\n\n${label}`)) return;
    try {
      if (type === 'categories') await api(`/categories/${record.id}`, { method: 'DELETE' });
      else if (type === 'wards') await api(`/wards/${record.id}`, { method: 'DELETE' });
      else await api(`/users/${record.id}`, { method: 'DELETE' });
      notify?.(kn ? 'ದಾಖಲೆ ನವೀಕರಿಸಲಾಗಿದೆ.' : 'Record updated.', 'success');
      await onRefresh?.();
    } catch (error) { notify?.(error.message, 'error'); }
  };

  const heading = t(language, meta.title);
  return <div className="page-content management-page">
    <div className="page-heading-row">
      <div><div className="overline-label"><span className="overline-mark" />{t(language, 'masterData')}</div><h1>{heading}</h1><p>{kn ? 'ಪಂಚಾಯತ್‌ನ ಮೂಲ ದಾಖಲೆಗಳು ಮತ್ತು ಪ್ರವೇಶಗಳನ್ನು ನಿರ್ವಹಿಸಿ.' : 'Maintain the reference data and access for this Panchayat.'}</p></div>
      <Button icon={CirclePlus} onClick={openCreate}>{t(language, meta.add)}</Button>
    </div>
    <div className="management-toolbar panel"><div className="management-summary"><span className="manage-icon"><Icon size={18} /></span><span><b>{records.length} {t(language, 'tableOfRecords')}</b><small>{type === 'officers' ? (kn ? 'ನಿಯೋಜಿಸಬಹುದಾದ ಸಕ್ರಿಯ ಅಧಿಕಾರಿಗಳು' : 'Active staff available for assignment') : type === 'users' ? (kn ? 'ನಾಗರಿಕರು ಮತ್ತು ಸಿಬ್ಬಂದಿ ಖಾತೆಗಳು' : 'Citizen and staff accounts') : (kn ? 'ಈ ಗ್ರಾಮ ಪಂಚಾಯತ್‌ಗೆ ಸಂಬಂಧಿಸಿದವು' : 'Scoped to this Gram Panchayat')}</small></span></div><div className="search-field manage-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kn ? 'ಹೆಸರು ಅಥವಾ ವಿವರ ಹುಡುಕಿ…' : 'Search name or details…'} /></div></div>

    {loading ? <div className="panel management-loading"><Spinner label={t(language, 'loading')} /></div> : !filtered.length ? <div className="panel"><EmptyState icon={Icon} title={t(language, meta.empty)} description={t(language, 'noResultsDesc')} action={<Button variant="soft" icon={CirclePlus} onClick={openCreate}>{t(language, meta.add)}</Button>} /></div> : <div className="panel management-table-panel"><div className="management-table-head"><span>{t(language, 'name')}</span><span>{type === 'categories' ? t(language, 'sla') : type === 'wards' ? t(language, 'ward') : t(language, 'email')}</span><span>{type === 'users' || type === 'officers' ? t(language, 'role') : t(language, 'activity')}</span><span>{t(language, 'actions')}</span></div>
      {filtered.map((record) => <div className="management-row" key={record.id}>
        <div className="management-name-cell">{type === 'categories' ? <span className="category-swatch" style={{ background: record.color }}><Icon size={14} /></span> : type === 'wards' ? <span className="record-icon-badge ward-badge"><MapPinned size={15} /></span> : <Avatar name={record.full_name} size="small" tone={record.role === 'admin' ? 'gold' : record.role === 'official' ? 'blue' : 'green'} />}<span><b>{record.name_en || record.full_name}</b><small>{record.name_kn || record.email || record.phone || ''}</small></span></div>
        <div className="management-secondary-cell">{type === 'categories' ? <span className="sla-chip"><Clock3Icon />{record.sla_days} {t(language, 'daysLeft')}</span> : type === 'wards' ? <span className="ward-mini-chip">{record.name_kn}</span> : <span className="email-cell"><Mail size={13} />{record.email}</span>}</div>
        <div className="management-state-cell">{type === 'users' || type === 'officers' ? <><span className={`role-pill role-${record.role}`}>{t(language, record.role)}</span><span className={`active-dot-label ${record.is_active ? 'is-active' : 'is-inactive'}`}><i />{record.is_active ? t(language, 'active') : t(language, 'inactive')}</span></> : <span className="record-subtle">{type === 'categories' ? `${kn ? 'SLA' : 'Target'} · ${record.sla_days} ${t(language, 'daysLeft')}` : `${t(language, 'ward')} · ${record.name_en.split('·')[0].trim()}`}</span>}</div>
        <div className="management-action-cell"><button className="row-action" onClick={() => openEdit(record)} title={t(language, 'edit')}><Edit3 size={15} /><span>{t(language, 'edit')}</span></button>{(type === 'users' || type === 'officers') ? record.is_active === 1 && <button className="row-action row-action-danger" onClick={() => remove(record)} title={t(language, 'disable')}><X size={15} /><span>{t(language, 'disable')}</span></button> : <button className="row-icon-action" onClick={() => remove(record)} title={t(language, 'delete')}><Trash2 size={15} /></button>}</div>
      </div>)}
      </div>}

    <div className="master-data-footnote"><ShieldCheck size={15} /><span>{kn ? 'ಬಳಕೆಯಲ್ಲಿರುವ ವರ್ಗ ಅಥವಾ ವಾರ್ಡ್‌ಗಳನ್ನು ಅಳಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ; ಇತಿಹಾಸ ಉಳಿಯುತ್ತದೆ.' : 'Categories and wards already used by complaints cannot be deleted, preserving the audit trail.'}</span><ChevronRight size={15} /></div>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `${t(language, 'edit')} ${heading}` : t(language, meta.add)} subtitle={kn ? 'ಇಂಗ್ಲಿಷ್ ಮತ್ತು ಕನ್ನಡ ಹೆಸರು ಎರಡನ್ನೂ ನೀಡಿ.' : 'Keep the record clear in both English and Kannada.'} size="small">
      <form onSubmit={save} className="form-stack">
        {type === 'categories' && <>
          <Field label={t(language, 'nameEnglish')} required><input className="form-input" value={form.name_en || ''} onChange={(event) => update('name_en', event.target.value)} required /></Field>
          <Field label={t(language, 'nameKannada')} required><input className="form-input" lang="kn" value={form.name_kn || ''} onChange={(event) => update('name_kn', event.target.value)} required /></Field>
          <div className="form-row"><Field label={t(language, 'sla')} required><input type="number" min="1" max="90" className="form-input" value={form.sla_days || ''} onChange={(event) => update('sla_days', event.target.value)} required /></Field><Field label={t(language, 'color')}><div className="color-picker-wrap"><input type="color" value={form.color || '#347a5c'} onChange={(event) => update('color', event.target.value)} /><span>{form.color}</span></div></Field></div>
        </>}
        {type === 'wards' && <>
          <Field label={t(language, 'nameEnglish')} required><input className="form-input" value={form.name_en || ''} onChange={(event) => update('name_en', event.target.value)} required /></Field>
          <Field label={t(language, 'nameKannada')} required><input className="form-input" lang="kn" value={form.name_kn || ''} onChange={(event) => update('name_kn', event.target.value)} required /></Field>
        </>}
        {(type === 'users' || type === 'officers') && <>
          <Field label={t(language, 'fullName')} required><input className="form-input" value={form.full_name || ''} onChange={(event) => update('full_name', event.target.value)} required /></Field>
          <Field label={t(language, 'email')} required><input type="email" className="form-input" value={form.email || ''} onChange={(event) => update('email', event.target.value)} required /></Field>
          <div className="form-row"><Field label={t(language, 'phone')}><input className="form-input" value={form.phone || ''} onChange={(event) => update('phone', event.target.value)} /></Field>{type === 'users' ? <Field label={t(language, 'role')} required><select className="form-input" value={form.role || 'citizen'} onChange={(event) => update('role', event.target.value)}><option value="citizen">{t(language, 'citizen')}</option><option value="official">{t(language, 'official')}</option><option value="admin">{t(language, 'admin')}</option></select></Field> : <Field label={t(language, 'role')}><input className="form-input" value={t(language, 'official')} disabled /></Field>}</div>
          <Field label={t(language, 'wardAssignment')}><select className="form-input" value={form.ward_id || ''} onChange={(event) => update('ward_id', event.target.value)}><option value="">{t(language, 'allWards')}</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{displayWard(ward, language)}</option>)}</select></Field>
          <Field label={editing ? (kn ? 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ (ಐಚ್ಛಿಕ)' : 'Reset password (optional)') : t(language, 'password')} required={!editing}><input type="password" className="form-input" value={form.password || ''} onChange={(event) => update('password', event.target.value)} minLength={8} required={!editing} placeholder={editing ? '••••••••' : ''} /></Field>
          {editing && <label className="public-check active-check"><input type="checkbox" checked={Number(form.is_active) === 1} onChange={(event) => update('is_active', event.target.checked ? 1 : 0)} /><span className="custom-check"><Check size={13} /></span><span><b>{t(language, 'active')}</b><small>{kn ? 'ನಿಷ್ಕ್ರಿಯ ಖಾತೆಗೆ ಪ್ರವೇಶ ನಿರ್ಬಂಧಿಸಲಾಗುತ್ತದೆ.' : 'Inactive accounts cannot sign in.'}</small></span></label>}
        </>}
        <div className="modal-actions"><Button variant="ghost" onClick={() => setModalOpen(false)}>{t(language, 'cancel')}</Button><Button type="submit" disabled={busy}>{busy ? t(language, 'loadingMore') : t(language, 'save')}</Button></div>
      </form>
    </Modal>
  </div>;
}

function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>; }
function Clock3Icon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>; }
