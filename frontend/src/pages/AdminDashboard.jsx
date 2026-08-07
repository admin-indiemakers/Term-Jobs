import { useEffect, useState } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
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
  email: '',
  name: '',
  password: '',
  department: '',
};

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingVendors, setSavingVendors] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([request('/api/auth/users', { token }), request('/requisitions', { token }), request('/api/auth/vendors', { token })])
      .then(([usersRes, reqsRes, vendorsRes]) => {
        setUsers(usersRes || []);
        setRequisitions(reqsRes || []);
        setVendors(vendorsRes || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const toggleVendor = (id) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, engaged: !v.engaged } : v)));
    setError('');
    setSuccess('');
  };

  const saveVendors = async () => {
    setSavingVendors(true);
    setError('');
    setSuccess('');
    try {
      const selected = vendors.filter((v) => v.engaged).map((v) => v.id);
      const updated = await request('/api/auth/vendors', {
        method: 'PUT',
        token,
        body: { vendor_tenant_ids: selected },
      });
      setVendors(updated || []);
      setSuccess(`Vendor partnerships updated — ${updated.length} engaged.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVendors(false);
    }
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          email: form.email,
          name: form.name,
          password: form.password,
          role: 'Hiring Manager',
          department: form.department,
        },
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

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Hiring Manager account ${confirmDelete.email} deleted.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const hiringManagers = users.filter((u) => u.role === 'Hiring Manager');
  const published = requisitions.filter((r) => r.status === 'Published').length;
  const pending = requisitions.filter((r) => r.status === 'PendingApproval').length;

  return (
    <div className="page">
      <WelcomeBanner
        title="Admin Console"
        subtitle={`${user.tenant_name} workspace — manage your Hiring Managers and oversee requisitions.`}
      />

      <div className="stat-grid">
        <StatCard label="Hiring Managers" value={hiringManagers.length} icon={Icons.usersPlus} tint="tint-blue" />
        <StatCard label="Requisitions" value={requisitions.length} icon={Icons.briefcase} tint="tint-violet" />
        <StatCard label="Pending Approval" value={pending} icon={Icons.clock} tint="tint-amber" />
        <StatCard label="Published" value={published} icon={Icons.check} tint="tint-green" />
      </div>

      <div className="glass-panel">
        <div className="form-panel-head">
          <div className="form-panel-icon">{Icons.users}</div>
          <div>
            <div className="form-panel-title">Partner Vendors</div>
            <div className="form-panel-caption">
              Select which consultancy vendors your Hiring Managers work with. Only engaged vendors can see your company's published requisitions and submit screened candidates.
            </div>
          </div>
        </div>
        {loading ? (
          <p className="muted">Loading vendors...</p>
        ) : vendors.length === 0 ? (
          <p className="muted">
            No vendor consultancies onboarded yet. Ask the Super Admin to onboard vendors before you can partner with them.
          </p>
        ) : (
          <div>
            <div className="vendor-grid">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  className={`vendor-card ${v.engaged ? 'vendor-card-selected' : ''}`}
                  onClick={() => toggleVendor(v.id)}
                >
                  <div className="vendor-card-top">
                    <span className="vendor-check">{v.engaged ? '✓' : ''}</span>
                    <span className="vendor-name">{v.name}</span>
                  </div>
                  <div className="vendor-meta">
                    {v.location && <span>{v.location}</span>}
                    {v.industry && <span>{v.industry}</span>}
                    {v.size && <span>{v.size}</span>}
                  </div>
                  {v.specializations.length > 0 && (
                    <div className="vendor-tags">
                      {v.specializations.slice(0, 4).map((s) => (
                        <span key={s} className="vendor-tag">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="glow-btn" style={{ marginTop: 16 }} onClick={saveVendors} disabled={savingVendors}>
              {savingVendors ? 'Saving...' : 'Save Vendor Partnerships'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading workspace...</p>
      ) : (
        <>
          <div className="glass-panel">
            <div className="form-panel-head">
              <div className="form-panel-icon">{Icons.usersPlus}</div>
              <div>
                <div className="form-panel-title">Create Hiring Manager Account</div>
                <div className="form-panel-caption">New accounts are attached to your {user.tenant_name} workspace.</div>
              </div>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-grid">
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" required value={form.name} onChange={handleInput} className="auth-input" placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="hm@company.com" />
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
              <button type="submit" className="glow-btn" disabled={submitting} style={{ marginTop: 18 }}>
                {submitting ? 'Creating...' : 'Create Hiring Manager'}
              </button>
            </form>
          </div>

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Hiring Managers</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>{hiringManagers.length} total</p>
              </div>
            </div>
            {hiringManagers.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No Hiring Manager accounts yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {hiringManagers.map((u) => (
                    <tr key={u.id}>
                      <td className="td-title">{u.name || '—'}</td>
                      <td>{u.email}</td>
                      <td>{u.department || <span className="muted">—</span>}</td>
                      <td>{rolePill(u.role)}</td>
                      <td>{u.is_active ? 'Active' : 'Deactivated'}</td>
                      <td className="td-date">{formatDate(u.created_at)}</td>
                      <td className="td-action">
                        <div className="row-actions">
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

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Requisitions</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Read-only — view requisitions and their status</p>
              </div>
            </div>
            {requisitions.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No requisitions in this workspace yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((r) => (
                    <tr key={r.id}>
                      <td className="td-title">{r.title || 'Untitled'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="td-date">{formatDate(r.created_at)}</td>
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
            <h3 className="modal-title">Remove Hiring Manager?</h3>
            <p className="modal-text">
              This will permanently delete the account <strong>{confirmDelete.name || confirmDelete.email}</strong>{' '}
              ({confirmDelete.email}). This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="danger-btn" onClick={handleDeleteUser} disabled={deleting}>
                {deleting ? 'Removing...' : 'Remove Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
