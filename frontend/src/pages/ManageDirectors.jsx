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
};

const EMPTY_EDIT = {
  id: '',
  email: '',
  name: '',
  password: '',
};

export default function ManageDirectors() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [directors, setDirectors] = useState([]);
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
        setDirectors((usersRes || []).filter((u) => u.role === 'Director'));
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

  const handleCreateDirector = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: { email: form.email, name: form.name, password: form.password, role: 'Director' },
      });
      setSuccess(`Director account created for ${form.email}.`);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDirector = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Director account ${confirmDelete.email} removed.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (u) => {
    setEdit({ ...EMPTY_EDIT, id: u.id, email: u.email, name: u.name || '' });
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
      if (edit.password) payload.password = edit.password;
      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Director account ${edit.email} updated.`);
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
        title="Directors"
        subtitle={`Create and manage Director accounts in the ${user.tenant_name} workspace. Directors get read-only executive access to requisitions, shortlists and vendor engagement.`}
      >
        <button className="ghost-btn" onClick={() => navigate('/dashboard/admin')}>
          Back to Dashboard
        </button>
      </WelcomeBanner>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="glass-panel" id="create-director">
        <div className="card-head-row">
          <div className="form-panel-head">
            <div className="form-panel-icon">{Icons.shield}</div>
            <div>
              <div className="form-panel-title">Create Director</div>
              <div className="form-panel-caption">Provision a new Director account for executive read-only access.</div>
            </div>
          </div>
          <button type="submit" form="create-director-form" className="glow-btn" disabled={submitting} style={{ flexShrink: 0 }}>
            {submitting ? 'Creating...' : 'Create Director Account'}
          </button>
        </div>
        <form id="create-director-form" onSubmit={handleCreateDirector}>
          <div className="form-grid">
            <div>
              <label className="form-label">Full Name</label>
              <input type="text" name="name" required value={form.name} onChange={handleInput} className="auth-input" placeholder="e.g. Rajesh Kumar" />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="director@company.com" />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} className="auth-input" placeholder="••••••••" />
            </div>
          </div>
        </form>
      </div>

      <div className="glass-panel table-card">
        <div className="table-head">
          <div>
            <h2 className="card-title">Directors</h2>
            <p className="muted" style={{ fontSize: '0.82rem' }}>{directors.length} total</p>
          </div>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading directors...</p>
        ) : directors.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No Director accounts yet. Directors log in at the Director Portal (read-only executive access).
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {directors.map((u) => (
                <tr key={u.id}>
                  <td className="td-title">{u.name || '—'}</td>
                  <td>{u.email}</td>
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
            <h3 className="modal-title">Remove Director account?</h3>
            <p className="modal-text">
              This will permanently delete the account <strong>{confirmDelete.name || confirmDelete.email}</strong> ({confirmDelete.email}).
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="danger-btn" onClick={handleDeleteDirector} disabled={deleting}>
                {deleting ? 'Removing...' : 'Remove Account'}
              </button>
            </div>
          </div>
        </div>
      )}
      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Director Account</h3>
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
