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
    Director: 'role-director',
  };
  return <span className={`role-pill ${map[role] || 'role-admin'}`}>{role}</span>;
}

const ROLE_OPTIONS = [
  { value: 'Hiring Manager', label: 'Hiring Manager', hint: 'Creates and manages requisitions' },
  { value: 'Director', label: 'Director', hint: 'Read-only executive portal' },
  { value: 'HR', label: 'HR', hint: 'Oversees Hiring Managers' },
];

const EMPTY_FORM = {
  email: '',
  name: '',
  password: '',
  department: '',
  role: 'Hiring Manager',
};

const EMPTY_PWD = {
  current_password: '',
  new_password: '',
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
  const [pwdForm, setPwdForm] = useState(EMPTY_PWD);
  const [changingPwd, setChangingPwd] = useState(false);

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
      const payload = {
        email: form.email,
        name: form.name,
        password: form.password,
        role: form.role,
      };
      if (form.role === 'Hiring Manager') payload.department = form.department;
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: payload,
      });
      setSuccess(`${form.role} account created for ${form.email}.`);
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
      setSuccess(`${confirmDelete.role} account ${confirmDelete.email} deleted.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handlePwdInput = (e) => {
    setPwdForm({ ...pwdForm, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangingPwd(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        token,
        body: { current_password: pwdForm.current_password, new_password: pwdForm.new_password },
      });
      setSuccess('Your password has been updated.');
      setPwdForm({ ...EMPTY_PWD });
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingPwd(false);
    }
  };

  const hiringManagers = users.filter((u) => u.role === 'Hiring Manager');
  const directors = users.filter((u) => u.role === 'Director');
  const hrList = users.filter((u) => u.role === 'HR');
  const published = requisitions.filter((r) => r.status === 'Published').length;
  const pending = requisitions.filter((r) => r.status === 'PendingApproval').length;

  return (
    <div className="page">
      <WelcomeBanner
        title="Admin Console"
        subtitle={`${user.tenant_name} workspace — manage your Hiring Managers, Directors and HR, and oversee requisitions.`}
      />

      <div className="stat-grid">
        <StatCard label="Hiring Managers" value={hiringManagers.length} icon={Icons.usersPlus} tint="tint-blue" />
        <StatCard label="Directors" value={directors.length} icon={Icons.shield} tint="tint-amber" />
        <StatCard label="HR" value={hrList.length} icon={Icons.users} tint="tint-violet" />
        <StatCard label="Requisitions" value={requisitions.length} icon={Icons.briefcase} tint="tint-sky" />
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
                <div className="form-panel-title">Add Team Member</div>
                <div className="form-panel-caption">Create a Hiring Manager, Director or HR account in the {user.tenant_name} workspace.</div>
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
                  <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="member@company.com" />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} className="auth-input" placeholder="••••••••" />
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <select name="role" value={form.role} onChange={handleInput} className="auth-input">
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
                    ))}
                  </select>
                </div>
                {form.role === 'Hiring Manager' && (
                  <div>
                    <label className="form-label">Department <span className="form-optional">(optional)</span></label>
                    <input type="text" name="department" value={form.department} onChange={handleInput} className="auth-input" placeholder="e.g. Engineering, Sales, HR" />
                  </div>
                )}
              </div>
              <button type="submit" className="glow-btn" disabled={submitting} style={{ marginTop: 18 }}>
                {submitting ? 'Creating...' : `Create ${form.role} Account`}
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
                <h2 className="card-title">Directors</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>{directors.length} total</p>
              </div>
            </div>
            {directors.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>
                No Director accounts yet. Directors log in at the Director Portal (read-only executive access).
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
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
                <h2 className="card-title">HR</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>{hrList.length} total</p>
              </div>
            </div>
            {hrList.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No HR accounts yet. HR oversees the Hiring Managers.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {hrList.map((u) => (
                    <tr key={u.id}>
                      <td className="td-title">{u.name || '—'}</td>
                      <td>{u.email}</td>
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

          <div className="glass-panel">
            <div className="form-panel-head">
              <div className="form-panel-icon">{Icons.shield}</div>
              <div>
                <div className="form-panel-title">Change Password</div>
                <div className="form-panel-caption">Update your own Admin account password. You'll need to re-verify your current password.</div>
              </div>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-grid">
                <div>
                  <label className="form-label">Current Password</label>
                  <input type="password" name="current_password" required value={pwdForm.current_password} onChange={handlePwdInput} className="auth-input" placeholder="••••••••" />
                </div>
                <div>
                  <label className="form-label">New Password</label>
                  <input type="password" name="new_password" required minLength={4} value={pwdForm.new_password} onChange={handlePwdInput} className="auth-input" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" className="ghost-btn" disabled={changingPwd} style={{ marginTop: 18 }}>
                {changingPwd ? 'Updating...' : 'Update Password'}
              </button>
            </form>
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
            <h3 className="modal-title">Remove {confirmDelete.role} account?</h3>
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
