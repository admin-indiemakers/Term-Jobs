import { useEffect, useState } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function rolePill(role) {
  const map = {
    'Super Admin': 'role-superadmin',
    Admin: 'role-admin',
    HR: 'role-hr',
    'Hiring Manager': 'role-hiringmanager',
    Recruiter: 'role-recruiter',
  };
  return <span className={`role-pill ${map[role] || 'role-admin'}`}>{role}</span>;
}

const EMPTY_FORM = {
  company_name: '',
  name: '',
  email: '',
  password: '',
};

const EMPTY_EDIT = {
  id: '',
  email: '',
  name: '',
  password: '',
};

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [edit, setEdit] = useState(null);
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

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const tenant = await request('/api/auth/tenants', {
        method: 'POST',
        token,
        body: { name: form.company_name, tenant_type: 'client' },
      });
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          email: form.email,
          name: form.name,
          password: form.password,
          role: 'Admin',
          tenant_id: tenant.id,
        },
      });
      setSuccess(`Company "${form.company_name}" created with Admin account for ${form.email}.`);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (u) => {
    setEdit({ id: u.id, email: u.email, name: u.name || '', password: '' });
    setError('');
    setSuccess('');
  };

  const handleEditInput = (e) => {
    setEdit({ ...edit, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (edit.email !== '') payload.email = edit.email;
      if (edit.name !== '') payload.name = edit.name;
      if (edit.password) payload.password = edit.password;
      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess('Account updated.');
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleDeleteUser = async (u) => {
    setError('');
    setSuccess('');
    if (!window.confirm(`Delete account ${u.email}?`)) return;
    try {
      await request(`/api/auth/users/${u.id}`, { method: 'DELETE', token });
      setSuccess(`Account ${u.email} deleted.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const clientTenants = tenants.filter((t) => t.tenant_type === 'client');
  const consultancyTenants = tenants.filter((t) => t.tenant_type === 'consultancy');
  const admins = users.filter((u) => u.role === 'Admin');

  return (
    <div className="page">
      <WelcomeBanner
        title="Super Admin Console"
        subtitle="Onboard buyer companies and provision their Admin accounts across the platform."
      />

      <div className="stat-grid">
        <StatCard label="Companies" value={tenants.length} icon={Icons.building} tint="tint-blue" />
        <StatCard label="Client (Buyer)" value={clientTenants.length} icon={Icons.briefcase} tint="tint-green" />
        <StatCard label="Consultancies (Vendor)" value={consultancyTenants.length} icon={Icons.layers} tint="tint-amber" />
        <StatCard label="Accounts" value={users.length} icon={Icons.users} tint="tint-violet" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading workspace...</p>
      ) : (
        <>
          <div className="glass-panel">
            <div className="form-panel-head">
              <div className="form-panel-icon">{Icons.building}</div>
              <div>
                <div className="form-panel-title">Onboard Buyer Company</div>
                <div className="form-panel-caption">Creates a client tenant and its Admin account in one step.</div>
              </div>
            </div>
            <form onSubmit={handleCreateCompany}>
              <div className="form-grid">
                <div>
                  <label className="form-label">Company Name</label>
                  <input
                    type="text"
                    name="company_name"
                    required
                    minLength={2}
                    value={form.company_name}
                    onChange={handleInput}
                    className="auth-input"
                    placeholder="e.g. Acme Systems"
                  />
                </div>
                <div>
                  <label className="form-label">Admin Full Name</label>
                  <input type="text" name="name" required value={form.name} onChange={handleInput} className="auth-input" placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="form-label">Admin Email</label>
                  <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="admin@acme.com" />
                </div>
                <div>
                  <label className="form-label">Admin Password</label>
                  <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} className="auth-input" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" className="glow-btn" disabled={submitting} style={{ marginTop: 18 }}>
                {submitting ? 'Creating...' : 'Create Company + Admin'}
              </button>
            </form>
          </div>

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
                    const tenantAdmins = admins.filter((a) => a.tenant_id === t.id);
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

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">All Accounts</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>{users.length} total</p>
              </div>
            </div>
            {users.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No accounts yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="td-title">{u.name || '—'}</td>
                      <td>{u.email}</td>
                      <td>{rolePill(u.role)}</td>
                      <td className="td-company">{u.tenant_name}</td>
                      <td>{u.is_active ? 'Active' : 'Deactivated'}</td>
                      <td className="td-date">{formatDate(u.created_at)}</td>
                      <td className="td-action">
                        <div className="row-actions">
                          <span className="row-action" onClick={() => openEdit(u)} style={{ cursor: 'pointer' }}>
                            Edit
                          </span>
                          <span
                            className="row-action row-action-danger"
                            onClick={() => handleDeleteUser(u)}
                            style={{ cursor: 'pointer' }}
                          >
                            Delete
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Account</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-fields">
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" value={edit.name} onChange={handleEditInput} className="auth-input" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input type="text" name="email" required inputMode="email" value={edit.email} onChange={handleEditInput} className="auth-input" />
                </div>
                <div>
                  <label className="form-label">New Password</label>
                  <input type="password" name="password" minLength={4} value={edit.password} onChange={handleEditInput} className="auth-input" placeholder="Leave blank to keep current" />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setEdit(null)}>
                  Cancel
                </button>
                <button type="submit" className="glow-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
