import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, WelcomeBanner } from '../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function Archives() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [acting, setActing] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    request('/api/auth/archives', { token })
      .then((data) => setArchives(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const handleRestore = async (archiveId, name) => {
    if (!window.confirm(`Restore "${name}"? This will bring it back to the active system.`)) return;
    setActing(archiveId);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/archives/${archiveId}/restore`, { method: 'POST', token });
      setSuccess(`"${name}" has been restored successfully.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  };

  const handlePermanentDelete = async (archiveId, name) => {
    if (!window.confirm(`Permanently delete "${name}"? This CANNOT be undone.`)) return;
    setActing(archiveId);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/archives/${archiveId}`, { method: 'DELETE', token });
      setSuccess(`"${name}" has been permanently deleted.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  };

  const filtered = filter === 'all' ? archives : archives.filter((a) => a.item_type === filter);
  const tenantCount = archives.filter((a) => a.item_type === 'tenant').length;
  const userCount = archives.filter((a) => a.item_type === 'user').length;

  if (user?.role !== 'Super Admin') {
    return (
      <div className="page">
        <div className="alert alert-error">Only Super Admins can view archives.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <WelcomeBanner
        title="Archives"
        subtitle="Deleted companies and user accounts are stored here before permanent removal."
      >
        <button className="ghost-btn" onClick={() => navigate('/dashboard/superadmin')}>
          Back to Dashboard
        </button>
      </WelcomeBanner>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="stat-grid" style={{ marginTop: '16px' }}>
        <div className="stat-card tint-blue">
          <div className="stat-label">Total Archived</div>
          <div className="stat-value">{archives.length}</div>
        </div>
        <div className="stat-card tint-violet">
          <div className="stat-label">Companies</div>
          <div className="stat-value">{tenantCount}</div>
        </div>
        <div className="stat-card tint-amber">
          <div className="stat-label">User Accounts</div>
          <div className="stat-value">{userCount}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', marginBottom: '16px' }}>
        {[
          { key: 'all', label: `All (${archives.length})` },
          { key: 'tenant', label: `Companies (${tenantCount})` },
          { key: 'user', label: `Users (${userCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: filter === tab.key ? '2px solid #0f172a' : '1px solid #e2e8f0',
              background: filter === tab.key ? '#0f172a' : '#fff',
              color: filter === tab.key ? '#fff' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-panel table-card">
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading archives...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No archived items</h3>
            <p>Deleted companies and accounts will appear here before permanent removal.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Details</th>
                <th>Archived By</th>
                <th>Reason</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const data = a.original_data || {};
                const isTenant = a.item_type === 'tenant';
                const displayName = isTenant ? data.name : (data.name || data.email);
                const detail = isTenant
                  ? `${data.tenant_type || '—'} · ID: ${(data.id || '').slice(0, 8)}`
                  : `${data.email || '—'} · ${data.role || '—'} · ID: ${(data.id || '').slice(0, 8)}`;
                const isActing = acting === a.id;
                return (
                  <tr key={a.id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px',
                        borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
                        background: isTenant ? '#ede9fe' : '#fef3c7',
                        color: isTenant ? '#6d28d9' : '#92400e',
                      }}>
                        {isTenant ? '🏢 Company' : '👤 User'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{displayName || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>{detail}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{(a.archived_by || '').slice(0, 8)}…</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{a.reason || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatDate(a.archived_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRestore(a.id, displayName)}
                          disabled={isActing}
                          style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                            background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                            cursor: isActing ? 'wait' : 'pointer',
                          }}
                        >
                          {isActing ? '...' : '↻ Restore'}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(a.id, displayName)}
                          disabled={isActing}
                          style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                            cursor: isActing ? 'wait' : 'pointer',
                          }}
                        >
                          {isActing ? '...' : '🗑 Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
