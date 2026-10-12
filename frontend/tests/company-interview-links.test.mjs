import assert from 'node:assert/strict';
import test from 'node:test';
import { getCandidateInterviewLink, getInterviewerStaffLink, getMeetingRoomLink, generateCandidateEmailTemplate } from '../src/interview/utils/credentialGenerator.js';

test('company interview invitations always use termjobs.in, even in local development', () => {
  globalThis.window = { location: { origin: 'http://localhost:5173' } };
  const round = { id: 'round-a', candidate_token: 'candidate-token', interviewer_token: 'staff-token', candidate_email: 'candidate@example.com' };
  for (const link of [getCandidateInterviewLink(round), getInterviewerStaffLink(round), getMeetingRoomLink(round.id)]) {
    assert.equal(new URL(link).origin, 'https://termjobs.in');
  }
  assert.doesNotMatch(generateCandidateEmailTemplate(round), /localhost/);
  delete globalThis.window;
});
