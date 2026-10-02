process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'gramsetu-test-secret-which-is-long-enough';
process.env.DB_PATH = ':memory:';
process.env.DATABASE_URL = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const { app } = require('../app');
const { seedIfEmpty } = require('../seed');

const json = (response) => response.json();

test('API supports auth, complaint CRUD, workflow, feedback and public tracking privacy', async (t) => {
  await db.initDatabase();
  await seedIfEmpty();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(`${base}${path}`, options);
  const login = async (email, password) => {
    const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 200);
    return (await json(response)).token;
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  });

  const healthResponse = await request('/api/health');
  assert.equal(healthResponse.status, 200);
  assert.equal((await json(healthResponse)).status, 'ok');

  const citizenToken = await login('citizen@gpportal.demo', 'Citizen@123');
  const citizenHeaders = { Authorization: `Bearer ${citizenToken}` };
  const scoped = await json(await request('/api/complaints', { headers: citizenHeaders }));
  assert.equal(scoped.length, 6, 'demo citizen sees only their own sample records');

  const categories = await json(await request('/api/categories'));
  const wards = await json(await request('/api/wards'));
  const createResponse = await request('/api/complaints', {
    method: 'POST',
    headers: { ...citizenHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Leaking public water valve',
      description: 'The public water valve is leaking steadily near the community hall.',
      publicSummary: 'Water valve leak reported near the community hall.',
      categoryId: categories[0].id,
      wardId: wards[0].id,
      locationText: 'Near community hall',
      isPublic: true
    })
  });
  assert.equal(createResponse.status, 201);
  const created = await json(createResponse);
  assert.match(created.reference_id, /^GS-\d{2}-\d{6}$/);
  assert.equal(created.status, 'Submitted');
  assert.ok(created.resolution_deadline);

  const editResponse = await request(`/api/complaints/${created.id}`, {
    method: 'PUT', headers: { ...citizenHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Leaking water valve by hall', description: 'The public valve continues leaking steadily near the community hall.', publicSummary: 'Water valve leak by the community hall.', categoryId: categories[0].id, wardId: wards[0].id, locationText: 'Near community hall', isPublic: true })
  });
  assert.equal(editResponse.status, 200);
  assert.equal((await json(editResponse)).title, 'Leaking water valve by hall');

  const withdrawResponse = await request('/api/complaints', {
    method: 'POST', headers: { ...citizenHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Damaged bin near bus stop', description: 'A public waste bin has a damaged lid beside the bus stop.', publicSummary: 'Damaged bin reported beside the bus stop.', categoryId: categories[0].id, wardId: wards[0].id, isPublic: true })
  });
  const toWithdraw = await json(withdrawResponse);
  const deleteResponse = await request(`/api/complaints/${toWithdraw.id}`, { method: 'DELETE', headers: citizenHeaders });
  assert.equal(deleteResponse.status, 204, 'citizens can withdraw their own unassigned submission');
  assert.equal((await request(`/api/public/track/${toWithdraw.reference_id}`)).status, 404, 'withdrawn complaint is hidden from public tracking');

  const publicTrack = await json(await request(`/api/public/track/${created.reference_id}`));
  assert.equal(publicTrack.status, 'Submitted');
  assert.equal(publicTrack.citizen_email, undefined, 'public tracking never returns private email');
  assert.equal(publicTrack.title, undefined, 'public tracking never exposes the private complaint title');

  const adminToken = await login('admin@gpportal.demo', 'Panchayat@123');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const officers = await json(await request('/api/officers', { headers: adminHeaders }));
  const assignedResponse = await request(`/api/complaints/${created.id}/assign`, {
    method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedOfficerId: officers[0].id, remarks: 'Routed to the water team.' })
  });
  assert.equal(assignedResponse.status, 200);
  assert.equal((await json(assignedResponse)).status, 'Assigned');

  const progressResponse = await request(`/api/complaints/${created.id}/status`, {
    method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'In Progress', remarks: 'Inspection completed; a repair is scheduled.' })
  });
  assert.equal(progressResponse.status, 200);
  const resolvedResponse = await request(`/api/complaints/${created.id}/status`, {
    method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Resolved', remarks: 'Valve seal replaced and flow checked.' })
  });
  assert.equal(resolvedResponse.status, 200);
  assert.equal((await json(resolvedResponse)).status, 'Resolved');

  const feedbackResponse = await request(`/api/complaints/${created.id}/feedback`, {
    method: 'POST', headers: { ...citizenHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 5, comment: 'The water leak was fixed promptly.' })
  });
  assert.equal(feedbackResponse.status, 201);
  assert.equal((await json(feedbackResponse)).rating, 5);

  const analytics = await json(await request('/api/analytics', { headers: adminHeaders }));
  assert.ok(analytics.total >= 29);
  assert.ok(analytics.averageRating >= 1);

  const forbidden = await request('/api/categories', { method: 'POST', headers: { ...citizenHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name_en: 'Test', name_kn: 'ಪರೀಕ್ಷೆ', sla_days: 7, color: '#31765A' }) });
  assert.equal(forbidden.status, 403);

  const invalid = await request('/api/complaints', { method: 'POST', headers: { ...citizenHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'bad', description: 'tiny', categoryId: '', wardId: '' }) });
  assert.equal(invalid.status, 400);

  const transparency = await json(await request('/api/public/transparency'));
  assert.ok(transparency.pending >= 1);
  assert.ok(transparency.resolved >= 1);
  assert.ok(transparency.items.some((item) => item.is_escalated), 'overdue sample records are escalated on the first API wake');
  assert.ok(transparency.items.every((item) => item.citizen_email === undefined && item.latitude === undefined && item.title === undefined));
});
