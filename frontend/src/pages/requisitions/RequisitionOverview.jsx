import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons } from '../../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusClass(status) {
  return `hm-row-status-${(status || 'Draft').replace(/\s+/g, '').toLowerCase()}`;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RequisitionOverview() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

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

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const data = await request('/requisitions', { token });
      downloadJSON(data, `requisitions-export-${new Date().toISOString().split('T')[0]}.json`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingle = (req) => {
    downloadJSON(req, `requisition-${req.id}-${new Date().toISOString().split('T')[0]}.json`);
  };

  const counts = {
    total: requisitions.length,
    Draft: requisitions.filter((r) => r.status === 'Draft').length,
    PendingApproval: requisitions.filter((r) => r.status === 'PendingApproval').length,
    Published: requisitions.filter((r) => r.status === 'Published').length,
  };

  const ordered = [...requisitions].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="page hm-page">
      <header className="hm-header">
        <div className="hm-header-left">
          <p className="hm-eyebrow">{greeting()}, {firstName}</p>
          <h1 className="hm-title">My Requisitions</h1>
          <p className="hm-description">
            Create, structure, and publish job requirements with AI assistance — right from this workspace.
          </p>
          <p className="hm-context">
            Hiring Manager <span>·</span> {user?.tenant_name || 'Term Jobs'}
          </p>
        </div>
        <div className="hm-header-actions">
          <div className="hm-export-dropdown">
            <button className="hm-export-btn" onClick={handleExportAll} disabled={exporting}>
              {Icons.download}
              <span>{exporting ? 'Exporting...' : 'Export All JSON'}</span>
            </button>
          </div>
          <Link to="/dashboard/requisitions/new" className="glow-btn hm-header-cta">
            + New Requisition
          </Link>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="hm-strip">
        <div className="hm-strip-seg hm-strip-total">
          <span className="hm-strip-value">{counts.total}</span>
          <span className="hm-strip-label">Total</span>
        </div>
        <div className="hm-strip-seg">
          <span className="hm-strip-value">{counts.Draft}</span>
          <span className="hm-strip-label">Draft</span>
        </div>
        <div className="hm-strip-seg">
          <span className="hm-strip-value">{counts.PendingApproval}</span>
          <span className="hm-strip-label">Pending</span>
        </div>
        <div className="hm-strip-seg">
          <span className="hm-strip-value">{counts.Published}</span>
          <span className="hm-strip-label">Live</span>
        </div>
      </div>

      <section className="hm-board">
        <div className="hm-board-head">
          <div>
            <h2 className="hm-board-title">Requisition Board</h2>
            <p className="hm-board-caption">Click any requisition to open its workspace flow. Use the menu to export JSON.</p>
          </div>
          <span className="hm-board-count">{ordered.length} total</span>
        </div>

        {loading ? (
          <p className="muted">Loading requisitions...</p>
        ) : requisitions.length === 0 ? (
          <div className="hm-empty">
            <div className="hm-empty-icon">{Icons.layers}</div>
            <h3>No requisitions yet</h3>
            <p>Create your first requisition and the AI will help structure the role and generate a JD.</p>
            <Link to="/dashboard/requisitions/new" className="glow-btn hm-empty-cta">
              Create Requisition
            </Link>
          </div>
        ) : (
          <div className="hm-board-list">
            {ordered.map((r) => (
              <div key={r.id} className="hm-row" onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}>
                <div className="hm-row-main">
                  <span className="hm-row-title">{r.title || 'Untitled'}</span>
                  <span className="hm-row-company">{r.company_name}</span>
                </div>
                <span className={`hm-row-status ${statusClass(r.status)}`}>
                  <span className="hm-dot" />
                  {r.status || 'Draft'}
                </span>
                <span className="hm-row-date">Created {formatDate(r.created_at)}</span>
                <div className="hm-row-actions">
                  <button
                    className="hm-row-export"
                    onClick={(e) => { e.stopPropagation(); handleExportSingle(r); }}
                    title="Export this requisition as JSON"
                  >
                    {Icons.download}
                  </button>
                  <span className="hm-row-chevron">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
