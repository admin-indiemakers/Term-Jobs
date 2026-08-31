import { useEffect, useState } from 'react';
import { request, API_BASE_URL } from '../api/client';
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

const EMPTY_FORM = {
  email: '',
  name: '',
  password: '',
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
  const [edit, setEdit] = useState(null);
  const [editing, setEditing] = useState(false);
  const [calConfig, setCalConfig] = useState({ provider: null, status: 'disconnected', connected_email: null });
  const [calProviders, setCalProviders] = useState([]);
  const [savingCalendar, setSavingCalendar] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }),
      request('/requisitions', { token }),
      request('/api/auth/vendors', { token }),
      request('/api/calendar/config', { token }).catch(() => ({ provider: null, status: 'disconnected', connected_email: null })),
      request('/api/calendar/providers', { token }).catch(() => ({ providers: [] })),
    ])
      .then(([usersRes, reqsRes, vendorsRes, calConfigRes, calProvidersRes]) => {
        setUsers(usersRes || []);
        setRequisitions(reqsRes || []);
        setVendors(vendorsRes || []);
        setCalConfig(calConfigRes || { provider: null, status: 'disconnected', connected_email: null });
        setCalProviders(calProvidersRes?.providers || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cal = params.get('calendar');
    if (cal === 'connected') {
      setSuccess('Company calendar connected successfully.');
    } else if (cal === 'error') {
      setError('Could not connect the calendar. Please try again.');
    }
    if (cal) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSaveCalConfig = async (e) => {
    e?.preventDefault();
    setSavingCalendar(true);
    setError('');
    setSuccess('');
    try {
      const updated = await request('/api/calendar/config', {
        method: 'PUT',
        token,
        body: {
          provider: 'cal',
          status: 'connected',
          cal_link: calConfig.cal_link || 'https://cal.com/',
          cal_username: calConfig.cal_username || '',
          event_slug: calConfig.event_slug || '30min',
          default_duration: Number(calConfig.default_duration) || 60,
          default_timezone: calConfig.default_timezone || 'Asia/Kolkata',
          instructions: calConfig.instructions || '',
        },
      });
      setCalConfig(updated);
      setSuccess('Cal.com / Cal.diy scheduling settings saved successfully.');
    } catch (err) {
      setError(err.message || 'Failed to save Cal.com settings.');
    } finally {
      setSavingCalendar(false);
    }
  };

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
    setSavingVendors(true);
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
      setSuccess(`Vendor partnerships updated — ${updated.filter((v) => v.engaged).length} engaged.`);
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
        role: 'Hiring Manager',
      };
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
      setSuccess(`Hiring Manager account ${edit.email} updated.`);
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditing(false);
    }
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

  const scrollToAddTeam = () => {
    document.getElementById('add-team')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToVendors = () => {
    document.getElementById('vendor-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const hiringManagers = users.filter((u) => u.role === 'Hiring Manager');
  const directors = users.filter((u) => u.role === 'Director');
  const published = requisitions.filter((r) => r.status === 'Published').length;
  const pending = requisitions.filter((r) => r.status === 'PendingApproval').length;

  return (
    <div className="page">
      <WelcomeBanner
        title="Admin Console"
        subtitle={`${user.tenant_name} workspace — manage your Hiring Managers and Directors, and oversee requisitions.`}
      >
        <button className="glow-btn" onClick={scrollToAddTeam}>
          + Invite Team Member
        </button>
      </WelcomeBanner>

      <div className="stat-grid">
        <StatCard label="Hiring Managers" value={hiringManagers.length} icon={Icons.usersPlus} />
        <StatCard label="Directors" value={directors.length} icon={Icons.shield} />
        <StatCard label="Requisitions" value={requisitions.length} icon={Icons.briefcase} />
        <StatCard label="Pending Approval" value={pending} icon={Icons.clock} />
        <StatCard label="Published" value={published} icon={Icons.check} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="form-panel-icon" style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Icons.users}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Partner Vendors</h3>
              <p className="muted" style={{ fontSize: '0.84rem', margin: '3px 0 0' }}>
                {vendors.filter((v) => v.engaged).length} of {vendors.length} consultancy vendors engaged.
              </p>
            </div>
          </div>
          <button className="glow-btn" onClick={() => navigate('/dashboard/admin/partner-vendors')}>
            Manage Vendors & Partnerships →
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ borderRadius: '18px', padding: '26px', marginBottom: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
              📅
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Cal.com / Cal.diy Integration
                </h3>
                <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', border: '1px solid #a7f3d0' }}>
                  ✓ Connected & Active
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
                Connect your Cal.com (or self-hosted Cal.diy) scheduling link. Hiring Managers will use this to generate live candidate booking slots.
              </p>
            </div>
          </div>

          {calConfig.cal_link && calConfig.cal_link !== 'https://cal.com/' && (
            <a
              href={calConfig.cal_link.startsWith('http') ? calConfig.cal_link : `https://cal.com/${calConfig.cal_link}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#f1f5f9',
                color: '#0f172a',
                fontSize: '0.82rem',
                fontWeight: 700,
                textDecoration: 'none',
                border: '1px solid #cbd5e1',
              }}
            >
              🔗 Test Live Booking Page ↗
            </a>
          )}
        </div>

        <form onSubmit={handleSaveCalConfig}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Cal.com / Cal.diy Base URL or Handle
              </label>
              <input
                type="text"
                className="auth-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.88rem' }}
                placeholder="e.g. https://cal.com/bearitt-team or bearitt-hiring"
                value={calConfig.cal_link || ''}
                onChange={(e) => setCalConfig({ ...calConfig, cal_link: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Enter your free Cal.com URL (e.g. <code>https://cal.com/your-name</code>) or self-hosted Cal.diy link.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Default Event Type Slug
              </label>
              <input
                type="text"
                className="auth-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.88rem' }}
                placeholder="e.g. 30min or technical-interview"
                value={calConfig.event_slug || '30min'}
                onChange={(e) => setCalConfig({ ...calConfig, event_slug: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                The event type name on Cal.com (e.g. <code>30min</code>, <code>technical-round</code>).
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Default Interview Duration
              </label>
              <select
                className="auth-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem' }}
                value={calConfig.default_duration || 60}
                onChange={(e) => setCalConfig({ ...calConfig, default_duration: Number(e.target.value) })}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={90}>90 Minutes (1.5 Hours)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Company Timezone
              </label>
              <select
                className="auth-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '0.85rem' }}
                value={calConfig.default_timezone || 'Asia/Kolkata'}
                onChange={(e) => setCalConfig({ ...calConfig, default_timezone: e.target.value })}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                <option value="America/New_York">America/New York (EST - UTC-5)</option>
                <option value="America/Los_Angeles">America/Los Angeles (PST - UTC-8)</option>
                <option value="Europe/London">Europe/London (GMT - UTC+0)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST - UTC+4)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+8)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="submit"
              className="glow-btn"
              style={{ padding: '10px 24px', fontSize: '0.88rem' }}
              disabled={savingCalendar}
            >
              {savingCalendar ? 'Saving...' : '💾 Save Cal.com Settings'}
            </button>
          </div>
        </form>
      </div>

      

      

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading workspace...</p>
      ) : (
        <>
          <div className="glass-panel" id="add-team">
            <div className="card-head-row">
              <div className="form-panel-head">
                <div className="form-panel-icon">{Icons.users}</div>
                <div>
                  <div className="form-panel-title">Add Hiring Manager</div>
                  <div className="form-panel-caption">Create a Hiring Manager account to manage requisitions. Directors are managed from the Workspace menu.</div>
                </div>
              </div>
              <button type="submit" form="add-team-form" className="glow-btn" disabled={submitting} style={{ flexShrink: 0 }}>
                {submitting ? 'Creating...' : 'Create Hiring Manager Account'}
              </button>
            </div>
            <form id="add-team-form" onSubmit={handleCreateUser}>
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
              </div>
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
