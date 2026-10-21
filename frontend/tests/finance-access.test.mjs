import test from 'node:test';
import assert from 'node:assert/strict';
import { financeRedirect, isFinanceRole } from '../src/utils/financeAccess.js';
import { notificationDestination } from '../src/utils/notificationNavigation.js';
test('all Finance role spellings have a payment-only workspace', () => {
  for (const role of ['Finance', 'Finance Team', 'finance team', ' FINANCE ']) {
    assert.equal(isFinanceRole(role), true);
    for (const path of ['/dashboard', '/dashboard/interviews', '/dashboard/recruiter/interviews', '/dashboard/hiring-manager', '/dashboard/superadmin/chat', '/dashboard/requisitions/new', '/interview-panel/C1']) assert.equal(financeRedirect(role, path), '/dashboard/finance');
    for (const path of ['/dashboard/finance', '/dashboard/finance/work-orders', '/dashboard/finance/approvals', '/dashboard/finance/profile']) assert.equal(financeRedirect(role, path), null);
    assert.equal(notificationDestination({ data: { link: '/dashboard/requisitions/R1/candidates' } }, role), null);
  }
});
test('other roles retain their interview access', () => {
  for (const role of ['Hiring Manager', 'Super Admin', 'Recruiter']) assert.equal(financeRedirect(role, '/dashboard/interviews'), null);
});
