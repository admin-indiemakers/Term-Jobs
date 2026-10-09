import assert from 'node:assert/strict';
import test from 'node:test';
import { directorRedirect } from '../src/utils/directorAccess.js';

for (const path of ['/dashboard/hiring-manager', '/dashboard/hiring-manager/chat', '/dashboard/interviews', '/dashboard/candidates', '/dashboard/workforce/team', '/dashboard/admin']) {
  test(`Director cannot enter ${path}`, () => assert.equal(directorRedirect('Director', path), '/dashboard/director'));
}
test('legacy criteria link preserves requisition ID', () => {
  assert.equal(directorRedirect('Director', '/dashboard/requisitions/req-123'), '/dashboard/director/requisitions?reqId=req-123');
});
test('Director routes stay accessible', () => {
  for (const path of ['/dashboard/director', '/dashboard/director/approvals', '/dashboard/director/requisitions/req-123', '/dashboard/director/work-orders', '/dashboard/director/agreements']) {
    assert.equal(directorRedirect('Director', path), null);
  }
});
test('Hiring Manager navigation remains accessible', () => assert.equal(directorRedirect('Hiring Manager', '/dashboard/requisitions/req-123'), null));
test('new requisition route does not become a review ID', () => assert.equal(directorRedirect('DIRECTOR', '/dashboard/requisitions/new'), '/dashboard/director/requisitions'));
