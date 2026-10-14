import assert from 'node:assert/strict';
import test from 'node:test';
import { installChunkRecovery } from '../src/utils/chunkRecovery.js';

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
  assert.equal(prevented, 1);
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
