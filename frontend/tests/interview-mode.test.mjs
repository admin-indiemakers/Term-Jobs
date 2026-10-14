import assert from 'node:assert/strict';
import test from 'node:test';
import { isAiInterviewRound, getCandidateInterviewPath } from '../src/interview/utils/interviewMode.js';

test('company LiveKit rounds do not activate the AI interviewer', () => {
  assert.equal(isAiInterviewRound({ round_name: 'Technical Round', round_type: 'Technical' }), false);
  assert.equal(isAiInterviewRound({ round_name: 'Recruiter Screening' }), false);
  assert.equal(isAiInterviewRound(null), false);
});
test('AI fast-track rounds retain their AI interviewer', () => {
  assert.equal(isAiInterviewRound({ round_name: 'AI Fast-Track Technical Interview' }), true);
  assert.equal(isAiInterviewRound({ round_type: 'AI' }), true);
});

test('AI links and company links retain separate routes and candidate credentials', () => {
  assert.equal(getCandidateInterviewPath({ id: 'ai', round_name: 'AI Fast-Track Technical Interview', candidate_token: 'invite' }), '/interview/ai/ai?role=candidate&token=invite');
  assert.equal(getCandidateInterviewPath({ id: 'company', round_type: 'Technical', candidate_token: 'invite' }), '/interview/room/company?role=candidate&token=invite');
});
