require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { parse } = require('csv-parse/sync');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { notifyUser, notifyAdmins } = require('./services/notifications');
const { maybeSweepEscalations, runEscalationSweep } = require('./services/escalations');
const { id, nowIso, addDays, makeReferenceId, publicSafeSummary, canTransition, normalizeStatus, STATUSES, ACTIVE_STATUSES } = require('./utils');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'local-only-gramsetu-secret-change-before-deploy-2026';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set a strong JWT_SECRET (at least 32 characters) in production.');
}
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = ['image/jpeg', 'image/png', 'image/webp'];
    if (!accepted.includes(file.mimetype)) return callback(new Error('Photo must be a JPG, PNG or WebP image.'));
    callback(null, true);
  }
});
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024, files: 1 } });

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== 'production' || CLIENT_ORIGINS.length === 0 || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not permitted by CORS configuration.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1d' }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.use('/api', asyncRoute(async (_req, _res, next) => {
  try { await maybeSweepEscalations(); } catch (error) { console.error('Escalation sweep failed:', error.message); }
  next();
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(8).max(80),
  wardId: z.string().optional().nullable()
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(80) });
const complaintSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(3000),
  publicSummary: z.string().trim().min(3).max(300),
  categoryId: z.string().min(1),
  wardId: z.string().min(1),
  locationText: z.string().trim().max(240).optional().or(z.literal('')),
  latitude: z.string().trim().max(30).optional().or(z.literal('')),
  longitude: z.string().trim().max(30).optional().or(z.literal('')),
  isPublic: z.union([z.boolean(), z.string(), z.number()]).optional()
});
const categorySchema = z.object({
  name_en: z.string().trim().min(2).max(70),
  name_kn: z.string().trim().min(2).max(100),
  sla_days: z.coerce.number().int().min(1).max(90),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#31765A')
});
const wardSchema = z.object({ name_en: z.string().trim().min(2).max(80), name_kn: z.string().trim().min(2).max(100) });
const userSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().nullable(),
  password: z.string().min(8).max(80),
  role: z.enum(['citizen', 'official', 'admin']),
  ward_id: z.string().optional().nullable()
});

function validationError(res, error) {
  return res.status(400).json({ error: 'Please check the highlighted fields.', details: error.issues?.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) || [] });
}

const requireAuth = asyncRoute(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch (_error) { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
  const user = await db.get('SELECT id, full_name, email, phone, role, ward_id, is_active FROM users WHERE id = ?', [payload.sub]);
  if (!user || !user.is_active) return res.status(401).json({ error: 'This account is inactive or no longer exists.' });
  req.user = user;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do that.' });
    next();
  };
}

function signInPayload(user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  return {
    token,
    user: { id: user.id, fullName: user.full_name, email: user.email, phone: user.phone, role: user.role, wardId: user.ward_id }
  };
}

