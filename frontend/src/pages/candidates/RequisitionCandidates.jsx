import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request, API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds <= 0) return '00h 00m 00s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
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

function StatusBadge({ status }) {
  const styles = {
    Screened: { background: '#eff6ff', color: '#2563eb' },
    Shortlisted: { background: '#ecfdf5', color: '#059669' },
    Rejected: { background: '#fef2f2', color: '#dc2626' },
    Accepted: { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' },
    Error: { background: '#fef2f2', color: '#dc2626' },
  };
  const s = styles[status] || { background: '#f8fafc', color: '#475569' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, ...s }}>
      {status || '—'}
    </span>
  );
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
    </div>
  );
}

export default function RequisitionCandidates() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [req, setReq] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [schedulingCandidate, setSchedulingCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [jdExpanded, setJdExpanded] = useState(false);
  const [candJdExpanded, setCandJdExpanded] = useState(null);
  const [acting, setActing] = useState(null);

  // 48-Hour Shortlist state
  const [shortlistStatus, setShortlistStatus] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [sendingInstant, setSendingInstant] = useState(false);
  const [showInstantModal, setShowInstantModal] = useState(false);
  const [instantNotes, setInstantNotes] = useState('');
  const [instantSuccess, setInstantSuccess] = useState('');

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      request(`/requisitions/${id}`, { token }).catch(() => null),
      request(`/candidates?requisition_id=${encodeURIComponent(id)}`, { token }).catch(() => []),
      request(`/api/interviews/company?requisition_id=${encodeURIComponent(id)}`, { token }).catch(() => []),
      request(`/requisitions/${id}/shortlist/status`, { token }).catch(() => null),
    ])
      .then(([reqData, candData, intRes, slStatus]) => {
        setReq(reqData);
        const list = Array.isArray(candData) ? candData : candData?.candidates || [];
        setCandidates(list);
        setInterviews(Array.isArray(intRes) ? intRes : intRes?.interviews || []);
        if (slStatus) {
          setShortlistStatus(slStatus);
          setSecondsRemaining(slStatus.seconds_remaining);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, token]);

  // Live 48-hour countdown timer
  useEffect(() => {
    if (secondsRemaining == null || secondsRemaining <= 0 || shortlistStatus?.shortlist_dispatched) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          load();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining, shortlistStatus?.shortlist_dispatched]);


  const stats = useMemo(() => {
    const byStatus = {};
    let strong = 0;
    let moderate = 0;
    let scoreSum = 0;
    candidates.forEach((c) => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      if (c.recommendation === 'Strong Match') strong += 1;
      if (c.recommendation === 'Moderate Match') moderate += 1;
      scoreSum += c.match_score ?? 0;
    });
    return {
      total: candidates.length,
      screened: byStatus.Screened || 0,
      shortlisted: byStatus.Shortlisted || 0,
      rejected: byStatus.Rejected || 0,
      strong,
      moderate,
      avg: candidates.length ? scoreSum / candidates.length : 0,
    };
  }, [candidates]);

  const act = async (c, status) => {
    const submissionId = c.submission_id || c.id;
    if (!window.confirm(`${status === 'Shortlisted' ? 'Shortlist' : 'Reject'} ${c.candidate_name || 'this candidate'}?`)) return;
    setActing(submissionId);
    setError('');
    const prevStatus = c.status;
    // Optimistically update candidate status immediately to show ? Shortlisted and disable button
    setCandidates((prev) => prev.map((item) => ((item.submission_id || item.id) === submissionId ? { ...item, status } : item)));
    setExpanded(null);
    try {
      await request(`/candidates/${submissionId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
    } catch (err) {
      // Revert on error
      setCandidates((prev) => prev.map((item) => ((item.submission_id || item.id) === submissionId ? { ...item, status: prevStatus } : item)));
      setError(err.message);
    } finally {
      setActing(null);
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

  const handleSendInstantShortlist = async (e) => {
    if (e) e.preventDefault();
    setSendingInstant(true);
    setError('');
    setInstantSuccess('');
    try {
      const res = await request(`/requisitions/${id}/shortlist/send-now`, {
        method: 'POST',
        token,
        body: { notes: instantNotes },
      });
      setInstantSuccess(res.message || 'Current candidate shortlist has been instantly dispatched to the Hiring Manager!');
      setShowInstantModal(false);
      setInstantNotes('');
      load();
    } catch (err) {
      setError(err.message || 'Failed to dispatch shortlist instantly');
    } finally {
      setSendingInstant(false);
    }
  };

  const ref = req?.ref || `REQ-${(id || '').slice(0, 6).toUpperCase()}`;

  const isDispatched = Boolean(shortlistStatus?.shortlist_dispatched || req?.shortlist_dispatched);
  const remainingSecs = secondsRemaining ?? shortlistStatus?.seconds_remaining ?? 0;
  const isExpired = remainingSecs <= 0 && !isDispatched;

  return (
    <div className="page page-shortlisted">
      <WelcomeBanner
        title={`${req?.title || 'Requisition'} — Candidates`}
        subtitle={`Review all candidates submitted against ${ref}. Shortlist the best fits or reject the rest.`}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to={`/dashboard/requisitions/${id}`} className="ghost-btn-link" style={{ color: '#dbeafe', fontSize: '0.88rem' }}>
            ← Back to requisition
          </Link>
          {req?.generated_jd_markdown && (
            <button className="ghost-btn-link" onClick={() => setJdExpanded((v) => !v)} style={{ background: 'transparent', border: '1px solid rgba(219,234,254,0.5)', color: '#dbeafe', fontSize: '0.88rem', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
              {jdExpanded ? 'Hide JD' : '📋 View JD'}
            </button>
          )}
        </div>
      </WelcomeBanner>

      {error && <div className="alert alert-error" style={{ marginTop: '14px' }}>{error}</div>}

      {instantSuccess && (
        <div style={{ marginTop: '14px', padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          <span>{instantSuccess}</span>
        </div>
      )}

      {/* 48-HOUR AUTO-SHORTLIST & INSTANT DISPATCH BANNER */}
      {isDispatched ? (
        <div
          className="glass-panel"
          style={{
            marginTop: '16px',
            padding: '18px 24px',
            background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.45) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            boxShadow: '0 8px 30px -8px rgba(0, 0, 0, 0.3)',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
                  fontSize: '22px',
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#6ee7b7',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {shortlistStatus?.shortlist_instant_sent || req?.shortlist_instant_sent ? '⚡ Instant Dispatch' : '⏱ 48h Auto-Shortlist'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 700 }}>
                    ✓ Delivered to Hiring Manager
                  </span>
                </div>
                <div style={{ fontSize: '0.92rem', color: '#f1f5f9', fontWeight: 600, marginTop: '4px' }}>
                  Shortlist of {shortlistStatus?.shortlist_candidate_count || req?.shortlist_candidate_count || stats.shortlisted || candidates.length} candidates dispatched{' '}
                  {shortlistStatus?.shortlist_dispatched_by || req?.shortlist_dispatched_by ? `by ${shortlistStatus?.shortlist_dispatched_by || req?.shortlist_dispatched_by}` : ''}{' '}
                  {shortlistStatus?.shortlist_dispatched_at || req?.shortlist_dispatched_at ? `on ${formatDate(shortlistStatus?.shortlist_dispatched_at || req?.shortlist_dispatched_at)}` : ''}.
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowInstantModal(true)}
                disabled={sendingInstant}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#a7f3d0',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>⚡</span>
                <span>Re-Send Shortlist Update</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            marginTop: '16px',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.94) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
                  fontSize: '22px',
                }}
              >
                ⏱
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#60a5fa',
                      background: 'rgba(37, 99, 235, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    48h Auto-Shortlist Window
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {isExpired ? 'Window closed — awaiting automatic compilation' : 'Automatic delivery to Hiring Manager once timer expires'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.05em' }}>
                    {formatCountdown(remainingSecs)}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {isExpired ? 'Window reached' : 'remaining before automated delivery'}
                  </span>
                </div>
              </div>
            </div>

            {/* Instant Send Button (Before 48h) - Admin Only */}
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowInstantModal(true)}
                  disabled={sendingInstant || candidates.length === 0}
                  style={{
                    background: candidates.length === 0 ? 'rgba(71, 85, 105, 0.5)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid rgba(251, 191, 36, 0.5)',
                    boxShadow: candidates.length === 0 ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.35)',
                    cursor: candidates.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease-in-out',
                  }}
                  title={candidates.length === 0 ? 'Submit or screen candidates first' : 'Dispatch current candidate shortlist right now before the 48h window'}
                >
                  <span style={{ fontSize: '1.05rem' }}>⚡</span>
                  <span>Send Shortlist Now (Instant)</span>
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  color: '#cbd5e1',
                  fontWeight: 600,
                }}
              >
                <span style={{ color: '#fbbf24', fontSize: '1rem' }}>⚡</span>
                <span>Super Admin is screening candidates. Shortlisted profiles will arrive automatically.</span>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.8rem',
              color: '#94a3b8',
            }}
          >
            <div>
              Current Sourced Pool: <strong style={{ color: '#ffffff' }}>{candidates.length} candidate(s)</strong>
              {' '}(<span style={{ color: '#93c5fd' }}>{stats.screened} screened</span>, <span style={{ color: '#86efac' }}>{stats.shortlisted} shortlisted</span>)
            </div>
            <div>
              Auto-Dispatch Deadline: <strong style={{ color: '#ffffff' }}>{formatDate(shortlistStatus?.shortlist_deadline || req?.shortlist_deadline)}</strong>
            </div>
          </div>
        </div>
      )}

      {req?.generated_jd_markdown && jdExpanded && (
        <div className="glass-panel" style={{ marginTop: '16px' }}>
          <div className="shortlist-head">
            <h3 className="card-title">📋 Job Description — {ref}</h3>
            <span className="muted">{req?.title}</span>
          </div>
          <pre className="cand-jd-text" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.6, color: '#334155', marginTop: '12px' }}>
            {req.generated_jd_markdown}
          </pre>
        </div>
      )}

      <div className="stat-grid" style={{ marginTop: '16px' }}>
        <StatCard label="Total Candidates" value={stats.total} icon={Icons.users} tint="tint-blue" />
        <StatCard label="Screened" value={stats.screened} icon={Icons.layers} tint="tint-violet" />
        <StatCard label="Shortlisted" value={stats.shortlisted} icon={Icons.check} tint="tint-green" />
        <StatCard label="Avg Match Score" value={stats.avg ? `${Math.round(stats.avg)}%` : '—'} icon={Icons.briefcase} tint="tint-amber" />
      </div>

      <div className="glass-panel table-card" style={{ marginTop: '20px' }}>
        <div className="shortlist-head">
          <h3 className="card-title">Candidates for {ref}</h3>
          <span className="muted">{stats.total} total · {stats.shortlisted} shortlisted · {stats.rejected} rejected</span>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading candidates...</p>
        ) : candidates.length === 0 ? (
          <div className="empty-state">
            <h3>No candidates submitted yet</h3>
            <p>Once vendors screen resumes against this JD, screened candidates will appear here for your review.</p>
          </div>
        ) : (
          <table className="data-table cand-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Match Score</th>
                <th>Recommendation</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const cid = c.submission_id || c.id;
                const isExpanded = expanded === cid;
                const isActing = acting === cid;
                const interview = interviews.find((inv) => inv.candidate_submission_id === cid || inv.candidate_name === c.candidate_name);
                return (
                  <CandidateRow
                    key={cid}
                    candidate={c}
                    interview={interview}
                    expanded={isExpanded}
                    onToggle={() => setExpanded(isExpanded ? null : cid)}
                    onShortlist={() => act(c, 'Shortlisted')}
                    onReject={() => act(c, 'Rejected')}
                    onSchedule={() => setSchedulingCandidate(c)}
                    scheduleUrl={c.status === 'Shortlisted' ? `/dashboard/requisitions/${id}/candidates/${cid}` : null}
                    onViewResume={() => handleViewResume(c)}
                    acting={isActing}
                    canShortlist={c.status !== 'Shortlisted' && c.status !== 'Error'}
                    canReject={c.status !== 'Rejected' && c.status !== 'Error'}
                    jdExpanded={candJdExpanded === cid}
                    onToggleJd={() => setCandJdExpanded(candJdExpanded === cid ? null : cid)}
                    isReadOnly={user?.role === 'Director'}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {schedulingCandidate && (
        <ScheduleInterviewModal
          candidate={schedulingCandidate}
          onClose={() => setSchedulingCandidate(null)}
          onScheduled={() => {
            load();
          }}
        />
      )}

      {/* INSTANT SHORTLIST DISPATCH MODAL (BEFORE 48H) */}
      {showInstantModal && (
        <div className="modal-overlay" onClick={() => setShowInstantModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '92%',
              background: '#ffffff',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 900 }}>
                  ⚡
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Send Shortlist Now (Instant)
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Bypass 48-hour sourcing countdown & dispatch current list
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstantModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.55, marginBottom: '16px' }}>
              Dispatch the current candidate pool for <strong>{ref} ({req?.title})</strong> directly to the Hiring Manager right now.
              Screened candidates will be promoted to <strong>Shortlisted</strong>, and instant in-app and email notifications will be delivered.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Shortlist Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                <div style={{ background: '#ffffff', padding: '10px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>{candidates.length}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total Sourced</div>
                </div>
                <div style={{ background: '#ffffff', padding: '10px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#2563eb' }}>{stats.screened + stats.shortlisted}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Ready to Send</div>
                </div>
                <div style={{ background: '#ffffff', padding: '10px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#059669' }}>{stats.avg ? `${Math.round(stats.avg)}%` : '—'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Avg Match</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSendInstantShortlist}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#334155', marginBottom: '6px' }}>
                  Note for Hiring Manager (Optional)
                </label>
                <textarea
                  rows="3"
                  value={instantNotes}
                  onChange={(e) => setInstantNotes(e.target.value)}
                  placeholder="e.g. Qualified candidates sourced ahead of schedule. Top candidates are available for Round 1 interviews this week."
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.84rem', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'vertical', background: '#f8fafc', color: '#0f172a', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowInstantModal(false)}
                  disabled={sendingInstant}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInstant || candidates.length === 0}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: candidates.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>⚡</span>
                  <span>{sendingInstant ? 'Dispatching Shortlist...' : 'Confirm & Dispatch Shortlist Now'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


function CandidateRow({ candidate: c, interview, expanded, onToggle, onShortlist, onReject, onSchedule, onViewResume, acting, canShortlist, canReject, jdExpanded, onToggleJd, isReadOnly, scheduleUrl }) {
  return (
    <>
      <tr className="clickable-row" onClick={onToggle}>
        <td className="td-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{c.candidate_name}</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{c.submission_id || c.id}</span>
          </div>
          {c.candidate_email && <div className="cand-email">{c.candidate_email}</div>}
        </td>
        <td className="td-company">{c.vendor_name || '—'}</td>
        <td><StatusBadge status={c.status} /></td>
        <td style={{ minWidth: 130 }}><ScoreBar score={c.match_score} /></td>
        <td><RecommendationBadge recommendation={c.recommendation} /></td>
        <td className="td-date">{formatDate(c.created_at)}</td>
        <td className="td-action">
          <div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
            <span className="row-action" onClick={onToggle}>{expanded ? 'Hide' : 'Details'}</span>
            {!isReadOnly && (
              <>
                {c.status === 'Shortlisted' && scheduleUrl && (
                  <Link
                    to={scheduleUrl}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: interview?.status === 'COMPLETED' ? '#f8fafc' : interview?.status === 'CONFIRMED_BY_VENDOR' ? '#ecfdf5' : '#eff6ff',
                      color: interview?.status === 'COMPLETED' ? '#475569' : interview?.status === 'CONFIRMED_BY_VENDOR' ? '#059669' : '#2563eb',
                      border: interview?.status === 'COMPLETED' ? '1px solid #cbd5e1' : interview?.status === 'CONFIRMED_BY_VENDOR' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Open the interview workspace — schedule, meeting link, and final decision"
                  >
                    {interview?.status === 'COMPLETED'
                      ? `🏁 ${interview.decision || 'Done'}`
                      : interview?.status === 'CONFIRMED_BY_VENDOR'
                        ? '✓ Confirmed'
                        : interview
                          ? '⏳ Proposed'
                          : '📅 Schedule'}
                  </Link>
                )}
                {canShortlist && (
                  <button
                    className="btn-shortlist"
                    onClick={(e) => { e.stopPropagation(); onShortlist(); }}
                    disabled={acting}
                  >
                    {acting ? 'Saving…' : 'Shortlist'}
                  </button>
                )}
                {canReject && (
                  <button
                    className="btn-reject"
                    onClick={(e) => { e.stopPropagation(); onReject(); }}
                    disabled={acting}
                  >
                    {acting ? 'Saving…' : 'Reject'}
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="cand-detail-row-tr">
          <td colSpan="7">
            <div className="cand-detail">
              {c.summary && <p className="cand-summary">{c.summary}</p>}
              <div className="cand-detail-grid">
                <ChipList label="Matched skills" items={c.matched_skills} tone="chip-primary" />
                <ChipList label="Missing skills" items={c.missing_skills} tone="chip-neutral" />
              </div>
              {c.hiring_manager_notes && (
                <div className="cand-detail-row">
                  <span className="cand-detail-label">Hiring manager notes</span>
                  <span>{c.hiring_manager_notes}</span>
                </div>
              )}
              {c.resume_text && (
                <div className="cand-detail-row">
                  <span className="cand-detail-label">Resume</span>
                  <pre className="cand-resume">{c.resume_text}</pre>
                </div>
              )}
              <div className="cand-jd-block">
                <div className="cand-jd-toggle" onClick={(e) => { e.stopPropagation(); onToggleJd(); }}>
                  <span>📋 JD Applied</span>
                  <span className="row-action">{jdExpanded ? 'Hide' : 'View'}</span>
                </div>
                {jdExpanded && (
                  <pre className="cand-jd-text">{c.jd_text || 'No JD recorded for this submission.'}</pre>
                )}
              </div>
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
                  📁 File: <strong>{c.filename || 'resume.pdf'}</strong>
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-secondary-sm"
                    onClick={(e) => { e.stopPropagation(); onViewResume(); }}
                    style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '8px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 700 }}
                  >
                    👁 View Resume
                  </button>
                  <a
                    href={c.resume_pdf ? `data:application/pdf;base64,${c.resume_pdf}` : `${API_BASE_URL}/candidates/${c.id}/resume-pdf`}
                    download={c.filename || `${c.candidate_name}_resume.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px', background: '#2563eb', color: '#ffffff', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    📄 Download Resume PDF
                  </a>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
