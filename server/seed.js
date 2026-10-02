require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const db = require('./db');
const { id, nowIso, addDays, publicSafeSummary, normalizeStatus } = require('./utils');

const CATEGORY_SEEDS = [
  { name_en: 'Water Supply', name_kn: 'ನೀರು ಸರಬರಾಜು', sla_days: 5, color: '#3187a5' },
  { name_en: 'Roads', name_kn: 'ರಸ್ತೆಗಳು', sla_days: 10, color: '#bc8c41' },
  { name_en: 'Street Lights', name_kn: 'ಬೀದಿ ದೀಪಗಳು', sla_days: 5, color: '#d29b33' },
  { name_en: 'Sanitation', name_kn: 'ಸ್ವಚ್ಛತೆ ಮತ್ತು ತ್ಯಾಜ್ಯ', sla_days: 3, color: '#468b60' },
  { name_en: 'Welfare Schemes', name_kn: 'ಕಲ್ಯಾಣ ಯೋಜನೆಗಳು', sla_days: 14, color: '#8364a5' },
  { name_en: 'Drainage', name_kn: 'ಚರಂಡಿ ಮತ್ತು ಒಳಚರಂಡಿ', sla_days: 5, color: '#4b8c83' }
];

const WARD_SEEDS = [
  { name_en: 'Ward 01 · Main Street', name_kn: 'ವಾರ್ಡ್ 01 · ಮುಖ್ಯ ರಸ್ತೆ' },
  { name_en: 'Ward 02 · Market Road', name_kn: 'ವಾರ್ಡ್ 02 · ಮಾರುಕಟ್ಟೆ ರಸ್ತೆ' },
  { name_en: 'Ward 03 · School Cross', name_kn: 'ವಾರ್ಡ್ 03 · ಶಾಲಾ ಕ್ರಾಸ್' },
  { name_en: 'Ward 04 · Lake Side', name_kn: 'ವಾರ್ಡ್ 04 · ಕೆರೆ ಬದಿ' },
  { name_en: 'Ward 05 · Hill View', name_kn: 'ವಾರ್ಡ್ 05 · ಬೆಟ್ಟದ ನೋಟ' },
  { name_en: 'Ward 06 · River Bend', name_kn: 'ವಾರ್ಡ್ 06 · ನದಿ ತಿರುವು' }
];

async function insertUser({ full_name, email, phone, role, password, ward_id = null }) {
  const user = {
    id: id(), full_name, email, phone: phone || null,
    password_hash: await bcrypt.hash(password, 10), role, ward_id,
    is_active: 1, created_at: nowIso()
  };
  await db.run(
    'INSERT INTO users (id, full_name, email, phone, password_hash, role, ward_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user.id, user.full_name, user.email, user.phone, user.password_hash, user.role, user.ward_id, user.is_active, user.created_at]
  );
  return user;
}

function plusHours(iso, hours) { return new Date(Date.parse(iso) + hours * 3_600_000).toISOString(); }

