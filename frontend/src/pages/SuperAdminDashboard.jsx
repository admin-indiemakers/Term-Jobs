import { useEffect, useState } from 'react';
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
    Promise.all([request('/api/auth/users', { token }), request('/api/auth/tenants', { token })])
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

  const clientTenants = tenants.filter((t) => t.tenant_type === 'client');
  const consultancyTenants = tenants.filter((t) => t.tenant_type === 'consultancy');
  const adminAccounts = users.filter((u) => u.role === 'Admin');

  return (
    <div className="page">
      <WelcomeBanner
        title="Super Admin Console"
        subtitle="You are signed in as Super Admin — onboard buyer companies and provision their Admin accounts across the platform."
      >
        <Link to="/dashboard/superadmin/onboard" className="glow-btn">
          + Onboard Buyer Company
        </Link>
      </WelcomeBanner>

      <div className="stat-grid">
        <StatCard label="Companies" value={tenants.length} icon={Icons.building} tint="tint-blue" />
        <StatCard label="Client (Buyer)" value={clientTenants.length} icon={Icons.briefcase} tint="tint-green" />
        <StatCard label="Consultancies (Vendor)" value={consultancyTenants.length} icon={Icons.layers} tint="tint-amber" />
        <StatCard label="Company Admins" value={adminAccounts.length} icon={Icons.users} tint="tint-violet" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading workspace...</p>
      ) : (
        <>
          <div className="glass-panel table-card">
            <div className="table-head">
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
                    const tenantAdmins = adminAccounts.filter((a) => a.tenant_id === t.id);
                    return (
                      <tr key={t.id}>
                        <td className="td-title">{t.name}</td>
                        <td>
                          <span className={`type-pill ${t.tenant_type === 'client' ? 'type-client' : 'type-consultancy'}`}>
                            {t.tenant_type === 'client' ? 'Client (Buyer)' : 'Consultancy (Vendor)'}
                          </span>
                        </td>
                        <td className="td-company">
                          {tenantAdmins.length === 0 ? '—' : tenantAdmins.map((a) => a.email).join(', ')}
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
