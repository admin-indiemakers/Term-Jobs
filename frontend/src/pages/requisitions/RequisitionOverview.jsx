import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className={`stat-dot ${accent}`}></div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function RequisitionOverview() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/requisitions', { token }),
      request('/company-profiles', { token }),
    ])
      .then(([reqs, profiles]) => {
        const profileName = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
        const rows = (reqs || []).map((r) => ({ ...r, company_name: r.company_name || profileName[r.company_profile_id] || '—' }));
        setRequisitions(rows);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const counts = {
    total: requisitions.length,
    Draft: requisitions.filter((r) => r.status === 'Draft').length,
    PendingApproval: requisitions.filter((r) => r.status === 'PendingApproval').length,
    Published: requisitions.filter((r) => r.status === 'Published').length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Requisitions</h1>
          <p className="page-subtitle">Create, structure, and publish job requirements with AI assistance.</p>
        </div>
        <Link to="/dashboard/requisitions/new" className="glow-btn">
          + New Requisition
        </Link>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Requisitions" value={counts.total} accent="accent-blue" />
        <StatCard label="Draft" value={counts.Draft} accent="accent-slate" />
        <StatCard label="Pending Approval" value={counts.PendingApproval} accent="accent-amber" />
        <StatCard label="Published" value={counts.Published} accent="accent-green" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="glass-panel table-card">
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading requisitions...</p>
        ) : requisitions.length === 0 ? (
          <div className="empty-state">
            <h3>No requisitions yet</h3>
            <p>Create your first requisition and the AI will help structure the role and generate a JD.</p>
            <Link to="/dashboard/requisitions/new" className="glow-btn">
              Create Requisition
            </Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/dashboard/requisitions/${r.id}`)} className="clickable-row">
                  <td className="td-title">{r.title || 'Untitled'}</td>
                  <td className="td-company">{r.company_name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="td-date">{formatDate(r.created_at)}</td>
                  <td className="td-action"><span className="row-action">Open →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
