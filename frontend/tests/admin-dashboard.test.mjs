import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardList, normalizeDashboardStatus, isValidCompanyName } from '../src/utils/adminDashboard.js';

test('dashboard accepts array and named list responses, including empty lists', () => {
  const rows = [{ id: 'req-1', status: 'Published' }];
  assert.deepEqual(dashboardList(rows, 'requisitions'), rows);
  assert.deepEqual(dashboardList({ requisitions: rows }, 'requisitions'), rows);
  assert.deepEqual(dashboardList({ users: [] }, 'users'), []);
});

test('unexpected responses are errors rather than empty dashboards', () => {
  for (const payload of [null, {}, '<html>Login</html>', { users: null }]) {
    assert.throws(() => dashboardList(payload, 'users'), /Unexpected users response/);
  }
});

test('backend and legacy pending approval statuses match the same counter', () => {
  for (const status of ['PendingApproval', 'pending_approval', 'Pending Approval']) {
    assert.equal(normalizeDashboardStatus(status), 'pendingapproval');
  }
  assert.equal(normalizeDashboardStatus('Published'), 'published');
});

test('isValidCompanyName excludes test artifacts, malformed strings, and generic labels', () => {
  // Invalid entries
  assert.equal(isValidCompanyName('test'), false);
  assert.equal(isValidCompanyName('testxcvgb'), false);
  assert.equal(isValidCompanyName('xcvgb'), false);
  assert.equal(isValidCompanyName('asdfg'), false);
  assert.equal(isValidCompanyName('t'), false);
  assert.equal(isValidCompanyName('12345'), false);
  assert.equal(isValidCompanyName('Enterprise Partner'), false);
  assert.equal(isValidCompanyName('null'), false);
  assert.equal(isValidCompanyName(''), false);
  assert.equal(isValidCompanyName(null), false);

  // Valid entries
  assert.equal(isValidCompanyName('APPLE'), true);
  assert.equal(isValidCompanyName('IBM'), true);
  assert.equal(isValidCompanyName('Roblox'), true);
  assert.equal(isValidCompanyName('Google Cloud'), true);
  assert.equal(isValidCompanyName('Meta Platforms'), true);
});
