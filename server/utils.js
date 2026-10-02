const { randomUUID, randomInt } = require('node:crypto');

const STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const ACTIVE_STATUSES = ['Submitted', 'Assigned', 'In Progress'];
const STATUS_TRANSITIONS = {
  Submitted: ['Assigned', 'In Progress', 'Rejected'],
  Assigned: ['In Progress', 'Rejected'],
  'In Progress': ['Resolved', 'Rejected'],
  Resolved: [],
  Rejected: []
};

function id() {
  return randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function makeReferenceId() {
  const year = String(new Date().getFullYear()).slice(-2);
  return `GS-${year}-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
}

function addDays(iso, days) {
  const value = new Date(iso);
  value.setUTCDate(value.getUTCDate() + Number(days || 0));
  return value.toISOString();
}

function publicSafeSummary(value, maxLength = 180) {
  return String(value || '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[contact details removed]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[contact details removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function canTransition(from, to) {
  return Boolean(STATUS_TRANSITIONS[from]?.includes(to));
}

function normalizeStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  const map = {
    submitted: 'Submitted',
    new: 'Submitted',
    pending: 'Submitted',
    assigned: 'Assigned',
    'in progress': 'In Progress',
    'in-progress': 'In Progress',
    'under process': 'In Progress',
    resolved: 'Resolved',
    closed: 'Resolved',
    disposed: 'Resolved',
    rejected: 'Rejected'
  };
  return map[text] || 'Submitted';
}

module.exports = { id, nowIso, makeReferenceId, addDays, publicSafeSummary, canTransition, normalizeStatus, STATUSES, ACTIVE_STATUSES };
