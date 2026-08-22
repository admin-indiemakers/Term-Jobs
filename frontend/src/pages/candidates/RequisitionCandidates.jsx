import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request, API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';

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

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      request(`/requisitions/${id}`, { token }).catch(() => null),
      request(`/candidates?requisition_id=${encodeURIComponent(id)}`, { token }).catch(() => []),
      request(`/api/interviews/company?requisition_id=${encodeURIComponent(id)}`, { token }).catch(() => []),
    ])
      .then(([reqData, candData, intRes]) => {
        setReq(reqData);
        const list = Array.isArray(candData) ? candData : candData?.candidates || [];
        setCandidates(list);
        setInterviews(Array.isArray(intRes) ? intRes : intRes?.interviews || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, token]);

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
    try {
      await request(`/candidates/${submissionId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      setCandidates((prev) => prev.map((item) => ((item.submission_id || item.id) === submissionId ? { ...item, status } : item)));
      setExpanded(null);
    } catch (err) {
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

  const ref = req?.ref || `REQ-${(id || '').slice(0, 6).toUpperCase()}`;

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

      {error && <div className="alert alert-error">{error}</div>}

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
