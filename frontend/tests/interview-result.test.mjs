import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeInterviewResult, isAiInterviewRound } from '../src/interview/utils/interviewMode.js';

test('scoring response preserves AI round identity and metadata', () => {
  const round = { id: 'round-1', round_name: 'AI Fast-Track Technical Interview', candidate_name: 'Candidate', requisition_title: 'Engineer', candidate_token: 'token' };
  const result = { analysis: { status: 'scored', overall_score: 75 }, metrics: { word_count: 200 } };
  const merged = mergeInterviewResult(round, result);
  assert.equal(isAiInterviewRound(merged), true);
  assert.equal(merged.id, round.id);
  assert.equal(merged.candidate_name, round.candidate_name);
  assert.equal(merged.candidate_token, round.candidate_token);
  assert.deepEqual(merged.communication_analysis, result.analysis);
  assert.deepEqual(merged.communication_metrics, result.metrics);
});

test('partial updates preserve metadata and foreign results are ignored', () => {
  const round = { id: 'one', round_type: 'ai', candidate_name: 'Candidate' };
  assert.equal(mergeInterviewResult(round, { status: 'In Progress' }).candidate_name, 'Candidate');
  assert.equal(mergeInterviewResult(round, { id: 'other', round_type: 'company' }), round);
  assert.equal(mergeInterviewResult(round, null), round);
});
