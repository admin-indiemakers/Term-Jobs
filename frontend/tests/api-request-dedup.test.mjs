import assert from 'node:assert/strict';
import test from 'node:test';
import { request, clearApiCache } from '../src/api/client.js';

test('concurrent refresh and uncached GETs share requests, with token isolation', async () => {
  const originalFetch = globalThis.fetch;
  const pending = [];
  globalThis.fetch = () => new Promise((resolve) => pending.push(resolve));
  try {
    clearApiCache();
    const first = request('/api/status', { token: 'a', forceRefresh: true });
    const second = request('/api/status', { token: 'a', noCache: true });
    const third = request('/api/status', { token: 'a' });
    const otherUser = request('/api/status', { token: 'b' });
    assert.equal(pending.length, 2);
    pending.splice(0).forEach(resolve => resolve({ ok: true, status: 200, json: async () => ({ connected: true }) }));
    const results = await Promise.all([first, second, third, otherUser]);
    assert.deepEqual(results[0], { connected: true });
    assert.strictEqual(results[0], results[1]);
    assert.strictEqual(results[0], results[2]);

    // A later refresh must still bypass the completed request's cache.
    const refresh = request('/api/status', { token: 'a', forceRefresh: true });
    assert.equal(pending.length, 1);
    pending.shift()({ ok: true, status: 200, json: async () => ({ connected: false }) });
    assert.deepEqual(await refresh, { connected: false });
  } finally {
    globalThis.fetch = originalFetch;
    clearApiCache();
  }
});