async function uploadPhoto(file) {
  if (!file) return null;
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.mimetype];
  const key = `${new Date().toISOString().slice(0, 10)}/${id()}.${ext}`;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'complaint-photos';
  if (supabaseUrl && serviceKey) {
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': file.mimetype, 'x-upsert': 'false' },
      body: file.buffer
    });
    if (!response.ok) throw new Error(`Photo storage returned ${response.status}. Check the Supabase bucket configuration.`);
    return `supabase://${bucket}/${key}`;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Photo storage is not configured. Set Supabase Storage keys or submit without a photo.');
  const folder = path.join(__dirname, 'uploads', path.dirname(key));
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'uploads', key), file.buffer);
  return `/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function resolvePhotoUrl(storedPath) {
  if (!storedPath || !String(storedPath).startsWith('supabase://')) return storedPath;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const objectPath = String(storedPath).slice('supabase://'.length);
  const separator = objectPath.indexOf('/');
  const bucket = objectPath.slice(0, separator);
  const key = objectPath.slice(separator + 1);
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    if (!response.ok) { console.warn('Could not sign complaint photo URL:', response.status); return null; }
    const payload = await response.json();
    const signed = payload.signedURL || payload.signedUrl;
    if (!signed) return null;
    return signed.startsWith('http') ? signed : `${supabaseUrl.replace(/\/$/, '')}/storage/v1${signed}`;
  } catch (error) {
    console.warn('Could not sign complaint photo URL:', error.message);
    return null;
  }
}

const complaintSelect = `
  SELECT c.*, cat.name_en AS category_name_en, cat.name_kn AS category_name_kn, cat.color AS category_color,
         w.name_en AS ward_name_en, w.name_kn AS ward_name_kn,
         officer.full_name AS officer_name, citizen.full_name AS citizen_name,
         citizen.email AS citizen_email, citizen.phone AS citizen_phone
  FROM complaints c
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN wards w ON w.id = c.ward_id
  LEFT JOIN users officer ON officer.id = c.assigned_officer_id
  LEFT JOIN users citizen ON citizen.id = c.citizen_id`;

function scopeSql(user, alias = 'c') {
  if (user.role === 'citizen') return { clause: `${alias}.citizen_id = ?`, params: [user.id] };
  if (user.role === 'official') return { clause: `(${alias}.assigned_officer_id = ? OR ${alias}.assigned_officer_id IS NULL)`, params: [user.id] };
  return { clause: '1 = 1', params: [] };
}

async function findComplaint(identifier) {
  return db.get(`${complaintSelect} WHERE (c.id = ? OR c.reference_id = ?) AND c.is_deleted = 0`, [identifier, identifier]);
}

function canStaffSee(user, complaint) {
  return user.role === 'admin' || (user.role === 'official' && (!complaint.assigned_officer_id || complaint.assigned_officer_id === user.id));
}

async function ensureComplaintAccess(req, res, complaint) {
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return false;
  }
  if (req.user.role === 'citizen' && complaint.citizen_id !== req.user.id) {
    res.status(404).json({ error: 'Complaint not found.' });
    return false;
  }
  if (req.user.role === 'official' && !canStaffSee(req.user, complaint)) {
    res.status(404).json({ error: 'Complaint not found.' });
    return false;
  }
  return true;
}

async function getComplaintDetail(complaint) {
  const events = await db.all(
    `SELECT e.id, e.event_type, e.old_status, e.new_status, e.remarks, e.created_at, u.full_name AS actor_name
     FROM complaint_events e LEFT JOIN users u ON u.id = e.actor_id
     WHERE e.complaint_id = ? ORDER BY e.created_at ASC`, [complaint.id]
  );
  const feedback = await db.get('SELECT rating, comment, created_at FROM feedback WHERE complaint_id = ?', [complaint.id]);
  return { ...complaint, photo_url: await resolvePhotoUrl(complaint.photo_url), events, feedback };
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await db.get('SELECT 1 AS ok');
  res.json({ status: 'ok', database: db.isPostgres ? 'postgres' : 'sqlite', timestamp: nowIso() });
}));

app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const input = parsed.data;
  const email = input.email.toLowerCase();
  const duplicate = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (duplicate) return res.status(409).json({ error: 'An account with this email already exists.' });
  if (input.wardId) {
    const ward = await db.get('SELECT id FROM wards WHERE id = ?', [input.wardId]);
    if (!ward) return res.status(400).json({ error: 'Select a valid ward.' });
  }
  const user = {
    id: id(), full_name: input.fullName, email, phone: input.phone || null,
    password_hash: await bcrypt.hash(input.password, 10), role: 'citizen', ward_id: input.wardId || null,
    is_active: 1, created_at: nowIso()
  };
  await db.run('INSERT INTO users (id, full_name, email, phone, password_hash, role, ward_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user.id, user.full_name, user.email, user.phone, user.password_hash, user.role, user.ward_id, user.is_active, user.created_at]);
  res.status(201).json(signInPayload(user));
}));

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const user = await db.get('SELECT * FROM users WHERE email = ?', [parsed.data.email.toLowerCase()]);
  if (!user || !user.is_active || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json(signInPayload(user));
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  res.json({ user: { id: req.user.id, fullName: req.user.full_name, email: req.user.email, phone: req.user.phone, role: req.user.role, wardId: req.user.ward_id } });
}));

app.get('/api/categories', asyncRoute(async (_req, res) => {
  res.json(await db.all('SELECT * FROM categories ORDER BY name_en'));
}));
app.post('/api/categories', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const item = { ...parsed.data, id: id(), created_at: nowIso() };
  await db.run('INSERT INTO categories (id, name_en, name_kn, sla_days, color, created_at) VALUES (?, ?, ?, ?, ?, ?)', [item.id, item.name_en, item.name_kn, item.sla_days, item.color, item.created_at]);
  res.status(201).json(item);
}));
app.put('/api/categories/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const result = await db.run('UPDATE categories SET name_en = ?, name_kn = ?, sla_days = ?, color = ? WHERE id = ?', [parsed.data.name_en, parsed.data.name_kn, parsed.data.sla_days, parsed.data.color, req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Category not found.' });
  res.json({ id: req.params.id, ...parsed.data });
}));
app.delete('/api/categories/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const used = await db.get('SELECT COUNT(*) AS count FROM complaints WHERE category_id = ?', [req.params.id]);
  if (Number(used?.count || 0) > 0) return res.status(409).json({ error: 'This category is used by complaints. Rename it instead of deleting it.' });
  const result = await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Category not found.' });
  res.status(204).end();
}));

app.get('/api/wards', asyncRoute(async (_req, res) => {
  res.json(await db.all('SELECT * FROM wards ORDER BY name_en'));
}));
app.post('/api/wards', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const parsed = wardSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const item = { ...parsed.data, id: id(), created_at: nowIso() };
  await db.run('INSERT INTO wards (id, name_en, name_kn, created_at) VALUES (?, ?, ?, ?)', [item.id, item.name_en, item.name_kn, item.created_at]);
  res.status(201).json(item);
}));
app.put('/api/wards/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const parsed = wardSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const result = await db.run('UPDATE wards SET name_en = ?, name_kn = ? WHERE id = ?', [parsed.data.name_en, parsed.data.name_kn, req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Ward not found.' });
  res.json({ id: req.params.id, ...parsed.data });
}));
app.delete('/api/wards/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const used = await db.get('SELECT COUNT(*) AS count FROM complaints WHERE ward_id = ?', [req.params.id]);
  if (Number(used?.count || 0) > 0) return res.status(409).json({ error: 'This ward is referenced by complaints. Keep it for record integrity.' });
  const result = await db.run('DELETE FROM wards WHERE id = ?', [req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'Ward not found.' });
  res.status(204).end();
}));

app.get('/api/officers', requireAuth, requireRole('admin', 'official'), asyncRoute(async (_req, res) => {
  const officers = await db.all("SELECT id, full_name, email, phone, ward_id, is_active, created_at FROM users WHERE role = 'official' ORDER BY full_name");
  res.json(officers);
}));

app.get('/api/users', requireAuth, requireRole('admin'), asyncRoute(async (_req, res) => {
  const users = await db.all('SELECT id, full_name, email, phone, role, ward_id, is_active, created_at FROM users ORDER BY created_at DESC');
  res.json(users);
}));
app.post('/api/users', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const input = parsed.data;
  const email = input.email.toLowerCase();
  if (await db.get('SELECT id FROM users WHERE email = ?', [email])) return res.status(409).json({ error: 'That email is already registered.' });
  const user = {
    id: id(), full_name: input.full_name, email, phone: input.phone || null,
    password_hash: await bcrypt.hash(input.password, 10), role: input.role, ward_id: input.ward_id || null,
    is_active: 1, created_at: nowIso()
  };
  await db.run('INSERT INTO users (id, full_name, email, phone, password_hash, role, ward_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user.id, user.full_name, user.email, user.phone, user.password_hash, user.role, user.ward_id, user.is_active, user.created_at]);
  res.status(201).json({ id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role, ward_id: user.ward_id, is_active: 1, created_at: user.created_at });
}));
app.put('/api/users/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const schema = userSchema.omit({ password: true }).extend({ password: z.string().min(8).max(80).optional(), is_active: z.coerce.number().int().min(0).max(1).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const input = parsed.data;
  const existing = await db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'User not found.' });
  const duplicate = await db.get('SELECT id FROM users WHERE email = ? AND id <> ?', [input.email.toLowerCase(), req.params.id]);
  if (duplicate) return res.status(409).json({ error: 'That email is already used by another account.' });
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
  await db.run(
    `UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, ward_id = ?, is_active = ?, password_hash = COALESCE(?, password_hash) WHERE id = ?`,
    [input.full_name, input.email.toLowerCase(), input.phone || null, input.role, input.ward_id || null, input.is_active ?? 1, passwordHash, req.params.id]
  );
  const user = await db.get('SELECT id, full_name, email, phone, role, ward_id, is_active, created_at FROM users WHERE id = ?', [req.params.id]);
  res.json(user);
}));
app.delete('/api/users/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(409).json({ error: 'You cannot disable your own administrator account.' });
  const result = await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
  if (!result.changes) return res.status(404).json({ error: 'User not found.' });
  res.status(204).end();
}));

app.get('/api/complaints', requireAuth, asyncRoute(async (req, res) => {
  const scope = scopeSql(req.user);
  const clauses = ['c.is_deleted = 0', scope.clause];
  const params = [...scope.params];
  if (req.query.status && STATUSES.includes(req.query.status)) { clauses.push('c.status = ?'); params.push(req.query.status); }
  if (req.query.categoryId) { clauses.push('c.category_id = ?'); params.push(req.query.categoryId); }
  if (req.query.wardId) { clauses.push('c.ward_id = ?'); params.push(req.query.wardId); }
  if (req.query.q) {
    const needle = `%${String(req.query.q).trim().toLowerCase().slice(0, 100)}%`;
    clauses.push('(LOWER(c.reference_id) LIKE ? OR LOWER(c.title) LIKE ? OR LOWER(c.public_summary) LIKE ? OR LOWER(cat.name_en) LIKE ? OR LOWER(w.name_en) LIKE ?)');
    params.push(needle, needle, needle, needle, needle);
  }
  const limit = Math.max(1, Math.min(500, Number.parseInt(req.query.limit || '250', 10) || 250));
  params.push(limit);
  const rows = await db.all(`${complaintSelect} WHERE ${clauses.join(' AND ')} ORDER BY c.created_at DESC LIMIT ?`, params);
  res.json(rows.map((row) => ({ ...row, photo_url: String(row.photo_url || '').startsWith('supabase://') ? null : row.photo_url })));
}));

app.post('/api/complaints', requireAuth, requireRole('citizen'), upload.single('photo'), asyncRoute(async (req, res) => {
  const parsed = complaintSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const input = parsed.data;
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [input.categoryId]);
  const ward = await db.get('SELECT * FROM wards WHERE id = ?', [input.wardId]);
  if (!category || !ward) return res.status(400).json({ error: 'Select a valid complaint category and ward.' });
  if ((input.latitude && !Number.isFinite(Number(input.latitude))) || (input.longitude && !Number.isFinite(Number(input.longitude)))) {
    return res.status(400).json({ error: 'Location coordinates must be valid numbers.' });
  }
  let photoUrl = null;
  try { photoUrl = await uploadPhoto(req.file); } catch (error) { return res.status(503).json({ error: error.message }); }
  const createdAt = nowIso();
  const referenceId = makeReferenceId();
  const complaintId = id();
  const isPublic = input.isPublic === undefined ? 1 : (String(input.isPublic) === 'false' || String(input.isPublic) === '0' ? 0 : 1);
  const summary = publicSafeSummary(input.publicSummary, 300);
  await db.run(
    `INSERT INTO complaints (
      id, reference_id, citizen_id, category_id, ward_id, assigned_officer_id, title, description, public_summary,
      location_text, latitude, longitude, photo_url, status, priority, resolution_deadline, assigned_at, resolved_at,
      escalated_at, is_public, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
    [complaintId, referenceId, req.user.id, category.id, ward.id, input.title, input.description, summary,
      input.locationText || null, input.latitude || null, input.longitude || null, photoUrl, 'Submitted', 'Normal',
      addDays(createdAt, category.sla_days), isPublic, 'portal', createdAt, createdAt]
  );
  await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)',
    [id(), complaintId, req.user.id, 'Submitted', 'Submitted', 'Complaint registered by citizen.', createdAt]);
  await notifyUser(req.user.id, complaintId, {
    title_en: `Complaint ${referenceId} submitted`, message_en: `Your complaint has been received. You can track its progress using ${referenceId}.`,
    title_kn: 'ದೂರು ಸಲ್ಲಿಸಲಾಗಿದೆ', message_kn: `${referenceId} ನಿಮ್ಮ ದೂರನ್ನು ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ಈ ಸಂಖ್ಯೆಯಿಂದ ಪ್ರಗತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ.`
  });
  const created = await findComplaint(complaintId);
  res.status(201).json(await getComplaintDetail(created));
}));

