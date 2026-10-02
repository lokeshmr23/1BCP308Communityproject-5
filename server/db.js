const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const isPostgres = Boolean(process.env.DATABASE_URL);
let sqlite;
let pool;

if (isPostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
} else {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'gramsetu.db');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
}

function toPg(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function all(sql, params = []) {
  if (isPostgres) {
    const result = await pool.query(toPg(sql), params);
    return result.rows;
  }
  return sqlite.prepare(sql).all(...params);
}

async function get(sql, params = []) {
  if (isPostgres) {
    const result = await pool.query(toPg(sql), params);
    return result.rows[0] || null;
  }
  return sqlite.prepare(sql).get(...params) || null;
}

async function run(sql, params = []) {
  if (isPostgres) {
    const result = await pool.query(toPg(sql), params);
    return { changes: result.rowCount || 0, rows: result.rows };
  }
  const result = sqlite.prepare(sql).run(...params);
  return { changes: result.changes, lastID: result.lastInsertRowid };
}

async function initDatabase() {
  if (isPostgres) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('citizen','official','admin')),
        ward_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL UNIQUE,
        name_kn TEXT NOT NULL,
        sla_days INTEGER NOT NULL DEFAULT 7,
        color TEXT NOT NULL DEFAULT '#31765A',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wards (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL UNIQUE,
        name_kn TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        reference_id TEXT NOT NULL UNIQUE,
        citizen_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
        ward_id TEXT REFERENCES wards(id) ON DELETE RESTRICT,
        assigned_officer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        public_summary TEXT NOT NULL,
        location_text TEXT,
        latitude TEXT,
        longitude TEXT,
        photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'Submitted',
        priority TEXT NOT NULL DEFAULT 'Normal',
        resolution_deadline TEXT,
        assigned_at TEXT,
        resolved_at TEXT,
        escalated_at TEXT,
        is_public INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'portal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS complaint_events (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        remarks TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        complaint_id TEXT REFERENCES complaints(id) ON DELETE CASCADE,
        title_en TEXT NOT NULL,
        message_en TEXT NOT NULL,
        title_kn TEXT NOT NULL,
        message_kn TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
        citizen_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
      CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at);
      CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id);
      CREATE INDEX IF NOT EXISTS idx_events_complaint ON complaint_events(complaint_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
    `);
  } else {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('citizen','official','admin')),
        ward_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL UNIQUE,
        name_kn TEXT NOT NULL,
        sla_days INTEGER NOT NULL DEFAULT 7,
        color TEXT NOT NULL DEFAULT '#31765A',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wards (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL UNIQUE,
        name_kn TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        reference_id TEXT NOT NULL UNIQUE,
        citizen_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
        ward_id TEXT REFERENCES wards(id) ON DELETE RESTRICT,
        assigned_officer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        public_summary TEXT NOT NULL,
        location_text TEXT,
        latitude TEXT,
        longitude TEXT,
        photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'Submitted',
        priority TEXT NOT NULL DEFAULT 'Normal',
        resolution_deadline TEXT,
        assigned_at TEXT,
        resolved_at TEXT,
        escalated_at TEXT,
        is_public INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'portal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS complaint_events (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        remarks TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        complaint_id TEXT REFERENCES complaints(id) ON DELETE CASCADE,
        title_en TEXT NOT NULL,
        message_en TEXT NOT NULL,
        title_kn TEXT NOT NULL,
        message_kn TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
        citizen_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
      CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at);
      CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id);
      CREATE INDEX IF NOT EXISTS idx_events_complaint ON complaint_events(complaint_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
    `);
  }
  if (isPostgres) {
    await pool.query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0');
  } else {
    const complaintColumns = sqlite.pragma('table_info(complaints)');
    if (!complaintColumns.some((column) => column.name === 'is_deleted')) sqlite.exec('ALTER TABLE complaints ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
  }
}

async function close() {
  if (pool) await pool.end();
  if (sqlite) sqlite.close();
}

module.exports = { all, get, run, initDatabase, close, isPostgres };
