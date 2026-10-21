import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDestination as destination } from '../src/utils/notificationNavigation.js';
const resolve = (link) => destination({ data: { link } }, 'Super Admin');
test('invalid and authentication destinations show details without leaving the session', () => {
  for (const link of ['/login', '/logout', '/dashboard/workforce/overview', 'https://other.example/login', '//other.example', '/dashboard/../login', '/dashboard/%2e%2e/login', '/dashboard/unknown', 'javascript:alert(1)']) assert.equal(resolve(link), null, link);
});
test('valid destinations preserve query parameters', () => {
  assert.equal(resolve('/dashboard/superadmin/candidate-management?tab=billing'), '/dashboard/superadmin/candidate-management?tab=billing');
  assert.equal(resolve('/dashboard/requisitions/req1/candidates'), '/dashboard/requisitions/req1/candidates');
});
test('Super Admin fallbacks use existing routes and unknown events show details', () => {
  assert.equal(destination({ type: 'candidate.selected' }, 'Super Admin'), '/dashboard/superadmin/candidate-management');
  assert.equal(destination({ type: 'agreement_signed' }, 'Super Admin'), '/dashboard/superadmin/candidate-management');
  assert.equal(destination({ type: 'general' }, 'Super Admin'), null);
});

test('Hiring Manager and HR links stay within their portal routes', () => {
  for (const role of ['Hiring Manager', 'HR']) {
    for (const link of ['/login', '/logout', '/dashboard/workforce/overview', '/dashboard/admin/team', '/dashboard/superadmin', '/dashboard/director', 'https://other.example/login']) {
      assert.equal(destination({ data: { link } }, role), null, `${role}: ${link}`);
    }
    for (const link of ['/dashboard/hiring-manager', '/dashboard/hiring-manager/chat', '/dashboard/requisitions/REQ-1/candidates', '/dashboard/workforce/timesheets']) {
      assert.equal(destination({ data: { link } }, role), link);
    }
  }
});

test('Hiring Manager notification fallbacks target the matching workflow', () => {
  assert.equal(destination({ type: 'candidate.shortlisted', data: { requisition_id: 'REQ-1' } }, 'Hiring Manager'), '/dashboard/requisitions/REQ-1/candidates');
  assert.equal(destination({ type: 'timesheet.submitted' }, 'Hiring Manager'), '/dashboard/workforce/timesheets');
  assert.equal(destination({ type: 'expense.submitted' }, 'Hiring Manager'), '/dashboard/workforce/expenses');
  assert.equal(destination({ type: 'user.created' }, 'Hiring Manager'), null);
});

test('Company Admin notification links stay in the company administration portal', () => {
  for (const section of ['', '/chat', '/team', '/directors', '/hiring-managers', '/procurement', '/finance', '/profile', '/partner-vendors', '/vendors']) {
    const link = `/dashboard/admin${section}`;
    assert.equal(destination({ data: { link } }, 'Admin'), link);
  }
  for (const link of ['/login', '/logout', '/dashboard/admin/unknown', '/dashboard/workforce/overview', '/dashboard/superadmin', '/dashboard/director', '/dashboard/recruiter', '/dashboard/requisitions', 'https://other.example/login']) {
    assert.equal(destination({ data: { link } }, 'Admin'), null, link);
  }
});

test('Company Admin notifications target management pages or display details', () => {
  for (const [type, expected] of [
    ['user.created', '/dashboard/admin/team'],
    ['director.added', '/dashboard/admin/directors'],
    ['hiring_manager.created', '/dashboard/admin/hiring-managers'],
    ['procurement.invited', '/dashboard/admin/procurement'],
    ['finance.invited', '/dashboard/admin/finance'],
    ['vendor.engaged', '/dashboard/admin/partner-vendors'],
    ['candidate.selected', null], ['requisition.published', null], ['general', null],
  ]) assert.equal(destination({ type }, 'Admin'), expected, type);
});
