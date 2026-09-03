import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  UserPlus,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  Loader2,
  Building2,
  Mail,
  Lock,
  Phone,
  Layers,
  Archive,
  RotateCcw,
  Clock,
  Activity,
  History,
  UserCog
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export default function AdminAccounts() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('admins'); // 'admins' | 'logs'
  const [admins, setAdmins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form & Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filters
  const [adminSearch, setAdminSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');

  // Deletion / Edit modal state
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }).catch(() => []),
      request('/api/auth/admin-logs', { token }).catch(() => []),
    ])
      .then(([userData, logData]) => {
        const allUsers = Array.isArray(userData) ? userData : [];
        setAdmins(allUsers.filter((u) => u.role === 'Super Admin'));
        setLogs(Array.isArray(logData) ? logData : []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // 2-second auto-dismiss for success alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Please enter the administrator full name.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await request('/api/auth/superadmins', {
        method: 'POST',
        token,
        body: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
        },
      });

      setSuccess(`Super Admin account created for ${form.name.trim()} (${form.email.trim()}).`);
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create Super Admin account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (adminUser) => {
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${adminUser.id}`, {
        method: 'DELETE',
        token,
      });
      setSuccess(`Super Admin account "${adminUser.name || adminUser.email}" removed.`);
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to remove admin account');
    } finally {
      setDeleting(false);
    }
  };

  const filteredAdmins = useMemo(() => {
    if (!adminSearch.trim()) return admins;
    const q = adminSearch.toLowerCase();
    return admins.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').toLowerCase().includes(q)
    );
  }, [admins, adminSearch]);

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (logFilter !== 'ALL') {
      list = list.filter((l) => (l.action || '').includes(logFilter));
    }
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      list = list.filter(
        (l) =>
          (l.admin_name || '').toLowerCase().includes(q) ||
          (l.admin_email || '').toLowerCase().includes(q) ||
          (l.target_name || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q) ||
          (l.action || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, logFilter, logSearch]);

  const activeAdminCount = useMemo(() => admins.filter((a) => a.is_active !== false).length, [admins]);

  const getActionBadge = (action) => {
    if (action.includes('CREATE_COMPANY')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Building2 size={11} className="text-blue-600" />
          <span>Company Created</span>
        </span>
      );
    }
    if (action.includes('CREATE_VENDOR')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <Layers size={11} className="text-purple-600" />
          <span>Vendor Onboarded</span>
        </span>
      );
    }
    if (action.includes('CREATE_ADMIN')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black text-white shadow-2xs">
          <Shield size={11} />
          <span>Admin Provisioned</span>
        </span>
      );
    }
    if (action.includes('ARCHIVE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Archive size={11} className="text-amber-600" />
          <span>Record Archived</span>
        </span>
      );
    }
    if (action.includes('RESTORE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <RotateCcw size={11} className="text-emerald-600" />
          <span>Record Restored</span>
        </span>
      );
    }
    if (action.includes('DELETE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <Trash2 size={11} className="text-rose-600" />
          <span>Record Deleted</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
        <Activity size={11} />
        <span>{action}</span>
      </span>
    );
  };

  return (
    <div
      className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto min-h-screen"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Banner Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              Super Admin Workspace
            </button>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              PLATFORM GOVERNANCE
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Admin Accounts & Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Provision platform Super Administrators and review operational audit logs across companies, vendor consultancies, and access accounts.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Super Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {admins.length} Super Admins
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {logs.length} Total Logs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            to="/dashboard/superadmin"
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Add Super Admin</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            SUPER ADMINISTRATORS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {admins.length}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Platform governance credentials
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            ACTIVE ADMIN LOGINS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {activeAdminCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Authorized administrative access
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            AUDIT TRAIL ACTIONS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {logs.length}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Historical operations recorded
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

      {/* Main Hub Tabs & Content */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'admins'
                  ? 'bg-black text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Super Admins ({admins.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-black text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <History size={14} />
              <span>Admin Activity Logs ({logs.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={activeTab === 'admins' ? adminSearch : logSearch}
              onChange={(e) => (activeTab === 'admins' ? setAdminSearch(e.target.value) : setLogSearch(e.target.value))}
              placeholder={activeTab === 'admins' ? 'Search admin name, email, phone...' : 'Search logs, admin, entity...'}
              className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>
        </div>

        {/* Tab 1: Super Admins Table */}
        {activeTab === 'admins' && (
          <div>
            {loading ? (
              <div className="py-12 text-center text-xs text-gray-400">Loading admin accounts...</div>
            ) : filteredAdmins.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No Super Admin accounts found matching your query.
              </div>
            ) : (
              <div
                className="overflow-x-auto overflow-y-auto pr-1"
                style={{ maxHeight: '480px', minHeight: '260px' }}
              >
                <table className="w-full text-left text-xs border-collapse relative">
                  <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                    <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                      <th className="py-3 px-3">ADMIN</th>
                      <th className="py-3 px-3">EMAIL</th>
                      <th className="py-3 px-3">PHONE NUMBER</th>
                      <th className="py-3 px-3">ROLE / ACCESS</th>
                      <th className="py-3 px-3">STATUS</th>
                      <th className="py-3 px-3">CREATED</th>
                      <th className="py-3 px-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAdmins.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Name with Avatar */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {(u.name || u.email || 'A').slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{u.name || 'Super Admin'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-3 text-gray-600 font-medium">
                          {u.email}
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-3 text-gray-600 font-medium font-mono text-[11px]">
                          {u.phone || '—'}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black text-white shadow-2xs">
                            <ShieldCheck size={11} />
                            <span>Super Admin</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              u.is_active !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.is_active !== false ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            {u.is_active !== false ? 'Active' : 'Not Active'}
                          </span>
                        </td>

                        {/* Created Date */}
                        <td className="py-3.5 px-3 text-gray-500 font-medium">
                          {formatDate(u.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(u)}
                              className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Admin Activity Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            {/* Filter Pills for Logs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'All Operations', value: 'ALL' },
                { label: 'Companies', value: 'COMPANY' },
                { label: 'Vendors', value: 'VENDOR' },
                { label: 'Admins', value: 'ADMIN' },
                { label: 'Archives & Deletions', value: 'ARCHIVE' },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setLogFilter(f.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    logFilter === f.value
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-gray-400">Loading audit trail...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No activity logs found for the selected filter.
              </div>
            ) : (
              <div
                className="overflow-x-auto overflow-y-auto pr-1"
                style={{ maxHeight: '480px', minHeight: '260px' }}
              >
                <table className="w-full text-left text-xs border-collapse relative">
                  <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                    <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                      <th className="py-3 px-3">TIMESTAMP</th>
                      <th className="py-3 px-3">ADMIN ACTOR</th>
                      <th className="py-3 px-3">ACTION</th>
                      <th className="py-3 px-3">TARGET ENTITY</th>
                      <th className="py-3 px-3">OPERATION DETAILS</th>
                      <th className="py-3 px-3 text-right">CHANNEL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3.5 px-3 text-gray-500 font-medium whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>

                        {/* Admin Actor */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-black text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(log.admin_name || 'A').slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 text-xs">{log.admin_name || 'Super Admin'}</div>
                              <div className="text-[10px] text-gray-400">{log.admin_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3.5 px-3">
                          {getActionBadge(log.action || '')}
                        </td>

                        {/* Target Entity */}
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-gray-900">{log.target_name || '—'}</span>
                          {log.target_type && (
                            <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">
                              {log.target_type}
                            </span>
                          )}
                        </td>

                        {/* Details */}
                        <td className="py-3.5 px-3 text-gray-600 font-medium">
                          {log.details || '—'}
                        </td>

                        {/* Channel / Source */}
                        <td className="py-3.5 px-3 text-right text-gray-400 font-mono text-[10px]">
                          {log.ip_address || 'Web Console'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Popup: Add Super Admin */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => !submitting && setShowCreateModal(false)}
        >
          <div
            className="relative w-full max-w-[500px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-2xs shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">Add Super Administrator</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Provision a platform root administrator login.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !submitting && setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mohammed Hashil"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@platform.com"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 8 characters"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 pr-14 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-black cursor-pointer select-none"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 pr-14 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-black cursor-pointer select-none"
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>{submitting ? 'Creating Admin...' : '+ Create Super Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove Super Admin */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Remove Super Admin</h3>
                <p className="text-xs text-gray-500">{confirmDelete.name || confirmDelete.email}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to remove <strong className="text-gray-900">{confirmDelete.name || confirmDelete.email}</strong>?
              This administrator will immediately lose access to the platform.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteAdmin(confirmDelete)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleting && <Loader2 size={13} className="animate-spin text-white" />}
                <span>Remove Administrator</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
