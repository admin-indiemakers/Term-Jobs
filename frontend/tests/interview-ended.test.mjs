import assert from 'node:assert/strict';
import test from 'node:test';
import { isRoundEnded, isTimeInPast } from '../src/utils/interviewSchedule.js';

test('isRoundEnded: detects already scheduled past rounds that are untouched', () => {
  const round = {
    title: 'HR Interview',
    isAlreadyScheduled: true,
    persistedRoundId: 'round-1',
    scheduledDate: '2026-10-17',
    scheduledTime: '07:30 PM',
    originalDate: '2026-10-17',
    originalTime: '19:30',
    duration: 45,
  };

  // Fixed reference date: 2026-10-18 (day after)
  const refDate = new Date('2026-10-18T12:00:00Z');
  assert.equal(isRoundEnded(round, refDate), true);
});

test('isRoundEnded: returns false if user changed the date of an existing round', () => {
  const round = {
    title: 'HR Interview',
    isAlreadyScheduled: true,
    persistedRoundId: 'round-1',
    scheduledDate: '2026-10-19',
    scheduledTime: '07:30 PM',
    originalDate: '2026-10-17',
    originalTime: '19:30',
    duration: 45,
  };

  const refDate = new Date('2026-10-18T12:00:00Z');
  assert.equal(isRoundEnded(round, refDate), false);
});

test('isRoundEnded: returns false if user changed the time of an existing round', () => {
  const round = {
    title: 'HR Interview',
    isAlreadyScheduled: true,
    persistedRoundId: 'round-1',
    scheduledDate: '2026-10-17',
    scheduledTime: '05:00 PM',
    originalDate: '2026-10-17',
    originalTime: '19:30',
    duration: 45,
  };

  const refDate = new Date('2026-10-18T12:00:00Z');
  assert.equal(isRoundEnded(round, refDate), false);
});

test('isRoundEnded: returns false for newly booked rounds even if past', () => {
  const round = {
    title: 'Technical Interview',
    isAlreadyScheduled: false,
    scheduledDate: '2026-10-17',
    scheduledTime: '07:30 PM',
    duration: 45,
  };

  const refDate = new Date('2026-10-18T12:00:00Z');
  assert.equal(isRoundEnded(round, refDate), false);
});

test('isRoundEnded: returns true for rounds explicitly marked Completed or Ended', () => {
  const round = {
    title: 'Technical Interview',
    status: 'Completed',
    scheduledDate: '2099-01-01',
    scheduledTime: '10:00 AM',
  };

  assert.equal(isRoundEnded(round), true);
});

test('isRoundEnded: returns false for future scheduled rounds', () => {
  const round = {
    title: 'Final Interview',
    isAlreadyScheduled: true,
    scheduledDate: '2099-12-31',
    scheduledTime: '11:00 AM',
    originalDate: '2099-12-31',
    originalTime: '11:00',
  };

  assert.equal(isRoundEnded(round), false);
});

test('isTimeInPast: accurately detects past vs future time', () => {
  const refDate = new Date('2026-10-18T12:00:00Z');
  assert.equal(isTimeInPast('07:30 PM', '2026-10-17', refDate), true);
  assert.equal(isTimeInPast('11:00 AM', '2026-10-20', refDate), false);
});
