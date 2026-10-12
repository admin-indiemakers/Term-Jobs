import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReviewRound, isAuditableAssessment } from '../src/interview/utils/reviewAssessment.js';

const assessment = { status: 'scored', rubric_version: 'star-v1', overall_score: 0,
  competencies: [{ competency: 'delivery', rating: 1, weight: 1 }],
  competency_dictionary: { delivery: { name: 'Delivery' } } };

test('a real zero score remains a scored assessment', () => assert.equal(isAuditableAssessment(assessment), true));
test('pending and legacy numbers are not presented as auditable scores', () => {
  for (const analysis of [null, {}, { overall_score: 85 }, { ...assessment, status: 'pending_review' }, { ...assessment, overall_score: null }]) {
    assert.equal(isAuditableAssessment(analysis), false);
  }
});
test('displayed total must match ratings and weights', () => {
  assert.equal(isAuditableAssessment({ ...assessment, overall_score: 95 }), false);
  assert.equal(isAuditableAssessment({ ...assessment, competencies: [{ competency: 'delivery', rating: 3, weight: 0.5 }] }), false);
  assert.equal(isAuditableAssessment({ ...assessment, overall_score: 50, competencies: [{ competency: 'delivery', rating: 3, weight: 1 }] }), true);
});
test('review data from a different round is rejected', () => {
  assert.throws(() => assertReviewRound('round-a', { round_id: 'round-b' }), /does not match/);
  assert.deepEqual(assertReviewRound('round-a', { round_id: 'round-a' }), { round_id: 'round-a' });
});
