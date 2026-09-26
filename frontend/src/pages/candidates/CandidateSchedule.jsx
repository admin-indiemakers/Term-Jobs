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
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [editingDecision, setEditingDecision] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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
        const inv = Array.isArray(invs) ? invs[0] || null : null;
        setInterview(inv);
        if (inv?.decision) {
          setDecision(inv.decision);
        } else if (cand?.status === 'Accepted' || cand?.status === 'Rejected') {
          setDecision(cand.status);
        }
        if (inv?.final_remark) {
          setRemark(inv.final_remark);
        } else if (cand?.hiring_manager_notes) {
          setRemark(cand.hiring_manager_notes);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [candidateId, token]);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://termjobs.in';
  const meetingLink = useMemo(() => {
    let raw = interview?.meeting_link || interview?.calendar_links?.cal_booking_url || '';
    if (!raw || raw.includes('cal.com')) {
      const rid = interview?.round_id || interview?.id;
      if (rid) {
        return `${currentOrigin}/interview/room/${rid}`;
      }
    }
    return raw;
  }, [interview, currentOrigin]);

  const isOver = interview?.status === 'COMPLETED';
  const recordedDecision =
    interview?.decision ||
    (candidate?.status === 'Accepted' || candidate?.status === 'Rejected' ? candidate.status : '') ||
    (successMsg ? decision : '');

  const isAcceptedNow =
    (candidate?.status === 'Accepted' || interview?.decision === 'Accepted' || recordedDecision === 'Accepted' || (successMsg && decision === 'Accepted')) &&
    decision === 'Accepted';

  const isRejectedNow =
    (candidate?.status === 'Rejected' || interview?.decision === 'Rejected' || recordedDecision === 'Rejected' || (successMsg && decision === 'Rejected')) &&
    decision === 'Rejected';

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
      // 1. Process candidate decision & complete company onboarding
      await request(`/api/interviews/candidates/${encodeURIComponent(candidateId)}/decision`, {
        method: 'POST',
        token,
        body: { decision, notes: remark, requisition_id: reqId },
      }).catch((err) => console.warn('Candidate decision warning:', err));

      if (decision === 'Accepted') {
        // Automatically dispatch formal employment offer letter & agreement to the candidate's agreements portal
        await request(`/api/candidates/${encodeURIComponent(candidateId)}/offer-letter/send`, {
          method: 'POST',
          token,
          body: { decision, notes: remark },
        }).catch((err) => console.warn('Offer letter dispatch error:', err));
      }

      if (interview) {
        // Complete interview record as well
        const res = await request(`/api/interviews/${interview.id}/complete`, {
          method: 'POST',
          token,
          body: { final_remark: remark, decision },
        });
        setInterview(res || { ...interview, status: 'COMPLETED', decision, final_remark: remark });
      } else {
        const newStatus = decision === 'Accepted' ? 'Accepted' : 'Rejected';
        await request(`/candidates/${candidateId}/status`, {
          method: 'PATCH',
          token,
          body: { status: newStatus },
        });
      }

      // Immediately update local candidate status so all UI elements react without delay
      setCandidate((prev) => (prev ? { ...prev, status: decision, hiring_manager_notes: remark } : prev));
      if (interview) {
        setInterview((prev) => (prev ? { ...prev, decision, status: 'COMPLETED', final_remark: remark } : prev));
      }

      setEditingDecision(false);
      setSuccessMsg(
        decision === 'Accepted'
          ? `✓ Candidate Accepted & Onboarded! Super Admin notified to issue contract and finalize onboarding.`
          : `✕ ${candidate?.candidate_name || 'Candidate'} has been rejected. Super Admin notified.`
      );
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
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '14px 18px', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 700, marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{successMsg}</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#047857' }}>Redirecting in 3s…</span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                        🌐 Native Video Interview Room
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#86efac', background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                        {currentOrigin.replace(/^https?:\/\//, '')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: interview.candidate_passcode ? '12px' : '14px' }}>
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
                        {copied ? '✓ Copied' : 'Copy Link'}
                      </button>
                    </div>

                    {/* Candidate Passcode if available */}
                    {interview.candidate_passcode && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px 14px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Candidate Access Passcode:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{ fontSize: '0.92rem', color: '#facc15', fontWeight: 800, letterSpacing: '0.06em' }}>
                            {interview.candidate_passcode}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(interview.candidate_passcode);
                              setCopiedPasscode(true);
                              setTimeout(() => setCopiedPasscode(false), 2000);
                            }}
                            style={{ background: 'rgba(255,255,255,0.15)', border: 0, color: PAPER, borderRadius: '6px', padding: '3px 8px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                          >
                            {copiedPasscode ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {meetingLink && (
                        <a
                          href={meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: PAPER, color: INK, padding: '9px 18px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 800, textDecoration: 'none' }}
                        >
                          🎥 Join Video Room ↗
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



          {/* Final Decision & Onboarding Panel */}
          {(isOver || !isReadOnly) && (
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '20px', padding: '28px 30px', marginTop: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <SectionLabel style={{ margin: 0 }}>Final Hiring Decision & Onboarding</SectionLabel>
                    {recordedDecision && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: recordedDecision === 'Accepted' ? '#ECFDF5' : '#FFF1F2',
                        color: recordedDecision === 'Accepted' ? '#047857' : '#BE123C',
                        border: `1px solid ${recordedDecision === 'Accepted' ? '#A7F3D0' : '#FECDD3'}`,
                        padding: '3px 12px',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        letterSpacing: '0.05em'
                      }}>
                        {recordedDecision === 'Accepted' ? '✓' : '✕'} RECORDED: {recordedDecision.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.86rem', color: MUTED, margin: 0 }}>
                    Review this candidate, select the final hiring decision, and record your hiring evaluation remarks. Accepted candidates are onboarded to the company with a Candidate ID and shown under Accepted Candidates.
                  </p>
                </div>
              </div>

              {successMsg && (
                <div style={{ padding: '20px', borderRadius: '14px', background: '#ECFDF5', border: '1px solid #A7F3D0', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065F46', fontWeight: 700, fontSize: '0.92rem' }}>
                    <span>{successMsg}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <a
                      href="/dashboard/candidates/accepted"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: '#059669', color: '#FFFFFF', fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                    >
                      View in Accepted Candidates →
                    </a>
                  </div>
                </div>
              )}

              <form onSubmit={handleComplete}>
                {/* Accept / Reject Selector Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }} className="decision-grid">
                  {/* ACCEPT CARD */}
                  <button
                    type="button"
                    onClick={() => setDecision('Accepted')}
                    style={{
                      padding: '22px 20px',
                      borderRadius: '16px',
                      border: decision === 'Accepted' ? '2.5px solid #059669' : `1.5px solid ${LINE_STRONG}`,
                      background: decision === 'Accepted' ? '#F0FDF4' : PAPER,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      boxShadow: decision === 'Accepted' ? '0 12px 24px -10px rgba(5,150,105,0.25)' : 'none',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: decision === 'Accepted' ? '#059669' : '#F4F4F0',
                      color: decision === 'Accepted' ? '#FFFFFF' : INK,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 900
                    }}>
                      ✓
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: decision === 'Accepted' ? '#065F46' : INK, letterSpacing: '-0.01em' }}>
                      Accept & Onboard
                    </span>
                    <span style={{ fontSize: '0.74rem', color: decision === 'Accepted' ? '#047857' : MUTED, fontWeight: 600, maxWidth: '240px', lineHeight: 1.4 }}>
                      Issues Candidate ID, starts 8-gate company onboarding & work order, notifies Super Admin.
                    </span>
                  </button>

                  {/* REJECT CARD */}
                  <button
                    type="button"
                    onClick={() => setDecision('Rejected')}
                    style={{
                      padding: '22px 20px',
                      borderRadius: '16px',
                      border: decision === 'Rejected' ? '2.5px solid #E11D48' : `1.5px solid ${LINE_STRONG}`,
                      background: decision === 'Rejected' ? '#FFF1F2' : PAPER,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      boxShadow: decision === 'Rejected' ? '0 12px 24px -10px rgba(225,29,72,0.25)' : 'none',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: decision === 'Rejected' ? '#E11D48' : '#F4F4F0',
                      color: decision === 'Rejected' ? '#FFFFFF' : INK,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 900
                    }}>
                      ✕
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: decision === 'Rejected' ? '#9F1239' : INK, letterSpacing: '-0.01em' }}>
                      Reject Candidate
                    </span>
                    <span style={{ fontSize: '0.74rem', color: decision === 'Rejected' ? '#BE123C' : MUTED, fontWeight: 600, maxWidth: '240px', lineHeight: 1.4 }}>
                      Decline candidate for this requisition and transmit rejection reason to Super Admin.
                    </span>
                  </button>
                </div>

                {/* Decision Reason / Final Remark Textarea */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: INK, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Decision Reason / Final Hiring Remark {decision === 'Rejected' && <span style={{ color: '#E11D48' }}>*</span>}
                  </label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={
                      decision === 'Accepted'
                        ? "Enter hiring decision remarks (e.g. Cleared all evaluation criteria with strong communication scores. Ready for company onboarding)..."
                        : "Enter specific rejection reason (e.g. Incomplete answers during screening, technical skills mismatch)..."
                    }
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: `1.5px solid ${decision === 'Accepted' ? '#10B981' : '#F43F5E'}`,
                      fontSize: '0.88rem',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      background: PAPER,
                      color: INK,
                      lineHeight: 1.6,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Submit Button & Confirmation Feedback */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '22px' }}>
                  {isAcceptedNow ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: '#ECFDF5',
                      border: '1.5px solid #10B981',
                      borderRadius: '12px',
                      padding: '10px 18px',
                      color: '#065F46',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      boxShadow: '0 4px 14px rgba(16,185,129,0.15)',
                    }}>
                      <span style={{ fontSize: '1.25rem' }}>🎉</span>
                      <span><strong>Candidate Accepted!</strong> Super Admin notified to issue contract & onboard.</span>
                      <a
                        href="/dashboard/candidates/accepted"
                        style={{
                          marginLeft: '8px',
                          color: '#047857',
                          textDecoration: 'underline',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                        }}
                      >
                        View in Accepted Candidates →
                      </a>
                    </div>
                  ) : isRejectedNow ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: '#FFF1F2',
                      border: '1.5px solid #F43F5E',
                      borderRadius: '12px',
                      padding: '10px 18px',
                      color: '#9F1239',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                    }}>
                      <span style={{ fontSize: '1.15rem' }}>✕</span>
                      <span><strong>Candidate Rejected.</strong> Rejection status recorded & Super Admin notified.</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: isAcceptedNow
                        ? '#047857'
                        : isRejectedNow
                        ? '#BE123C'
                        : decision === 'Accepted'
                        ? '#059669'
                        : '#E11D48',
                      color: '#FFFFFF',
                      border: 0,
                      padding: '14px 34px',
                      borderRadius: '12px',
                      fontSize: '0.94rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: isAcceptedNow || decision === 'Accepted'
                        ? '0 8px 20px -6px rgba(5,150,105,0.45)'
                        : '0 8px 20px -6px rgba(225,29,72,0.45)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {saving ? (
                      'Processing Decision & Onboarding…'
                    ) : isAcceptedNow ? (
                      <>
                        <span style={{ fontSize: '1.15rem' }}>✓</span>
                        <span>Candidate Accepted & Onboarded!</span>
                      </>
                    ) : isRejectedNow ? (
                      <>
                        <span style={{ fontSize: '1.15rem' }}>✕</span>
                        <span>Candidate Rejected</span>
                      </>
                    ) : decision === 'Accepted' ? (
                      <>
                        <span>✓</span>
                        <span>Confirm Acceptance & Onboard Candidate</span>
                      </>
                    ) : (
                      <>
                        <span>✕</span>
                        <span>Confirm Rejection with Reason</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
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