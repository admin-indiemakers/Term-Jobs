import assert from 'node:assert/strict';
import test from 'node:test';
import { installChunkRecovery, loadRoute, isChunkRecoveryInProgress } from '../src/utils/chunkRecovery.js';

test('failed imports reload once across page loads without clearing the session', () => {
  const values = new Map([['auth', 'retained']]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let handler;
  let reloads = 0;
  let prevented = 0;
  const target = {
    location: { reload: () => reloads++ },
    addEventListener: (name, fn) => { assert.equal(name, 'vite:preloadError'); handler = fn; },
    removeEventListener: () => {},
  };
  const event = { preventDefault: () => prevented++ };
  installChunkRecovery(target, storage, 'bundle-v1');
  handler(event);
  installChunkRecovery(target, storage, 'bundle-v1');
  handler(event);
  assert.equal(reloads, 1);
  assert.equal(prevented, 0);
  assert.equal(values.get('auth'), 'retained');
});

test('unavailable storage does not cause an unguarded reload', () => {
  let handler;
  const target = {
    location: { reload: () => assert.fail('must not reload') },
    addEventListener: (_, fn) => { handler = fn; },
  };
  installChunkRecovery(target, { getItem: () => { throw new Error('disabled'); } }, 'bundle');
  handler({ preventDefault: () => assert.fail('must leave failure visible') });
});


test('route import failures stay pending during recovery rather than flashing an error', async () => {
  let handler;
  const target = {
    location: { reload() {} },
    addEventListener: (_, fn) => { handler = fn; },
  };
  installChunkRecovery(target, { getItem() {}, setItem() {} }, 'v1');
  handler({});
  assert.equal(isChunkRecoveryInProgress(target), true);
  const result = loadRoute(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), target);
  const state = await Promise.race([result.then(() => 'resolved', () => 'rejected'), new Promise(resolve => setTimeout(() => resolve('pending'), 20))]);
  assert.equal(state, 'pending');
});

test('persistent or unrelated route failures remain available to the error boundary', async () => {
  const error = new Error('render dependency failed');
  await assert.rejects(loadRoute(() => Promise.reject(error), {}), error);
});
