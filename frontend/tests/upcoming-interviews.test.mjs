import assert from 'node:assert/strict';
import test from 'node:test';
import { upcomingInterviewRounds } from '../src/interview/utils/upcomingInterviews.js';

const now = new Date('2026-10-12T12:00:00');
const requisitions = [{ id: 'apple-role' }];
const scheduled = { id: 'round-1', requisition_id: 'apple-role', candidate_submission_id: 'submission-1', status: 'Scheduled', scheduled_date: '2026-10-13', scheduled_time: '10:00 AM' };
const select = rounds => upcomingInterviewRounds(rounds, requisitions, now);

test('no company requisitions means no upcoming interviews', () => {
  assert.deepEqual(upcomingInterviewRounds([scheduled], [], now), []);
});

test('only real upcoming schedules in visible requisitions are included', () => {
  const rows = [scheduled,
    { ...scheduled, id: 'other-company', requisition_id: 'other-role' },
    { ...scheduled, id: 'completed', status: 'Completed' },
    { ...scheduled, id: 'cancelled', status: 'Cancelled' },
    { ...scheduled, id: 'draft', status: 'Draft' },
    { ...scheduled, id: 'unknown', status: '' },
    { ...scheduled, id: 'unscheduled', scheduled_date: '' },
    { ...scheduled, id: 'past', scheduled_date: '2026-10-11' },
    { ...scheduled, id: 'earlier-today', scheduled_date: '2026-10-12' },
    { ...scheduled, id: 'no-application', candidate_submission_id: '' },
    scheduled,
  ];
  assert.deepEqual(select(rows), [scheduled]);
});

test('confirmed future schedules retain their real status', () => {
  const confirmed = { ...scheduled, status: 'Confirmed', scheduled_date: '2026-10-12', scheduled_time: '2:00 PM' };
  assert.deepEqual(select([confirmed]), [confirmed]);
  assert.equal(select([scheduled])[0].status, 'Scheduled');
});

test('invalid dates and summary rows without persisted round IDs are excluded', () => {
  assert.deepEqual(select([{ ...scheduled, scheduled_date: 'invalid' }, { ...scheduled, id: null }]), []);
});
