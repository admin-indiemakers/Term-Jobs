import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Link2,
  Check,
  UserPlus,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
};

export default function ManageProcurement() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [procurementUsers, setProcurementUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => {
    setLoading(true);
    request('/api/auth/users', { token })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        setProcurementUsers(all.filter((u) => u.role === 'Procurement Team' || u.role === 'Procurement'));
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  // 2-second auto-dismiss timer for success notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/procurement?company=${encodeURIComponent(user?.tenant_name || 'Bearitt')}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setSuccess('Invite link copied to clipboard! Anyone with this link can request Procurement Team access.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApproveProcurement = async (procUser) => {
    setApprovingId(procUser.id);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${procUser.id}/approve`, {
        method: 'POST',
        token,
      });
      setSuccess(`Procurement Team member "${procUser.name || procUser.email}" approved and activated successfully.`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve procurement account');
    } finally {
      setApprovingId(null);
    }
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleCreateProcurement = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          role: 'Procurement Team',
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        },
      });
      setSuccess(`Procurement Team account created for ${form.email}.`);
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to create procurement account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProcurement = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Procurement account "${confirmDelete.name || confirmDelete.email}" removed.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to remove account');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!edit) return;
    setEditing(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (edit.email !== '') payload.email = edit.email.trim();
      if (edit.name !== '') payload.name = edit.name.trim();
      if (edit.password) payload.password = edit.password;

      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Procurement member "${edit.name || edit.email}" updated successfully.`);
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to update procurement account');
    } finally {
      setEditing(false);
    }
  };

  const filteredProcurement = useMemo(() => {
    if (!searchQuery.trim()) return procurementUsers;
    const q = searchQuery.toLowerCase();
    return procurementUsers.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [procurementUsers, searchQuery]);

  const activeCount = useMemo(() => procurementUsers.filter((u) => u.is_active !== false).length, [procurementUsers]);

  return (
    <div
      className="w-full min-w-0 pb-12 space-y-5 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Header Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={13} />
              Dashboard
            </button>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              PROCUREMENT GOVERNANCE
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Procurement Team
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Manage Procurement Team accounts in the {user?.tenant_name || 'company'} workspace. Procurement members handle commercial rate cards, work orders, and financial approvals across pipelines.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {user?.tenant_name || 'Client'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {procurementUsers.length} active procurement members
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Copy public invite link for new Procurement Members"
          >
            <Link2 size={14} className="text-gray-500" />
            <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Create Procurement Member</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            TOTAL PROCUREMENT
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {procurementUsers.length}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Registered commercial managers
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            ACTIVE ACCOUNTS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {activeCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Operational procurement logins
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            ACCESS LEVEL
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            Commercials
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Rate card & WO governance
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Procurement Data Table Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Active Procurement Members</h2>
            <p className="text-xs text-gray-500">All procurement credentials provisioned under {user?.tenant_name}</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading procurement accounts...</div>
        ) : filteredProcurement.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No procurement accounts found matching your query.
          </div>
        ) : (
          <div
            className="overflow-x-auto overflow-y-auto pr-1"
            style={{
              maxHeight: '520px',
              minHeight: '340px',
            }}
          >
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-3 px-3">NAME</th>
                  <th className="py-3 px-3">EMAIL</th>
                  <th className="py-3 px-3">ROLE / ACCESS</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3">CREATED</th>
                  <th className="py-3 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProcurement.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Name with Avatar */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{u.name || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-3 text-gray-600 font-medium">
                      {u.email}
                    </td>

                    {/* Role / Access Level */}
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        <ShieldCheck size={11} className="text-gray-500" />
                        <span>Procurement & Commercials</span>
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3">
                      {u.is_active !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Approval
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-3 text-gray-500 font-medium">
                      {formatDate(u.created_at)}
                    </td>

                    {/* Actions (Approve / Reject for pending, Edit / Remove for active) */}
                    <td className="py-3.5 px-3 text-right">
                      {u.is_active === false ? (
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleApproveProcurement(u)}
                            disabled={approvingId === u.id}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Check size={13} />
                            <span>{approvingId === u.id ? 'Approving...' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(u)}
                            className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEdit({ ...u, password: '' })}
                            className="font-bold text-gray-900 hover:text-black text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(u)}
                            className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Procurement Member Modal Popup */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Create Procurement Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Provision a procurement account for {user?.tenant_name || 'your company'}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProcurement} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleInput}
                  placeholder="e.g. Aditi Varma"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleInput}
                  placeholder="procurement@company.com"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={4}
                  value={form.password}
                  onChange={handleInput}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Procurement Member Modal */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setEdit(null)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Edit Procurement Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials for {edit.email}.</p>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  minLength={4}
                  value={edit.password || ''}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEdit(null)}
                  disabled={editing}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editing && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Remove Procurement Member?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently delete the account <strong>{confirmDelete.name || confirmDelete.email}</strong> ({confirmDelete.email}). This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProcurement}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 size={13} className="animate-spin text-white" />}
                <span>Remove Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
