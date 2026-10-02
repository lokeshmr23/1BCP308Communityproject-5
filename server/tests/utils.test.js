const test = require('node:test');
const assert = require('node:assert/strict');
const { addDays, canTransition, makeReferenceId, normalizeStatus, publicSafeSummary } = require('../utils');

test('complaint utility rules are deterministic and privacy aware', () => {
  assert.equal(canTransition('Submitted', 'Assigned'), true);
  assert.equal(canTransition('Resolved', 'In Progress'), false);
  assert.equal(normalizeStatus('disposed'), 'Resolved');
  assert.match(makeReferenceId(), /^GS-\d{2}-\d{6}$/);
  assert.equal(publicSafeSummary('Call me at 98765 43210 or name@example.org'), 'Call me at [contact details removed] or [contact details removed]');
  assert.equal(new Date(addDays('2026-09-01T00:00:00.000Z', 5)).toISOString(), '2026-09-06T00:00:00.000Z');
});
