import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, FilePlus2, Filter, Search, SlidersHorizontal, UploadCloud, X } from 'lucide-react';
import { displayCategory, displayWard, t } from '../i18n';
import { api, downloadSampleCsv } from '../api';
import ComplaintList from '../components/ComplaintList';
import { Button, Field, Modal } from '../components/Shared';

const statuses = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

export default function ComplaintsPage({ user, language, complaints = [], categories = [], wards = [], onOpenComplaint, onNewComplaint, onRefresh, notify }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [wardId, setWardId] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);
  const kn = language === 'kn';
  const filtered = useMemo(() => complaints.filter((item) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [item.reference_id, item.title, item.public_summary, item.category_name_en, item.ward_name_en].some((text) => String(text || '').toLowerCase().includes(search));
    return matchesSearch && (!status || item.status === status) && (!categoryId || item.category_id === categoryId) && (!wardId || item.ward_id === wardId);
  }), [complaints, query, status, categoryId, wardId]);
  const activeFilters = [status, categoryId, wardId].filter(Boolean).length;

  const importCsv = async (event) => {
    event.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const data = new FormData();
      data.append('file', importFile);
      const result = await api('/admin/import-csv', { method: 'POST', body: data });
      setReport(result);
      notify?.(`${result.imported} imported · ${result.skipped} skipped`, 'success');
      if (result.imported) onRefresh?.();
    } catch (error) { notify?.(error.message, 'error'); }
    finally { setImporting(false); }
  };

  const clearFilters = () => { setStatus(''); setCategoryId(''); setWardId(''); setQuery(''); };
  const download = async () => {
    try { const blob = await downloadSampleCsv(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'secondary-grievance-sample.csv'; a.click(); URL.revokeObjectURL(url); }
    catch (error) { notify?.(error.message, 'error'); }
  };

  return <div className="page-content">
    <div className="page-heading-row">
      <div><div className="overline-label"><span className="overline-mark" />{user.role === 'citizen' ? t(language, 'citizenTools') : t(language, 'operationalView')}</div><h1>{user.role === 'citizen' ? t(language, 'myComplaints') : t(language, 'complaints')}</h1><p>{kn ? 'ಪ್ರತಿ ದೂರಿನ ಪ್ರಗತಿಯನ್ನು ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ ಅನುಸರಿಸಿ.' : 'Follow every local service request from one clear queue.'}</p></div>
      <div className="heading-actions">
        {user.role === 'admin' && <Button variant="secondary" icon={UploadCloud} onClick={() => { setImportOpen(true); setReport(null); }}>{t(language, 'importData')}</Button>}
        {user.role === 'citizen' && <Button icon={FilePlus2} onClick={onNewComplaint}>{t(language, 'newComplaint')}</Button>}
      </div>
    </div>

    {user.role === 'admin' && <div className="import-hint-strip"><span className="hint-badge"><UploadCloud size={14} /></span><span><b>{t(language, 'sourceDemo')}</b> · {t(language, 'importHint')}</span><button onClick={download}><ArrowDownToLine size={14} />{t(language, 'downloadSample')}</button></div>}

    <section className="panel records-panel">
      <div className="records-toolbar">
        <div className="search-field"><Search size={16} /><input aria-label={t(language, 'searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(language, 'search')} />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</div>
        <button className={`filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal size={16} />{t(language, 'filterStatus')}{activeFilters > 0 && <span>{activeFilters}</span>}</button>
        {activeFilters > 0 && <button className="clear-filter-btn" onClick={clearFilters}>{t(language, 'clearFilters')}</button>}
      </div>
      {showFilters && <div className="filter-row">
        <Field label={t(language, 'status')}><select className="form-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t(language, 'allStatuses')}</option>{statuses.map((item) => <option key={item} value={item}>{t(language, item === 'In Progress' ? 'inProgress' : item.toLowerCase())}</option>)}</select></Field>
        <Field label={t(language, 'category')}><select className="form-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{t(language, 'allCategories')}</option>{categories.map((item) => <option key={item.id} value={item.id}>{displayCategory(item, language)}</option>)}</select></Field>
        <Field label={t(language, 'ward')}><select className="form-input" value={wardId} onChange={(event) => setWardId(event.target.value)}><option value="">{t(language, 'allWards')}</option>{wards.map((item) => <option key={item.id} value={item.id}>{displayWard(item, language)}</option>)}</select></Field>
      </div>}
      <div className="records-list-heading"><span>{filtered.length} {t(language, 'tableOfRecords')}</span><span><Filter size={13} />{t(language, 'allRecords')}</span></div>
      <ComplaintList complaints={filtered} language={language} onOpen={onOpenComplaint} showOfficer={user.role !== 'citizen'} emptyTitle={t(language, 'noResults')} emptyDescription={t(language, 'noResultsDesc')} />
    </section>

    <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t(language, 'importData')} subtitle={t(language, 'importHint')} size="medium">
      <form onSubmit={importCsv} className="form-stack">
        <div className="import-dropzone">
          <span className="import-drop-icon"><UploadCloud size={21} /></span>
          <b>{importFile?.name || t(language, 'chooseFile')}</b><small>{t(language, 'csvExample')} · max 1 MB</small>
          <input type="file" accept=".csv,text/csv" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setReport(null); }} aria-label={t(language, 'chooseFile')} />
        </div>
        <div className="csv-columns-note"><b>Expected columns</b><span>category, ward, title, description, status, public_summary, location_text, created_at, resolved_at, officer_email, reference_id</span><small>{t(language, 'publicNote')}</small></div>
        {report && <div className={`import-report ${report.imported ? 'report-success' : 'report-warning'}`}><b>{report.message}</b><span>{report.imported} {t(language, 'rowsImported')} · {report.skipped} {t(language, 'rowSkipped')}</span>{report.errors?.length > 0 && <details><summary>{t(language, 'importReport')}</summary><ul>{report.errors.slice(0, 8).map((item) => <li key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</li>)}</ul></details>}</div>}
        <div className="modal-actions"><Button variant="ghost" onClick={() => setImportOpen(false)}>{t(language, 'close')}</Button><Button type="submit" icon={UploadCloud} disabled={!importFile || importing}>{importing ? t(language, 'loadingMore') : t(language, 'uploadCsv')}</Button></div>
      </form>
    </Modal>
  </div>;
}
