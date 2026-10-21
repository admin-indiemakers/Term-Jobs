// Monthly billing status is authoritative; old contract flags cannot approve a new bill.
export function billingApprovalState(row = {}) {
  const status = String(row.status || row.sow_data?.status || '').trim();
  const directorApproved = ['Paid', 'Approved by Director', 'Approved'].includes(status);
  const pendingDirector = ['Pending Director Approval', 'Approved by Procurement'].includes(status);
  return {
    directorApproved,
    pendingDirector,
    procurementApproved: directorApproved || pendingDirector,
  };
}

export function billingReviewLink(row, month) {
  const params = new URLSearchParams({
    period: row.period || month,
    candidate: row.candidate_id || row.workorder_id || row._id || '',
  });
  return `/dashboard/director/work-orders?${params}`;
}
