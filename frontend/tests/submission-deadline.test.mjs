import assert from 'node:assert/strict';
import test from 'node:test';
import { todayForDeadline, deadlineError } from '../src/utils/submissionDeadline.js';

test('deadline rejects yesterday and earlier but permits today and future dates', () => {
  assert.match(deadlineError('2026-10-13', '2026-10-14'), /past/);
  assert.match(deadlineError('2025-01-01', '2026-10-14'), /past/);
  assert.equal(deadlineError('2026-10-14', '2026-10-14'), '');
  assert.equal(deadlineError('2026-10-15', '2026-10-14'), '');
  assert.match(deadlineError('2026-02-30', '2026-01-01'), /valid date/);
});

test('deadline day uses Indian time across the UTC date boundary', () => {
  assert.equal(todayForDeadline(new Date('2026-10-13T20:00:00Z')), '2026-10-14');
  assert.equal(todayForDeadline(new Date('2026-10-13T18:29:00Z')), '2026-10-13');
});
