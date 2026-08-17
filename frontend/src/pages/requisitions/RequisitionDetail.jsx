import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import RequisitionEditor from '../../components/RequisitionEditor';
import JdPreview from '../../components/JdPreview';

const STATE_STEPS = ['Draft', 'Intake', 'Structuring', 'PendingApproval', 'Published', 'Closed'];
const NORMALIZED = {
  Draft: 'Draft',
  Intake: 'Intake',
  Structuring: 'Structuring',
  PendingApproval: 'PendingApproval',
  Published: 'Published',
  Closed: 'Closed',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [answer, setAnswer] = useState('');
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftRole, setDraftRole] = useState(null);
  const [busy, setBusy] = useState('');
  const [info, setInfo] = useState('');
  const [shortlisted, setShortlisted] = useState([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);

  const load = () => {
    setLoading(true);
    request(`/requisitions/${id}`, { token })
      .then((data) => {
        setReq(data);
        const role = data.structured_role ? { ...data.structured_role } : null;
        if (role && !role.hiring_manager && user?.name) role.hiring_manager = user.name;
        setDraftRole(role);
        setEditing(false);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, token, user?.name]);

  useEffect(() => {
    setShortlistLoading(true);
    request(`/api/candidates/shortlisted?requisition_id=${encodeURIComponent(id)}`, { token })
      .then((data) => setShortlisted(data?.shortlisted_candidates || data || []))
      .catch(() => setShortlisted([]))
      .finally(() => setShortlistLoading(false));
  }, [id, token]);

  const run = async (path, method, body) => {
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${id}${path}`, { method, body, token });
      load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const handleStart = async () => {
    setBusy('start');
    const ok = await run('/start', 'POST');
    if (ok) setInfo('Agent started.');
    setBusy('');
  };

  const handleAnswer = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy('answer');
    const ok = await run('/answer', 'POST', { answer: answer.trim() });
    if (ok) setAnswer('');
    setBusy('');
  };

  const handleRefine = async (e) => {
    e.preventDefault();
    if (!instruction.trim()) return;
    setBusy('refine');
    const ok = await run('/refine', 'POST', { instruction: instruction.trim() });
    if (ok) setInstruction('');
    setBusy('');
  };

  const handleApprove = async () => {
    setBusy('approve');
    const body = {};
    if (editing && draftRole) {
      const normPair = (arr) =>
        arr && arr[0] != null && arr[1] != null ? [arr[0], arr[1]] : null;
      body.edited_role = {
        ...draftRole,
        rate_band: normPair(draftRole.rate_band),
        range_vendors_see: normPair(draftRole.range_vendors_see),
      };
    }
    const ok = await run('/approve', 'POST', { ...body, reviewer: user.id });
    if (ok) setInfo('Role approved.');
    setBusy('');
  };

  const handleReject = async () => {
    setBusy('reject');
    const ok = await run('/reject', 'POST', { reviewer: user.id });
    if (ok) setInfo('Role rejected — moved back to Draft.');
    setBusy('');
  };

  const handlePublish = async () => {
    setBusy('publish');
    const ok = await run('/publish', 'POST', { by: user.id });
    if (ok) setInfo('Requisition published.');
    setBusy('');
  };

  const handleClose = async () => {
    setBusy('close');
    const ok = await run('/close', 'POST');
    if (ok) setInfo('Requisition closed.');
    setBusy('');
  };

  const handleReset = async () => {
    setBusy('reset');
    const ok = await run('/reset', 'POST');
    if (ok) setInfo('Requisition reset to Draft.');
    setBusy('');
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this requisition and its decision records permanently?')) return;
    setBusy('delete');
    try {
      await request(`/requisitions/${id}`, { method: 'DELETE', token });
      const section = req?.status === 'Closed' ? 'completed' : req?.status === 'Published' ? 'published' : 'drafted';
      navigate(`/dashboard/requisitions/${section}`);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  if (loading) return <p className="muted">Loading requisition...</p>;
  if (error && !req) return <div className="alert alert-error">{error}</div>;
  if (!req) return <p className="muted">Requisition not found.</p>;

  const status = req.status || 'Draft';
  const normStatus = NORMALIZED[status] || status;
  const currentStep = STATE_STEPS.indexOf(normStatus);
  const coverage = req.coverage_result;
  const canShowReview = (req.structured_role || req.generated_jd_markdown) && ['Structuring', 'PendingApproval', 'Published', 'Closed'].includes(normStatus);
  const isReadOnly = user.role === 'Director';

  const intakeMeta = req.intake_meta || {};
  const sourceLabel = intakeMeta.source_filename
    ? intakeMeta.source_filename
    : intakeMeta.background_profile_id || intakeMeta.reference_documents?.length || intakeMeta.context_notes
      ? 'Company Background sources'
      : null;

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <div className="detail-title-row">
            <h1 className="page-title">
              <span className="req-ref-pill">{req.ref || `REQ-${(id || '').slice(0, 6).toUpperCase()}`}</span>
              {req.title || 'Untitled Requisition'}
            </h1>
            <StatusBadge status={normStatus} />
          </div>
          <p className="page-subtitle">
            {req.company?.name || 'Company'} · Created {formatDate(req.created_at)}
          </p>
        </div>
        <Link to="/dashboard/requisitions/drafted" className="ghost-btn-link">← Back to list</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {info && <div className="alert alert-success">{info}</div>}

      {isReadOnly && (
        <div className="alert" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#fbbf24' }}>
          Read-only view — Directors can review requisitions but cannot make changes.
        </div>
      )}

      <div className="glass-panel timeline-card">
        <div className="timeline">
          {STATE_STEPS.map((step, i) => (
            <div key={step} className={`timeline-step ${i <= currentStep ? 'done' : ''} ${i === currentStep ? 'current' : ''}`}>
              <div className="timeline-dot"></div>
              <span className="timeline-label">{NORMALIZED[step] === 'PendingApproval' ? 'Pending Approval' : step}</span>
            </div>
          ))}
        </div>
      </div>

      {coverage && normStatus === 'Intake' && (
        <div className="glass-panel info-card">
          <h3 className="card-title">Coverage check</h3>
          <p>
            {coverage.covered
              ? 'The requested stack is covered by your company profile — no intake needed.'
              : 'Some skills are outside your registered stack. Answer the intake questions to complete the role.'}
          </p>
          {!coverage.covered && coverage.missing_skills?.length > 0 && (
            <div className="chips">
              {coverage.missing_skills.map((s, i) => (
                <span key={i} className="chip chip-amber">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {!isReadOnly && normStatus === 'Draft' && (
        <div className="glass-panel action-card">
          <h3 className="card-title">Run the Job Requirement Agent</h3>
          <p className="card-text">
            The agent will analyse this role against your company profile, ask targeted questions if needed, and generate a structured role plus a ready-to-publish JD for your review.
          </p>
          <button className="glow-btn" onClick={handleStart} disabled={busy === 'start'}>
            {busy === 'start' ? 'Running...' : 'Run Agent'}
          </button>
        </div>
      )}

      {!isReadOnly && normStatus === 'Intake' && (
        <div className="glass-panel action-card">
          <div className="assistant-head">
            <span className="assistant-avatar">AI</span>
            <span className="assistant-name">Job Requirement Agent</span>
          </div>
          {req.pending_question ? (
            <>
              <p className="question-text">{req.pending_question}</p>
              <form onSubmit={handleAnswer} className="answer-form">
                <input
                  className="auth-input"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={busy === 'answer'}
                  autoFocus
                />
                <button type="submit" className="glow-btn" disabled={busy === 'answer' || !answer.trim()}>
                  {busy === 'answer' ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <p className="card-text">Processing your answers — one moment.</p>
          )}
        </div>
      )}

      {!isReadOnly && normStatus === 'Structuring' && (
        <div className="glass-panel action-card">
          <h3 className="card-title">Review the generated role</h3>
          <p className="card-text">The AI has drafted a structured role and JD. Edit before approving, or request a refinement.</p>
          <div className="refine-form">
            <input
              className="auth-input"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Add AWS experience, change rate band to 18–24 LPA"
            />
            <button className="ghost-btn" onClick={handleRefine} disabled={busy === 'refine' || !instruction.trim()}>
              {busy === 'refine' ? 'Refining...' : 'Refine'}
            </button>
          </div>
          <div className="approval-actions">
            <button className="danger-btn" onClick={handleReject} disabled={busy === 'reject'}>
              Reject
            </button>
            <button className="glow-btn" onClick={handleApprove} disabled={busy === 'approve'}>
              {busy === 'approve' ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      )}

      {!isReadOnly && normStatus === 'PendingApproval' && (
        <div className="glass-panel action-card">
          <h3 className="card-title">Approved — ready to publish</h3>
          <p className="card-text">Publish this requisition to share it with your consultancy partners.</p>
          <div className="approval-actions">
            <button className="danger-btn" onClick={handleReject} disabled={busy === 'reject'}>
              Reject
            </button>
            <button className="glow-btn" onClick={handlePublish} disabled={busy === 'publish'}>
              {busy === 'publish' ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {!isReadOnly && normStatus === 'Published' && (
        <div className="glass-panel action-card">
          <h3 className="card-title">Published</h3>
          <p className="card-text">This requisition is live. Close it when the position is filled.</p>
          <button className="glow-btn" onClick={handleClose} disabled={busy === 'close'}>
            {busy === 'close' ? 'Closing...' : 'Close Requisition'}
          </button>
        </div>
      )}

      {!isReadOnly && normStatus === 'Closed' && (
        <div className="glass-panel action-card">
          <h3 className="card-title">Closed</h3>
          <p className="card-text">This requisition is finished. Reset to draft to re-run the flow.</p>
          <div className="approval-actions">
            <button className="danger-btn" onClick={handleDelete} disabled={busy === 'delete'}>
              Delete
            </button>
            <button className="glow-btn" onClick={handleReset} disabled={busy === 'reset'}>
              {busy === 'reset' ? 'Resetting...' : 'Reset to Draft'}
            </button>
          </div>
        </div>
      )}

      {canShowReview && (
        <div className="glass-panel review-card">
          <div className="review-tabs">
            <span className="review-tab active">Structured Role</span>
            <span className="review-tab">Job Description</span>
          </div>

          <div className="editor-panel">
            <RequisitionEditor
              role={draftRole}
              editable={normStatus === 'Structuring' && !isReadOnly}
              onChange={setDraftRole}
              sourceLabel={sourceLabel}
              onReplace={() => setInfo('Replace sources from the New Requisition intake screen.')}
            />
          </div>

          <div className="jd-section">
            <h3 className="card-title">Generated JD</h3>
            <JdPreview markdown={req.generated_jd_markdown} />
          </div>
        </div>
      )}

      {req.refinement_log?.length > 0 && (
        <div className="glass-panel">
          <h3 className="card-title">Refinement history</h3>
          <ul className="log-list">
            {req.refinement_log.map((entry, i) => (
              <li key={i} className="log-item">
                <span className="log-index">{i + 1}.</span>
                {entry.instruction}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-panel">
        <div className="shortlist-head">
          <h3 className="card-title">Shortlisted Candidates</h3>
          <span className="muted">{req.ref || `REQ-${(id || '').slice(0, 6).toUpperCase()}`}</span>
        </div>
        {shortlistLoading ? (
          <p className="muted" style={{ padding: 12 }}>Loading shortlisted candidates...</p>
        ) : shortlisted.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>No shortlisted candidates for this requisition yet.</p>
        ) : (
          <div className="shortlist-list">
            {shortlisted.map((c) => (
              <div key={c.submission_id || c.id} className="shortlist-item">
                <div className="shortlist-item-main">
                  <span className="shortlist-name">{c.candidate_name || 'Candidate'}</span>
                  <span className="muted">{c.vendor_name || 'Vendor A'}</span>
                </div>
                <span className="chip chip-primary">
                  {c.match_score != null ? `${Math.round(c.match_score)}% match` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