app.put('/api/complaints/:identifier', requireAuth, requireRole('citizen'), upload.single('photo'), asyncRoute(async (req, res) => {
  const parsed = complaintSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const complaint = await findComplaint(req.params.identifier);
  if (!(await ensureComplaintAccess(req, res, complaint))) return;
  if (complaint.status !== 'Submitted' || complaint.assigned_officer_id) return res.status(409).json({ error: 'A complaint can only be edited before an official is assigned.' });
  const input = parsed.data;
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [input.categoryId]);
  const ward = await db.get('SELECT * FROM wards WHERE id = ?', [input.wardId]);
  if (!category || !ward) return res.status(400).json({ error: 'Select a valid complaint category and ward.' });
  if ((input.latitude && !Number.isFinite(Number(input.latitude))) || (input.longitude && !Number.isFinite(Number(input.longitude)))) return res.status(400).json({ error: 'Location coordinates must be valid numbers.' });
  let photoUrl = complaint.photo_url;
  if (String(req.body.removePhoto) === 'true') photoUrl = null;
  if (req.file) {
    try { photoUrl = await uploadPhoto(req.file); } catch (error) { return res.status(503).json({ error: error.message }); }
  }
  const updatedAt = nowIso();
  const summary = publicSafeSummary(input.publicSummary, 300);
  const isPublic = input.isPublic === undefined ? complaint.is_public : (String(input.isPublic) === 'false' || String(input.isPublic) === '0' ? 0 : 1);
  await db.run(
    `UPDATE complaints SET category_id = ?, ward_id = ?, title = ?, description = ?, public_summary = ?, location_text = ?,
     latitude = ?, longitude = ?, photo_url = ?, resolution_deadline = ?, is_public = ?, updated_at = ? WHERE id = ? AND is_deleted = 0`,
    [category.id, ward.id, input.title, input.description, summary, input.locationText || null, input.latitude || null, input.longitude || null,
      photoUrl, addDays(complaint.created_at, category.sla_days), isPublic, updatedAt, complaint.id]
  );
  await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id(), complaint.id, req.user.id, 'Edited', complaint.status, complaint.status, 'Citizen updated the complaint before assignment.', updatedAt]);
  res.json(await getComplaintDetail(await findComplaint(complaint.id)));
}));

