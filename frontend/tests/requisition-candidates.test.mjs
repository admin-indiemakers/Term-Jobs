import assert from 'node:assert/strict';
import test from 'node:test';
import { mapRequisitionCandidates } from '../src/utils/requisitionCandidates.js';

test('empty requisitions never show sample candidates', () => {
  assert.deepEqual(mapRequisitionCandidates([], []), []);
});

test('saved records preserve zero scores and do not invent candidate details', () => {
  const [candidate] = mapRequisitionCandidates([{ id: 'real', candidate_name: 'Real Candidate', match_score: 0 }]);
  assert.equal(candidate.score, 0);
  assert.equal(candidate.email, '');
  assert.equal(candidate.experience, 'Not provided');
  assert.equal(candidate.availability, 'Not provided');
  assert.deepEqual(candidate.skills, []);
  assert.deepEqual(candidate.scoreBreakdown, {});
  assert.equal(mapRequisitionCandidates([{ id: 'unscored' }])[0].score, null);
});

test('only persisted, non-cancelled rounds mark their own candidate in interview', () => {
  const candidates = [{ id: 'mine', status: 'Submitted' }, { id: 'other', status: 'Shortlisted' }];
  const mapped = mapRequisitionCandidates(candidates, [{ candidate_submission_id: 'mine', status: 'Scheduled' }, { candidate_submission_id: 'other', status: 'Cancelled' }]);
  assert.equal(mapped[0].status, 'In Interview');
  assert.equal(mapped[1].status, 'AI Shortlisted');
});

test('original compact rows show three real skills and a remaining-skill count', () => {
  const [candidate] = mapRequisitionCandidates([{ id: 'real', matched_skills: ['Python', 'Django', 'AWS', 'Docker', 'SQL'], missing_skills: ['React'] }]);
  assert.deepEqual(candidate.skills, ['Python', 'Django', 'AWS', '+2']);
  assert.equal(candidate.skillsMatchPct, 83);
});
