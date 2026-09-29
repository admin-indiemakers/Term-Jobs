import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  FileText,
  Building2,
  Search,
  Plus,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  Loader2,
  User,
  Check,
  TrendingUp,
  Link2,
  Mail,
  Lock,
  ShieldCheck,
  Shield,
  UserCheck
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return 'Sep 25, 2026';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function ManageDirectors() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editing, setEditing] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);

  const searchInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    request('/api/auth/users', { token })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        setDirectors(all.filter((u) => u.role === 'Director'));
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  // Keyboard shortcut ⌘K or Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 2.5-second auto-dismiss timer for success notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Close popup menus on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/director?company=${encodeURIComponent(user?.tenant_name || 'Bearitt')}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setSuccess('Invite link copied to clipboard! Anyone with this link can request Director access.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleCreateDirector = async (e) => {
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
          role: 'Director',
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          department: form.department?.trim() || undefined,
        },
      });
      setSuccess(`Director account created for ${form.email}.`);
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to create director account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveDirector = async (director) => {
    setApprovingId(director.id);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${director.id}/approve`, {
        method: 'POST',
        token,
      });
      setSuccess(`Director "${director.name || director.email}" approved and activated.`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve director account');
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeleteDirector = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Director account "${confirmDelete.name || confirmDelete.email}" removed.`);
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
      if (edit.email !== undefined) payload.email = edit.email.trim();
      if (edit.name !== undefined) payload.name = edit.name.trim();
      if (edit.department !== undefined) payload.department = edit.department.trim();
      if (edit.password) payload.password = edit.password;

      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Director "${edit.name || edit.email}" updated successfully.`);
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to update director account');
    } finally {
      setEditing(false);
    }
  };

  const filteredDirectors = useMemo(() => {
    if (!searchQuery.trim()) return directors;
    const q = searchQuery.toLowerCase();
    return directors.filter(
      (d) =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        (d.department || '').toLowerCase().includes(q)
    );
  }, [directors, searchQuery]);

  const activeCount = useMemo(() => directors.filter((d) => d.is_active !== false).length, [directors]);

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area (shrink-0) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • EXECUTIVE GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Company Directors
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Manage executive director accounts and oversee platform read-only access.
          </p>
        </div>

        {/* Top Right: Create Director Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>+ Create Director</span>
          </button>
        </div>
      </div>

      {/* Notifications (shrink-0) */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs shrink-0">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Content Area: Left Table Card + Right Vertical Stat Cards */}
      <div className="flex-1 min-h-[calc(100vh-260px)] flex flex-col lg:flex-row gap-3.5 items-stretch overflow-hidden">
        {/* Left: Main Glassmorphic Table Card */}
        <div className="flex-1 min-w-0 h-full min-h-[calc(100vh-260px)] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
          {/* Table Top Controls Row: Search Input Bar + Filter Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
            {/* Search Input Bar with ⌘K Badge */}
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or department..."
                className="w-full pl-9 pr-12 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded-md bg-white/80 border border-gray-200/80 shadow-3xs">
                  ⌘ K
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* View/Filter Action Toggle Button */}
              <button
                type="button"
                onClick={handleCopyInviteLink}
                title="Copy public invite link"
                className="px-2.5 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-medium text-gray-600 hover:text-black hover:bg-white shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 size={13} className="text-gray-500" />
                <span>{copied ? 'Invite Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          </div>

          {/* Data Table with Hidden Scrollbar */}
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
              Loading directors...
            </div>
          ) : filteredDirectors.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
              No director accounts found.
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1 min-h-0 mt-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                  <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">NAME</th>
                    <th className="py-2.5 px-3">EMAIL</th>
                    <th className="py-2.5 px-3">ROLE / ACCESS</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">JOINED</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {filteredDirectors.map((u) => {
                    const firstLetter = (u.name || u.email || 'D').slice(0, 1).toUpperCase();
                    const isMenuOpen = activeMenuId === u.id;

                    return (
                      <tr
                        key={u.id}
                        className="bg-transparent hover:bg-white/35 transition-colors relative"
                      >
                        {/* Name Column with Black Square Rounded Avatar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7.5 h-7.5 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-3xs">
                              {firstLetter}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 text-xs sm:text-[13px] leading-tight truncate">
                                {u.name || 'Company Director'}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">
                                Executive Board
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email Column */}
                        <td className="py-3 px-3 text-gray-600 font-normal text-xs sm:text-[12.5px]">
                          {u.email}
                        </td>

                        {/* Role / Access Column */}
                        <td className="py-3 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100/90 text-gray-700 border border-gray-200/70">
                            Executive Read-Only
                          </span>
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-3">
                          {u.is_active !== false ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
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

                        {/* Joined Date */}
                        <td className="py-3 px-3 text-gray-600 font-normal text-xs sm:text-[12.5px]">
                          {formatDate(u.created_at)}
                        </td>

                        {/* Actions Column (3 Dots Button + Floating Popup Action Menu) */}
                        <td className="py-3 px-3 text-right relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(isMenuOpen ? null : u.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white/60 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <MoreHorizontal size={15} />
                          </button>

                          {/* Floating Action Menu Dropdown */}
                          {isMenuOpen && (
                            <div
                              className="absolute right-3 top-10 w-36 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-1 z-30 animate-in fade-in zoom-in-95 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setViewProfile(u);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <User size={13} className="text-gray-500" />
                                <span>View Profile</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEdit({ ...u, password: '' });
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <Edit3 size={13} className="text-gray-500" />
                                <span>Edit</span>
                              </button>

                              {u.is_active === false && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleApproveDirector(u);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                                >
                                  <Check size={13} className="text-emerald-500" />
                                  <span>Approve</span>
                                </button>
                              )}

                              <div className="h-px bg-black/[0.04] my-1" />

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDelete(u);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                              >
                                <Trash2 size={13} className="text-red-500" />
                                <span>Remove</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: 3 Metric Stat Cards Stacked Vertically Down by Down (Compact Height) */}
        <div className="w-full lg:w-44 xl:w-48 shrink-0 flex flex-col gap-2.5">
          {/* Stat Card 1: Total Directors */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <UserCheck size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {directors.length}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Total Directors
              </div>
            </div>
          </div>

          {/* Stat Card 2: Active Accounts */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <ShieldCheck size={15} />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span>▲</span> +0%
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {activeCount}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Active Accounts
              </div>
            </div>
          </div>

          {/* Stat Card 3: Platform Access */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Shield size={15} />
              </div>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                title="Copy Director invite link"
                className="px-2 py-1 rounded-xl bg-white/60 hover:bg-white border border-white/80 text-[10px] font-bold text-gray-700 hover:text-black flex items-center gap-1 shadow-3xs transition-all cursor-pointer"
              >
                <Link2 size={11} />
                <span>{copied ? 'Copied' : 'Invite'}</span>
              </button>
            </div>
            <div>
              <div className="text-[12px] sm:text-[13px] font-bold text-gray-900 tracking-tight leading-tight">
                Executive Read-Only
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Access Level
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* View Profile Modal Popup */}
      {viewProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setViewProfile(null)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                  {(viewProfile.name || viewProfile.email || 'D').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">
                    {viewProfile.name || 'Company Director'}
                  </h3>
                  <p className="text-xs text-gray-500">{viewProfile.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewProfile(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-gray-500 font-medium">Role</span>
                <span className="font-bold text-gray-900">Director</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-gray-500 font-medium">Access Tier</span>
                <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                  Executive Read-Only Oversight
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-gray-500 font-medium">Department</span>
                <span className="font-bold text-gray-900">{viewProfile.department || 'Executive Board'}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-gray-500 font-medium">Account Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-gray-500 font-medium">Joined Date</span>
                <span className="font-bold text-gray-900">{formatDate(viewProfile.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-5 mt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setEdit({ ...viewProfile, password: '' });
                  setViewProfile(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Edit Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Director Modal Popup */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Create Director</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Provision a new executive read-only director for {user?.tenant_name || 'your company'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDirector} className="space-y-3.5" autoComplete="off">
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
                  placeholder="e.g. Priya Iyer"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="dir_email"
                  autoComplete="off"
                  required
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setError('');
                  }}
                  placeholder="director@company.com"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  name="dir_password"
                  autoComplete="new-password"
                  required
                  minLength={4}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Department / Unit <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="department"
                  value={form.department}
                  onChange={handleInput}
                  placeholder="e.g. Technology, Operations, Board"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
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

      {/* Edit Director Modal */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setEdit(null)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Edit Director</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials and director profile details.</p>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5" autoComplete="off">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="dir_edit_email"
                  autoComplete="off"
                  required
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Department / Unit
                </label>
                <input
                  type="text"
                  value={edit.department || ''}
                  onChange={(e) => setEdit({ ...edit, department: e.target.value })}
                  placeholder="e.g. Technology, Operations, Board"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  name="dir_edit_password"
                  autoComplete="new-password"
                  minLength={4}
                  value={edit.password || ''}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Remove Director?</h3>
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
                onClick={handleDeleteDirector}
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
