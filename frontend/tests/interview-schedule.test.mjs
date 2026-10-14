import assert from 'node:assert/strict';
import test from 'node:test';
import { toInterviewTime } from '../src/utils/interviewSchedule.js';

test('original time-slot buttons produce backend 24-hour times', () => {
  assert.equal(toInterviewTime('10:30 AM'), '10:30');
  assert.equal(toInterviewTime('02:00 PM'), '14:00');
  assert.equal(toInterviewTime('12:00 PM'), '12:00');
  assert.equal(toInterviewTime('12:00 AM'), '00:00');
  assert.equal(toInterviewTime('15:30'), '15:30');
  assert.throws(() => toInterviewTime(''), /valid interview time/);
});
