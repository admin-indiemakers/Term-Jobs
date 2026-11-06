import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRoles } from '../src/utils/loadOpenRoles.js';

test('roles load from the current API without memory, session, or HTTP cache reuse', async () => {
  const rows = [{ id: 'testing-role' }];
  const result = await loadOpenRoles(async (path, options) => {
    assert.equal(path, '/api/public/requisitions');
    assert.deepEqual(options, { forceRefresh: true, noCache: true });
    return rows;
  });
  assert.equal(result, rows);
});

test('QA proxy errors propagate rather than returning historical production-looking rows', async () => {
  const error = new Error('API unavailable: database isolation could not be verified.');
  await assert.rejects(loadOpenRoles(async () => { throw error; }, Promise.resolve(null)), error);
});

test('same-page prefetch can return an empty testing database without a stale fallback', async () => {
  assert.deepEqual(await loadOpenRoles(() => assert.fail('must not use another data source'), Promise.resolve([])), []);
});

test('failed speculative prefetch retries only the current API and rejects non-array responses', async () => {
  assert.deepEqual(await loadOpenRoles(async () => [{ id: 'qa' }], Promise.reject(new Error('unavailable'))), [{ id: 'qa' }]);
  await assert.rejects(loadOpenRoles(async () => ({ error: 'bad response' })), /invalid response/);
});
