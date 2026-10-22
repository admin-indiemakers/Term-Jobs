const STATUS_LABELS = {
  Draft: 'Draft',
  Intake: 'Intake',
  Structuring: 'Structuring',
  Restructuring: 'Restructuring',
  PendingApproval: 'Pending Approval',
  Published: 'Published',
  Rejected: 'Rejected',
  RevisionRequired: 'Revision Required',
  Closed: 'Closed',
  DeletedbyHM: 'Deleted by HM',
  Deleted: 'Deleted',
  Cancelled: 'Cancelled',
};

export default function StatusBadge({ status, requisition }) {
  const reqObj = requisition || (typeof status === 'object' && status !== null ? status : null);
  let rawStatus = typeof status === 'string' ? status : (reqObj?.status || 'Draft');
  const isRej = Boolean(
    rawStatus === 'Restructuring' ||
    rawStatus === 'Rejected' ||
    (reqObj && (
      (reqObj.status || '').toLowerCase().includes('restructur') ||
      (reqObj.director_approved === false && Boolean(reqObj.rejection_reason || reqObj.rejected_by || reqObj.rejected_at))
    ))
  );
  if (isRej) {
    rawStatus = 'Restructuring';
  }
  const normalized = (rawStatus || 'Draft').replace(/\s+/g, '');
  const className = `status-badge status-${normalized.toLowerCase()}`;
  return <span className={className}>{STATUS_LABELS[normalized] || rawStatus}</span>;
}

