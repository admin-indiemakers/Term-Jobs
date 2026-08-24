import ScheduleInterviewModal from "../../components/ScheduleInterviewModal";
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request, API_BASE_URL } from '../../api/client';
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

function scoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score >= 70) return '#059669';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function ScoreBar({ score }) {
  const color = scoreColor(score);
  return (
    <div className="score-wrap">
      <div className="score-track">
        <div className="score-fill" style={{ width: `${score ?? 0}%`, background: color }}></div>
      </div>
      <span className="score-value" style={{ color }}>{score != null ? `${Math.round(score)}%` : '—'}</span>
    </div>
  );
}

function RecommendationBadge({ recommendation }) {
  const cls =
    recommendation === 'Strong Match' ? 'rec-strong' : recommendation === 'Moderate Match' ? 'rec-moderate' : 'rec-low';
  return <span className={`rec-badge ${cls}`}>{recommendation || '—'}</span>;
}

function ChipList({ label, items, tone }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="cand-detail-row">
      <span className="cand-detail-label">{label}</span>
      <div className="chips">
        {items.map((s, i) => (
          <span key={i} className={`chip ${tone}`}>{s}</span>
        ))}
      </div>

      {schedulingCandidate && (
        <ScheduleInterviewModal
          candidate={schedulingCandidate}
          onClose={() => setSchedulingCandidate(null)}
          onScheduled={() => {
            loadCandidatesAndInterviews();
          }}
        />
      )}
    </div>
  );
}

