import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roleVisitorId, trackRoleView } from '../src/utils/trackRoleView.js';

test('anonymous browser identifier survives repeat views and handles blocked storage', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(roleVisitorId(storage), roleVisitorId(storage));
  assert.equal(roleVisitorId(undefined), roleVisitorId(undefined));
  values.set('tj_role_visitor', '<invalid>');
  assert.match(roleVisitorId(storage), /^[a-zA-Z0-9-]{1,100}$/);
});

test('view tracking uses the active backend and only sends identity via the auth token', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return { ok: true }; });
  await trackRoleView('https://qa.example.test', 'role/one', 'candidate-session');
  assert.equal(calls[0].url, 'https://qa.example.test/api/public/requisitions/role%2Fone/views');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer candidate-session');
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)), ['visitor_id']);
  await trackRoleView('', 'role-two');
  assert.equal(calls[1].url, '/api/public/requisitions/role-two/views');
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test('failed tracking reports failure without manufacturing a successful view', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  await assert.rejects(trackRoleView('', 'role'), /could not be recorded/);
});
