import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWorkdayPattern } from '../src/utils/workdayPattern.js';
const options = { today: '2026-10-23', assignmentStart: '2026-10-19' };
const week = () => Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${19 + index}`, hours: 8, category: 'Regular', note: `note ${index}` }));
test('copies selected hours and category to workdays, preserving notes and weekends', () => {
  const entries = week();
  entries[2] = { ...entries[2], hours: 9.5, category: 'Overtime' };
  const result = applyWorkdayPattern(entries, 2, options);
  assert.equal(result.changed, 4);
  assert.equal(result.entries[0].hours, 9.5);
  assert.equal(result.entries[0].category, 'Overtime');
  assert.equal(result.entries[0].note, 'note 0');
  assert.equal(result.entries[5], entries[5]);
  assert.equal(entries[0].hours, 8);
});
test('future, pre-start, leave, holiday and locked days remain unchanged', () => {
  for (const patch of [{ category: 'Paid Leave' }, { category: 'Sick Leave' }, { category: 'Holiday' }, { locked: true }, { status: 'APPROVED' }]) {
    const entries = week(); entries[0].hours = 6; entries[1] = { ...entries[1], ...patch };
    assert.equal(applyWorkdayPattern(entries, 0, options).entries[1], entries[1]);
  }
  const entries = week(); entries[2].hours = 6;
  const result = applyWorkdayPattern(entries, 2, { ...options, assignmentStart: '2026-10-20', today: '2026-10-21' });
  assert.equal(result.entries[0], entries[0]);
  assert.equal(result.entries[3], entries[3]);
});
test('locked weeks and invalid sources cannot change entries', () => {
  const entries = week();
  assert.equal(applyWorkdayPattern(entries, 0, { ...options, locked: true }).entries, entries);
  assert.equal(applyWorkdayPattern(entries, 5, options).entries, entries);
  entries[0].hours = 25;
  assert.equal(applyWorkdayPattern(entries, 0, options).entries, entries);
});
