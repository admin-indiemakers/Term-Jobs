/**
 * Requisition status categorization and normalization helpers.
 * Ensures consistent filtering, counting, and status badge presentation
 * across Hiring Manager and Administrative Requisition views.
 */

export function normalizeRequisitionStatus(status) {
  return String(status || '').toLowerCase().replace(/[\s_-]+/g, '');
}

export function isPendingApprovalStatus(status) {
  const norm = normalizeRequisitionStatus(status);
  if (!norm) return false;
  return (
    norm.includes('pending') ||
    norm.includes('awaitingapproval') ||
    norm.includes('needsapproval') ||
    norm.includes('waitingapproval') ||
    norm.includes('waitingforapproval')
  );
}

export function isPublishedStatus(status) {
  const norm = normalizeRequisitionStatus(status);
  return ['published', 'active', 'open'].includes(norm);
}

export function isDraftedStatus(status) {
  const norm = normalizeRequisitionStatus(status);
  return ['draft', 'drafted', 'intake', 'structuring'].includes(norm);
}

export function isCompletedStatus(status) {
  const norm = normalizeRequisitionStatus(status);
  return ['closed', 'completed', 'filled'].includes(norm);
}

export function matchesRequisitionSection(status, sectionKey) {
  if (!sectionKey || sectionKey === 'history') return true;
  if (sectionKey === 'pending_approval') return isPendingApprovalStatus(status);
  if (sectionKey === 'published') return isPublishedStatus(status);
  if (sectionKey === 'drafted') return isDraftedStatus(status);
  if (sectionKey === 'completed') return isCompletedStatus(status);
  return false;
}

export function matchesRequisitionStatusFilter(status, selectedFilter) {
  if (!selectedFilter || selectedFilter === 'All Status') return true;
  if (selectedFilter === 'Pending Approval') return isPendingApprovalStatus(status);
  if (selectedFilter === 'Published') return isPublishedStatus(status);
  if (selectedFilter === 'Drafted') return isDraftedStatus(status);
  if (selectedFilter === 'Completed') return isCompletedStatus(status);

  return normalizeRequisitionStatus(status) === normalizeRequisitionStatus(selectedFilter);
}

export function calculateRequisitionCounts(requisitions = []) {
  const list = Array.isArray(requisitions) ? requisitions : [];
  let published = 0;
  let pending_approval = 0;
  let drafted = 0;
  let completed = 0;

  for (const r of list) {
    const st = r?.status;
    if (isPendingApprovalStatus(st)) {
      pending_approval += 1;
    } else if (isPublishedStatus(st)) {
      published += 1;
    } else if (isDraftedStatus(st)) {
      drafted += 1;
    } else if (isCompletedStatus(st)) {
      completed += 1;
    }
  }

  return {
    published,
    pending_approval,
    drafted,
    completed,
    history: list.length,
  };
}
