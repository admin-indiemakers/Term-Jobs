import { useState, useEffect, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Cal, { getCalApi } from '@calcom/embed-react';

export function normalizeCalLink(rawInput, eventSlug = '30min') {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      embedLink: 'termjobs/interview',
      fullUrl: 'https://cal.com/termjobs/interview',
      isCustomHost: false,
    };
  }

  let trimmed = rawInput.trim();
  // Remove leading http:// or https://
  trimmed = trimmed.replace(/^https?:\/\//i, '');
  // Remove trailing slashes
  trimmed = trimmed.replace(/\/+$/, '');

  let isCustomHost = false;
  let path = trimmed;

  if (trimmed.toLowerCase().startsWith('cal.com/')) {
    path = trimmed.slice(8);
  } else if (trimmed.toLowerCase() === 'cal.com') {
    path = '';
  } else if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts[0].includes('.')) {
      isCustomHost = true;
    }
  }

  const segments = path.split('/').filter(Boolean);
  let finalEmbed = path;
  let finalFullUrl = '';

  if (isCustomHost) {
    finalFullUrl = `https://${trimmed}`;
    finalEmbed = path;
  } else {
    if (segments.length === 0) {
      finalEmbed = 'termjobs/interview';
      finalFullUrl = 'https://cal.com/termjobs/interview';
    } else if (segments.length === 1) {
      const slug = (eventSlug || '30min').replace(/^\/+/, '');
      finalEmbed = `${segments[0]}/${slug}`;
      finalFullUrl = `https://cal.com/${segments[0]}/${slug}`;
    } else {
      finalEmbed = segments.join('/');
      finalFullUrl = `https://cal.com/${segments.join('/')}`;
    }
  }

  return {
    embedLink: finalEmbed,
    fullUrl: finalFullUrl,
    isCustomHost,
  };
}

