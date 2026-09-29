import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/emailValidation';
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
  Briefcase
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

export default function ManageHiringManagers() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
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
  const [emailError, setEmailError] = useState('');

  const searchInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    request('/api/auth/users', { token })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        setManagers(all.filter((u) => u.role === 'Hiring Manager'));
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

  // Close popup menus & dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setShowDeptDropdown(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/hiring-manager?company=${encodeURIComponent(user?.tenant_name || 'Bearitt')}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setSuccess('Invite link copied to clipboard! Anyone with this link can request Hiring Manager access.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    const emailErr = validateEmail(form.email);
    if (emailErr) { setEmailError(emailErr); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          role: 'Hiring Manager',
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          department: form.department.trim() || undefined,
        },
      });
      setSuccess(`Hiring Manager account created for ${form.email}.`);
      setForm(EMPTY_FORM);
      setEmailError('');
      setShowCreateModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to create manager account');
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
      setSuccess(`Hiring Manager account "${confirmDelete.name || confirmDelete.email}" removed.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to remove account');
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveManager = async (manager) => {
    setApprovingId(manager.id);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${manager.id}/approve`, {
        method: 'POST',
        token,
      });
      setSuccess(`Hiring Manager "${manager.name || manager.email}" approved successfully.`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve hiring manager account');
    } finally {
      setApprovingId(null);
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
      if (edit.department !== '') payload.department = edit.department.trim();
      if (edit.password) payload.password = edit.password;

      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Hiring Manager "${edit.name || edit.email}" updated successfully.`);
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to update manager account');
    } finally {
      setEditing(false);
    }
  };

  const departmentsList = useMemo(() => {
    const set = new Set(managers.map((m) => m.department).filter(Boolean));
    return ['All Departments', ...Array.from(set)];
  }, [managers]);

  const filteredManagers = useMemo(() => {
    return managers.filter((m) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.department || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept =
        selectedDept === 'All Departments' || (m.department || '').toLowerCase() === selectedDept.toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [managers, searchQuery, selectedDept]);

  const activeCount = useMemo(() => managers.filter((m) => m.is_active !== false).length, [managers]);
  const deptCount = useMemo(() => new Set(managers.map((m) => m.department).filter(Boolean)).size, [managers]);

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area (shrink-0) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • TEAM GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Hiring Managers
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Manage hiring manager accounts and oversee job requisitions.
          </p>
        </div>

        {/* Top Right: Create Hiring Manager Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>+ Create Hiring Manager</span>
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
          {/* Table Top Controls Row: Search Input Bar + Department Filter + Filter Action */}
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

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Department Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeptDropdown(!showDeptDropdown);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all flex items-center gap-2 shadow-3xs cursor-pointer"
                >
                  <span>{selectedDept}</span>
                  <ChevronDown size={13} className="text-gray-400" />
                </button>

                {showDeptDropdown && (
                  <div
                    className="absolute right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {departmentsList.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          setSelectedDept(dept);
                          setShowDeptDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          selectedDept === dept
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{dept}</span>
                        {selectedDept === dept && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View/Filter Action Toggle Button */}
              <button
                type="button"
                onClick={handleCopyInviteLink}
                title="Copy public invite link"
                className="px-2.5 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-medium text-gray-600 hover:text-black hover:bg-white shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 size={13} className="text-gray-500" />
                <span>{copied ? 'Copied' : 'Invite Link'}</span>
              </button>
            </div>
          </div>

          {/* Data Table with Hidden Scrollbar */}
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
              Loading hiring managers...
            </div>
          ) : filteredManagers.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
              No hiring manager accounts found.
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1 min-h-0 mt-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                  <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">NAME</th>
                    <th className="py-2.5 px-3">EMAIL</th>
                    <th className="py-2.5 px-3">DEPARTMENT</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">JOINED</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {filteredManagers.map((u) => {
                    const firstLetter = (u.name || u.email || 'M').slice(0, 1).toUpperCase();
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
                                {u.name || 'Team Member'}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">
                                Hiring Manager
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email Column */}
                        <td className="py-3 px-3 text-gray-600 font-normal text-xs sm:text-[12.5px]">
                          {u.email}
                        </td>

                        {/* Department Column */}
                        <td className="py-3 px-3">
                          {u.department ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100/90 text-gray-700 border border-gray-200/70">
                              {u.department}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100/90 text-gray-500 border border-gray-200/70">
                              eng
                            </span>
                          )}
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
                                    handleApproveManager(u);
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
          {/* Stat Card 1: Total Managers */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Users size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {managers.length}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Total Managers
              </div>
            </div>
          </div>

          {/* Stat Card 2: Active Accounts */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <FileText size={15} />
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

          {/* Stat Card 3: Departments */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Building2 size={15} />
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextDept = departmentsList.find((d) => d !== selectedDept) || 'All Departments';
                  setSelectedDept(nextDept);
                }}
                className="w-7 h-7 rounded-full bg-white/50 hover:bg-white border border-white/70 flex items-center justify-center text-gray-400 hover:text-black transition-all cursor-pointer shadow-3xs"
              >
                <ChevronRight size={12} />
              </button>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {deptCount || 1}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Departments
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
                  {(viewProfile.name || viewProfile.email || 'M').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">
                    {viewProfile.name || 'Hiring Manager'}
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
                <span className="font-bold text-gray-900">Hiring Manager</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <span className="text-gray-500 font-medium">Department</span>
                <span className="font-bold text-gray-900">{viewProfile.department || 'General'}</span>
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

      {/* Create Hiring Manager Modal Popup */}
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
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Create Hiring Manager</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Provision a new manager account for {user?.tenant_name || 'your company'}.
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

            <form onSubmit={handleCreateManager} className="space-y-3.5" autoComplete="off">
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
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="hm_email"
                  autoComplete="off"
                  required
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setEmailError(validateEmail(e.target.value));
                    setError('');
                  }}
                  placeholder="manager@company.com"
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-xl focus:outline-hidden focus:ring-1 transition-all ${
                    emailError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-black'
                  }`}
                />
                {emailError && (
                  <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                    <span>⚠</span> {emailError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  name="hm_password"
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
                  Department <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="department"
                  value={form.department}
                  onChange={handleInput}
                  placeholder="e.g. Engineering, Sales, HR"
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

      {/* Edit Hiring Manager Modal */}
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
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Edit Hiring Manager</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials and department assignment.</p>
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
                  name="hm_edit_email"
                  autoComplete="off"
                  required
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={edit.department || ''}
                  onChange={(e) => setEdit({ ...edit, department: e.target.value })}
                  placeholder="e.g. Engineering, Sales, HR"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  name="hm_edit_password"
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
            <h3 className="text-base font-bold text-gray-900">Remove Hiring Manager?</h3>
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
                onClick={handleDeleteManager}
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


