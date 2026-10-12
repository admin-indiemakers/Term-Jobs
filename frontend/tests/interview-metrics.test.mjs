import assert from 'node:assert/strict';
import test from 'node:test';
import { interviewMetrics } from '../src/interview/utils/interviewMetrics.js';

const requisitions = [{ id: 'company-role' }];
const round = { id: 'round-1', requisition_id: 'company-role', candidate_submission_id: 'application-1', scheduled_date: '2026-10-13', status: 'Scheduled' };

test('existing requisitions without interview rounds show zero', () => {
  assert.deepEqual(interviewMetrics([], requisitions), { interviewCount: 0, aiScoreCount: 0 });
});
test('other company rounds and orphan records do not count', () => {
  assert.deepEqual(interviewMetrics([round], []), { interviewCount: 0, aiScoreCount: 0 });
  assert.deepEqual(interviewMetrics([
    { ...round, requisition_id: 'other-company' },
    { ...round, candidate_submission_id: '' },
    { ...round, scheduled_date: '' },
    { ...round, status: 'Draft' },
    { ...round, status: 'Cancelled' },
  ], requisitions), { interviewCount: 0, aiScoreCount: 0 });
});
test('counts persisted rounds once and only saved numeric AI scores', () => {
  assert.deepEqual(interviewMetrics([
    round, round,
    { ...round, id: 'completed', status: 'Completed', communication_analysis: { overall_score: 0 } },
    { ...round, id: 'empty-analysis', communication_analysis: {} },
  ], requisitions), { interviewCount: 3, aiScoreCount: 1 });
});
