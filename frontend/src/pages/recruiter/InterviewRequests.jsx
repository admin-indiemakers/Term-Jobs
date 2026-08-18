import { useEffect, useState } from 'react';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

export default function InterviewRequests() {
  const { token, user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchInterviews = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/interviews/vendor', { token });
      setInterviews(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch interview requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [token]);

  const handleConfirm = async (invId, candName) => {
    if (!window.confirm(`Confirm candidate availability for ${candName}?`)) return;
    setConfirmingId(invId);
    setError('');
    setSuccess('');
    try {
      await request(`/api/interviews/${invId}/vendor-confirm`, {
        method: 'POST',
        token,
        body: { action: 'confirm', vendor_notes: 'Confirmed by candidate' },
      });
      setSuccess(`Interview for ${candName} confirmed successfully.`);
      await fetchInterviews();
    } catch (err) {
      setError(err.message || 'Failed to confirm interview slot.');
    } finally {
      setConfirmingId(null);
    }
  };

  const pendingCount = interviews.filter((i) => i.status === 'PROPOSED_BY_COMPANY').length;
  const confirmedCount = interviews.filter((i) => i.status === 'CONFIRMED_BY_VENDOR').length;

  let filtered = interviews;
  if (filter === 'PENDING') filtered = filtered.filter((i) => i.status === 'PROPOSED_BY_COMPANY');
  if (filter === 'CONFIRMED') filtered = filtered.filter((i) => i.status === 'CONFIRMED_BY_VENDOR');
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        (i.candidate_name && i.candidate_name.toLowerCase().includes(q)) ||
        (i.requisition_title && i.requisition_title.toLowerCase().includes(q)) ||
        (i.company_name && i.company_name.toLowerCase().includes(q))
    );
  }

  return (
    <div className="page recruiter-page" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      <WelcomeBanner
        title="Interview Requests & Cal.com Scheduling"
        subtitle={`Consultancy Portal • ${user?.tenant_name || 'Vendor Agency'} • Review client interview proposals and sync directly with candidate calendars.`}
      />

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 0, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {success && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '12px 18px', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 600, marginBottom: '16px' }}>
          ✓ {success}
        </div>
      )}

      {/* Metric summary */}
      <div className="stat-grid recruiter-stats" style={{ marginBottom: '24px' }}>
        <StatCard
          label="TOTAL PROPOSALS"
          value={interviews.length}
          icon={Icons.briefcase}
          tint="tint-ink"
          delta="Client Interview Pipeline"
          deltaTone="ink"
        />
        <StatCard
          label="AWAITING CONFIRMATION"
          value={pendingCount}
          icon={Icons.layers}
          tint="tint-amber"
          delta="Action Required"
          deltaTone="amber"
        />
        <StatCard
          label="CONFIRMED INTERVIEWS"
          value={confirmedCount}
          icon={Icons.check}
          tint="tint-green"
          delta="Scheduled & Synced"
          deltaTone="green"
        />
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', background: '#ffffff', padding: '14px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'ALL', label: `All Requests (${interviews.length})` },
            { key: 'PENDING', label: `Pending (${pendingCount})` },
            { key: 'CONFIRMED', label: `Confirmed (${confirmedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 0,
                background: filter === tab.key ? '#0f172a' : '#f1f5f9',
                color: filter === tab.key ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search candidate, role, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              width: '260px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={fetchInterviews}
            style={{
              padding: '9px 14px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Cards List */}
      {loading ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '0.92rem', color: '#64748b' }}>Loading interview requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📅</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            No Interview Requests Found
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
            When client hiring managers shortlist candidates and propose interview slots, they will appear here instantly.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '18px' }}>
          {filtered.map((inv) => {
            const isConfirmed = inv.status === 'CONFIRMED_BY_VENDOR';
            const slot = inv.confirmed_slot || (inv.proposed_slots && inv.proposed_slots[0]) || {};
            const initials = (inv.candidate_name || '?').slice(0, 2).toUpperCase();

            return (
              <div
                key={inv.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  border: isConfirmed ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                  padding: '24px',
                  boxShadow: isConfirmed ? '0 4px 16px rgba(16,185,129,0.06)' : '0 4px 16px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {inv.candidate_name}
                        </h3>
                        <span
                          style={{
                            background: isConfirmed ? '#ecfdf5' : '#fef3c7',
                            color: isConfirmed ? '#059669' : '#d97706',
                            border: isConfirmed ? '1px solid #a7f3d0' : '1px solid #fde68a',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '999px',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {isConfirmed ? '✓ CONFIRMED' : '⏳ AWAITING CONFIRMATION'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0 0' }}>
                        Role: <strong style={{ color: '#0f172a' }}>{inv.requisition_title}</strong> • Client: <strong style={{ color: '#0f172a' }}>{inv.company_name || 'Bearitt'}</strong>
                        {inv.candidate_email && <> • Email: <a href={`mailto:${inv.candidate_email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{inv.candidate_email}</a></>}
                      </p>
                    </div>
                  </div>

                  <div>
                    {!isConfirmed ? (
                      <button
                        type="button"
                        onClick={() => handleConfirm(inv.id, inv.candidate_name)}
                        disabled={confirmingId === inv.id}
                        style={{
                          background: '#059669',
                          color: '#ffffff',
                          border: 0,
                          padding: '10px 20px',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {confirmingId === inv.id ? 'Confirming...' : '🟢 Confirm Slot with Candidate'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '8px 14px', borderRadius: '10px' }}>
                        ✓ Ready & Scheduled
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '14px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Interview Round</span>
                    <strong style={{ color: '#0f172a' }}>{inv.interview_round || 'Round 1 - Technical'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Proposed Slot</span>
                    <strong style={{ color: '#0f172a' }}>{slot.date} ({slot.start_time} - {slot.end_time} {slot.timezone || 'IST'})</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Client Interviewer</span>
                    <strong style={{ color: '#0f172a' }}>{inv.interviewer_name || 'Hiring Team'}</strong> {inv.interviewer_email && <span style={{ color: '#64748b' }}>({inv.interviewer_email})</span>}
                  </div>
                  {inv.meeting_link && (
                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Meeting Room</span>
                      <a href={inv.meeting_link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                        Join Video Call ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Client Notes */}
                {inv.notes && (
                  <div style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '16px', background: '#fffbeb', border: '1px solid #fef3c7', padding: '10px 14px', borderRadius: '10px' }}>
                    📝 <strong style={{ color: '#92400e' }}>Notes from Client:</strong> {inv.notes}
                  </div>
                )}

                {/* Cal.com Direct Booking Link & 1-Click Sync Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                  {inv.calendar_links?.cal_booking_url ? (
                    <a
                      href={inv.calendar_links.cal_booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: '#2563eb',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#eff6ff',
                        padding: '6px 14px',
                        borderRadius: '8px',
                      }}
                    >
                      🔗 Open Candidate Cal.com Booking Link ↗
                    </a>
                  ) : (
                    <span />
                  )}

                  {inv.calendar_links && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>1-Click Sync:</span>
                      {inv.calendar_links.google && (
                        <a href={inv.calendar_links.google} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.76rem', fontWeight: 700, padding: '5px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', textDecoration: 'none', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🟢 Google
                        </a>
                      )}
                      {inv.calendar_links.outlook && (
                        <a href={inv.calendar_links.outlook} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.76rem', fontWeight: 700, padding: '5px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', textDecoration: 'none', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔵 Outlook
                        </a>
                      )}
                      <a href={`/api/interviews/${inv.id}/invite.ics`} download style={{ fontSize: '0.76rem', fontWeight: 700, padding: '5px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', textDecoration: 'none', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⚪ .ICS File
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
