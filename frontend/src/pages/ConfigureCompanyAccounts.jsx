import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, WelcomeBanner } from '../components/Dashboard';

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
    Director: 'role-director',
  };
  return <span className={`role-pill ${map[role] || 'role-admin'}`}>{role}</span>;
}

const EMPTY_EDIT = {
  id: '',
  email: '',
  name: '',
  password: '',
};

export default function ConfigureCompanyAccounts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [edit, setEdit] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    setLoading(true);
    request('/api/auth/users', { token })
      .then((usersRes) => {
        setAdmins((usersRes || []).filter((u) => u.role === 'Admin'));
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

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
      setSuccess('Admin account updated.');
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Admin account ${confirmDelete.email} deleted.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <WelcomeBanner
        title="Configure Company Accounts"
        subtitle="View and manage the Admin accounts across all buyer companies. Hiring Managers are provisioned by each company's Admin or HR."
      >
        <button className="ghost-btn" onClick={() => navigate('/dashboard/superadmin')}>
          Back to Dashboard
        </button>
      </WelcomeBanner>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="glass-panel table-card">
        <div className="table-head">
          <div>
            <h2 className="card-title">Company Admin Accounts</h2>
            <p className="muted" style={{ fontSize: '0.82rem' }}>{admins.length} total</p>
          </div>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading accounts...</p>
        ) : admins.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No Admin accounts yet.{' '}
            <button
              className="auth-switch-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}
              onClick={() => navigate('/dashboard/superadmin/onboard')}
            >
              Onboard a buyer company
            </button>
          </p>
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
              {admins.map((u) => (
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
                        onClick={() => setConfirmDelete(u)}
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

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete Admin account?</h3>
            <p className="modal-text">
              This will permanently delete the account <strong>{confirmDelete.name || confirmDelete.email}</strong> ({confirmDelete.email}).
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="danger-btn" onClick={handleDeleteUser} disabled={submitting}>
                {submitting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Admin Account</h3>
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