app.delete('/api/complaints/:identifier', requireAuth, requireRole('citizen', 'admin'), asyncRoute(async (req, res) => {
  const complaint = await findComplaint(req.params.identifier);
  if (!(await ensureComplaintAccess(req, res, complaint))) return;
  if (req.user.role === 'citizen' && (complaint.status !== 'Submitted' || complaint.assigned_officer_id)) {
    return res.status(409).json({ error: 'A complaint can only be withdrawn before an official is assigned.' });
  }
  const at = nowIso();
  const eventType = req.user.role === 'citizen' ? 'Withdrawn' : 'Archived';
  await db.run('UPDATE complaints SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_deleted = 0', [at, complaint.id]);
  await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id(), complaint.id, req.user.id, eventType, complaint.status, complaint.status, req.user.role === 'citizen' ? 'Citizen withdrew the unassigned complaint.' : 'Admin archived the complaint from active views.', at]);
  if (req.user.role === 'admin' && complaint.citizen_id) {
    await notifyUser(complaint.citizen_id, complaint.id, {
      title_en: `Complaint ${complaint.reference_id} archived`, message_en: 'A Panchayat admin archived this complaint from active views. Contact the Panchayat if you think this is an error.',
      title_kn: 'ದೂರು ಆರ್ಕೈವ್ ಮಾಡಲಾಗಿದೆ', message_kn: 'ಪಂಚಾಯತ್ ನಿರ್ವಾಹಕರು ಈ ದೂರನ್ನು ಸಕ್ರಿಯ ಪಟ್ಟಿಯಿಂದ ಆರ್ಕೈವ್ ಮಾಡಿದ್ದಾರೆ. ಇದು ತಪ್ಪೆಂದು ಅನಿಸಿದರೆ ಪಂಚಾಯತ್ ಸಂಪರ್ಕಿಸಿ.'
    });
  }
  res.status(204).end();
}));

