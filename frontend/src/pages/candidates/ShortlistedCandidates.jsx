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

  useEffect(() => {
    request('/candidates/shortlisted', { token })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.shortlisted_candidates || [];
        setCandidates(list);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const requisitions = useMemo(() => {
    const map = {};
    candidates.forEach((c) => {
      if (!c.requisition_id) return;
      if (!map[c.requisition_id]) {
        map[c.requisition_id] = { id: c.requisition_id, title: c.requisition_title || 'Untitled', count: 0 };
      }
      map[c.requisition_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [candidates]);

  const shown = useMemo(() => {
    if (!filter) return candidates;
    if (filter === '__none__') return candidates.filter((c) => !c.requisition_id);
    return candidates.filter((c) => c.requisition_id === filter);
  }, [candidates, filter]);

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
    <div className="page">
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
              <option key={r.id} value={r.id}>{r.title} ({r.count})</option>
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
              {shown.map((c) => (
                <CandidateRow key={c.id} candidate={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? null : c.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CandidateRow({ candidate: c, expanded, onToggle }) {
  return (
    <>
      <tr className="clickable-row" onClick={onToggle}>
        <td className="td-title">
          {c.candidate_name}
          {c.candidate_email && <div className="cand-email">{c.candidate_email}</div>}
        </td>
        <td className="td-company">{c.vendor_name || '—'}</td>
        <td className="td-company">
          {c.requisition_title || <span className="muted">No requisition</span>}
        </td>
        <td style={{ minWidth: 130 }}><ScoreBar score={c.match_score} /></td>
        <td><RecommendationBadge recommendation={c.recommendation} /></td>
        <td className="td-date">{formatDate(c.created_at)}</td>
        <td className="td-action"><span className="row-action">{expanded ? 'Hide' : 'Details'}</span></td>
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
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
