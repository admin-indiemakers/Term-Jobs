import { useEffect, useState } from 'react';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

function SkeletonBlock({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.5s infinite linear',
        ...style,
      }}
    />
  );
}

function SkeletonStatCard({ label, tint = 'tint-blue', icon }) {
  return (
    <div className={`stat-card ${tint} glass-panel`}>
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value" style={{ margin: '8px 0' }}>
        <SkeletonBlock width="45px" height="28px" borderRadius="8px" />
      </div>
      <div className="stat-delta">
        <SkeletonBlock width="110px" height="13px" borderRadius="4px" />
      </div>
    </div>
  );
}

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
        subtitle={`Consultancy Portal   ${user?.tenant_name || 'Vendor Agency'}   Review client interview proposals and sync directly with candidate calendars.`}
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
      {loading ? (
        <div className="stat-grid recruiter-stats" style={{ marginBottom: '24px' }}>
          <SkeletonStatCard label="TOTAL PROPOSALS" tint="tint-ink" icon={Icons.briefcase} />
          <SkeletonStatCard label="AWAITING CONFIRMATION" tint="tint-amber" icon={Icons.layers} />
          <SkeletonStatCard label="CONFIRMED SLOTS" tint="tint-green" icon={Icons.check} />
        </div>
      ) : (
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
            label="CONFIRMED SLOTS"
            value={confirmedCount}
            icon={Icons.check}
            tint="tint-green"
            delta="Cal.com Dynamic Sync"
            deltaTone="green"
          />
        </div>
      )}

      {/* Filter and search bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#ffffff', padding: '14px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'PENDING', 'CONFIRMED'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setInterviewFilter(tab)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 0,
                background: interviewFilter === tab ? '#0f172a' : '#f1f5f9',
                color: interviewFilter === tab ? '#ffffff' : '#64748b',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab === 'ALL' ? 'All Requests' : tab === 'PENDING' ? 'Pending' : 'Confirmed'}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search candidate, role, or company..."
          value={interviewSearch}
          onChange={(e) => setInterviewSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '260px' }}
        />
      </div>

      {/* Interviews List */}
      {loading ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonBlock width="160px" height="22px" borderRadius="6px" />
                <SkeletonBlock width="80px" height="24px" borderRadius="6px" />
              </div>
              <SkeletonBlock width="220px" height="14px" borderRadius="4px" style={{ marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <SkeletonBlock width="120px" height="34px" borderRadius="8px" />
                <SkeletonBlock width="100px" height="34px" borderRadius="8px" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        (() => {
          if (!filtered.length) {
            return (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📅</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                  No Interview Requests Found
                </h3>
                <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                  {search ? 'Try adjusting your search criteria.' : 'Client hiring managers have not scheduled any candidate interviews yet.'}
                </p>
              </div>
            );
          }

          return (
            <div style={{ display: 'grid', gap: '16px' }}>
              {filtered.map((inv) => {
                const confirmed = inv.confirmed_slot;
                const proposed = inv.proposed_slots || [];
                const isPending = inv.status === 'PROPOSED_BY_COMPANY';
                const isConfirmed = inv.status === 'CONFIRMED_BY_VENDOR';

                return (
                  <div
                    key={inv.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: isPending ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                      padding: '24px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            {inv.candidate_name}
                          </h3>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: isConfirmed ? '#ecfdf5' : '#fffbeb', color: isConfirmed ? '#059669' : '#d97706' }}>
                            {isConfirmed ? '✓ Confirmed' : '⏱ Action Required'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                          Role: <strong style={{ color: '#334155' }}>{inv.requisition_title || 'Role'}</strong> • Client: <strong style={{ color: '#334155' }}>{inv.company_name}</strong>
                        </p>
                      </div>

                      {isPending && (
                        <button
                          type="button"
                          disabled={confirmingId === inv.id}
                          onClick={() => handleConfirm(inv.id, inv.candidate_name)}
                          style={{
                            background: '#059669',
                            color: '#ffffff',
                            border: 0,
                            padding: '10px 18px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          {confirmingId === inv.id ? 'Confirming...' : '✓ Confirm Candidate Availability'}
                        </button>
                      )}
                    </div>

                    {/* Cal.com Direct Links */}
                    {inv.calendar_links && (
                      <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                          🔗 Cal.com Meeting Link:
                        </span>
                        <a
                          href={inv.calendar_links.cal_booking_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                        >
                          Open Cal.com Booking Page ↗
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}