app.get('/api/complaints/:identifier', requireAuth, asyncRoute(async (req, res) => {
  const complaint = await findComplaint(req.params.identifier);
  if (!(await ensureComplaintAccess(req, res, complaint))) return;
  res.json(await getComplaintDetail(complaint));
}));

app.patch('/api/complaints/:identifier/assign', requireAuth, requireRole('admin', 'official'), asyncRoute(async (req, res) => {
  const schema = z.object({ assignedOfficerId: z.string().min(1), remarks: z.string().trim().max(1000).optional().or(z.literal('')) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const complaint = await findComplaint(req.params.identifier);
  if (!(await ensureComplaintAccess(req, res, complaint))) return;
  if (['Resolved', 'Rejected'].includes(complaint.status)) return res.status(409).json({ error: 'Closed complaints cannot be reassigned.' });
  const officer = await db.get("SELECT id, full_name FROM users WHERE id = ? AND role = 'official' AND is_active = 1", [parsed.data.assignedOfficerId]);
  if (!officer) return res.status(400).json({ error: 'Choose an active Panchayat official.' });
  const at = nowIso();
  const nextStatus = complaint.status === 'Submitted' ? 'Assigned' : complaint.status;
  await db.run('UPDATE complaints SET assigned_officer_id = ?, status = ?, assigned_at = ?, updated_at = ? WHERE id = ?', [officer.id, nextStatus, at, at, complaint.id]);
  await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id(), complaint.id, req.user.id, 'Assigned', complaint.status, nextStatus, parsed.data.remarks || `Assigned to ${officer.full_name}.`, at]);
  const copy = {
    title_en: `Complaint ${complaint.reference_id} assigned`, message_en: `Your complaint is now assigned to ${officer.full_name}.`,
    title_kn: 'ದೂರು ಅಧಿಕಾರಿಗೆ ಹಂಚಿಕೆ ಮಾಡಲಾಗಿದೆ', message_kn: `${complaint.reference_id} ದೂರನ್ನು ${officer.full_name} ಅವರಿಗೆ ಹಂಚಿಕೆ ಮಾಡಲಾಗಿದೆ.`
  };
  await notifyUser(complaint.citizen_id, complaint.id, copy);
  await notifyUser(officer.id, complaint.id, {
    title_en: 'New complaint assigned to you', message_en: `${complaint.reference_id} · ${complaint.title} is now in your queue.`,
    title_kn: 'ಹೊಸ ದೂರು ನಿಮಗೆ ಹಂಚಿಕೆ ಮಾಡಲಾಗಿದೆ', message_kn: `${complaint.reference_id} · ${complaint.title} ನಿಮ್ಮ ಕಾರ್ಯಪಟ್ಟಿಗೆ ಬಂದಿದೆ.`
  });
  res.json(await getComplaintDetail(await findComplaint(complaint.id)));
}));