export default function ShortlistedCandidates() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [jdExpanded, setJdExpanded] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const [schedulingCandidate, setSchedulingCandidate] = useState(null);
  const [interviews, setInterviews] = useState([]);

  const loadCandidatesAndInterviews = () => {
    setLoading(true);
    Promise.all([
      request('/candidates/shortlisted', { token }),
      request('/api/interviews/company', { token }).catch(() => []),
    ])
      .then(([data, invs]) => {
        const list = Array.isArray(data) ? data : data?.shortlisted_candidates || [];
        setCandidates(list);
        setInterviews(invs || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCandidatesAndInterviews();
  }, [token]);

  const handleReject = async (c) => {
    if (!window.confirm(`Reject ${c.candidate_name}? This will remove them from the shortlist.`)) return;
    setRejecting(c.id);
    setError('');
    try {
      await request('/api/approve-candidate', {
        method: 'POST',
        token,
        body: { submission_id: c.id, action: 'reject' },
      });
      setCandidates((prev) => prev.filter((item) => item.id !== c.id));
      setExpanded(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRejecting(null);
    }
  };

  const handleViewResume = async (c) => {
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/candidates/${c.id}/resume`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          if (data && data.detail) msg = data.detail;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const requisitions = useMemo(() => {
    const map = {};
    candidates.forEach((c) => {
      if (!c.requisition_id) return;
      if (!map[c.requisition_id]) {
        map[c.requisition_id] = {
          id: c.requisition_id,
          ref: c.requisition_ref || `REQ-${c.requisition_id.slice(0, 6).toUpperCase()}`,
          title: c.requisition_title || 'Untitled',
          count: 0,
          candidates: [],
        };
      }
      map[c.requisition_id].count += 1;
      map[c.requisition_id].candidates.push({ id: c.submission_id || c.id, name: c.candidate_name, vendor: c.vendor_name || '—', score: c.match_score ?? null });
    });
    // Sort candidates within each requisition by match score (highest first)
    Object.values(map).forEach((req) => {
      req.candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [candidates]);

  const unlinked = useMemo(() => candidates.filter((c) => !c.requisition_id), [candidates]);

  const stats = useMemo(() => {
    const strong = candidates.filter((c) => c.recommendation === 'Strong Match').length;
    const moderate = candidates.filter((c) => c.recommendation === 'Moderate Match').length;
    const avg =
      candidates.length > 0
        ? candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / candidates.length
        : 0;
    return { total: candidates.length, strong, moderate, avg };
  }, [candidates]);

  return (
    <div className="page page-shortlisted">
      <WelcomeBanner title="Shortlisted Candidates" subtitle="Candidates shortlisted by your hiring managers across all requisitions.">
        <Link to="/dashboard/requisitions" className="ghost-btn-link" style={{ color: '#dbeafe', fontSize: '0.88rem' }}>
          ← Back to requisitions
        </Link>
      </WelcomeBanner>

      <div className="stat-grid">
        <StatCard label="Shortlisted" value={stats.total} icon={Icons.check} tint="tint-green" />
        <StatCard label="Strong Matches" value={stats.strong} icon={Icons.briefcase} tint="tint-blue" />
        <StatCard label="Moderate Matches" value={stats.moderate} icon={Icons.layers} tint="tint-amber" />
        <StatCard label="Avg Match Score" value={stats.avg ? Math.round(stats.avg) + '%' : '—'} icon={Icons.users} tint="tint-violet" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {requisitions.length > 1 && (
        <div className="filter-bar">
          <label className="form-label" style={{ marginBottom: 0 }}>Filter by requisition</label>
          <select className="auth-input select-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All requisitions</option>
            {requisitions.map((r) => (
              <option key={r.id} value={r.id}>{r.ref} · {r.title} ({r.count})</option>
            ))}
            {candidates.some((c) => !c.requisition_id) && <option value="__none__">No requisition linked</option>}
          </select>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading requisitions...</p>
        ) : requisitions.length === 0 ? (
          <div className="empty-state">
            <h3>No requisitions with shortlisted candidates</h3>
            <p>Shortlisted candidates from vendor submissions will appear under their respective requisitions.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {requisitions.map((reqItem) => (
              <div
                key={reqItem.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  gap: '16px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.74rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', border: '1px solid #c7d2fe' }}>
                      {reqItem.ref}
                    </span>
                    <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                      {reqItem.count} Shortlisted
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                    {reqItem.title}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                    {reqItem.count} shortlisted candidate{reqItem.count === 1 ? '' : 's'} — sorted by match score, best first.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reqItem.candidates.map((cand) => (
                    <Link
                      key={cand.id}
                      to={`/dashboard/requisitions/${reqItem.id}/candidates/${cand.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#0f172a',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                          {(cand.name || 'C').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span>{cand.name || 'Candidate'}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', fontFamily: 'monospace' }}>{cand.id}</span>
                          {cand.vendor && cand.vendor !== '—' && (
                            <span style={{ fontSize: '0.63rem', fontWeight: 600, color: '#6366f1', background: '#eef2ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #c7d2fe', display: 'inline-block', width: 'fit-content', marginTop: '2px' }}>{cand.vendor}</span>
                          )}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {cand.score != null && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            background: cand.score >= 70 ? '#ecfdf5' : cand.score >= 40 ? '#fef3c7' : '#fef2f2',
                            color: cand.score >= 70 ? '#059669' : cand.score >= 40 ? '#d97706' : '#dc2626',
                            border: `1px solid ${cand.score >= 70 ? '#a7f3d0' : cand.score >= 40 ? '#fde68a' : '#fecaca'}`,
                          }}>
                            {Math.round(cand.score)}%
                          </span>
                        )}
                        <span style={{ color: '#2563eb', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                          Open Workspace →
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>              </div>
            ))}
          </div>
        )}
      </div>

      {schedulingCandidate && (
        <ScheduleInterviewModal
          candidate={schedulingCandidate}
          onClose={() => setSchedulingCandidate(null)}
          onScheduled={() => {
            loadCandidatesAndInterviews();
          }}
        />
      )}
    </div>
  );
}

function CandidateRow({ candidate: c, interview }) {
  return (
    <tr className="clickable-row">
      <td className="td-title" style={{ whiteSpace: 'nowrap' }}>
        {c.candidate_name}
        {c.candidate_email && <div className="cand-email" style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 400 }}>{c.candidate_email}</div>}
      </td>
      <td className="td-company" style={{ whiteSpace: 'nowrap' }}>{c.vendor_name || '—'}</td>
      <td className="td-company" style={{ maxWidth: '200px' }}>
        {c.requisition_ref ? (
          <div style={{ lineHeight: '1.3' }}>
            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.80rem' }}>{c.requisition_ref}</span>
            {c.requisition_title && <div style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.requisition_title}</div>}
          </div>
        ) : (
          <span className="muted">No requisition</span>
        )}
      </td>
      <td style={{ minWidth: 140 }}><ScoreBar score={c.match_score} /></td>
      <td style={{ whiteSpace: 'nowrap' }}><RecommendationBadge recommendation={c.recommendation} /></td>
      <td className="td-date" style={{ whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
    </tr>
  );
}
