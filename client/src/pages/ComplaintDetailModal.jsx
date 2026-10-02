import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarClock, Check, CheckCheck, Clock3, Copy, Edit3, MapPin, MessageSquare, Navigation, RotateCw, Send, ShieldAlert, Star, Trash2, UserRound } from 'lucide-react';
import { api } from '../api';
import { displayCategory, displayStatus, displayWard, t } from '../i18n';
import { Avatar, Button, Field, Modal, PriorityBadge, StatusBadge } from '../components/Shared';

function formatFullDate(value, language) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export default function ComplaintDetailModal({ complaint: initialComplaint, onClose, onEdit, onWithdraw, user, language, officers = [], onUpdated, notify }) {
  const [complaint, setComplaint] = useState(initialComplaint);
  const [assignedOfficerId, setAssignedOfficerId] = useState(initialComplaint?.assigned_officer_id || '');
  const [assignmentRemark, setAssignmentRemark] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [statusRemark, setStatusRemark] = useState('');
  const [rating, setRating] = useState(initialComplaint?.feedback?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState(initialComplaint?.feedback?.comment || '');
  const [busy, setBusy] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(Boolean(initialComplaint?.feedback));
  const kn = language === 'kn';
  const canWork = user.role === 'admin' || user.role === 'official';
  const validNext = useMemo(() => ({
    Submitted: ['Assigned', 'In Progress', 'Rejected'], Assigned: ['In Progress', 'Rejected'], 'In Progress': ['Resolved', 'Rejected'], Resolved: [], Rejected: []
  }[complaint?.status] || []), [complaint?.status]);

  useEffect(() => {
    setComplaint(initialComplaint);
    setAssignedOfficerId(initialComplaint?.assigned_officer_id || '');
    setRating(initialComplaint?.feedback?.rating || 0);
    setFeedbackComment(initialComplaint?.feedback?.comment || '');
    setFeedbackSent(Boolean(initialComplaint?.feedback));
  }, [initialComplaint?.id, initialComplaint?.status, initialComplaint?.feedback?.id]);

  if (!complaint) return null;

  const optimisticUpdate = async (optimistic, request, successText) => {
    const previous = complaint;
    setComplaint((current) => ({ ...current, ...optimistic }));
    setBusy('update');
    try {
      const fresh = await request();
      setComplaint(fresh);
      onUpdated?.(fresh);
      notify?.(successText, 'success');
    } catch (error) {
      setComplaint(previous);
      notify?.(error.message, 'error');
    } finally { setBusy(''); }
  };

  const assign = async (event) => {
    event.preventDefault();
    if (!assignedOfficerId) { notify?.(kn ? 'ಅಧಿಕಾರಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.' : 'Choose an official first.', 'error'); return; }
    const officer = officers.find((item) => item.id === assignedOfficerId);
    const optimisticStatus = complaint.status === 'Submitted' ? 'Assigned' : complaint.status;
    await optimisticUpdate({ assigned_officer_id: assignedOfficerId, officer_name: officer?.full_name, status: optimisticStatus, assigned_at: new Date().toISOString() },
      () => api(`/complaints/${complaint.id}/assign`, { method: 'PATCH', body: { assignedOfficerId, remarks: assignmentRemark } }),
      kn ? 'ಅಧಿಕಾರಿಯನ್ನು ನಿಯೋಜಿಸಲಾಗಿದೆ.' : 'Complaint assigned.'
    );
    setAssignmentRemark('');
  };

  const updateStatus = async (event) => {
    event.preventDefault();
    if (!nextStatus || statusRemark.trim().length < 3) { notify?.(kn ? 'ಸ್ಥಿತಿ ಮತ್ತು ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳ ಟಿಪ್ಪಣಿ ಅಗತ್ಯ.' : 'Choose a status and add a short remark.', 'error'); return; }
    const target = nextStatus;
    await optimisticUpdate({ status: target, updated_at: new Date().toISOString(), ...(target === 'Resolved' ? { resolved_at: new Date().toISOString() } : {}) },
      () => api(`/complaints/${complaint.id}/status`, { method: 'PATCH', body: { status: target, remarks: statusRemark } }),
      kn ? `ಸ್ಥಿತಿ: ${displayStatus(target, language)}` : `Status updated to ${target}.`
    );
    setNextStatus(''); setStatusRemark('');
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!rating) return notify?.(kn ? '1 ರಿಂದ 5 ನಕ್ಷತ್ರ ಆಯ್ಕೆಮಾಡಿ.' : 'Choose a rating from 1 to 5.', 'error');
    setBusy('feedback');
    try {
      const result = await api(`/complaints/${complaint.id}/feedback`, { method: 'POST', body: { rating, comment: feedbackComment } });
      setComplaint((current) => ({ ...current, feedback: result }));
      setFeedbackSent(true);
      onUpdated?.({ ...complaint, feedback: result });
      notify?.(t(language, 'feedbackThanks'), 'success');
    } catch (error) { notify?.(error.message, 'error'); }
    finally { setBusy(''); }
  };

  const copyReference = async () => {
    try { await navigator.clipboard.writeText(complaint.reference_id); notify?.(t(language, 'ticketCopied'), 'success'); }
    catch (_error) { notify?.(complaint.reference_id, 'info'); }
  };
  const withdrawComplaint = async () => {
    const prompt = user.role === 'admin' ? t(language, 'confirmArchive') : t(language, 'confirmWithdraw');
    if (!window.confirm(`${prompt}\n\n${complaint.reference_id}`)) return;
    setBusy('withdraw');
    try {
      await api(`/complaints/${complaint.id}`, { method: 'DELETE' });
      notify?.(user.role === 'admin' ? t(language, 'archivedSuccess') : t(language, 'withdrawnSuccess'), 'success');
      onWithdraw?.(complaint);
      onClose?.();
    } catch (error) { notify?.(error.message, 'error'); }
    finally { setBusy(''); }
  };

  const canEditCitizen = user.role === 'citizen' && complaint.status === 'Submitted' && !complaint.assigned_officer_id;
  const canRemove = canEditCitizen || user.role === 'admin';
  const deadlineBreached = complaint.escalated_at || (complaint.resolution_deadline && complaint.status !== 'Resolved' && complaint.status !== 'Rejected' && new Date(complaint.resolution_deadline) < new Date());
  const eventLabel = (event) => event.event_type === 'Submitted' ? t(language, 'timelineSubmitted') : event.event_type === 'Assigned' ? t(language, 'timelineAssigned') : event.event_type === 'Escalated' ? t(language, 'escalation') : event.event_type === 'Status changed' ? t(language, 'timelineStatus') : event.event_type === 'Edited' ? t(language, 'edited') : event.event_type === 'Withdrawn' ? t(language, 'withdrawn') : event.event_type === 'Archived' ? t(language, 'archived') : event.event_type;

  return <Modal open={Boolean(complaint)} onClose={onClose} title={t(language, 'complaintDetails')} subtitle={complaint.reference_id} size="large">
    <div className="detail-layout">
      <main className="detail-main">
        <div className="detail-status-head">
          <div><div className="detail-category-row"><span className="category-color-dot" style={{ background: complaint.category_color || '#478365' }} />{displayCategory({ name_en: complaint.category_name_en, name_kn: complaint.category_name_kn }, language)}<span className="bullet-dot" />{displayWard({ name_en: complaint.ward_name_en, name_kn: complaint.ward_name_kn }, language)}</div><h2>{complaint.title}</h2></div>
          <div className="detail-header-actions">{canEditCitizen && <Button variant="secondary" size="small" icon={Edit3} onClick={() => onEdit?.(complaint)}>{t(language, 'edit')}</Button>}{canRemove && <Button variant="danger" size="small" icon={Trash2} onClick={withdrawComplaint} disabled={busy === 'withdraw'}>{user.role === 'admin' ? t(language, 'archive') : t(language, 'withdraw')}</Button>}<div className="detail-status-stack"><StatusBadge status={complaint.status} language={language} escalated={Boolean(deadlineBreached)} /><PriorityBadge priority={complaint.priority || (deadlineBreached ? 'High' : 'Normal')} language={language} /></div></div>
        </div>
        <div className="detail-id-bar"><span>{t(language, 'reference')} <b>{complaint.reference_id}</b></span><button onClick={copyReference}><Copy size={13} />{t(language, 'copyId')}</button></div>

        <section className="detail-section"><div className="detail-section-title"><span className="detail-section-icon"><MessageSquare size={15} /></span><div><h3>{t(language, 'description')}</h3><small>{t(language, 'staffOnly')}</small></div></div><p className="detail-description">{complaint.description}</p></section>

        {complaint.photo_url && <section className="detail-section"><div className="detail-section-title"><span className="detail-section-icon"><Navigation size={15} /></span><div><h3>{t(language, 'complaintImage')}</h3><small>{t(language, 'photoAttached')}</small></div></div><a className="detail-photo-link" href={complaint.photo_url} target="_blank" rel="noreferrer"><img src={complaint.photo_url} alt={complaint.title} /><span>{kn ? 'ಪೂರ್ಣ ಗಾತ್ರದಲ್ಲಿ ನೋಡಿ' : 'View full size'}<ArrowUpRight size={14} /></span></a></section>}

        <section className="detail-info-grid">
          <div className="detail-info-item"><span><CalendarClock size={15} />{t(language, 'date')}</span><b>{formatFullDate(complaint.created_at, language)}</b></div>
          <div className={`detail-info-item ${deadlineBreached ? 'deadline-breached' : ''}`}><span><Clock3 size={15} />{t(language, 'resolutionDeadline')}</span><b>{formatFullDate(complaint.resolution_deadline, language)}</b><small>{deadlineBreached ? t(language, 'overdue') : t(language, 'onTrack')}</small></div>
          <div className="detail-info-item"><span><MapPin size={15} />{t(language, 'location')}</span><b>{complaint.location_text || t(language, 'notProvided')}</b>{complaint.latitude && complaint.longitude && <small>{kn ? 'GPS ಮಾಹಿತಿ ಖಾಸಗಿ' : 'Precise coordinates are private'}</small>}</div>
          <div className="detail-info-item"><span><UserRound size={15} />{t(language, 'officer')}</span><b>{complaint.officer_name || t(language, 'responsePending')}</b></div>
        </section>

        {canWork && complaint.citizen_name && <div className="citizen-contact-card"><Avatar name={complaint.citizen_name} size="small" tone="blue" /><span><b>{complaint.citizen_name}</b><small>{complaint.citizen_email}{complaint.citizen_phone ? ` · ${complaint.citizen_phone}` : ''}</small></span><span className="staff-private-label"><ShieldAlert size={12} />{kn ? 'ಖಾಸಗಿ' : 'Staff only'}</span></div>}

        {canWork && !['Resolved', 'Rejected'].includes(complaint.status) && <div className="staff-action-grid">
          <form className="action-card assignment-action" onSubmit={assign}>
            <div className="action-card-heading"><span className="action-card-icon"><UserRound size={15} /></span><span><b>{t(language, 'assign')}</b><small>{kn ? 'ಸ್ಪಷ್ಟ ಜವಾಬ್ದಾರಿ ನಿಗದಿಪಡಿಸಿ' : 'Give this request a clear owner'}</small></span></div>
            <Field label={t(language, 'officer')}><select className="form-input" value={assignedOfficerId} onChange={(event) => setAssignedOfficerId(event.target.value)}><option value="">{t(language, 'selectOfficer')}</option>{officers.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field>
            <input className="form-input" value={assignmentRemark} onChange={(event) => setAssignmentRemark(event.target.value)} placeholder={kn ? 'ನಾಗರಿಕರಿಗೆ ಕಾಣುವ ನಿಯೋಜನೆ ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)' : 'Assignment note (visible to citizen, optional)'} maxLength={1000} />
            <Button type="submit" variant="soft" disabled={busy === 'update'}>{busy === 'update' ? '…' : t(language, 'assign')}<ArrowDownRight size={14} /></Button>
          </form>
          <form className="action-card status-action" onSubmit={updateStatus}>
            <div className="action-card-heading"><span className="action-card-icon status-action-icon"><RotateCw size={15} /></span><span><b>{t(language, 'updateStatus')}</b><small>{kn ? 'ನಾಗರಿಕರಿಗೆ ಸಂಕ್ಷಿಪ್ತ ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ' : 'Add a short citizen-facing update'}</small></span></div>
            <Field label={t(language, 'status')}><select className="form-input" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}><option value="">{kn ? 'ಮುಂದಿನ ಸ್ಥಿತಿ ಆಯ್ಕೆಮಾಡಿ' : 'Choose next status'}</option>{validNext.map((item) => <option key={item} value={item}>{displayStatus(item, language)}</option>)}</select></Field>
            <input className="form-input" value={statusRemark} onChange={(event) => setStatusRemark(event.target.value)} placeholder={t(language, 'addRemarkPlaceholder')} maxLength={1000} />
            <Button type="submit" variant="primary" disabled={busy === 'update'}>{busy === 'update' ? '…' : t(language, 'saveRemark')}<Send size={14} /></Button>
          </form>
        </div>}

        {complaint.status === 'Resolved' && user.role === 'citizen' && <section className="feedback-card">
          <div className="feedback-card-head"><div className="feedback-icon"><CheckCheck size={17} /></div><div><b>{feedbackSent ? t(language, 'resolutionFeedback') : t(language, 'ratingPrompt')}</b><small>{feedbackSent ? t(language, 'feedbackThanks') : t(language, 'feedback')}</small></div></div>
          {feedbackSent ? <div className="submitted-rating"><span className="star-row">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={17} fill={index < (complaint.feedback?.rating || rating) ? '#e2a641' : 'transparent'} color={index < (complaint.feedback?.rating || rating) ? '#e2a641' : '#c7cec8'} />)}</span><p>{complaint.feedback?.comment || feedbackComment}</p></div> : <form onSubmit={submitFeedback}>
            <div className="rating-stars" onMouseLeave={() => setHoverRating(0)}>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onMouseEnter={() => setHoverRating(value)} onClick={() => setRating(value)} aria-label={`${value} stars`}><Star size={25} fill={(hoverRating || rating) >= value ? '#e2a641' : 'transparent'} color={(hoverRating || rating) >= value ? '#e2a641' : '#c7cec8'} /></button>)}</div>
            <textarea className="form-input feedback-input" rows={2} value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} placeholder={kn ? 'ಐಚ್ಛಿಕವಾಗಿ ನಿಮ್ಮ ಅನುಭವ ಹಂಚಿಕೊಳ್ಳಿ…' : 'Share a little about your experience (optional)…'} maxLength={1000} />
            <Button type="submit" variant="soft" icon={Send} disabled={busy === 'feedback'}>{busy === 'feedback' ? t(language, 'loadingMore') : t(language, 'submitFeedback')}</Button>
          </form>}
        </section>}

        {complaint.status !== 'Resolved' && user.role === 'citizen' && <div className="citizen-awaiting"><Clock3 size={16} /><span><b>{t(language, 'waitingForResolution')}</b><small>{t(language, 'escalationNote')}</small></span></div>}
      </main>

      <aside className="detail-aside">
        <div className="timeline-head"><span className="timeline-icon"><RotateCw size={15} /></span><div><h3>{t(language, 'statusHistory')}</h3><small>{complaint.events?.length || 0} {t(language, 'activity')}</small></div></div>
        <div className="timeline-list">{(complaint.events || []).map((event, index) => <div key={event.id || `${event.event_type}-${index}`} className={`timeline-item ${index === (complaint.events.length - 1) ? 'timeline-current' : ''}`}>
          <span className={`timeline-node ${event.event_type === 'Escalated' ? 'node-alert' : ''}`}>{event.event_type === 'Escalated' ? <ShieldAlert size={12} /> : event.new_status === 'Resolved' ? <Check size={12} /> : <span />}</span><div className="timeline-content"><b>{event.event_type === 'Status changed' ? displayStatus(event.new_status, language) : eventLabel(event)}</b><time>{formatFullDate(event.created_at, language)}</time>{event.remarks && <p>{event.remarks}</p>}{event.actor_name && <small>{t(language, 'by')} {event.actor_name}</small>}</div>
        </div>)}{!complaint.events?.length && <div className="timeline-empty">{t(language, 'noActivity')}</div>}</div>
        <div className="timeline-next-step"><span className="next-step-icon"><Clock3 size={14} /></span><p><b>{t(language, 'responsePending')}</b><small>{t(language, 'resolutionDeadline')}: {formatFullDate(complaint.resolution_deadline, language)}</small></p></div>
        {complaint.escalated_at && <div className="escalated-note"><ShieldAlert size={14} /><span>{t(language, 'escalationNote')}</span></div>}
      </aside>
    </div>
  </Modal>;
}