app.patch('/api/complaints/:identifier/status', requireAuth, requireRole('admin', 'official'), asyncRoute(async (req, res) => {
  const schema = z.object({ status: z.enum(STATUSES), remarks: z.string().trim().min(3).max(1000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const complaint = await findComplaint(req.params.identifier);
  if (!(await ensureComplaintAccess(req, res, complaint))) return;
  if (!canTransition(complaint.status, parsed.data.status)) return res.status(409).json({ error: `A complaint cannot move from ${complaint.status} to ${parsed.data.status}.` });
  const at = nowIso();
  const resolvedAt = parsed.data.status === 'Resolved' ? at : complaint.resolved_at;
  await db.run('UPDATE complaints SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?', [parsed.data.status, resolvedAt, at, complaint.id]);
  await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id(), complaint.id, req.user.id, 'Status changed', complaint.status, parsed.data.status, parsed.data.remarks, at]);
  const localizedStatus = parsed.data.status;
  await notifyUser(complaint.citizen_id, complaint.id, {
    title_en: `Complaint ${complaint.reference_id}: ${localizedStatus}`,
    message_en: `The status of your complaint is now ${localizedStatus}. Note: ${parsed.data.remarks}`,
    title_kn: `${complaint.reference_id} ದೂರು: ${localizedStatus}`,
    message_kn: `ನಿಮ್ಮ ದೂರಿನ ಸ್ಥಿತಿ ಈಗ ${localizedStatus}. ಟಿಪ್ಪಣಿ: ${parsed.data.remarks}`
  });
  res.json(await getComplaintDetail(await findComplaint(complaint.id)));
}));

app.post('/api/complaints/:identifier/feedback', requireAuth, requireRole('citizen'), asyncRoute(async (req, res) => {
  const schema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional().or(z.literal('')) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const complaint = await findComplaint(req.params.identifier);
  if (!(await ensureComplaintAccess(req, res, complaint))) return;
  if (complaint.status !== 'Resolved') return res.status(409).json({ error: 'Feedback is available after a complaint is resolved.' });
  if (await db.get('SELECT id FROM feedback WHERE complaint_id = ?', [complaint.id])) return res.status(409).json({ error: 'Feedback has already been submitted for this complaint.' });
  const feedback = { id: id(), complaint_id: complaint.id, citizen_id: req.user.id, rating: parsed.data.rating, comment: parsed.data.comment || null, created_at: nowIso() };
  await db.run('INSERT INTO feedback (id, complaint_id, citizen_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)', [feedback.id, feedback.complaint_id, feedback.citizen_id, feedback.rating, feedback.comment, feedback.created_at]);
  res.status(201).json(feedback);
}));

app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit || '30', 10) || 30));
  const rows = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [req.user.id, limit]);
  const unread = await db.get('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  res.json({ items: rows, unread: Number(unread?.count || 0) });
}));
app.patch('/api/notifications/read-all', requireAuth, asyncRoute(async (req, res) => {
  await db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [nowIso(), req.user.id]);
  res.json({ ok: true });
}));
app.patch('/api/notifications/:id/read', requireAuth, asyncRoute(async (req, res) => {
  const result = await db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', [nowIso(), req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ ok: true });
}));

