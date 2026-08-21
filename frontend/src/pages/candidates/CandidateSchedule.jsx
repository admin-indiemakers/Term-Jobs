import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';

const INK = '#0a0a0a';
const PAPER = '#ffffff';
const LINE = '#e5e5e5';
const LINE_STRONG = '#d4d4d4';
const MUTED = '#737373';
const FAINT = '#fafafa';
const GHOST = '#f5f5f5';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatSlot(slot) {
  if (!slot) return '—';
  const date = slot.date ? formatDate(slot.date) : '—';
  return `${date} · ${slot.start_time || '--:--'} – ${slot.end_time || '--:--'} ${slot.timezone || ''}`.trim();
}

const STATUS_META = {
  PROPOSED_BY_COMPANY: { label: 'Proposed', hint: 'Schedule sent to the vendor — awaiting slot confirmation.' },
  CONFIRMED_BY_VENDOR: { label: 'Confirmed', hint: 'Vendor confirmed the interview slot — meeting is locked in.' },
  RESCHEDULE_REQUESTED: { label: 'Reschedule Requested', hint: 'Vendor requested an alternate slot.' },
  CANCELLED: { label: 'Cancelled', hint: 'This interview was cancelled.' },
  COMPLETED: { label: 'Meeting Over', hint: 'The meeting is over — record the final decision.' },
};

