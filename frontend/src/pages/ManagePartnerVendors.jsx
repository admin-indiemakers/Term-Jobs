import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, WelcomeBanner } from '../components/Dashboard';

export default function ManagePartnerVendors() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'engaged', 'available'

  const loadVendors = () => {
    setLoading(true);
    request('/api/auth/vendors', { token })
      .then((res) => {
        setVendors(res || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadVendors, [token]);

  const toggleVendor = (id) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, engaged: !v.engaged } : v)));
    setError('');
    setSuccess('');
  };

  const setVendorCandidateLimit = (id, val) => {
    const num = val === '' ? null : Math.max(1, Math.round(Number(val) || 0));
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, candidate_limit: num } : v)));
    setError('');
    setSuccess('');
  };

  const saveVendors = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const selected = vendors.filter((v) => v.engaged);
      const payload = {
        vendor_tenant_ids: selected.map((v) => v.id),
        engagements: selected.map((v) => ({
          vendor_tenant_id: v.id,
          candidate_limit: v.candidate_limit != null && v.candidate_limit !== '' ? Number(v.candidate_limit) : null,
        })),
      };
      const updated = await request('/api/auth/vendors', {
        method: 'PUT',
        token,
        body: payload,
      });
      setVendors(updated || []);
      setSuccess(`Partner vendors updated — ${updated.filter((v) => v.engaged).length} active vendor partnerships.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Search auto-complete suggestions
  const searchSuggestions = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return vendors
      .filter((v) => v.name?.toLowerCase().includes(query) || v.location?.toLowerCase().includes(query) || v.industry?.toLowerCase().includes(query))
      .slice(0, 5);
  }, [vendors, search]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesTab =
        activeTab === 'all' ? true : activeTab === 'engaged' ? v.engaged : !v.engaged;
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        v.name?.toLowerCase().includes(query) ||
        v.location?.toLowerCase().includes(query) ||
        v.industry?.toLowerCase().includes(query) ||
        (v.specializations || []).some((s) => s.toLowerCase().includes(query));
      return matchesTab && matchesSearch;
    });
  }, [vendors, activeTab, search]);

  const engagedCount = vendors.filter((v) => v.engaged).length;

  return (
    <div className="page">
      <WelcomeBanner
        title="Partner Vendors Management"
        subtitle="Manage active consultancy vendor partnerships. Only engaged vendors can view your company's published requisitions and submit candidates."
      >
        <button type="button" className="ghost-btn" onClick={() => navigate('/dashboard/admin')}>
          Back to Dashboard
        </button>
      </WelcomeBanner>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'all' ? '#ffffff' : 'transparent',
                color: activeTab === 'all' ? '#1e293b' : '#64748b',
                boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              All Vendors ({vendors.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('engaged')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'engaged' ? '#ffffff' : 'transparent',
                color: activeTab === 'engaged' ? '#2563eb' : '#64748b',
                boxShadow: activeTab === 'engaged' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Engaged ({engagedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('available')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'available' ? '#ffffff' : 'transparent',
                color: activeTab === 'available' ? '#1e293b' : '#64748b',
                boxShadow: activeTab === 'available' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Unengaged ({vendors.length - engagedCount})
            </button>
          </div>

          {/* Search bar with auto popup suggestions */}
          <div style={{ position: 'relative', width: '320px' }}>
            <input
              className="auth-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor by name, location..."
              style={{ paddingRight: search ? '30px' : '12px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ✕
              </button>
            )}

            {/* Auto Popup Match Suggestions */}
            {searchSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '6px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                zIndex: 20,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '6px 12px', fontSize: '0.70rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', background: '#f8fafc' }}>
                  Matching Vendors
                </div>
                {searchSuggestions.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSearch(v.name);
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      color: '#1e293b',
                      cursor: 'pointer',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #f1f5f9'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <div>
                      <strong>{v.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>
                        {v.location ? `· ${v.location}` : ''}
                      </span>
                    </div>
                    {v.engaged && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                        Engaged
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Vendors Content */}
        {loading ? (
          <p className="muted" style={{ padding: '24px' }}>Loading vendors workspace...</p>
        ) : filteredVendors.length === 0 ? (
          <div className="empty-box" style={{ padding: '40px', textAlign: 'center' }}>
            <strong>No vendors matching your filter/search criteria.</strong>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: '4px' }}>
              Try clearing your search query or switching to another filter tab.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredVendors.map((v) => (
              <div
                key={v.id}
                className={`vendor-card ${v.engaged ? 'vendor-card-selected' : ''}`}
                onClick={() => toggleVendor(v.id)}
                style={{
                  padding: '18px',
                  borderRadius: '14px',
                  border: v.engaged ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: v.engaged ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{v.name}</span>
                  <span style={{
                    minWidth: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: v.engaged ? '#2563eb' : '#f1f5f9',
                    color: v.engaged ? '#ffffff' : '#94a3b8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}>
                    {v.engaged ? '✓' : '+'}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {v.location && <span>📍 {v.location}</span>}
                  {v.industry && <span>🏢 {v.industry}</span>}
                  {v.size && <span>👥 {v.size}</span>}
                </div>

                {v.specializations && v.specializations.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    {v.specializations.slice(0, 4).map((s) => (
                      <span key={s} style={{ fontSize: '0.70rem', background: '#e2e8f0', color: '#334155', padding: '2px 7px', borderRadius: '4px', fontWeight: 500 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {v.engaged && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #cbd5e1' }}
                  >
                    <label style={{ fontSize: '0.76rem', color: '#475569', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      Candidate Limit / Requisition
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Default (3)"
                      value={v.candidate_limit ?? ''}
                      onChange={(e) => setVendorCandidateLimit(v.id, e.target.value)}
                      className="auth-input"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="glow-btn" onClick={saveVendors} disabled={saving}>
            {saving ? 'Saving Changes...' : 'Save Vendor Partnerships'}
          </button>
        </div>
      </div>
    </div>
  );
}
