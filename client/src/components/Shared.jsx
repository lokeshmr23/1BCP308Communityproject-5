import React from 'react';
import { X, LoaderCircle, AlertCircle } from 'lucide-react';
import { displayStatus } from '../i18n';

export function Button({ children, onClick, variant = 'primary', size = '', icon: Icon, disabled = false, type = 'button', className = '', ...props }) {
  return <button type={type} className={`button button-${variant} ${size ? `button-${size}` : ''} ${className}`} disabled={disabled} onClick={onClick} {...props}>
    {Icon && <Icon size={16} strokeWidth={2} />}{children}
  </button>;
}

export function IconButton({ icon: Icon, label, onClick, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} {...props}><Icon size={18} strokeWidth={1.9} /></button>;
}

export function StatusBadge({ status, language = 'en', escalated = false }) {
  const state = status === 'Resolved' ? 'resolved' : status === 'Rejected' ? 'rejected' : status === 'In Progress' ? 'in-progress' : status === 'Assigned' ? 'assigned' : 'submitted';
  return <span className={`status-pill status-${state}`}><span className="status-dot" />{displayStatus(status, language)}{escalated && <span className="mini-alert">!</span>}</span>;
}

export function PriorityBadge({ priority, language = 'en' }) {
  if (priority !== 'High') return null;
  return <span className="priority-pill">{language === 'kn' ? 'ಗಡುವು ಮೀರಿದೆ' : 'Escalated'}</span>;
}

export function Modal({ open, onClose, title, subtitle, children, size = 'medium', hideClose = false }) {
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {!hideClose && <IconButton icon={X} label="Close" onClick={onClose} />}
      </header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

export function Field({ label, hint, error, required, children, className = '' }) {
  return <label className={`field ${className}`}>
    <span className="field-label">{label}{required && <b className="required-star"> *</b>}</span>
    {children}
    {hint && !error && <small className="field-hint">{hint}</small>}
    {error && <small className="field-error"><AlertCircle size={12} />{error}</small>}
  </label>;
}

export function Spinner({ label = 'Loading…', small = false }) {
  return <div className={`spinner-wrap ${small ? 'spinner-small' : ''}`}><LoaderCircle className="spin" size={small ? 18 : 24} /><span>{label}</span></div>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state"><div className="empty-icon">{Icon && <Icon size={22} />}</div><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}

export function StatCard({ icon: Icon, label, value, note, tone = 'green', suffix }) {
  return <article className={`stat-card tone-${tone}`}>
    <div className="stat-top"><span className="stat-icon">{Icon && <Icon size={18} />}</span><span className="stat-label">{label}</span></div>
    <div className="stat-value">{value ?? '—'}{suffix && <small>{suffix}</small>}</div>
    {note && <div className="stat-note">{note}</div>}
  </article>;
}

export function Avatar({ name = '', size = 'normal', tone = 'green' }) {
  const initials = String(name || 'GP').trim().split(/\s+/).slice(0, 2).map((piece) => piece[0] || '').join('').toUpperCase();
  return <span className={`avatar avatar-${size} avatar-${tone}`}>{initials || 'GP'}</span>;
}

export function Skeleton({ className = '' }) { return <span className={`skeleton ${className}`} />; }
