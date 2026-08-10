import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Icons, StatCard, WelcomeBanner } from '../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function DirectorDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      request('/requisitions', { token }),
      request('/candidates/shortlisted', { token }),
      request('/api/auth/vendors', { token }),
    ])
      .then(([reqsRes, candsRes, vendorsRes]) => {
        setRequisitions(reqsRes || []);
        setCandidates(candsRes || []);
        setVendors(vendorsRes || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const published = requisitions.filter((r) => r.status === 'Published').length;
  const pending = requisitions.filter((r) => r.status === 'PendingApproval').length;
  const engagedVendors = vendors.filter((v) => v.engaged).length;

  const candidatesByRequisition = useMemo(() => {
    const map = {};
    (candidates || []).forEach((c) => {
      if (!c.requisition_id) return;
      map[c.requisition_id] = (map[c.requisition_id] || 0) + 1;
    });
    return map;
  }, [candidates]);

  return (
    <div className="page">
      <WelcomeBanner
        title="Executive Overview"
        subtitle={`${user.tenant_name} — read-only view of hiring activity across the company.`}
      />

      <div className="stat-grid">
        <StatCard label="Requisitions" value={requisitions.length} icon={Icons.briefcase} tint="tint-violet" />
        <StatCard label="Pending Approval" value={pending} icon={Icons.clock} tint="tint-amber" />
        <StatCard label="Published" value={published} icon={Icons.check} tint="tint-green" />
        <StatCard label="Shortlisted Candidates" value={candidates.length} icon={Icons.users} tint="tint-blue" />
        <StatCard label="Partner Vendors" value={engagedVendors} icon={Icons.layers} tint="tint-slate" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading executive overview...</p>
      ) : (
        <>
          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Requisitions</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Read-only overview of all requisitions</p>
              </div>
            </div>
            {requisitions.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No requisitions in this workspace yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Shortlisted</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((r) => (
                    <tr key={r.id} onClick={() => navigate(`/dashboard/requisitions/${r.id}`)} className="clickable-row">
                      <td className="td-title">{r.title || 'Untitled'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{candidatesByRequisition[r.id] || 0}</td>
                      <td className="td-date">{formatDate(r.created_at)}</td>
                      <td className="td-action"><span className="row-action">View →</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Shortlisted Candidates</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Candidates shortlisted by your partner vendors</p>
              </div>
            </div>
            {candidates.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No shortlisted candidates yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role</th>
                    <th>Vendor</th>
                    <th>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 20).map((c) => (
                    <tr key={c.id}>
                      <td className="td-title">{c.candidate_name || '—'}</td>
                      <td>{c.requisition_title || '—'}</td>
                      <td className="td-company">{c.vendor_name || '—'}</td>
                      <td>{c.match_score != null ? `${Math.round(c.match_score)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Partner Vendors</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Consultancies your company works with</p>
              </div>
            </div>
            {vendors.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No consultancy vendors onboarded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Location</th>
                    <th>Industry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id}>
                      <td className="td-title">{v.name}</td>
                      <td>{v.location || '—'}</td>
                      <td>{v.industry || '—'}</td>
                      <td>
                        <span className={`rec-badge ${v.engaged ? 'rec-strong' : 'rec-low'}`}>
                          {v.engaged ? 'Engaged' : 'Not engaged'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
