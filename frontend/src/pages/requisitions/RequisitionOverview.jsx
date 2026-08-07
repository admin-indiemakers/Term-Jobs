import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { Icons, WelcomeBanner } from '../../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const STATUS_META = {
  Draft: { icon: '📝', tone: 'hm-tone-slate' },
  Intake: { icon: '💬', tone: 'hm-tone-blue' },
  Structuring: { icon: '🧩', tone: 'hm-tone-violet' },
  PendingApproval: { icon: '⏳', tone: 'hm-tone-amber' },
  Published: { icon: '🚀', tone: 'hm-tone-green' },
  Closed: { icon: '🔒', tone: 'hm-tone-rose' },
};

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

  const ordered = [...requisitions].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="page">
      <WelcomeBanner
        title="My Requisitions"
        subtitle="Create, structure, and publish job requirements with AI assistance — right from this workspace."
      >
        <Link to="/dashboard/requisitions/new" className="glow-btn">
          + New Requisition
        </Link>
      </WelcomeBanner>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="hm-stats">
        <div className="hm-stat hm-stat-total">
          <span className="hm-stat-value">{counts.total}</span>
          <span className="hm-stat-label">Total</span>
        </div>
        <div className="hm-stat">
          <span className="hm-stat-value">{counts.Draft}</span>
          <span className="hm-stat-label">Draft</span>
        </div>
        <div className="hm-stat">
          <span className="hm-stat-value">{counts.PendingApproval}</span>
          <span className="hm-stat-label">Pending</span>
        </div>
        <div className="hm-stat">
          <span className="hm-stat-value">{counts.Published}</span>
          <span className="hm-stat-label">Live</span>
        </div>
      </div>

      <div className="hm-section-head">
        <div>
          <h2 className="hm-section-title">Requisition Board</h2>
          <p className="hm-section-caption">Click any card to open its workspace flow.</p>
        </div>
        <div className="hm-count-pill">{ordered.length} total</div>
      </div>

      {loading ? (
        <p className="muted">Loading requisitions...</p>
      ) : requisitions.length === 0 ? (
        <div className="hm-empty">
          <div className="hm-empty-icon">{Icons.layers}</div>
          <h3>No requisitions yet</h3>
          <p>Create your first requisition and the AI will help structure the role and generate a JD.</p>
          <Link to="/dashboard/requisitions/new" className="glow-btn">
            Create Requisition
          </Link>
        </div>
      ) : (
        <div className="hm-board">
          {ordered.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.Draft;
            return (
              <div key={r.id} className={`hm-card ${meta.tone}`} onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}>
                <div className="hm-card-top">
                  <span className="hm-card-emoji">{meta.icon}</span>
                  <StatusBadge status={r.status} />
                </div>
                <h3 className="hm-card-title">{r.title || 'Untitled'}</h3>
                <div className="hm-card-company">{r.company_name}</div>
                <div className="hm-card-foot">
                  <span className="hm-card-date">Created {formatDate(r.created_at)}</span>
                  <span className="hm-card-open">Open →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
