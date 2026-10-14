import test from 'node:test';
import assert from 'node:assert/strict';
import { attendedApplicants, candidateRounds } from '../src/utils/requisitionCandidates.js';

test('applications and invitations alone are not attended applicants', () => {
  const rows = [{id: 'a', requisition_id: 'req'}, {id: 'b', requisition_id: 'req'}, {id: 'c', requisition_id: 'req'}];
  const rounds = [{candidate_submission_id: 'a', requisition_id: 'req', status: 'Scheduled'}, {candidate_submission_id: 'b', requisition_id: 'req', status: 'In Progress'}, {candidate_submission_id: 'c', requisition_id: 'req', status: 'Completed'}];
  assert.deepEqual(attendedApplicants(rows, rounds), [rows[2]]);
});
test('legacy IDs can match email without exposing a different requisition assessment', () => {
  const row = {id: 'new', candidate_email: 'A@Example.com', requisition_id: 'req'};
  const rounds = [{candidate_email: 'a@example.com', requisition_id: 'other', status: 'Completed'}, {candidate_email: 'a@example.com', requisition_id: 'req', status: 'Completed'}];
  assert.deepEqual(candidateRounds(row, rounds), [rounds[1]]);
});
