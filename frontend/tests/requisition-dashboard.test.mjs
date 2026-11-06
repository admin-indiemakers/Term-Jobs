import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { indianCalendarDate, requisitionDashboard } from '../src/utils/requisitionDashboard.js';
const row = (id, status, applications, views, company = 'Example', deadline = '2026-11-10') => ({ id, title: `Role ${id}`, company_name: company, status, applicants_count: applications, viewers_count: views, structured_role: { submission_deadline: deadline } });
const rows = [row('one', 'Published', 4, 7), row('two', 'Closed', 3, 5, ' Example '), row('three', 'Published', 0, 2, 'Another')];

test('totals cover all postings while awaiting applicants only counts published roles', () => {
  const data = requisitionDashboard([...rows, row('four', 'Closed', 0, 0, 'EXAMPLE'), row('draft', 'Draft', 0, 0, '')], '2026-11-05');
  assert.deepEqual([data.applications, data.viewers, data.open, data.closed, data.companies, data.awaitingApplicants], [7, 14, 2, 2, 2, 1]);
  assert.deepEqual(data.topRoles.map(row => row.id), ['one', 'two']);
});
test('empty and older records do not fabricate activity', () => {
  const empty = requisitionDashboard([]);
  for (const key of ['applications', 'viewers', 'open', 'closed', 'companies', 'awaitingApplicants']) assert.equal(empty[key], 0);
  const data = requisitionDashboard([{ id: 'old', status: 'Published' }, row('bad', 'Closed', -3, Infinity)]);
  assert.equal(data.applications, 0); assert.equal(data.viewers, 0); assert.equal(data.awaitingApplicants, 1); assert.deepEqual(data.topRoles, []);
});
test('deadlines include today and day seven; India calendar determines the day', () => {
  const input = [row('seven', 'Published', 0, 0, '', '2026-11-12'), row('today', 'Published', 0, 0, '', '2026-11-05'), row('later', 'Published', 0, 0, '', '2026-11-13'), row('past', 'Published', 0, 0, '', '2026-11-04'), row('closed', 'Closed', 0, 0, '', '2026-11-05'), row('invalid', 'Published', 0, 0, '', '2026-02-31')];
  assert.deepEqual(requisitionDashboard(input, '2026-11-05').closingSoon.map(row => [row.id, row.daysLeft]), [['today', 0], ['seven', 7]]);
  assert.equal(indianCalendarDate(new Date('2026-11-05T19:00:00Z')), '2026-11-06');
  assert.equal(indianCalendarDate(new Date('2026-11-05T18:00:00Z')), '2026-11-05');
});
test('rankings sort by count, limit to five, and preserve source order', () => {
  const input = Array.from({ length: 8 }, (_, index) => row(String(index), 'Published', index, index));
  assert.deepEqual(requisitionDashboard(input).topRoles.map(row => row.applicants_count), [7, 6, 5, 4, 3]);
  assert.deepEqual(input.map(row => row.applicants_count), [0, 1, 2, 3, 4, 5, 6, 7]);
});
let server, cacheDir, Dashboard;
before(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'termjobs-dashboard-vite-'));
  server = await createServer({ configFile: false, cacheDir, plugins: [react()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  Dashboard = (await server.ssrLoadModule('/src/components/admin/RequisitionDashboard.jsx')).default;
});
after(async () => { try { await server?.close(); } finally { if (cacheDir) await rm(cacheDir, { recursive: true, force: true }); } });
test('dashboard distinguishes loading, unavailable, and real zero results', () => {
  const render = props => renderToStaticMarkup(React.createElement(Dashboard, { rows: [], onReview() {}, ...props }));
  const pending = render({ ready: false, loading: true });
  assert.match(pending, /Updating metrics/);
  assert.equal((pending.match(/admin-metric-value">—/g) || []).length, 6);
  assert.match(render({ ready: false, loading: false }), /Metrics unavailable/);
  const empty = render({ ready: true, loading: false });
  assert.equal((empty.match(/admin-metric-value">0/g) || []).length, 6);
  assert.match(empty, /No applications yet/); assert.match(empty, /No open roles are due/);
});
test('role ranking opens applicants for the selected requisition', () => {
  const calls = [];
  const tree = Dashboard({ rows, ready: true, loading: false, onReview: (...args) => calls.push(args) });
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === 'button' && node.props['aria-label'] === 'Review applications for Role one') node.props.onClick();
    React.Children.forEach(node.props.children, visit);
  }
  visit(tree);
  assert.deepEqual(calls, [[rows[0], 'applicants']]);
  assert.match(renderToStaticMarkup(tree), /submissions, not unique people/);
});
