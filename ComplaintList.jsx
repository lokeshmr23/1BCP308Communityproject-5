import React from 'react';
import { ArrowUpRight, Clock3, MapPin, MessageSquareText } from 'lucide-react';
import { displayCategory, displayWard, t } from '../i18n';
import { PriorityBadge, StatusBadge } from './Shared';

function prettyDate(value, language = 'en') {
  if (!value) return '—';
  const locale = language === 'kn' ? 'kn-IN' : 'en-IN';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function ComplaintCard({ complaint, language, onOpen, showOfficer = false }) {
  const isLate = Boolean(complaint.escalated_at);
  return <button className="complaint-card" onClick={() => onOpen(complaint)}>
    <span className="complaint-category-mark" style={{ '--category-color': complaint.category_color || '#478365' }} />
    <div className="complaint-card-main">
      <div className="complaint-card-eyebrow"><span>{displayCategory({ name_en: complaint.category_name_en, name_kn: complaint.category_name_kn }, language)}</span><span className="bullet-dot" />{complaint.reference_id}</div>
      <h3>{complaint.title}</h3>
      <p>{complaint.public_summary || complaint.description}</p>
      <div className="complaint-card-meta"><span><MapPin size={13} />{displayWard({ name_en: complaint.ward_name_en, name_kn: complaint.ward_name_kn }, language)}</span><span><Clock3 size={13} />{prettyDate(complaint.created_at, language)}</span>{showOfficer && complaint.officer_name && <span><MessageSquareText size={13} />{complaint.officer_name}</span>}</div>
    </div>
    <div className="complaint-card-side"><StatusBadge status={complaint.status} language={language} escalated={isLate} />{isLate && <PriorityBadge priority="High" language={language} />}<span className="row-open-icon"><ArrowUpRight size={15} /></span></div>
  </button>;
}

export default function ComplaintList({ complaints = [], language, onOpen, showOfficer = false, emptyTitle, emptyDescription, compact = false }) {
  if (!complaints.length) return <div className="inline-empty"><div className="inline-empty-icon"><MessageSquareText size={18} /></div><div><b>{emptyTitle || t(language, 'emptyComplaints')}</b><span>{emptyDescription || t(language, 'noComplaintsDesc')}</span></div></div>;
  return <div className={`complaint-list ${compact ? 'complaint-list-compact' : ''}`}>
    {complaints.map((complaint) => <ComplaintCard key={complaint.id || complaint.reference_id} complaint={complaint} language={language} onOpen={onOpen} showOfficer={showOfficer} />)}
  </div>;
}