app.get('/api/analytics', requireAuth, asyncRoute(async (req, res) => {
  const scope = scopeSql(req.user);
  const rows = await db.all(
    `SELECT c.id, c.status, c.created_at, c.resolved_at, c.escalated_at, cat.name_en AS category, w.name_en AS ward
     FROM complaints c LEFT JOIN categories cat ON cat.id = c.category_id LEFT JOIN wards w ON w.id = c.ward_id
     WHERE c.is_deleted = 0 AND ${scope.clause}`,
    scope.params
  );
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const categoryCounts = new Map();
  const wardCounts = new Map();
  const monthly = new Map();
  let totalHours = 0;
  let resolvedWithDates = 0;
  let escalated = 0;
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    categoryCounts.set(row.category || 'Other', (categoryCounts.get(row.category || 'Other') || 0) + 1);
    wardCounts.set(row.ward || 'Unassigned', (wardCounts.get(row.ward || 'Unassigned') || 0) + 1);
    const month = String(row.created_at || '').slice(0, 7);
    if (month) monthly.set(month, (monthly.get(month) || 0) + 1);
    if (row.escalated_at) escalated += 1;
    if (row.resolved_at && row.created_at) {
      const hours = (Date.parse(row.resolved_at) - Date.parse(row.created_at)) / 3_600_000;
      if (Number.isFinite(hours) && hours >= 0) { totalHours += hours; resolvedWithDates += 1; }
    }
  }
  let feedbackSql = `SELECT f.rating FROM feedback f JOIN complaints c ON c.id = f.complaint_id WHERE c.is_deleted = 0 AND ${scope.clause}`;
  const feedbackRows = await db.all(feedbackSql, scope.params);
  const averageRating = feedbackRows.length ? feedbackRows.reduce((sum, row) => sum + Number(row.rating), 0) / feedbackRows.length : null;
  res.json({
    total: rows.length,
    pending: ACTIVE_STATUSES.reduce((sum, key) => sum + (statusCounts[key] || 0), 0),
    resolved: statusCounts.Resolved || 0,
    rejected: statusCounts.Rejected || 0,
    escalated,
    avgResolutionHours: resolvedWithDates ? totalHours / resolvedWithDates : null,
    averageRating,
    feedbackCount: feedbackRows.length,
    statusCounts,
    categoryCounts: [...categoryCounts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    wardCounts: [...wardCounts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    monthlyTrend: [...monthly].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, value]) => ({ month, value }))
  });
}));

app.get('/api/public/transparency', asyncRoute(async (req, res) => {
  const allowedStatus = STATUSES.includes(req.query.status) ? req.query.status : null;
  const records = await db.all(
    `SELECT c.reference_id, c.public_summary, c.status, c.created_at, c.updated_at, c.resolved_at,
            c.escalated_at, cat.name_en AS category_name_en, cat.name_kn AS category_name_kn,
            w.name_en AS ward_name_en, w.name_kn AS ward_name_kn
     FROM complaints c LEFT JOIN categories cat ON cat.id = c.category_id LEFT JOIN wards w ON w.id = c.ward_id
     WHERE c.is_public = 1 AND c.is_deleted = 0 ORDER BY c.created_at DESC LIMIT 500`
  );
  const search = String(req.query.q || '').trim().toLowerCase();
  const filtered = records.filter((item) => {
    const matchesStatus = !allowedStatus || item.status === allowedStatus;
    const matchesGroup = !req.query.group || (req.query.group === 'pending' ? ACTIVE_STATUSES.includes(item.status) : req.query.group === 'resolved' ? item.status === 'Resolved' : true);
    const matchesSearch = !search || [item.reference_id, item.public_summary, item.category_name_en, item.ward_name_en].some((value) => String(value || '').toLowerCase().includes(search));
    return matchesStatus && matchesGroup && matchesSearch;
  });
  const allCounts = records.reduce((counts, item) => { counts[item.status] = (counts[item.status] || 0) + 1; return counts; }, {});
  res.json({
    total: records.length,
    pending: ACTIVE_STATUSES.reduce((sum, status) => sum + (allCounts[status] || 0), 0),
    resolved: allCounts.Resolved || 0,
    rejected: allCounts.Rejected || 0,
    items: filtered.slice(0, 250).map((item) => ({ ...item, public_summary: publicSafeSummary(item.public_summary, 180), is_escalated: Boolean(item.escalated_at) }))
  });
}));

app.get('/api/public/track/:reference', asyncRoute(async (req, res) => {
  const complaint = await db.get(
    `SELECT c.reference_id, c.status, c.public_summary, c.created_at, c.updated_at, c.resolution_deadline,
            c.resolved_at, c.escalated_at, c.is_public, cat.name_en AS category_name_en, cat.name_kn AS category_name_kn,
            w.name_en AS ward_name_en, w.name_kn AS ward_name_kn
     FROM complaints c LEFT JOIN categories cat ON cat.id = c.category_id LEFT JOIN wards w ON w.id = c.ward_id
     WHERE c.reference_id = ? AND c.is_deleted = 0`, [req.params.reference]
  );
  if (!complaint || !complaint.is_public) return res.status(404).json({ error: 'No public complaint found with that tracking ID.' });
  const events = await db.all('SELECT event_type, new_status, created_at FROM complaint_events WHERE complaint_id = (SELECT id FROM complaints WHERE reference_id = ?) ORDER BY created_at ASC', [req.params.reference]);
  res.json({ ...complaint, public_summary: publicSafeSummary(complaint.public_summary, 180), is_escalated: Boolean(complaint.escalated_at), events: events.map(({ event_type, new_status, created_at }) => ({ event_type, new_status, created_at })) });
}));

