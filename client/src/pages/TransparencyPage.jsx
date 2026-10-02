import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, Eye, ExternalLink, Search, ShieldCheck, TicketCheck, X } from 'lucide-react';
import { api } from '../api';
import { displayCategory, displayStatus, displayWard, t } from '../i18n';
import { Button, Field, Modal, Spinner, StatusBadge } from '../components/Shared';

function dateLabel(value, language, short = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function TransparencyPage({ language, onNavigate, embedded = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [trackRef, setTrackRef] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const kn = language === 'kn';

  const refresh = async () => {
    setLoading(true); setLoadError('');
    try { setData(await api('/public/transparency')); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const items = useMemo(() => (data?.items || []).filter((item) => {
    const q = query.trim().toLowerCase();
    const matchesGroup = group === 'all' || (group === 'pending' ? ['Submitted', 'Assigned', 'In Progress'].includes(item.status) : item.status === 'Resolved');
    const matchesSearch = !q || [item.reference_id, item.public_summary, item.category_name_en, item.ward_name_en].some((field) => String(field || '').toLowerCase().includes(q));
    return matchesGroup && matchesSearch;
  }), [data, group, query]);

  const track = async (event) => {
    event.preventDefault();
    if (!trackRef.trim()) return;
    setTracking(true); setTrackError('');
    try { setTrackResult(await api(`/public/track/${encodeURIComponent(trackRef.trim())}`)); }
    catch (error) { setTrackResult(null); setTrackError(error.status === 404 ? t(language, 'trackNotFound') : error.message); }
    finally { setTracking(false); }
  };

  return <div className={`page-content transparency-page ${embedded ? 'transparency-embedded' : ''}`}>
    {!embedded && <div className="page-heading-row transparency-page-heading">
      <div><div className="overline-label"><span className="overline-mark" />{t(language, 'impact')}</div><h1>{t(language, 'publicTitle')}</h1><p>{t(language, 'publicSubtitle')}</p></div>
      <div className="privacy-stamp"><ShieldCheck size={17} /><span><b>{kn ? 'ಗೌಪ್ಯತೆ ಮೊದಲಿಗೆ' : 'Privacy first'}</b><small>{t(language, 'noContactPublic')}</small></span></div>
    </div>}

    <section className="transparency-hero">
      <div className="transparency-hero-copy"><div className="public-label"><Eye size={14} />{t(language, 'publicBoard')}</div><h2>{kn ? 'ದೂರುಗಳ ಪ್ರಗತಿಯನ್ನು ಎಲ್ಲರೂ ನೋಡಬಹುದು.' : 'Progress that the whole village can see.'}</h2><p>{t(language, 'publicSubtitle')}</p><span className="transparency-note"><ShieldCheck size={14} />{t(language, 'privateInformation')}</span></div>
      <div className="transparency-hero-art" aria-hidden="true"><div className="transparency-art-orbit orbit-one" /><div className="transparency-art-orbit orbit-two" /><div className="transparency-art-center"><TicketCheck size={28} /></div><div className="art-tag tag-one"><i />{kn ? 'ಸಲ್ಲಿಸಲಾಗಿದೆ' : 'Submitted'}</div><div className="art-tag tag-two"><i />{kn ? 'ಪರಿಹರಿಸಲಾಗಿದೆ' : 'Resolved'}</div><div className="art-tag tag-three"><i />{kn ? 'ಪಾರದರ್ಶಕತೆ' : 'Accountable'}</div></div>
    </section>

    <div className="transparency-stats">
      <div><span className="trans-stat-icon"><TicketCheck size={18} /></span><span><small>{t(language, 'totalComplaints')}</small><b>{data?.total ?? '—'}</b></span></div>
      <div><span className="trans-stat-icon amber"><Clock3 size={18} /></span><span><small>{t(language, 'pending')}</small><b>{data?.pending ?? '—'}</b></span></div>
      <div><span className="trans-stat-icon blue"><CheckCircle2 size={18} /></span><span><small>{t(language, 'resolved')}</small><b>{data?.resolved ?? '—'}</b></span></div>
      <div><span className="trans-stat-icon lavender"><ShieldCheck size={18} /></span><span><small>{t(language, 'rejected')}</small><b>{data?.rejected ?? '—'}</b></span></div>
    </div>

    <section className="track-panel panel">
      <div className="track-panel-intro"><span className="track-icon"><Search size={17} /></span><span><b>{t(language, 'track')}</b><small>{t(language, 'trackingHelp')}</small></span></div>
      <form onSubmit={track}><div className="search-field track-search"><Search size={16} /><input value={trackRef} onChange={(event) => { setTrackRef(event.target.value); setTrackError(''); }} placeholder={t(language, 'trackPlaceholder')} /></div><Button type="submit" icon={ArrowUpRight} disabled={tracking}>{tracking ? t(language, 'loadingMore') : t(language, 'trackButton')}</Button></form>
      {trackError && <span className="track-error">{trackError}</span>}
    </section>

    <div className="public-records-head"><div><div className="panel-kicker">{t(language, 'latestActivity')}</div><h2>{t(language, 'allRecords')}</h2></div><div className="public-filter-pills">{[
      ['all', t(language, 'all')], ['pending', t(language, 'pending')], ['resolved', t(language, 'resolved')]
    ].map(([key, label]) => <button key={key} className={group === key ? 'selected' : ''} onClick={() => setGroup(key)}>{label}{key === 'pending' && <span>{data?.pending ?? 0}</span>}</button>)}</div></div>

    <div className="public-record-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(language, 'search')} />{query && <button onClick={() => setQuery('')}><X size={14} /></button>}</div><span>{items.length} {t(language, 'tableOfRecords')}</span></div>

    {loading ? <div className="public-loading"><Spinner label={t(language, 'loadingPublic')} /></div> : loadError ? <div className="panel error-panel"><p>{loadError}</p><Button variant="secondary" onClick={refresh}>{t(language, 'retry')}</Button></div> : items.length ? <div className="public-record-grid">{items.map((item) => <article className="public-record-card" key={item.reference_id}>
      <div className="public-record-top"><span className="public-record-id">{item.reference_id}</span><StatusBadge status={item.status} language={language} escalated={item.is_escalated} /></div>
      <div className="public-record-main"><span className="public-category-label">{displayCategory({ name_en: item.category_name_en, name_kn: item.category_name_kn }, language)}<i />{displayWard({ name_en: item.ward_name_en, name_kn: item.ward_name_kn }, language)}</span><h3>{item.public_summary || displayCategory({ name_en: item.category_name_en, name_kn: item.category_name_kn }, language)}</h3><p>{t(language, 'updated')}: {dateLabel(item.updated_at, language)}{item.is_escalated ? ` · ${t(language, 'escalated')}` : ''}</p></div>
      <div className="public-record-bottom"><span><Clock3 size={13} />{dateLabel(item.created_at, language, true)}</span><button onClick={() => { setTrackRef(item.reference_id); setTrackResult(item); }}>View status<ArrowUpRight size={13} /></button></div>
    </article>)}</div> : <div className="panel"><div className="empty-state"><div className="empty-icon"><Search size={21} /></div><h3>{t(language, 'noPublicItems')}</h3><p>{t(language, 'noResultsDesc')}</p></div></div>}

    <div className="transparency-footnote"><span><ShieldCheck size={14} />{t(language, 'publicNote')}</span><span>{t(language, 'sourceDemo')}</span></div>

    <Modal open={Boolean(trackResult)} onClose={() => setTrackResult(null)} title={t(language, 'track')} subtitle={trackResult?.reference_id} size="small">
      {trackResult && <div className="track-result-card"><div className="track-result-status"><StatusBadge status={trackResult.status} language={language} escalated={Boolean(trackResult.is_escalated)} /><span>{t(language, 'date')}: {dateLabel(trackResult.created_at, language)}</span></div><h3>{trackResult.public_summary}</h3><div className="track-result-category">{displayCategory({ name_en: trackResult.category_name_en, name_kn: trackResult.category_name_kn }, language)} · {displayWard({ name_en: trackResult.ward_name_en, name_kn: trackResult.ward_name_kn }, language)}</div><p>{trackResult.public_summary}</p><div className="track-result-footer"><span>{t(language, 'resolutionDeadline')}</span><b>{dateLabel(trackResult.resolution_deadline, language)}</b></div><div className="track-result-footer"><span>{t(language, 'updated')}</span><b>{dateLabel(trackResult.updated_at, language)}</b></div><div className="private-result-note"><ShieldCheck size={14} />{t(language, 'noContactPublic')}</div></div>}
    </Modal>
  </div>;
}