async function seedIfEmpty() {
  const existing = await db.get('SELECT COUNT(*) AS count FROM users');
  if (Number(existing?.count || 0) > 0) return { seeded: false, message: 'Database already contains users.' };

  const createdAt = nowIso();
  for (const category of CATEGORY_SEEDS) {
    await db.run(
      'INSERT INTO categories (id, name_en, name_kn, sla_days, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id(), category.name_en, category.name_kn, category.sla_days, category.color, createdAt]
    );
  }
  for (const ward of WARD_SEEDS) {
    await db.run(
      'INSERT INTO wards (id, name_en, name_kn, created_at) VALUES (?, ?, ?, ?)',
      [id(), ward.name_en, ward.name_kn, createdAt]
    );
  }
  const firstWard = await db.get('SELECT id FROM wards ORDER BY name_en LIMIT 1');
  const citizen = await insertUser({ full_name: 'Ananya Poojary', email: 'citizen@gpportal.demo', phone: '9000000001', role: 'citizen', password: 'Citizen@123', ward_id: firstWard.id });
  const officerOne = await insertUser({ full_name: 'Ravi Shetty', email: 'officer1@gpportal.demo', phone: '9000000002', role: 'official', password: 'Officer@123', ward_id: firstWard.id });
  const officerTwo = await insertUser({ full_name: 'Meena Rai', email: 'officer2@gpportal.demo', phone: '9000000003', role: 'official', password: 'Officer@123', ward_id: firstWard.id });
  await insertUser({ full_name: 'Panchayat Administrator', email: 'admin@gpportal.demo', phone: '9000000004', role: 'admin', password: 'Panchayat@123', ward_id: null });

  const categories = await db.all('SELECT * FROM categories');
  const wards = await db.all('SELECT * FROM wards');
  const categoryMap = new Map(categories.map((item) => [item.name_en.toLowerCase(), item]));
  const wardMap = new Map(wards.map((item) => [item.name_en.toLowerCase(), item]));
  const officerMap = new Map([[officerOne.email, officerOne], [officerTwo.email, officerTwo]]);
  const csvPath = path.join(__dirname, 'data', 'secondary-grievance-sample.csv');
  const records = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true, bom: true, trim: true });
  const seedCitizenRefs = new Set(['GS-26-0001', 'GS-26-0003', 'GS-26-0005', 'GS-26-0007', 'GS-26-0011', 'GS-26-0017']);
  const demoRatings = new Map([['GS-26-0001', 5], ['GS-26-0003', 4], ['GS-26-0007', 4], ['GS-26-0011', 5]]);

  for (const record of records) {
    const category = categoryMap.get(record.category.toLowerCase());
    const ward = wardMap.get(record.ward.toLowerCase());
    if (!category || !ward) continue;
    const status = normalizeStatus(record.status);
    const complaintId = id();
    const createdAt = new Date(record.created_at).toISOString();
    const resolvedAt = record.resolved_at ? new Date(record.resolved_at).toISOString() : null;
    const officer = officerMap.get((record.officer_email || '').toLowerCase());
    const deadline = addDays(createdAt, category.sla_days);
    const isPublic = 1;
    await db.run(
      `INSERT INTO complaints (
        id, reference_id, citizen_id, category_id, ward_id, assigned_officer_id, title, description, public_summary,
        location_text, latitude, longitude, photo_url, status, priority, resolution_deadline, assigned_at, resolved_at,
        escalated_at, is_public, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaintId, record.reference_id, seedCitizenRefs.has(record.reference_id) ? citizen.id : null,
        category.id, ward.id, officer?.id || null, record.title, record.description,
        publicSafeSummary(record.public_summary || record.description), record.location_text || null,
        null, null, null, status, 'Normal', deadline,
        officer && status !== 'Submitted' ? plusHours(createdAt, 1) : null, resolvedAt, null, isPublic,
        'synthetic-seed', createdAt, resolvedAt || createdAt
      ]
    );
    await db.run(
      'INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?)',
      [id(), complaintId, 'Submitted', 'Submitted', 'Synthetic CPGRAMS-style demonstration record; not a real citizen grievance.', createdAt]
    );
    if (officer && status !== 'Submitted') {
      await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id(), complaintId, officer.id, 'Assigned', 'Submitted', 'Assigned', `Synthetic demo assignment to ${officer.full_name}.`, plusHours(createdAt, 1)]);
    }
    if (status === 'In Progress' || status === 'Resolved') {
      await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id(), complaintId, officer?.id || null, 'Status changed', officer ? 'Assigned' : 'Submitted', 'In Progress', 'Synthetic demo: field work or follow-up started.', plusHours(createdAt, 2)]);
    }
    if (status === 'Resolved' || status === 'Rejected') {
      const priorStatus = status === 'Resolved' ? 'In Progress' : (officer ? 'Assigned' : 'Submitted');
      const eventTime = status === 'Resolved' ? (resolvedAt || createdAt) : plusHours(createdAt, 3);
      await db.run('INSERT INTO complaint_events (id, complaint_id, actor_id, event_type, old_status, new_status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id(), complaintId, officer?.id || null, 'Status changed', priorStatus, status, status === 'Resolved' ? 'Synthetic demo resolution recorded.' : 'Synthetic demo record referred to the relevant service channel.', eventTime]);
    }
    if (demoRatings.has(record.reference_id) && seedCitizenRefs.has(record.reference_id)) {
      await db.run('INSERT INTO feedback (id, complaint_id, citizen_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        id(), complaintId, citizen.id, demoRatings.get(record.reference_id), 'Synthetic demonstration feedback; replace with a real pilot response.', resolvedAt || createdAt
      ]);
    }
  }
  return { seeded: true, complaints: records.length };
}

async function main() {
  await db.initDatabase();
  const result = await seedIfEmpty();
  console.log(result.seeded ? `Seeded demo accounts and ${result.complaints} synthetic complaints.` : result.message);
  console.log('Demo logins: citizen@gpportal.demo / Citizen@123 · officer1@gpportal.demo / Officer@123 · admin@gpportal.demo / Panchayat@123');
  await db.close();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error);
    await db.close();
    process.exit(1);
  });
}

module.exports = { seedIfEmpty, CATEGORY_SEEDS, WARD_SEEDS };
