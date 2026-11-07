import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicJobPath, publicJobUrl } from './jobLinks.js';

test('public job links target the individual requisition', () => {
  const job = { id: 'role-123' };
  assert.equal(publicJobPath(job), '/open-roles?requisition=role-123');
  assert.equal(publicJobUrl(job, 'https://termjobs.in'), 'https://termjobs.in/open-roles?requisition=role-123');
});

test('public job links preserve requisition IDs containing separators', () => {
  assert.equal(publicJobPath({ id: 'req/with spaces' }), '/open-roles?requisition=req%2Fwith%20spaces');
});