app.post('/api/admin/import-csv', requireAuth, requireRole('admin'), csvUpload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a CSV file to import.' });
  let records;
  try { records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true }); }
  catch (error) { return res.status(400).json({ error: `Could not read CSV: ${error.message}` }); }
  if (!records.length) return res.status(400).json({ error: 'The CSV has a header but no complaint rows.' });
  if (records.length > 1000) return res.status(400).json({ error: 'Import up to 1,000 rows per file.' });
  const categories = await db.all('SELECT * FROM categories');
  const wards = await db.all('SELECT * FROM wards');
  const officers = await db.all("SELECT id, email FROM users WHERE role = 'official' AND is_active = 1");
  const categoryMap = new Map(categories.flatMap((item) => [[item.id.toLowerCase(), item], [item.name_en.toLowerCase(), item]]));
  const wardMap = new Map(wards.flatMap((item) => [[item.id.toLowerCase(), item], [item.name_en.toLowerCase(), item]]));
  const officerMap = new Map(officers.map((item) => [item.email.toLowerCase(), item]));
  const errors = [];
  let imported = 0;
  for (let index = 0; index < records.length; index += 1) {
    const row = records[index];
    const line = index + 2;
    const category = categoryMap.get(String(row.category_id || row.category || '').toLowerCase());
    const ward = wardMap.get(String(row.ward_id || row.ward || '').toLowerCase());
    const title = String(row.title || row.subject || row.public_summary || row.description || '').trim().slice(0, 120);
    const description = String(row.description || row.public_summary || row.title || '').trim().slice(0, 3000);
    if (!category || !ward || title.length < 5 || description.length < 10) {
      errors.push({ row: line, message: 'Provide a known category, known ward, title (5+ chars), and description (10+ chars).' });
      continue;
    }
    const status = normalizeStatus(row.status);
    const createdAt = row.created_at && Number.isFinite(Date.parse(row.created_at)) ? new Date(row.created_at).toISOString() : nowIso();
    const resolvedAt = row.resolved_at && Number.isFinite(Date.parse(row.resolved_at)) ? new Date(row.resolved_at).toISOString() : null;
    const reference = String(row.reference_id || row.complaint_id || '').trim() || makeReferenceId();
    if (await db.get('SELECT id FROM complaints WHERE reference_id = ?', [reference])) {
      errors.push({ row: line, message: `Tracking ID ${reference} already exists.` });
      continue;
    }
    const officer = officerMap.get(String(row.officer_email || '').toLowerCase());
    const complaintId = id();
    const updatedAt = resolvedAt || createdAt;
    const deadline = row.resolution_deadline && Number.isFinite(Date.parse(row.resolution_deadline)) ? new Date(row.resolution_deadline).toISOString() : addDays(createdAt, category.sla_days);
    await db.run(
      `INSERT INTO complaints (id, reference_id, citizen_id, category_id, ward_id, assigned_officer_id, title, description, public_summary,
        location_text, latitude, longitude, photo_url, status, priority, resolution_deadline, assigned_at, resolved_at, escalated_at,
        is_public, source, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, 1, 'csv-import', ?, ?)`,
      [complaintId, reference, category.id, ward.id, officer?.id || null, title, description,
        publicSafeSummary(row.public_summary || description, 300), String(row.location_text || row.location || '').slice(0, 240) || null,
        status, 'Normal', deadline, officer ? createdAt : null, resolvedAt, createdAt, updatedAt]
    );
    await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)',
      [id(), complaintId, req.user.id, 'Imported', status, 'Imported from an administrative CSV file.', nowIso()]);
    imported += 1;
  }
  res.status(201).json({ imported, skipped: errors.length, errors: errors.slice(0, 50), message: `Imported ${imported} record${imported === 1 ? '' : 's'}; skipped ${errors.length}.` });
}));

const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large. Photos are limited to 5 MB and CSV files to 1 MB.' });
  if (error?.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Unexpected upload field. Use the provided file control.' });
  if (error?.message?.includes('Photo must be')) return res.status(400).json({ error: error.message });
  if (error?.code === '23505' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'A record with those details already exists.' });
  if (error?.code === '23503' || error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(409).json({ error: 'This record is referenced by other data and cannot be removed.' });
  console.error(error);
  res.status(error.status || 500).json({ error: error.status && error.status < 500 ? error.message : 'Something went wrong. Please try again.' });
});

module.exports = { app, runEscalationSweep, JWT_SECRET };
