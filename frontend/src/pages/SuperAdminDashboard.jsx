import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../components/Dashboard';

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }),
      request('/api/auth/tenants', { token }),
    ])
      .then(([usersRes, tenantsRes]) => {
        setUsers(usersRes || []);
        setTenants(tenantsRes || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const handleDeleteCompany = async (tenant) => {
    setConfirmDelete(null);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/tenants/${tenant.id}`, { method: 'DELETE', token });
      setSuccess(`Company "${tenant.name}" deleted (accounts removed).`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const clientTenants = useMemo(() => tenants.filter((t) => t.tenant_type === 'client'), [tenants]);
  const consultancyTenants = useMemo(() => tenants.filter((t) => t.tenant_type === 'consultancy'), [tenants]);
  const adminAccounts = useMemo(() => users.filter((u) => u.role === 'Admin' || u.role === 'Recruiter'), [users]);

  const tenantAdminsMap = useMemo(() => {
    const map = {};
    adminAccounts.forEach((a) => {
      if (!a.tenant_id) return;
      if (!map[a.tenant_id]) map[a.tenant_id] = { admins: [], recruiters: [] };
      if (a.role === 'Admin') map[a.tenant_id].admins.push(a);
      if (a.role === 'Recruiter') map[a.tenant_id].recruiters.push(a);
    });
    return map;
  }, [adminAccounts]);

  const totalTenants = tenants.length;
  const buyerShare = totalTenants === 0 ? 0 : Math.round((clientTenants.length / totalTenants) * 100);
  const vendorShare = totalTenants === 0 ? 0 : Math.round((consultancyTenants.length / totalTenants) * 100);
  const adminsPerBuyer = clientTenants.length === 0 ? '—' : (adminAccounts.length / clientTenants.length).toFixed(1);

  return (
    <div className="page">
      <WelcomeBanner
        title="Super Admin Console"
        subtitle="You are signed in as Super Admin — onboard buyer companies and provision their Admin accounts across the platform."
      >
        <Link to="/dashboard/superadmin/onboard" className="glow-btn">
          + Onboard Buyer Company
        </Link>
        <Link to="/dashboard/superadmin/onboard-vendor" className="ghost-btn">
          + Onboard Vendor
        </Link>
      </WelcomeBanner>

      <div className="stat-grid" style={{ marginTop: '16px', marginBottom: '24px' }}>
        <StatCard label="Companies" value={tenants.length} icon={Icons.building} tint="tint-black" delta={totalTenants === 0 ? 'No tenants' : '100% of all'} deltaTone="ink" />
        <StatCard label="Client (Buyer)" value={clientTenants.length} icon={Icons.briefcase} tint="tint-black" delta={`${buyerShare}% of tenants`} deltaTone="ink" />
        <StatCard label="Consultancies (Vendor)" value={consultancyTenants.length} icon={Icons.layers} tint="tint-black" delta={`${vendorShare}% of tenants`} deltaTone="ink" />
        <StatCard label="Vendor Admins (Recruiters)" value={adminAccounts.filter(u => u.role === 'Recruiter').length} icon={Icons.layers} tint="tint-black" delta={`${consultancyTenants.length === 0 ? '—' : (adminAccounts.filter(u => u.role === 'Recruiter').length / consultancyTenants.length).toFixed(1)} per vendor`} deltaTone="ink" />
        <StatCard label="Company Admins" value={adminAccounts.filter(u => u.role === 'Admin').length} icon={Icons.users} tint="tint-black" delta={`${adminsPerBuyer} per buyer`} deltaTone="ink" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading workspace...</p>
      ) : (
        <>
          <div className="glass-panel table-card">
            <div className="table-head" style={{ padding: '18px 24px' }}>
              <div>
                <h2 className="card-title">Companies</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>{tenants.length} total</p>
              </div>
            </div>
            {tenants.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No companies onboarded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Admins</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const group = tenantAdminsMap[t.id] || { admins: [], recruiters: [] };
                    const admins = group.admins;
                    const recruiters = group.recruiters;
                    return (
                      <tr key={t.id}>
                        <td className="td-title">{t.name}</td>
                        <td>
                          <span className={`type-pill ${t.tenant_type === 'client' ? 'type-client' : 'type-consultancy'}`}>
                            {t.tenant_type === 'client' ? 'Client (Buyer)' : 'Consultancy (Vendor)'}
                          </span>
                        </td>
                        <td className="td-company">
                          {admins.length === 0 && recruiters.length === 0 ? '—' : (
                            <>
                              {admins.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <strong style={{ fontSize: '0.75rem', color: '#64748b' }}>Admins:</strong>
                                  {' '}
                                  {admins.map((a) => a.email).join(', ')}
                                </div>
                              )}
                              {recruiters.length > 0 && (
                                <div>
                                  <strong style={{ fontSize: '0.75rem', color: '#64748b' }}>Recruiters:</strong>
                                  {' '}
                                  {recruiters.map((a) => a.email).join(', ')}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="td-action">
                          <div className="row-actions">
                            <span
                              className="row-action row-action-danger"
                              onClick={() => setConfirmDelete(t)}
                              style={{ cursor: 'pointer' }}
                            >
                              Delete
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete company?</h3>
            <p className="modal-text">
              This will permanently delete <strong>{confirmDelete.name}</strong> and all of its accounts.
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="danger-btn" onClick={() => handleDeleteCompany(confirmDelete)}>
                Delete Company
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
