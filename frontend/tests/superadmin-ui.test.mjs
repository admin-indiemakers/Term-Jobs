import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { superAdminNavigation, isSuperAdminNavActive } from '../src/utils/superAdminNavigation.js';

let server, Header, Metric, Actions;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const header = await server.ssrLoadModule('/src/components/admin/AdminPageHeader.jsx');
  Header = header.default;
  Metric = header.AdminMetric;
  Actions = (await server.ssrLoadModule('/src/components/admin/CandidateApplicationActions.jsx')).default;
});
after(async () => { await server?.close(); });

const navigation = () => superAdminNavigation({ icons: {}, selectedCount: 3, candidateCount: 12, onboardCompany() {}, onboardVendor() {} });
const render = element => renderToStaticMarkup(React.createElement(MemoryRouter, null, element));
const application = { submission_id: 'application-1', requisition_id: 'req-1', status: 'Submitted', requisition_status: 'Published', ai_interview_status: 'Scheduled', sent_to_hiring_manager: false };

function buttons(element) {
  const result = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === 'button') result.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(element);
  return result;
}
function actions(overrides = {}, busy = '', onAction = () => {}) {
  return Actions({ application: { ...application, ...overrides }, applicationAction: busy, onAction });
}

test('grouped navigation preserves all destinations and onboarding actions', async () => {
  const nav = navigation();
  assert.deepEqual([...new Set(nav.map(item => item.section))], ['WORKSPACE', 'HIRING', 'PLACEMENTS', 'ACCOUNTS', 'ONBOARDING']);
  assert.equal(new Set(nav.map(item => item.label)).size, nav.length);
  assert.equal(nav.find(item => item.label === 'Candidate Pool').count, 12);
  assert.equal(nav.find(item => item.label === 'Candidate Selections').badge, 3);
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const item of nav.filter(item => item.to)) {
    const route = item.to.split('?')[0].replace('/dashboard/', '');
    assert.ok(appSource.includes(`path="${route}"`), `Missing registered route: ${item.to}`);
  }
  let companies = 0, vendors = 0;
  const withActions = superAdminNavigation({ icons: {}, onboardCompany: () => companies++, onboardVendor: () => vendors++ });
  withActions.find(item => item.label === 'Onboard Company').action();
  withActions.find(item => item.label === 'Onboard Vendor').action();
  assert.equal(companies, 1);
  assert.equal(vendors, 1);
});

test('overview, selections, contracts, and billing highlight only their own navigation', () => {
  for (const [path, search, expected] of [
    ['/dashboard/superadmin', '', 'Overview'],
    ['/dashboard/superadmin/', '', 'Overview'],
    ['/dashboard/superadmin/candidate-management', '', 'Candidate Selections'],
    ['/dashboard/superadmin/candidate-management', '?tab=contracts', 'Candidate Selections'],
    ['/dashboard/candidate-management', '?tab=billing', 'Billing & Work Orders'],
    ['/dashboard/superadmin/candidate-management', '?tab=billing', 'Billing & Work Orders'],
    ['/dashboard/superadmin/vendor-accounts', '', 'Vendor Accounts'],
  ]) {
    assert.deepEqual(navigation().filter(item => isSuperAdminNavActive(item, path, search)).map(item => item.label), [expected]);
  }
});

test('candidate and outreach route aliases retain the correct active navigation', () => {
  for (const alias of ['candidates', 'candidate-pool', 'candidatepool', 'candidates-pool', 'candidatespool']) {
    for (const prefix of ['/dashboard/', '/dashboard/superadmin/']) {
      assert.deepEqual(navigation().filter(item => isSuperAdminNavActive(item, prefix + alias)).map(item => item.label), ['Candidate Pool']);
    }
  }
  assert.equal(isSuperAdminNavActive(navigation()[0], '/dashboard/superadmin/requisitions'), false);
});

test('page header renders a single clear heading and retains accessible actions', () => {
  const html = render(React.createElement(Header, { title: 'Candidate pool', section: 'Hiring', description: 'Review candidate applications.' }, React.createElement('button', { type: 'button' }, 'Export CSV')));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Candidate pool actions/);
  assert.match(html, /Export CSV/);
  assert.match(html, /Review candidate applications/);
});

test('metrics distinguish zero from loading and keep account links navigable', () => {
  assert.match(render(React.createElement(Metric, { label: 'Candidates', value: 0 })), />0<\/div>/);
  assert.match(render(React.createElement(Metric, { label: 'Candidates', value: null })), /—/);
  assert.match(render(React.createElement(Metric, { label: 'Vendors', value: 4, href: '/dashboard/superadmin/vendor-accounts' })), /href="\/dashboard\/superadmin\/vendor-accounts"/);
});

test('unattended application retains email and direct shortlist actions with the selected application', () => {
  const calls = [];
  const controls = buttons(actions({}, '', (...args) => calls.push(args)));
  assert.equal(controls.length, 2);
  assert.ok(controls.every(control => !control.props.disabled));
  controls[0].props.onClick();
  controls[1].props.onClick();
  assert.deepEqual(calls.map(([row, action]) => [row.submission_id, row.requisition_id, action]), [
    ['application-1', 'req-1', 'email-ai-interview'], ['application-1', 'req-1', 'direct-shortlist'],
  ]);
});

test('completed and started interviews cannot be reinvited while direct shortlisting stays available', () => {
  for (const status of ['Completed', 'Evaluated', 'In Progress', 'Live']) {
    const controls = buttons(actions({ ai_interview_status: status }));
    assert.ok(controls[0].props.disabled);
    assert.equal(controls[1].props.disabled, false);
  }
});

test('closed, deleted, rejected and withdrawn applications disable workflow actions', () => {
  for (const overrides of [{ requisition_status: 'Closed' }, { requisition_deleted: true }, { status: 'Rejected' }, { status: 'Withdrawn' }]) {
    assert.ok(buttons(actions(overrides)).every(control => control.props.disabled));
  }
});

test('busy and sent states prevent duplicate actions and retain delivery feedback', () => {
  assert.ok(buttons(actions({}, 'application-1:email-ai-interview')).every(control => control.props.disabled));
  assert.match(render(actions({}, 'application-1:email-ai-interview')), /Sending…/);
  assert.ok(buttons(actions({ sent_to_hiring_manager: true }))[1].props.disabled);
  assert.match(render(actions({ sent_to_hiring_manager: true })), /Sent to hiring manager/);
  assert.match(render(actions({ ai_invitation_sent_at: '2026-11-05T10:00:00Z' })), /Resend AI interview link/);
  assert.match(render(actions({ ai_email_delivery_status: 'failed' })), /Last email failed/);
});
