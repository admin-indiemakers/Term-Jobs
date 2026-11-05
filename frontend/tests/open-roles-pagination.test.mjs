import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadOpenRolesPage, openRolesPagePath } from '../src/utils/loadOpenRoles.js';
const page = { items: [{ id: 'qa-role' }], page: 2, total: 19, total_pages: 3 };

test('page requests fetch eight roles with encoded server-side filters', async () => {
  await loadOpenRolesPage(async (path, options) => {
    const url = new URL(path, 'https://qa.example.test');
    assert.equal(url.pathname, '/api/public/requisitions/page');
    for (const [key, expected] of Object.entries({ page: '2', page_size: '8', q: 'Python & React', location: 'Kochi', category: 'Development' })) assert.equal(url.searchParams.get(key), expected);
    assert.equal(url.searchParams.has('family'), false);
    assert.deepEqual(options, { forceRefresh: true, noCache: true });
    return page;
  }, { page: 2, q: ' Python & React ', location: 'Kochi', category: 'Development' });
});

test('startup effects can share one initial prefetch', async () => {
  const prefetched = Promise.resolve({ ...page, page: 1 });
  const request = () => assert.fail('must reuse initial prefetch');
  const results = await Promise.all([loadOpenRolesPage(request, {}, prefetched), loadOpenRolesPage(request, {}, prefetched)]);
  assert.equal(results[0], results[1]);
});

test('initial prefetch cannot replace another page or filtered results', async () => {
  const initial = Promise.resolve({ ...page, page: 1 });
  let requests = 0;
  const request = async () => { requests++; return page; };
  assert.equal(await loadOpenRolesPage(request, { page: 2 }, initial), page);
  assert.equal(await loadOpenRolesPage(request, { q: 'Python' }, initial), page);
  assert.equal(requests, 2);
});

test('page failures preserve environment isolation and accept an empty testing database', async () => {
  const error = new Error('Database isolation could not be verified');
  await assert.rejects(loadOpenRolesPage(async () => { throw error; }, {}, Promise.resolve(null)), error);
  await assert.rejects(loadOpenRolesPage(async () => [{ id: 'old-production-row' }], {}), /invalid page response/);
  const empty = { items: [], total: 0, total_pages: 1 };
  assert.equal(await loadOpenRolesPage(() => assert.fail('empty data is valid'), {}, Promise.resolve(empty)), empty);
  assert.equal(openRolesPagePath(), '/api/public/requisitions/page?page=1&page_size=8');
});
