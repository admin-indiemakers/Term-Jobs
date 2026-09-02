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

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  department: '',
};

const EMPTY_EDIT = {
  id: '',
  email: '',
  name: '',
  password: '',
  department: '',
};

export default function ManageHiringManagers() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => {
    setLoading(true);
    request('/api/auth/users', { token })
      .then((usersRes) => {
        setManagers((usersRes || []).filter((u) => u.role === 'Hiring Manager'));
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

  const handleCreateManager = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = { email: form.email, name: form.name, password: form.password, role: 'Hiring Manager' };
      if (form.department) payload.department = form.department;
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: payload,
      });
      setSuccess(`Hiring Manager account created for ${form.email}.`);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteManager = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Hiring Manager account ${confirmDelete.email} removed.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (u) => {
    setEdit({ ...EMPTY_EDIT, id: u.id, email: u.email, name: u.name || '', department: u.department || '' });
    setError('');
    setSuccess('');
  };

  const handleEditInput = (e) => {
    setEdit({ ...edit, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!edit) return;
    setEditing(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (edit.email !== '') payload.email = edit.email;
      if (edit.name !== '') payload.name = edit.name;
      if (edit.department !== '') payload.department = edit.department;
      if (edit.password) payload.password = edit.password;
      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Hiring Manager account ${edit.email} updated.`);
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditing(false);
    }
  };

  return (
    <div className="page">
      <WelcomeBanner
        title="Hiring Managers"
        subtitle={`Create and manage Hiring Manager accounts in the ${user.tenant_name} workspace. Hiring Managers create and manage requisitions.`}
      >
        <button className="ghost-btn" onClick={() => navigate('/dashboard/admin')}>
          Back to Dashboard
        </button>
      </WelcomeBanner>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="glass-panel" id="create-hm">
        <div className="card-head-row">
          <div className="form-panel-head">
            <div className="form-panel-icon">{Icons.usersPlus}</div>
            <div>
              <div className="form-panel-title">Create Hiring Manager</div>
              <div className="form-panel-caption">Provision a new Hiring Manager account for your team.</div>
            </div>
          </div>
          <button type="submit" form="create-hm-form" className="glow-btn" disabled={submitting} style={{ flexShrink: 0 }}>
            {submitting ? 'Creating...' : 'Create Hiring Manager'}
          </button>
        </div>
        <form id="create-hm-form" onSubmit={handleCreateManager}>
          <div className="form-grid">
            <div>
              <label className="form-label">Full Name</label>
              <input type="text" name="name" required value={form.name} onChange={handleInput} className="auth-input" placeholder="e.g. Rahul Sharma" />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="manager@company.com" />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} className="auth-input" placeholder="••••••••" />
            </div>
            <div>
              <label className="form-label">Department <span className="form-optional">(optional)</span></label>
              <input type="text" name="department" value={form.department} onChange={handleInput} className="auth-input" placeholder="e.g. Engineering, Sales, HR" />
            </div>
          </div>
        </form>
      </div>

      <div className="glass-panel table-card">
        <div className="table-head">
          <div>
            <h2 className="card-title">Hiring Managers</h2>
            <p className="muted" style={{ fontSize: '0.82rem' }}>{managers.length} total</p>
          </div>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading hiring managers...</p>
        ) : managers.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>No Hiring Manager accounts yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {managers.map((u) => (
                <tr key={u.id}>
                  <td className="td-title">{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.department || <span className="muted">—</span>}</td>
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
                        Remove
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
            <h3 className="modal-title">Remove Hiring Manager account?</h3>
            <p className="modal-text">
              This will permanently delete the account <strong>{confirmDelete.name || confirmDelete.email}</strong> ({confirmDelete.email}).
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="danger-btn" onClick={handleDeleteManager} disabled={deleting}>
                {deleting ? 'Removing...' : 'Remove Account'}
              </button>
            </div>
          </div>
        </div>
      )}
      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Hiring Manager Account</h3>
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
                  <label className="form-label">Department</label>
                  <input type="text" name="department" value={edit.department} onChange={handleEditInput} className="auth-input" placeholder="e.g. Engineering, Sales, HR" />
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
                <button type="submit" className="glow-btn" disabled={editing}>
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
