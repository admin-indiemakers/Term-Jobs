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

export default function StatusBadge({ status }) {
  const normalized = (status || 'Draft').replace(/\s+/g, '');
  const className = `status-badge status-${normalized.toLowerCase()}`;
  return <span className={className}>{STATUS_LABELS[normalized] || status}</span>;
}
