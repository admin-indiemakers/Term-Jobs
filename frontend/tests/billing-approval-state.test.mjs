import test from 'node:test';
import assert from 'node:assert/strict';
import { billingApprovalState, billingReviewLink } from '../src/utils/billingApprovalState.js';

test('only Procurement-submitted monthly bills await Director approval', () => {
  for (const status of ['Pending Director Approval', 'Approved by Procurement']) {
    assert.deepEqual(billingApprovalState({ status }), {
      directorApproved: false, pendingDirector: true, procurementApproved: true,
    });
  }
});

test('stale approval flags cannot override returned or unsubmitted bill status', () => {
  for (const status of ['Draft', 'Sent to Procurement', 'Revision Requested', 'Rejected by Procurement']) {
    assert.deepEqual(billingApprovalState({ status, director_approved: true, procurement_authorized: true, sow_data: { director_approved: true } }), {
      directorApproved: false, pendingDirector: false, procurementApproved: false,
    });
  }
});

test('approved and paid bills never request a second Director approval', () => {
  for (const status of ['Approved by Director', 'Paid']) {
    assert.equal(billingApprovalState({ status }).directorApproved, true);
    assert.equal(billingApprovalState({ status }).pendingDirector, false);
  }
});

test('review links preserve the selected candidate and billing period', () => {
  const link = new URL(billingReviewLink({ candidate_id: 'C&1', period: '2026-09' }, '2026-10'), 'https://example.com');
  assert.equal(link.pathname, '/dashboard/director/work-orders');
  assert.equal(link.searchParams.get('period'), '2026-09');
  assert.equal(link.searchParams.get('candidate'), 'C&1');
});

test('pending, active contracts and missing monthly status cannot release Finance payment', () => {
  for (const status of ['Pending Director Approval', 'ACTIVE', '']) {
    const state = billingApprovalState({ status, ready_for_payment: true, director_approved: true });
    assert.equal(state.directorApproved, false);
  }
});
