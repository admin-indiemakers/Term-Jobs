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
        };
      }
      map[c.requisition_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [candidates]);

  const unlinked = useMemo(() => candidates.filter((c) => !c.requisition_id), [candidates]);

  const shown = useMemo(() => {
    let list = candidates;
    if (filter === '__none__') list = candidates.filter((c) => !c.requisition_id);
    else if (filter) list = candidates.filter((c) => c.requisition_id === filter);

    const grouped = [];
    const byReq = {};
    list.forEach((c) => {
      if (!c.requisition_id) return;
      if (!byReq[c.requisition_id]) {
        byReq[c.requisition_id] = {
          req: requisitions.find((r) => r.id === c.requisition_id) || {
            id: c.requisition_id,
            ref: c.requisition_ref || `REQ-${c.requisition_id.slice(0, 6).toUpperCase()}`,
            title: c.requisition_title || 'Untitled',
          },
          candidates: [],
        };
      }
      byReq[c.requisition_id].candidates.push(c);
    });
    Object.values(byReq).forEach((g) => {
      const vendorCount = new Set(g.candidates.map((x) => x.vendor_name)).size;
      grouped.push({ type: 'req', req: g.req, count: g.candidates.length, vendorCount });
      g.candidates.forEach((c) => grouped.push({ type: 'cand', c }));
    });
    list.forEach((c) => {
      if (!c.requisition_id) grouped.push({ type: 'cand', c });
    });
    return grouped;
  }, [candidates, filter, requisitions]);

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

      <div className="glass-panel table-card">
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading candidates...</p>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <h3>No shortlisted candidates yet</h3>
            <p>Shortlisted candidates from vendor submissions will appear here.</p>
          </div>
        ) : (
          <table className="data-table cand-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Vendor</th>
                <th>Requisition</th>
                <th>Match Score</th>
                <th>Recommendation</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
{shown.map((item) =>
                item.type === 'req' ? (
                  <tr key={item.req.id} className="req-group-row">
                    <td colSpan="7" className="req-group-cell">
                      <span className="req-group-ref">{item.req.ref}</span>
                      <span className="req-group-title">{item.req.title}</span>
                      <span className="req-group-count">{item.count} shortlisted</span>
                      {item.vendorCount > 1 && (
                        <span className="req-group-vendors">{item.vendorCount} vendors competing</span>
                      )}
                      <Link to={`/dashboard/requisitions/${item.req.id}/candidates`} className="req-group-shortlist-link">📋 Review JD Candidates →</Link>
                    </td>
                  </tr>
                ) : (
                  <CandidateRow
                    key={item.c.id}
                    candidate={item.c}
                    interview={interviews.find((inv) => inv.candidate_submission_id === item.c.id || inv.candidate_name === item.c.candidate_name)}
                    expanded={expanded === item.c.id}
                    onToggle={() => setExpanded(expanded === item.c.id ? null : item.c.id)}
                    onReject={() => handleReject(item.c)}
                    onSchedule={() => setSchedulingCandidate(item.c)}
                    onViewResume={() => handleViewResume(item.c)}
                    rejecting={rejecting === item.c.id}
                    jdExpanded={jdExpanded === item.c.id}
                    onToggleJd={() => setJdExpanded(jdExpanded === item.c.id ? null : item.c.id)}
                  />
                ))}
            </tbody>
          </table>
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

function CandidateRow({ candidate: c, interview, expanded, onToggle, onReject, onSchedule, onViewResume, rejecting, jdExpanded, onToggleJd }) {
  return (
    <>
      <tr className="clickable-row" onClick={onToggle}>
        <td className="td-title">
          {c.candidate_name}
          {c.candidate_email && <div className="cand-email">{c.candidate_email}</div>}
        </td>
        <td className="td-company">{c.vendor_name || '—'}</td>
        <td className="td-company">
          {c.requisition_ref
            ? `${c.requisition_ref}${c.requisition_title ? ` · ${c.requisition_title}` : ''}`
            : <span className="muted">No requisition</span>}
        </td>
        <td style={{ minWidth: 130 }}><ScoreBar score={c.match_score} /></td>
        <td><RecommendationBadge recommendation={c.recommendation} /></td>
        <td className="td-date">{formatDate(c.created_at)}</td>
        <td className="td-action">
          <div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {interview ? (
              <span
                style={{
                  background: interview.status === 'CONFIRMED_BY_VENDOR' ? '#ecfdf5' : '#eff6ff',
                  color: interview.status === 'CONFIRMED_BY_VENDOR' ? '#059669' : '#2563eb',
                  border: interview.status === 'CONFIRMED_BY_VENDOR' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
                title={interview.status === 'CONFIRMED_BY_VENDOR' ? 'Vendor confirmed interview attendance' : 'Interview proposed to vendor'}
              >
                {interview.status === 'CONFIRMED_BY_VENDOR' ? '✓ Confirmed' : '⏳ Proposed'}
              </span>
            ) : (
              <button
                type="button"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 0,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.2)'
                }}
                onClick={(e) => { e.stopPropagation(); onSchedule(); }}
              >
                📅 Schedule
              </button>
            )}
            <span className="row-action" onClick={onToggle}>{expanded ? 'Hide' : 'Details'}</span>
            <button
              className="btn-reject"
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              disabled={rejecting}
            >
              {rejecting ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="cand-detail-row-tr">
          <td colSpan="7">
            <div className="cand-detail">
              {c.summary && <p className="cand-summary">{c.summary}</p>}
              {interview && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>📅</span>
                      <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{interview.interview_round || 'Interview Scheduled'}</strong>
                      <span style={{ background: interview.status === 'CONFIRMED_BY_VENDOR' ? '#ecfdf5' : '#fef3c7', color: interview.status === 'CONFIRMED_BY_VENDOR' ? '#059669' : '#d97706', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                        {interview.status === 'CONFIRMED_BY_VENDOR' ? 'VENDOR CONFIRMED' : 'AWAITING VENDOR CONFIRMATION'}
                      </span>
                    </div>
                    {interview.meeting_link && (
                      <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                        🎥 Open Meeting Link ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span>🕒 <strong>Slot:</strong> {interview.confirmed_slot?.date || (interview.proposed_slots && interview.proposed_slots[0]?.date)} ({interview.confirmed_slot?.start_time || (interview.proposed_slots && interview.proposed_slots[0]?.start_time)} - {interview.confirmed_slot?.end_time || (interview.proposed_slots && interview.proposed_slots[0]?.end_time)})</span>
                    <span>👤 <strong>Interviewer:</strong> {interview.interviewer_name || 'Hiring Team'}</span>
                  </div>
                  {interview.calendar_links && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>1-Click Sync:</span>
                      <a href={interview.calendar_links.google} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', textDecoration: 'none', color: '#0f172a' }}>🟢 Google</a>
                      <a href={interview.calendar_links.outlook} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', textDecoration: 'none', color: '#0f172a' }}>🔵 Outlook</a>
                      <a href={`/api/interviews/${interview.id}/invite.ics`} download style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', textDecoration: 'none', color: '#0f172a' }}>⚪ .ICS File</a>
                    </div>
                  )}
                </div>
              )}
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
                  <div
                    className="cand-jd-toggle"
                    onClick={(e) => { e.stopPropagation(); onToggleJd(); }}
                  >
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
                  <a
                    href={c.resume_pdf ? `data:application/pdf;base64,${c.resume_pdf}` : `${API_BASE_URL}/candidates/${c.id}/resume-pdf`}
                    download={c.filename || `${c.candidate_name}_resume.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.82rem',
                      padding: '6px 14px',
                      background: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: 700,
                      boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    📄 View / Download Resume PDF
                  </a>
                </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
