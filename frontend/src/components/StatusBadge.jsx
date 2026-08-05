const STATUS_LABELS = {
  Draft: 'Draft',
  Intake: 'Intake',
  Structuring: 'Structuring',
  PendingApproval: 'Pending Approval',
  Published: 'Published',
  Closed: 'Closed',
};

export default function StatusBadge({ status }) {
  const normalized = (status || 'Draft').replace(/\s+/g, '');
  const className = `status-badge status-${normalized.toLowerCase()}`;
  return <span className={className}>{STATUS_LABELS[normalized] || status}</span>;
}