export default function ScheduleInterviewModal({ candidate, onClose, onScheduled }) {
  const { token, user } = useAuth();
  const [calConfig, setCalConfig] = useState({ provider: 'cal', cal_link: 'https://cal.com/', event_slug: '30min', default_duration: 60, default_timezone: 'Asia/Kolkata' });
  const [activeTab, setActiveTab] = useState('embed'); // 'embed' | 'form'
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scheduledResult, setScheduledResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [round, setRound] = useState('Round 1 - Technical & System Design');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [interviewerName, setInterviewerName] = useState(user?.name || '');
  const [interviewerEmail, setInterviewerEmail] = useState(user?.email || '');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    request('/api/calendar/config', { token })
      .then((cfg) => {
        if (cfg) setCalConfig(cfg);
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, [token]);

  // Compute normalized Cal links
  const { embedLink, fullUrl } = useMemo(() => {
    return normalizeCalLink(calConfig.cal_link, calConfig.event_slug);
  }, [calConfig.cal_link, calConfig.event_slug]);

  useEffect(() => {
    if (activeTab === 'embed') {
      (async function () {
        try {
          const cal = await getCalApi();
          if (cal) {
            cal('ui', {
              theme: 'light',
              styles: { branding: { brandColor: '#2563eb' } },
              hideEventTypeDetails: false,
              layout: 'month_view',
            });
          }
        } catch (err) {
          console.warn('Cal embed init:', err);
        }
      })();
    }
  }, [activeTab, embedLink]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      setError('Please select an interview date, start time, and end time.');
      return;
    }
    setSubmitting(true);
    setError('');

    const payload = {
      requisition_id: candidate?.requisition_id || '',
      requisition_title: candidate?.requisition_title || candidate?.requisition_ref || 'Role Opening',
      candidate_submission_id: candidate?.id || '',
      candidate_name: candidate?.candidate_name || 'Candidate',
      candidate_email: candidate?.candidate_email || '',
      vendor_name: candidate?.vendor_name || 'Vendor',
      vendor_id: candidate?.vendor_id || candidate?.tenant_id || null,
      interview_round: round,
      interviewer_name: interviewerName,
      interviewer_email: interviewerEmail,
      meeting_link: fullUrl,
      platform: 'Cal.com Video',
      proposed_slots: [
        {
          slot_id: `slot_${Date.now()}`,
          date: date,
          start_time: startTime,
          end_time: endTime,
          timezone: calConfig.default_timezone || 'Asia/Kolkata',
        },
      ],
      notes: notes,
    };

    try {
      const res = await request('/api/interviews/schedule', {
        method: 'POST',
        token,
        body: payload,
      });
      setScheduledResult(res);
      if (onScheduled) onScheduled(res);
    } catch (err) {
      setError(err.message || 'Failed to dispatch interview schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCalUrl = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: activeTab === 'embed' ? '860px' : '620px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '26px 30px',
          position: 'relative',
          transition: 'max-width 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>📅</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Schedule Interview
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Candidate: <strong style={{ color: '#1e293b' }}>{candidate?.candidate_name || 'Candidate'}</strong> ({candidate?.requisition_title || 'Role'})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 0, borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('embed')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 0,
              background: activeTab === 'embed' ? '#ffffff' : 'transparent',
              color: activeTab === 'embed' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'embed' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            🗓️ Interactive Cal.com Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 0,
              background: activeTab === 'form' ? '#ffffff' : 'transparent',
              color: activeTab === 'form' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'form' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            🚀 Dispatch Proposal to Vendor
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* View 1: Success confirmation */}
        {scheduledResult ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', margin: '0 0 8px 0' }}>
              Interview Dispatched Successfully!
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.5', marginBottom: '20px' }}>
              The Cal.com interview booking link has been transmitted to <strong style={{ color: '#0f172a' }}>{candidate?.vendor_name || 'the recruiter agency'}</strong>.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                🔗 Cal.com Booking Link
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <input
                  type="text"
                  readOnly
                  value={scheduledResult.calendar_links?.cal_booking_url || fullUrl}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff' }}
                />
                <button
                  type="button"
                  onClick={copyCalUrl}
                  style={{ padding: '8px 14px', background: '#2563eb', color: '#ffffff', border: 0, borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Universal 1-Click Sync
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {scheduledResult.calendar_links?.google && (
                  <a
                    href={scheduledResult.calendar_links.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textDecoration: 'none', color: '#0f172a', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>🟢</span> Google
                  </a>
                )}
                {scheduledResult.calendar_links?.outlook && (
                  <a
                    href={scheduledResult.calendar_links.outlook}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textDecoration: 'none', color: '#0f172a', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>🔵</span> Outlook
                  </a>
                )}
                <a
                  href={`/api/interviews/${scheduledResult.id}/invite.ics`}
                  download={`interview_${candidate?.candidate_name || 'candidate'}.ics`}
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textDecoration: 'none', color: '#0f172a', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>⚪</span> .ICS File
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{ background: '#0f172a', color: '#ffffff', border: 0, padding: '10px 24px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}
            >
              Done & Close
            </button>
          </div>
        ) : activeTab === 'embed' ? (
          /* View 2: Cal.com Live Embed */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                🔗 Cal link: <strong style={{ color: '#0f172a' }}>{fullUrl}</strong>
              </span>
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Open in New Tab ↗
              </a>
            </div>

            <div style={{ height: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <Cal
                key={embedLink}
                calLink={embedLink}
                style={{ width: '100%', height: '100%', overflow: 'auto' }}
                config={{
                  layout: 'month_view',
                  name: candidate?.candidate_name || '',
                  email: candidate?.candidate_email || '',
                  notes: `Interview for ${candidate?.requisition_title || 'Role'}`,
                }}
              />
            </div>
          </div>
        ) : (
          /* View 3: Proposal Dispatch Form */
          <form onSubmit={handleSubmit}>
            {/* Interview Round */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Interview Round / Title
              </label>
              <select
                value={round}
                onChange={(e) => setRound(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a' }}
              >
                <option value="Round 1 - Technical & System Design">Round 1 - Technical & System Design</option>
                <option value="Round 2 - Live Coding & Problem Solving">Round 2 - Live Coding & Problem Solving</option>
                <option value="Hiring Manager Discussion">Hiring Manager Discussion</option>
                <option value="HR Culture & Fit Round">HR Culture & Fit Round</option>
                <option value="Final Director Round">Final Director Round</option>
              </select>
            </div>

            {/* Date & Time Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Target Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>
            </div>

            {/* Interviewer Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Interviewer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Interviewer Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. sarah@company.com"
                  value={interviewerEmail}
                  onChange={(e) => setInterviewerEmail(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Instructions / Cal Notes
              </label>
              <textarea
                placeholder="e.g. Please be ready with your laptop and IDE for hands-on live coding..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ background: '#f1f5f9', border: 0, padding: '10px 18px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ background: '#2563eb', color: '#ffffff', border: 0, padding: '10px 22px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
                disabled={submitting}
              >
                {submitting ? 'Dispatching...' : '🚀 Send Proposal to Vendor'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
