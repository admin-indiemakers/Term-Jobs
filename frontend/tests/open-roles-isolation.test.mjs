import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenRoles, mapLiveOpenRoles } from '../src/utils/loadOpenRoles.js';

test('published requisitions supply the newer cards with their real IDs and company logos', () => {
  const logo = 'data:image/png;base64,example';
  const [job] = mapLiveOpenRoles([{
    id: 'abc-123', title: 'AI Engineer', company_name: 'Term Jobs', company_logo_url: logo,
    structured_role: {
      work_mode: 'Onsite', location: ['Kozhikode', 'Kochi'], experience: '3–4 years',
      must_have_skills: ['Python'], job_description: 'Build AI applications.',
    },
  }]);
  assert.deepEqual(job, {
    slug: 'abc-123', title: 'AI Engineer', company: 'Term Jobs', logo,
    mode: 'On-site', loc: 'Kozhikode, Kochi', exp: '3–4 years',
    skills: ['Python'], description: 'Build AI applications.',
  });
  assert.deepEqual(mapLiveOpenRoles([{ id: 'invalid/route' }]), []);
});

test('untitled and generic partner placeholders do not appear among open roles', () => {
  const jobs = mapLiveOpenRoles([
    { id: 'untitled', company_name: 'Partner Enterprise' },
    { id: 'generic', title: 'Open role', company_name: 'Partner Enterprise' },
    { id: 'real-role', title: '  ', company_name: 'Partner Enterprise', structured_role: { title: 'AI Engineer' } },
  ]);
  assert.deepEqual(jobs.map(job => job.title), ['AI Engineer']);
});

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
