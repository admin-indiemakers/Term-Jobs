import test from 'node:test';
import assert from 'node:assert/strict';
import { billingCycle, currentBillingMonth, shiftBillingMonth } from '../src/utils/billingPeriod.js';

test('billing opens October timesheets in October rather than a fixed month', () => {
  const now = new Date(2026, 9, 15);
  assert.equal(currentBillingMonth(now), '2026-10');
  assert.deepEqual(billingCycle(currentBillingMonth(now), now), {
    label: 'October 2026', range: '01 Oct - 31 Oct',
    endLabel: '31 Oct 2026', daysRemaining: 16,
  });
});

test('billing cycle handles year changes, leap years and historical months', () => {
  assert.equal(currentBillingMonth(new Date(2027, 0, 1)), '2027-01');
  assert.equal(billingCycle('2028-02', new Date(2028, 1, 1)).daysRemaining, 28);
  assert.equal(billingCycle('2026-09', new Date(2026, 9, 15)).daysRemaining, 0);
});

test('billing month arrows navigate forward and backward across year boundaries', () => {
  assert.equal(shiftBillingMonth('2026-10', 1), '2026-11');
  assert.equal(shiftBillingMonth('2026-12', 1), '2027-01');
  assert.equal(shiftBillingMonth('2027-01', -1), '2026-12');
  assert.equal(shiftBillingMonth('2028-02', 1), '2028-03');
});
