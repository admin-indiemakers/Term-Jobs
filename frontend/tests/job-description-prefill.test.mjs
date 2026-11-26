import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJobPrefill } from '../src/utils/jobDescriptionPrefill.js';

const emptyJob = {
  company_name: '', job_title: '', department: '', industry: '', location: '', min_experience: '',
  max_experience: '', salary: '', employment_type: '', contract_period: '', work_mode: '', openings: '',
  target_start_date: '', application_deadline: '', working_hours: '', role_overview: '',
  required_skills: [], preferred_skills: [], responsibilities: [], technical_skills: [],
  soft_skills: [], qualifications: [], benefits: [], verification_warnings: [],
};

test('maps confirmed details and omits unknown or ambiguous inputs', () => {
  const result = buildJobPrefill({
    ...emptyJob, job_title: 'AI Engineer', work_mode: 'Onsite', openings: '2–3',
    application_deadline: 'December 7, 2026', required_skills: ['Python'], technical_skills: ['Python'],
    preferred_skills: ['Docker'], verification_warnings: ['Verify job location.'],
  }, '2026-11-26');
  assert.equal(result.values.title, 'AI Engineer');
  assert.equal(result.values.work_mode, 'On-site');
  assert.equal(result.values.submission_deadline, '2026-12-07');
  assert.equal(result.values.skills, 'Python');
  assert.equal(result.values.preferred_skills, 'Docker');
  assert(!('headcount' in result.values));
  assert(!('location' in result.values));
  assert(!('salary' in result.values));
  assert.match(result.description, /Required Technical Skills:\n- Python/);
  assert.doesNotMatch(result.description, /Benefits/);
  assert.deepEqual(result.warnings, ['Verify job location.', 'Number of openings needs a single value from 1 to 10,000.']);
});

test('rejects invalid structured responses and skips expired or incomplete dates', () => {
  assert.throws(() => buildJobPrefill({ ...emptyJob, required_skills: null }), /invalid result/);
  assert.deepEqual(buildJobPrefill({ ...emptyJob, application_deadline: '2026-11-25', target_start_date: 'December' }, '2026-11-26').values, {});
});
