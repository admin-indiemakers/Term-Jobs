import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreateRequisition } from '../src/utils/requisitionPermissions.js';
test('Procurement and employee roles have no requisition creation access', () => {
  for (const role of ['Procurement', 'Procurement Team', 'Employee', 'Finance', 'Candidate', undefined]) assert.equal(canCreateRequisition(role), false);
});
test('authorized hiring roles retain requisition creation access', () => {
  for (const role of ['Hiring Manager', 'HR', 'Admin', 'Company Admin', 'Super Admin']) assert.equal(canCreateRequisition(role), true);
});

import { requisitionWorkflowRedirect } from '../src/utils/requisitionPermissions.js';
test('Finance and Procurement cannot enter hiring creation pages through shared links', () => {
  for (const [role, home] of [['Finance', '/dashboard/finance'], ['Finance Team', '/dashboard/finance'], ['Procurement', '/dashboard/procurement'], ['Procurement Team', '/dashboard/procurement'], ['Employee', '/dashboard/procurement']]) {
    for (const path of ['/dashboard/requisitions', '/dashboard/requisitions/new', '/dashboard/requisitions/REQ-1', '/dashboard/hiring-manager', '/dashboard/hiring-manager/chat']) assert.equal(requisitionWorkflowRedirect(role, path), home);
    assert.equal(requisitionWorkflowRedirect(role, home), null);
  }
  assert.equal(requisitionWorkflowRedirect('Hiring Manager', '/dashboard/requisitions/new'), null);
});
