import { useEffect, useState, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/emailValidation';
import {
  Link2,
  Check,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
  DollarSign,
  CreditCard
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
  department: 'Finance & Accounts',
};

export default function ManageFinance() {
  const { user, token } = useAuth();

  const [financeUsers, setFinanceUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editing, setEditing] = useState(false);
  const [emailError, setEmailError] = useState('');

  const load = () => {
    setLoading(true);
    request('/api/auth/users?role=Finance+Team,Finance', { token })
      .then((data) => {
        setFinanceUsers(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/finance?company=${encodeURIComponent(user?.tenant_name || 'Bearitt')}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setSuccess('Invite link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApproveFinance = async (finUser) => {
    setApprovingId(finUser.id);
    setError(''); setSuccess('');
    try {
      await request(`/api/auth/users/${finUser.id}/approve`, { method: 'POST', token });
      setSuccess(`Finance Team member "${finUser.name || finUser.email}" approved successfully.`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve finance account');
    } finally { setApprovingId(null); }
  };

  const handleInput = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

  const handleCreateFinance = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setError('Please fill in all required fields.'); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr) { setEmailError(emailErr); return; }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST', token,
        body: { role: 'Finance Team', name: form.name.trim(), email: form.email.trim(), password: form.password, department: form.department?.trim() || 'Finance & Accounts' },
      });
      setSuccess(`Finance Team account created for ${form.email}.`);
      setForm(EMPTY_FORM); setEmailError(''); setShowCreateModal(false); load();
    } catch (err) { setError(err.message || 'Failed to create finance account'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteFinance = async () => {
    if (!confirmDelete) return;
    setDeleting(true); setError(''); setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Finance account "${confirmDelete.name || confirmDelete.email}" removed.`);
      setConfirmDelete(null); load();
    } catch (err) { setError(err.message || 'Failed to remove account'); }
    finally { setDeleting(false); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!edit) return;
    setEditing(true); setError(''); setSuccess('');
    try {
      const payload = {};
      if (edit.email !== '') payload.email = edit.email.trim();
      if (edit.name !== '') payload.name = edit.name.trim();
      if (edit.department !== undefined) payload.department = edit.department.trim();
      if (edit.password) payload.password = edit.password;
      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Finance member "${edit.name || edit.email}" updated successfully.`);
      setEdit(null); load();
    } catch (err) { setError(err.message || 'Failed to update finance account'); }
    finally { setEditing(false); }
  };

  const filteredFinance = useMemo(() => {
    if (!searchQuery.trim()) return financeUsers;
    const q = searchQuery.toLowerCase();
    return financeUsers.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  }, [financeUsers, searchQuery]);

  const activeCount = useMemo(() => financeUsers.filter((u) => u.is_active !== false).length, [financeUsers]);

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • FINANCE GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Finance &amp; Accounts Team
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Manage finance accounts overseeing invoices, billing, and expense disbursements.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button type="button" onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <UserPlus size={14} />
            <span>+ Create Finance Member</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs shrink-0">
          <AlertCircle size={15} className="shrink-0 text-red-500" /><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /><span>{success}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-[calc(100vh-260px)] flex flex-col lg:flex-row gap-3.5 items-stretch overflow-hidden">
        {/* Left: Table Card */}
        <div className="flex-1 min-w-0 h-full min-h-[calc(100vh-260px)] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or department..."
                className="w-full pl-9 pr-12 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all" />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded-md bg-white/80 border border-gray-200/80 shadow-3xs">cmd K</span>
              </div>
            </div>
            <button type="button" onClick={handleCopyInviteLink}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors shrink-0 cursor-pointer">
              <Link2 size={13} /><span>{copied ? 'Copied!' : 'Invite Link'}</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full py-12"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
            ) : filteredFinance.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-center">
                <DollarSign size={28} className="text-gray-300" />
                <p className="text-xs text-gray-400 font-medium">No finance accounts found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.04] text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">NAME</th>
                    <th className="py-2.5 px-2">EMAIL</th>
                    <th className="py-2.5 px-2">DEPARTMENT</th>
                    <th className="py-2.5 px-2">ROLE / ACCESS</th>
                    <th className="py-2.5 px-2">STATUS</th>
                    <th className="py-2.5 px-2">CREATED</th>
                    <th className="py-2.5 px-2 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFinance.map((u) => (
                    <tr key={u.id} className="border-b border-black/[0.03] hover:bg-black/[0.015] transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 leading-tight">{u.name || '—'}</div>
                            <div className="text-[10px] text-gray-400 font-medium">Finance Team</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-gray-600 font-medium">{u.email}</td>
                      <td className="py-3 px-2 text-gray-500 font-medium text-[11px]">{u.department || 'Finance & Accounts'}</td>
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          <ShieldCheck size={11} className="text-gray-500" /><span>Finance & Invoicing</span>
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {u.is_active !== false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-gray-500 font-medium">{formatDate(u.created_at)}</td>
                      <td className="py-3 px-2 text-right">
                        {u.is_active === false ? (
                          <div className="inline-flex items-center gap-2">
                            <button type="button" onClick={() => handleApproveFinance(u)} disabled={approvingId === u.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50">
                              <Check size={11} /><span>{approvingId === u.id ? 'Approving...' : 'Approve'}</span>
                            </button>
                            <button type="button" onClick={() => setConfirmDelete(u)} className="font-bold text-red-500 hover:text-red-700 text-[10px] transition-colors cursor-pointer">Reject</button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-3">
                            <button type="button" onClick={() => setEdit({ ...u, password: '' })} className="font-bold text-gray-700 hover:text-black text-[10px] transition-colors cursor-pointer">Edit</button>
                            <button type="button" onClick={() => setConfirmDelete(u)} className="font-bold text-red-500 hover:text-red-700 text-[10px] transition-colors cursor-pointer">Remove</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: 3 Stat Cards */}
        <div className="flex lg:flex-col gap-2.5 lg:w-44 xl:w-48 shrink-0 flex-row">
          <div className="flex-1 lg:flex-none h-[102px] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <UserPlus size={15} className="text-gray-400" />
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">Active</span>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">{financeUsers.length}</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">Total Members</div>
            </div>
          </div>
          <div className="flex-1 lg:flex-none h-[102px] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <CreditCard size={15} className="text-gray-400" />
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">+0%</span>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">{activeCount}</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">Active Accounts</div>
            </div>
          </div>
          <div className="flex-1 lg:flex-none h-[102px] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <DollarSign size={15} className="text-gray-400" />
              <span className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-700">›</span>
            </div>
            <div>
              <div className="text-sm font-extrabold text-gray-900 tracking-tight leading-none">Billing</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">Invoicing and disbursements</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={() => setShowCreateModal(false)}>
          <div className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Create Finance Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Provision a finance account for {user?.tenant_name || 'your company'}.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateFinance} className="space-y-3.5" autoComplete="off">
              <input type="text" name="prevent_autofill_name" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} autoComplete="off" readOnly />
              <input type="password" name="prevent_autofill_pwd" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} autoComplete="new-password" readOnly />
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Full Name *</label>
                <input type="text" name="name" required value={form.name} onChange={handleInput} placeholder="e.g. Rachel Green"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Email Address *</label>
                <input type="email" name="finance_email" autoComplete="off" data-lpignore="true" data-form-type="other" required value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailError(validateEmail(e.target.value)); setError(''); }} placeholder="finance@company.com"
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 transition-all ${emailError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-black'}`} />
                {emailError && (
                  <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1"><span>⚠</span> {emailError}</p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Department</label>
                <input type="text" name="department" value={form.department} onChange={handleInput} placeholder="e.g. Finance, Accounting"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Initial Password *</label>
                <input type="password" name="finance_password" autoComplete="new-password" data-lpignore="true" data-form-type="other" required minLength={4}
                  value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }} placeholder="..."
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowCreateModal(false)} disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  {submitting && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={() => setEdit(null)}>
          <div className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Edit Finance Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials for {edit.email}.</p>
              </div>
              <button type="button" onClick={() => setEdit(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3.5" autoComplete="off">
              <input type="text" name="prevent_autofill_name" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} autoComplete="off" readOnly />
              <input type="password" name="prevent_autofill_pwd" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} autoComplete="new-password" readOnly />
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Full Name *</label>
                <input type="text" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Email Address *</label>
                <input type="email" name="finance_edit_email" autoComplete="off" data-lpignore="true" data-form-type="other" required
                  value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Department</label>
                <input type="text" value={edit.department || ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} placeholder="Finance and Accounts"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
                <input type="password" name="finance_edit_password" autoComplete="new-password" data-lpignore="true" data-form-type="other"
                  minLength={4} value={edit.password || ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="..."
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEdit(null)} disabled={editing}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={editing}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={() => setConfirmDelete(null)}>
          <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">Remove Finance Member?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently delete <strong>{confirmDelete.name || confirmDelete.email}</strong> ({confirmDelete.email}). This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={handleDeleteFinance} disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
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
