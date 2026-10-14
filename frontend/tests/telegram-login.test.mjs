import assert from 'node:assert/strict';
import test from 'node:test';
import { signInAndConnectTelegram } from '../src/utils/telegramLogin.js';

test('sign-in connects using the fresh token without waiting for React session updates', async () => {
  const calls = [];
  const session = { access_token: 'fresh-token', user: { role: 'Hiring Manager' } };
  const request = async (path, options) => {
    calls.push({ path, options });
    return path === '/api/auth/login' ? session : { status: 'success' };
  };
  assert.equal(await signInAndConnectTelegram(request, { state: 'single-use-state', email: ' hm@example.com ', password: 'correct password' }), session);
  assert.equal(calls[1].options.token, 'fresh-token');
  assert.deepEqual(calls[1].options.body, { state: 'single-use-state' });
  assert.equal(calls[0].options.body.email, 'hm@example.com');
});

test('an existing Hiring Manager session connects directly', async () => {
  const session = { user: { role: 'Hiring Manager' }, access_token: 'existing' };
  const calls = [];
  await signInAndConnectTelegram(async (path, options) => calls.push({ path, options }), { state: 'state', session });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/integrations/telegram/complete-login');
});

test('wrong-role and missing-link requests cannot connect', async () => {
  const unexpected = async () => assert.fail('Must not call backend');
  await assert.rejects(signInAndConnectTelegram(unexpected, { state: '', session: {} }), /fresh sign-in link/);
  await assert.rejects(signInAndConnectTelegram(unexpected, { state: 'state', session: { user: { role: 'Super Admin' } } }), /Hiring Manager account/);
});

test('failed connection does not report success', async () => {
  await assert.rejects(signInAndConnectTelegram(async () => { throw new Error('Link expired'); }, {
    state: 'state', session: { user: { role: 'Hiring Manager' }, access_token: 'token' },
  }), /Link expired/);
});
