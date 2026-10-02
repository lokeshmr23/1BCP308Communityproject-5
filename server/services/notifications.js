const nodemailer = require('nodemailer');
const db = require('../db');
const { id, nowIso } = require('../utils');

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transport;
}

async function notifyUser(userId, complaintId, copy) {
  if (!userId) return;
  const user = await db.get('SELECT id, full_name, email FROM users WHERE id = ? AND is_active = 1', [userId]);
  if (!user) return;
  await db.run(
    `INSERT INTO notifications (id, user_id, complaint_id, title_en, message_en, title_kn, message_kn, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id(), user.id, complaintId || null, copy.title_en, copy.message_en, copy.title_kn || copy.title_en, copy.message_kn || copy.message_en, nowIso()]
  );

  const mailer = getTransport();
  if (!mailer || !user.email) return;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: copy.title_en,
      text: `${copy.message_en}\n\nIf you did not expect this email, you can ignore it.`,
      html: `<p>${escapeHtml(copy.message_en)}</p><p style="color:#63736c;font-size:12px">GramSetu · Panchayat grievance portal</p>`
    });
  } catch (error) {
    console.warn('Email delivery skipped:', error.message);
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function notifyAdmins(complaintId, copy) {
  const admins = await db.all("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
  for (const admin of admins) await notifyUser(admin.id, complaintId, copy);
}

module.exports = { notifyUser, notifyAdmins };
