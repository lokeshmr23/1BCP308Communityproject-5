const db = require('../db');
const { id, nowIso, ACTIVE_STATUSES } = require('../utils');
const { notifyUser, notifyAdmins } = require('./notifications');

let lastSweepAt = 0;
let running = false;

async function runEscalationSweep() {
  if (running) return 0;
  running = true;
  let escalated = 0;
  try {
    const active = await db.all(
      'SELECT * FROM complaints WHERE is_deleted = 0 AND status IN (?, ?, ?) AND resolution_deadline IS NOT NULL AND escalated_at IS NULL',
      ACTIVE_STATUSES
    );
    const now = Date.now();
    for (const complaint of active) {
      if (!Number.isFinite(Date.parse(complaint.resolution_deadline)) || Date.parse(complaint.resolution_deadline) >= now) continue;
      const when = nowIso();
      await db.run('UPDATE complaints SET escalated_at = ?, priority = ?, updated_at = ? WHERE id = ? AND escalated_at IS NULL', [when, 'High', when, complaint.id]);
      await db.run(
        'INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
        [id(), complaint.id, 'Escalated', complaint.status, complaint.status, 'Resolution deadline breached. Automatically escalated to the Panchayat Admin for review.', when]
      );
      const copy = {
        title_en: 'Complaint deadline breached',
        message_en: `${complaint.reference_id} has passed its resolution deadline and was automatically escalated for review.`,
        title_kn: 'ದೂರು ಗಡುವು ಮೀರಿದೆ',
        message_kn: `${complaint.reference_id} ದೂರು ಪರಿಹಾರದ ಗಡುವು ಮೀರಿದೆ. ಪರಿಶೀಲನೆಗಾಗಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮೇಲ್ದರ್ಜೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.`
      };
      if (complaint.assigned_officer_id) await notifyUser(complaint.assigned_officer_id, complaint.id, copy);
      await notifyAdmins(complaint.id, copy);
      escalated += 1;
    }
  } finally {
    lastSweepAt = Date.now();
    running = false;
  }
  return escalated;
}

async function maybeSweepEscalations() {
  if (Date.now() - lastSweepAt > 60_000 && !running) await runEscalationSweep();
}

function startEscalationJob() {
  const timer = setInterval(() => runEscalationSweep().catch((error) => console.error('Escalation sweep failed:', error)), 5 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { runEscalationSweep, maybeSweepEscalations, startEscalationJob };
