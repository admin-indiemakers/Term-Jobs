import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function AcceptedCandidates() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      request('/candidates?status=Accepted', { token }).catch(() => []),
      request('/api/interviews/company', { token }).catch(() => []),
    ])
      .then(([data, invs]) => {
        setCandidates(Array.isArray(data) ? data : data?.candidates || []);
        setInterviews(Array.isArray(invs) ? invs : invs?.interviews || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const stats = useMemo(() => {
    const byRequisition = {};
    candidates.forEach((c) => {
      if (!c.requisition_id) return;
      byRequisition[c.requisition_id] = (byRequisition[c.requisition_id] || 0) + 1;
    });
    return {
      total: candidates.length,
      requisitions: Object.keys(byRequisition).length,
      avg: candidates.length ? candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / candidates.length : 0,
    };
  }, [candidates]);

  const interviewFor = (c) => {
    const cid = c.submission_id || c.id;
    return interviews.find((inv) => inv.candidate_submission_id === cid || inv.candidate_name === c.candidate_name);
  };

  return (
    <div className="page page-shortlisted">
      <WelcomeBanner
        title="Accepted Candidates"
        subtitle="Candidates whose interviews are over and received a final 'Accepted' decision. These are ready to onboard."
      >
        <Link to="/dashboard/candidates" className="ghost-btn-link" style={{ color: '#dbeafe', fontSize: '0.88rem' }}>
          ← Shortlisted candidates
        </Link>
      </WelcomeBanner>

      <div className="stat-grid">
        <StatCard label="Accepted Candidates" value={stats.total} icon={Icons.check} tint="tint-green" />
        <StatCard label="Requisitions" value={stats.requisitions} icon={Icons.briefcase} tint="tint-blue" />
        <StatCard label="Avg Match Score" value={stats.avg ? `${Math.round(stats.avg)}%` : '—'} icon={Icons.users} tint="tint-violet" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="glass-panel table-card" style={{ marginTop: '20px' }}>
        <div className="shortlist-head">
          <h3 className="card-title">Accepted Candidates</h3>
          <span className="muted">{stats.total} accepted · decision recorded after the interview meeting</span>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading accepted candidates...</p>
        ) : candidates.length === 0 ? (
          <div className="empty-state">
            <h3>No accepted candidates yet</h3>
            <p>Once an interview meeting is over, mark the final decision as Accepted and the candidate will appear here.</p>
          </div>
        ) : (
          <table className="data-table cand-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Vendor</th>
                <th>Requisition</th>
                <th>Match Score</th>
                <th>Interview</th>
                <th>Accepted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const cid = c.submission_id || c.id;
                const inv = interviewFor(c);
                return (
                  <tr key={cid}>
                    <td className="td-title">
                      {c.candidate_name}
                      {c.candidate_email && <div className="cand-email">{c.candidate_email}</div>}
                    </td>
                    <td className="td-company">{c.vendor_name || '—'}</td>
                    <td className="td-company">
                      {c.requisition_ref ? (
                        <div style={{ lineHeight: '1.3' }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>{c.requisition_ref}</span>
                          {c.requisition_title && <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{c.requisition_title}</div>}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: c.match_score >= 70 ? '#059669' : c.match_score >= 40 ? '#d97706' : '#dc2626' }}>
                        {c.match_score != null ? `${Math.round(c.match_score)}%` : '—'}
                      </span>
                    </td>
                    <td>
                      {inv ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                          {inv.interview_round || 'Interview'}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                    <td className="td-date">{formatDate(inv?.completed_at || c.updated_at)}</td>
                    <td className="td-action">
                      {c.requisition_id && (
                        <Link
                          to={`/dashboard/requisitions/${c.requisition_id}/candidates/${cid}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#059669', color: '#ffffff', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}
                        >
                          View Decision →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}