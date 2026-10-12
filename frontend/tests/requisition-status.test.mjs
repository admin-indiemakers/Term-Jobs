import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPendingApprovalStatus,
  matchesRequisitionSection,
  matchesRequisitionStatusFilter,
  calculateRequisitionCounts,
  normalizeRequisitionStatus,
} from '../src/utils/requisitionStatus.js';

test('pending approval status recognition covers all backend variants and formatting', () => {
  const pendingVariants = [
    'Pending Approval',
    'PendingApproval',
    'Pending_Approval',
    'Pending-Approval',
    'pending',
    'PENDING',
    'Pending Director Approval',
    'Pending Director Signoff',
    'Awaiting Approval',
    'awaiting approval',
    'AwaitingApproval',
    'waiting for approval',
    'needs approval',
  ];

  for (const status of pendingVariants) {
    assert.equal(
      isPendingApprovalStatus(status),
      true,
      `Expected "${status}" to be recognized as Pending Approval`
    );
    assert.equal(
      matchesRequisitionSection(status, 'pending_approval'),
      true,
      `Expected "${status}" to match pending_approval section`
    );
    assert.equal(
      matchesRequisitionStatusFilter(status, 'Pending Approval'),
      true,
      `Expected "${status}" to match "Pending Approval" dropdown filter`
    );
  }
});

test('non-pending statuses are not misclassified as pending approval', () => {
  const nonPending = ['Published', 'Active', 'Open', 'Draft', 'Drafted', 'Intake', 'Structuring', 'Closed', 'Completed', 'Filled'];
  for (const status of nonPending) {
    assert.equal(isPendingApprovalStatus(status), false, `"${status}" should not be pending`);
    assert.equal(matchesRequisitionSection(status, 'pending_approval'), false);
    assert.equal(matchesRequisitionStatusFilter(status, 'Pending Approval'), false);
  }
});

test('calculateRequisitionCounts synchronizes exactly with section matching', () => {
  const requisitions = [
    { id: '1', title: 'DevSecOps Engineer', status: 'Pending Approval' },
    { id: '2', title: 'Backend Lead', status: 'Pending Director Approval' },
    { id: '3', title: 'Fullstack Dev', status: 'PendingApproval' },
    { id: '4', title: 'Cloud Architect', status: 'Published' },
    { id: '5', title: 'QA Engineer', status: 'Draft' },
    { id: '6', title: 'DevOps Intern', status: 'Completed' },
  ];

  const counts = calculateRequisitionCounts(requisitions);

  assert.equal(counts.pending_approval, 3);
  assert.equal(counts.published, 1);
  assert.equal(counts.drafted, 1);
  assert.equal(counts.completed, 1);
  assert.equal(counts.history, 6);

  // Filtered rows for pending_approval must match the count exactly
  const pendingRows = requisitions.filter((r) => matchesRequisitionSection(r.status, 'pending_approval'));
  assert.equal(pendingRows.length, counts.pending_approval);

  // Applying the "Pending Approval" dropdown filter inside pending_approval section keeps all 3 rows
  const dropdownFiltered = pendingRows.filter((r) => matchesRequisitionStatusFilter(r.status, 'Pending Approval'));
  assert.equal(dropdownFiltered.length, 3);
});