const PIPELINE = [
  { key: 'Screened', label: 'Screened' },
  { key: 'Shortlisted', label: 'Shortlisted' },
  { key: 'Proposed', label: 'Proposed' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Meeting', label: 'Meeting Over' },
  { key: 'Decision', label: 'Decision' },
];

function pipelineIndex(candidate, interview) {
  if (interview?.status === 'COMPLETED') return interview.decision ? 5 : 4;
  if (interview?.status === 'CONFIRMED_BY_VENDOR') return 3;
  if (interview?.status && interview.status !== 'CANCELLED') return 2;
  if (candidate?.status === 'Shortlisted') return 1;
  return 0;
}

function PipelineBar({ candidate, interview, decision }) {
  const idx = pipelineIndex(candidate, interview);
  const pct = Math.round((idx / (PIPELINE.length - 1)) * 100);
  const label = decision
    ? `${decision}`
    : STATUS_META[interview?.status]?.label || candidate?.status || 'Screened';

  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '20px', padding: '26px 30px 28px', boxShadow: '0 1px 2px rgba(10,10,10,0.04), 0 12px 32px -16px rgba(10,10,10,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '5px' }}>Candidate Pipeline</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>Hiring Progress</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: decision ? INK : GHOST, color: decision ? PAPER : INK, border: decision ? `1px solid ${INK}` : `1px solid ${LINE}`, padding: '7px 16px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em' }}>
            {decision ? (decision === 'Accepted' ? '✓' : '✕') : '●'} {label}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: MUTED, background: PAPER, border: `1px solid ${LINE_STRONG}`, padding: '7px 14px', borderRadius: '999px', letterSpacing: '0.04em' }}>
            {pct}%
          </span>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {PIPELINE.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          const reached = i <= idx;
          return (
            <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {i > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '17px',
                  left: 'calc(-50% + 18px)',
                  width: 'calc(100% - 36px)',
                  height: '3px',
                  background: reached ? INK : GHOST,
                  zIndex: 0,
                  transition: 'background 0.25s ease',
                }} />
              )}
              <div style={{
                position: 'relative',
                zIndex: 1,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: done || active ? INK : PAPER,
                border: done || active ? `2px solid ${INK}` : `2px solid ${LINE_STRONG}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: done || active ? PAPER : MUTED,
                boxShadow: active ? '0 0 0 6px rgba(10,10,10,0.07)' : 'none',
                transition: 'all 0.2s ease',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{
                marginTop: '12px',
                fontSize: active ? '0.78rem' : '0.72rem',
                fontWeight: active ? 800 : 700,
                color: active || done ? INK : MUTED,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
                transition: 'all 0.2s ease',
              }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingStatus({ status }) {
  const meta = STATUS_META[status] || { label: status || '—' };
  const solid = status === 'CONFIRMED_BY_VENDOR' || status === 'COMPLETED';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: solid ? INK : PAPER,
      color: solid ? PAPER : INK,
      border: solid ? `1px solid ${INK}` : `1px solid ${LINE_STRONG}`,
      padding: '6px 14px',
      borderRadius: '999px',
      fontSize: '0.76rem',
      fontWeight: 800,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: solid ? PAPER : INK }} />
      {meta.label}
    </span>
  );
}

function InfoRow({ label, children }) {
  return (
    <div style={{ padding: '13px 0', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
      <span style={{ fontSize: '0.66rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ fontSize: '0.88rem', color: INK, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

function ScoreBar({ score }) {
  const width = Math.min(100, Math.max(0, score ?? 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1, height: '8px', background: GHOST, overflow: 'hidden', borderRadius: '999px' }}>
        <div style={{ width: `${width}%`, height: '100%', background: INK, borderRadius: '999px', transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '1rem', fontWeight: 800, color: INK, minWidth: '46px', textAlign: 'right', letterSpacing: '-0.01em' }}>
        {score != null ? `${Math.round(score)}%` : '—'}
      </span>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: '0.66rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '14px', ...style }}>
      {children}
    </div>
  );
}

export default function CandidateSchedule() {
  const { reqId, candidateId } = useParams();
  const { token, user } = useAuth();
  const [candidate, setCandidate] = useState(null);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState('Accepted');
  const [remark, setRemark] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingDecision, setEditingDecision] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const isReadOnly = user?.role === 'Director';

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      request(`/candidates/${candidateId}`, { token }).catch(() => null),
      request(`/api/interviews/company?candidate_submission_id=${encodeURIComponent(candidateId)}`, { token }).catch(() => []),
    ])
      .then(([cand, invs]) => {
        setCandidate(cand);
        setInterview(Array.isArray(invs) ? invs[0] || null : null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [candidateId, token]);

  const meetingLink = interview?.meeting_link || interview?.calendar_links?.cal_booking_url || '';
  const isOver = interview?.status === 'COMPLETED';
  const recordedDecision = isOver ? interview?.decision || '' : '';

  const copyLink = () => {
    if (!meetingLink) return;
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleComplete = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (interview) {
        // Interview exists — record decision via the interview complete endpoint
        const res = await request(`/api/interviews/${interview.id}/complete`, {
          method: 'POST',
          token,
          body: { final_remark: remark, decision },
        });
        setInterview(res);
      } else {
        // No interview — directly update candidate status via PATCH
        const newStatus = decision === 'Accepted' ? 'Accepted' : 'Rejected';
        await request(`/candidates/${candidateId}/status`, {
          method: 'PATCH',
          token,
          body: { status: newStatus },
        });
      }
      setEditingDecision(false);
      // Refetch candidate data so the updated status (Accepted/Rejected) is reflected
      try {
        const updatedCandidate = await request(`/candidates/${candidateId}`, { token });
        if (updatedCandidate) setCandidate(updatedCandidate);
      } catch (_) {
        // Candidate fetch failed; decision update succeeded so this is non-critical
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const ref = candidate?.requisition_ref || `REQ-${(reqId || '').slice(0, 6).toUpperCase()}`;

  const stats = useMemo(() => {
    const score = candidate?.match_score ?? null;
    return {
      match: score,
      shortlisted: candidate?.status === 'Shortlisted' || candidate?.status === 'Accepted',
      confirmed: interview?.status === 'CONFIRMED_BY_VENDOR',
      accepted: interview?.decision === 'Accepted',
    };
  }, [candidate, interview]);

  return (
    <div className="page page-shortlisted" style={{ background: PAPER }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', padding: '8px 0 24px 0', borderBottom: `1px solid ${LINE}` }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '10px' }}>
            {ref} · Interview Workspace
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: INK, margin: 0, letterSpacing: '-0.02em' }}>
            {candidate?.candidate_name || 'Candidate'}
          </h1>
          <div style={{ fontSize: '0.92rem', color: MUTED, fontWeight: 500, marginTop: '6px' }}>
            {candidate?.requisition_title || 'Role'} · {candidate?.candidate_email || ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {candidate?.status === 'Accepted' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: INK, color: PAPER, padding: '7px 16px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em' }}>
              ✓ ACCEPTED
            </span>
          )}
          <Link
            to={`/dashboard/requisitions/${reqId}/candidates`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: PAPER, border: `1px solid ${LINE_STRONG}`, color: INK, padding: '8px 16px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}
          >
            ← Back
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: PAPER, border: `1px solid ${LINE_STRONG}`, color: INK, padding: '12px 16px', borderRadius: '12px', fontSize: '0.86rem', fontWeight: 600, marginTop: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: MUTED, padding: 32, fontSize: '0.9rem' }}>Loading schedule…</p>
      ) : (
        <>
          {/* Pipeline */}
          <div style={{ marginTop: '24px' }}>
            <PipelineBar candidate={candidate} interview={interview} decision={recordedDecision} />
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '16px' }} className="cs-stats">
            {[
              { label: 'Match Score', value: stats.match != null ? `${Math.round(stats.match)}%` : '—' },
              { label: 'Status', value: candidate?.status || '—' },
              { label: 'Interview', value: stats.confirmed ? 'Confirmed' : interview ? STATUS_META[interview.status]?.label || interview.status : 'Not scheduled' },
              { label: 'Decision', value: stats.accepted ? 'Accepted' : recordedDecision === 'Rejected' ? 'Rejected' : 'Pending' },
            ].map((s) => (
              <div key={s.label} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '16px', padding: '18px 20px' }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>{s.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Candidate + Meeting */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: '16px', marginTop: '16px' }} className="cs-grid">
            {/* Left: Candidate */}
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '20px', padding: '26px 28px' }}>
              <SectionLabel>Candidate Profile</SectionLabel>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>{candidate?.candidate_name || 'Candidate'}</div>
                  <div style={{ fontSize: '0.84rem', color: MUTED }}>{candidate?.candidate_email || ''}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', background: GHOST, border: `1px solid ${LINE}`, color: INK }}>
                  {candidate?.status || '—'}
                </span>
              </div>

              <div style={{ background: GHOST, border: `1px solid ${LINE}`, borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                <SectionLabel style={{ marginBottom: '10px' }}>Match Score vs JD</SectionLabel>
                <ScoreBar score={candidate?.match_score} />
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '0.74rem', color: MUTED, fontWeight: 700 }}>Recommendation</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: INK }}>{candidate?.recommendation || '—'}</span>
                </div>
              </div>

              <div style={{ fontSize: '0.88rem', color: '#3a3a3a', lineHeight: '1.7', marginBottom: '12px' }}>
                {candidate?.summary || 'No AI summary recorded for this submission.'}
              </div>

              <InfoRow label="Vendor">{candidate?.vendor_name || '—'}</InfoRow>
              <InfoRow label="Submitted">{formatDate(candidate?.created_at)}</InfoRow>
              <InfoRow label="Requisition">{ref}</InfoRow>
              <InfoRow label="Role">{candidate?.requisition_title || '—'}</InfoRow>
              {candidate?.matched_skills?.length > 0 && (
                <InfoRow label="Matched skills">
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {candidate.matched_skills.map((s, i) => (
                      <span key={i} style={{ background: GHOST, color: INK, padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${LINE}` }}>{s}</span>
                    ))}
                  </div>
                </InfoRow>
              )}
              {candidate?.missing_skills?.length > 0 && (
                <InfoRow label="Missing skills">
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {candidate.missing_skills.map((s, i) => (
                      <span key={i} style={{ background: PAPER, color: MUTED, padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${LINE}` }}>{s}</span>
                    ))}
                  </div>
                </InfoRow>
              )}
            </div>

            {/* Right: Meeting */}
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '20px', padding: '26px 28px' }}>
              {!interview ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📅</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: INK, margin: '0 0 8px 0' }}>No meeting scheduled yet</h3>
                  <p style={{ fontSize: '0.86rem', color: MUTED, margin: '0 0 18px 0' }}>
                    This candidate has not been scheduled for an interview. Dispatch a schedule proposal to the vendor.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: INK, color: PAPER, padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', border: 0 }}
                  >
                    📅 Schedule interview
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: INK, margin: 0, letterSpacing: '-0.01em' }}>{interview.interview_round || 'Interview'}</h3>
                    <MeetingStatus status={interview.status} />
                  </div>
                  <p style={{ fontSize: '0.82rem', color: MUTED, margin: '0 0 ' + (isOver ? '8px' : '16px') + ' 0' }}>
                    {STATUS_META[interview.status]?.hint || ''}
                  </p>

                  {isOver && (
                    <div style={{ background: GHOST, border: `1px solid ${LINE}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <SectionLabel style={{ marginBottom: 0 }}>Meeting completed</SectionLabel>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: INK }}>{formatDate(interview.completed_at)}</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: INK, lineHeight: '1.6' }}>{interview.final_remark || 'No remark recorded.'}</div>
                    </div>
                  )}

                  <InfoRow label="Interviewer">{interview.interviewer_name || '—'}{interview.interviewer_email ? ` · ${interview.interviewer_email}` : ''}</InfoRow>
                  <InfoRow label="Platform">{interview.platform || 'Cal.com Video'}</InfoRow>
                  <InfoRow label="Proposed slots">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      {(interview.proposed_slots || []).map((s) => (
                        <span key={s.slot_id} style={{ fontSize: '0.82rem' }}>{formatSlot(s)}</span>
                      ))}
                    </div>
                  </InfoRow>
                  {interview.confirmed_slot && (
                    <InfoRow label="Confirmed slot">{formatSlot(interview.confirmed_slot)}</InfoRow>
                  )}
                  <InfoRow label="Company">{interview.company_name || '—'}</InfoRow>
                  {interview.vendor_notes && <InfoRow label="Vendor notes">{interview.vendor_notes}</InfoRow>}
                  {interview.notes && <InfoRow label="Instructions">{interview.notes}</InfoRow>}
                  <InfoRow label="Created">{formatDate(interview.created_at)}</InfoRow>

                  {/* Meeting link */}
                  <div style={{ background: INK, borderRadius: '16px', padding: '20px', marginTop: '18px' }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '10px' }}>
                      Meeting Link
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        readOnly
                        value={meetingLink || '—'}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.25)', fontSize: '0.82rem', color: PAPER, background: 'rgba(255,255,255,0.08)', minWidth: 0 }}
                      />
                      <button
                        type="button"
                        onClick={copyLink}
                        style={{ padding: '10px 16px', background: PAPER, color: INK, border: 0, borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
                      {meetingLink && (
                        <a
                          href={meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: PAPER, color: INK, padding: '9px 18px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 800, textDecoration: 'none' }}
                        >
                          Join Meeting ↗
                        </a>
                      )}
                      {interview.calendar_links?.google && (
                        <a href={interview.calendar_links.google} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: PAPER, padding: '9px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                          Google
                        </a>
                      )}
                      {interview.calendar_links?.outlook && (
                        <a href={interview.calendar_links.outlook} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: PAPER, padding: '9px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                          Outlook
                        </a>
                      )}
                      {interview.calendar_links?.ics && (
                        <a href={interview.calendar_links.ics} download style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: PAPER, padding: '9px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                          .ICS
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Decision panel */}
          {(isOver || !isReadOnly) && (
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '20px', padding: '28px 30px', marginTop: '16px', boxShadow: '0 1px 2px rgba(10,10,10,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                <div>
                  <SectionLabel style={{ marginBottom: '6px' }}>Final Decision</SectionLabel>
                  <p style={{ fontSize: '0.86rem', color: MUTED, margin: 0 }}>
                    {isOver ? 'This meeting is over. Review the candidate and finalize the outcome.' : 'Once the meeting is over, record the outcome to move the candidate into Accepted or Rejected.'}
                  </p>
                </div>
                {isOver && !editingDecision && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: recordedDecision === 'Accepted' ? INK : PAPER, color: recordedDecision === 'Accepted' ? PAPER : INK, border: `1px solid ${INK}`, padding: '7px 16px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em' }}>
                    {recordedDecision === 'Accepted' ? '✓' : '✕'} {recordedDecision.toUpperCase()}
                  </span>
                )}
              </div>

              {isOver && !editingDecision && (
                <div style={{ background: GHOST, border: `1px solid ${LINE}`, borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
                  <SectionLabel style={{ marginBottom: '8px' }}>Final remark</SectionLabel>
                  <div style={{ fontSize: '0.92rem', color: INK, lineHeight: '1.7' }}>{interview.final_remark || 'No remark recorded.'}</div>
                </div>
              )}

              {(!isOver || editingDecision) && (
                <form onSubmit={handleComplete}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }} className="decision-grid">
                    {['Accepted', 'Rejected'].map((d) => {
                      const selected = decision === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDecision(d)}
                          style={{
                            padding: '26px 20px',
                            borderRadius: '14px',
                            border: selected ? `2px solid ${INK}` : `2px solid ${LINE_STRONG}`,
                            background: selected ? INK : PAPER,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.15s ease',
                            boxShadow: selected ? '0 16px 32px -16px rgba(10,10,10,0.35)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: '1.9rem', color: selected ? PAPER : INK, lineHeight: 1 }}>
                            {d === 'Accepted' ? '✓' : '✕'}
                          </span>
                          <span style={{ fontSize: '1rem', fontWeight: 900, color: selected ? PAPER : INK, letterSpacing: '-0.01em' }}>
                            {d === 'Accepted' ? 'Accept' : 'Reject'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: selected ? 'rgba(255,255,255,0.7)' : MUTED, fontWeight: 600, textAlign: 'center', maxWidth: '220px', letterSpacing: '0.02em' }}>
                            {d === 'Accepted' ? 'Move to accepted candidates & onboarding.' : 'Decline this candidate for this role.'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Final remark — strengths, concerns, and overall fit for the role…"
                    rows={3}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${LINE_STRONG}`, fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box', marginBottom: '16px', background: PAPER, color: INK }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                    {editingDecision && (
                      <button
                        type="button"
                        onClick={() => { setEditingDecision(false); setDecision(recordedDecision || 'Accepted'); setRemark(interview?.final_remark || ''); }}
                        style={{ background: PAPER, border: `1px solid ${LINE_STRONG}`, padding: '11px 20px', borderRadius: '10px', fontSize: '0.86rem', fontWeight: 700, color: INK, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      style={{ background: INK, color: PAPER, border: 0, padding: '12px 28px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px -8px rgba(10,10,10,0.4)' }}
                    >
                      {saving ? 'Recording…' : isOver && editingDecision ? 'Update Decision' : 'Confirm & Record Decision'}
                    </button>
                  </div>
                </form>
              )}

              {isOver && !editingDecision && (
                <button
                  type="button"
                  onClick={() => { setEditingDecision(true); setDecision(recordedDecision || 'Accepted'); setRemark(interview?.final_remark || ''); }}
                  style={{ background: PAPER, border: `1px solid ${LINE_STRONG}`, padding: '9px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, color: INK, cursor: 'pointer' }}
                >
                  ✎ Edit decision
                </button>
              )}
            </div>
          )}
        </>
      )}

      {showScheduleModal && (
        <ScheduleInterviewModal
          candidate={{
            id: candidateId,
            submission_id: candidateId,
            requisition_id: reqId,
            requisition_title: candidate?.requisition_title,
            candidate_name: candidate?.candidate_name,
            candidate_email: candidate?.candidate_email,
            vendor_name: candidate?.vendor_name,
          }}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => { setShowScheduleModal(false); load(); }}
        />
      )}
    </div>
  );
}