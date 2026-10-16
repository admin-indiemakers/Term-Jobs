import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserCheck,
  Shield,
  Building2,
  CreditCard,
  Search,
  RefreshCw,
  Mail,
  Copy,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Award,
  AlertCircle,
  ExternalLink,
  User
} from 'lucide-react';

export default function AdminTeamMembers() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const searchInputRef = useRef(null);

  const fetchMembers = (force = false) => {
    setLoading(true);
    request('/api/auth/users', { token, forceRefresh: force })
      .then((rows) => {
        setMembers(
          (Array.isArray(rows) ? rows : []).filter(
            (row) => row.role !== 'Candidate' && row.tenant_id === user?.tenant_id
          )
        );
        setError('');
      })
      .catch((err) => setError(err.message || 'Unable to load team members.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, [token, user?.tenant_id]);

  // Keyboard shortcut ⌘K / Ctrl+K
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

  const handleCopyEmail = (email, id) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Distinct roles & departments
  const rolesList = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      if (m.role) set.add(m.role);
    });
    return ['All Roles', ...Array.from(set).sort()];
  }, [members]);

  const departmentsList = useMemo(() => {
    const set = new Set();
    let hasUnassigned = false;
    members.forEach((m) => {
      if (m.department && m.department.trim()) {
        set.add(m.department.trim());
      } else {
        hasUnassigned = true;
      }
    });
    const list = ['All Departments', ...Array.from(set).sort()];
    if (hasUnassigned) list.push('Unassigned');
    return list;
  }, [members]);

  // Counts for right vertical stat stack
  const counts = useMemo(() => {
    const total = members.length;
    const admins = members.filter((m) => m.role === 'Admin').length;
    const hiringManagers = members.filter((m) => m.role === 'Hiring Manager' || m.role === 'HR').length;
    const directors = members.filter((m) => m.role === 'Director').length;
    const governance = members.filter(
      (m) => m.role === 'Procurement' || m.role === 'Finance' || m.role === 'Procurement Team' || m.role === 'Finance Team'
    ).length;

    return { total, admins, hiringManagers, directors, governance };
  }, [members]);

  // Filtered members list
  const filtered = useMemo(() => {
    return members.filter((m) => {
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        [m.name, m.email, m.role, m.department].some((value) =>
          String(value || '').toLowerCase().includes(term)
        );

      const matchesRole =
        selectedRole === 'All Roles' ||
        (selectedRole === 'Governance'
          ? ['Procurement', 'Finance', 'Procurement Team', 'Finance Team'].includes(m.role)
          : m.role === selectedRole);

      const isUnassignedDept = !m.department || !m.department.trim();
      const matchesDept =
        selectedDept === 'All Departments' ||
        (selectedDept === 'Unassigned'
          ? isUnassignedDept
          : (m.department || '').toLowerCase() === selectedDept.toLowerCase());

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [members, search, selectedRole, selectedDept]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const roleBadgeStyle = (role) => {
    switch (role) {
      case 'Admin':
        return {
          bg: 'bg-black text-white border-black shadow-2xs',
          dot: 'bg-white',
          icon: Shield,
        };
      case 'Hiring Manager':
      case 'HR':
        return {
          bg: 'bg-gray-100/90 text-gray-800 border-gray-200/80',
          dot: 'bg-gray-500',
          icon: Briefcase,
        };
      case 'Director':
        return {
          bg: 'bg-gray-100/90 text-gray-800 border-gray-200/80',
          dot: 'bg-gray-500',
          icon: Award,
        };
      case 'Procurement':
      case 'Procurement Team':
        return {
          bg: 'bg-gray-100/90 text-gray-800 border-gray-200/80',
          dot: 'bg-gray-500',
          icon: Building2,
        };
      case 'Finance':
      case 'Finance Team':
        return {
          bg: 'bg-gray-100/90 text-gray-800 border-gray-200/80',
          dot: 'bg-gray-500',
          icon: CreditCard,
        };
      default:
        return {
          bg: 'bg-gray-100/90 text-gray-800 border-gray-200/80',
          dot: 'bg-gray-500',
          icon: User,
        };
    }
  };

  const getInitials = (name) => {
    if (!name) return 'TM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-team-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-team-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-team-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 4px; }
        .custom-team-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
      `}</style>

      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • TEAM GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Team Members
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            {user?.tenant_name || 'Company'} · {members.length} members across all staff roles and departments
          </p>
        </div>

        {/* Top Right Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchMembers(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link
            to="/dashboard/admin"
            className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs shrink-0">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area: Left Table Card + Right Vertical Stat Cards */}
      <div className="flex-1 min-h-[calc(100vh-260px)] flex flex-col lg:flex-row gap-3.5 items-stretch overflow-hidden pt-1.5 sm:pt-2.5">
        {/* Left: Main Glassmorphic Table Card */}
        <div className="flex-1 min-w-0 h-full min-h-[calc(100vh-260px)] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
          {/* Table Top Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
            {/* Search Input Bar with ⌘K Badge */}
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name, email, role, or dept..."
                className="w-full pl-9 pr-12 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded-md bg-white/80 border border-gray-200/80 shadow-3xs">
                  ⌘ K
                </span>
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Role Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRoleDropdown(!showRoleDropdown);
                    setShowDeptDropdown(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all flex items-center gap-2 shadow-3xs cursor-pointer"
                >
                  <span>{selectedRole}</span>
                  <ChevronDown size={13} className="text-gray-400" />
                </button>

                {showRoleDropdown && (
                  <div
                    className="absolute right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rolesList.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setSelectedRole(r);
                          setShowRoleDropdown(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          selectedRole === r
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{r}</span>
                        {selectedRole === r && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Department Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeptDropdown(!showDeptDropdown);
                    setShowRoleDropdown(false);
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
                          setCurrentPage(1);
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
            </div>
          </div>

          {/* Table Area with Custom Scrollbar */}
          {loading ? (
            <div className="py-16 text-center text-xs text-gray-400 font-medium flex-1 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              <span>Loading team members...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-400 font-medium flex-1 flex flex-col items-center justify-center gap-2">
              <Users size={28} className="text-gray-300" />
              <span className="font-bold text-gray-700 text-sm">No team members found</span>
              <span className="text-[11px] text-gray-400 max-w-xs">
                {search ? 'Try clearing or modifying your search query' : 'Staff members will appear here once added.'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto custom-team-scroll flex-1 min-h-0 mt-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-black/[0.04] z-10">
                  <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-[26%]">MEMBER & IDENTITY</th>
                    <th className="py-2.5 px-3 w-[28%]">EMAIL ADDRESS</th>
                    <th className="py-2.5 px-3 w-[18%]">ORGANIZATIONAL ROLE</th>
                    <th className="py-2.5 px-3 w-[16%]">DEPARTMENT</th>
                    <th className="py-2.5 px-3 text-right w-[12%]">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {paginatedMembers.map((member) => {
                    const badge = roleBadgeStyle(member.role);
                    const RoleIcon = badge.icon;
                    const initials = getInitials(member.name);

                    return (
                      <tr
                        key={member.id}
                        className="bg-transparent hover:bg-white/50 transition-colors group"
                      >
                        {/* Member Identity Column */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-black text-white font-black text-xs flex items-center justify-center shrink-0 shadow-3xs group-hover:scale-105 transition-transform">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 text-xs sm:text-[13px] leading-tight truncate">
                                {member.name || 'Unnamed Member'}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                                ID: #{String(member.id).slice(0, 8)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email Column */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 font-medium truncate max-w-[200px]">
                              {member.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(member.email, member.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-black cursor-pointer"
                              title="Copy email address"
                            >
                              {copiedId === member.id ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Role Badge Column */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold border shadow-3xs ${badge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            <RoleIcon size={11} />
                            <span>{member.role || 'Staff'}</span>
                          </span>
                        </td>

                        {/* Department Column */}
                        <td className="py-3 px-3">
                          {member.department && member.department.trim() ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100/90 text-gray-700 border border-gray-200/70">
                              {member.department}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200/60 italic">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer with Pagination Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] shrink-0 text-xs text-gray-400">
            <div>
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} team members
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded-lg bg-white/60 border border-white/80 flex items-center justify-center text-gray-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-3xs"
                >
                  <ChevronLeft size={13} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-3xs cursor-pointer ${
                      currentPage === pg
                        ? 'bg-black text-white'
                        : 'bg-white/60 hover:bg-white text-gray-700 border border-white/80'
                    }`}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="w-7 h-7 rounded-lg bg-white/60 border border-white/80 flex items-center justify-center text-gray-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-3xs"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metric Stat Cards Stacked Vertically */}
        <div className="w-full lg:w-44 xl:w-48 shrink-0 flex flex-col gap-2.5">

          {/* Stat Card 1: Admins */}
          <div
            onClick={() => {
              setSelectedRole((prev) => (prev === 'Admin' ? 'All Roles' : 'Admin'));
              setCurrentPage(1);
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              selectedRole === 'Admin'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Shield size={15} />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition-colors ${
                  selectedRole === 'Admin'
                    ? 'bg-black text-white border-black'
                    : 'bg-gray-100 text-gray-700 border-gray-200/80'
                }`}
              >
                Admin
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.admins}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Administrators
              </div>
            </div>
          </div>

          {/* Stat Card 2: Hiring Managers */}
          <div
            onClick={() => {
              setSelectedRole((prev) => (prev === 'Hiring Manager' ? 'All Roles' : 'Hiring Manager'));
              setCurrentPage(1);
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              selectedRole === 'Hiring Manager'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Briefcase size={15} />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition-colors ${
                  selectedRole === 'Hiring Manager'
                    ? 'bg-black text-white border-black'
                    : 'bg-gray-100 text-gray-700 border-gray-200/80'
                }`}
              >
                Hiring
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.hiringManagers}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Hiring Managers
              </div>
            </div>
          </div>

          {/* Stat Card 3: Directors */}
          <div
            onClick={() => {
              setSelectedRole((prev) => (prev === 'Director' ? 'All Roles' : 'Director'));
              setCurrentPage(1);
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              selectedRole === 'Director'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Award size={15} />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition-colors ${
                  selectedRole === 'Director'
                    ? 'bg-black text-white border-black'
                    : 'bg-gray-100 text-gray-700 border-gray-200/80'
                }`}
              >
                Executive
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.directors}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Directors
              </div>
            </div>
          </div>

          {/* Stat Card 4: Governance */}
          <div
            onClick={() => {
              setSelectedRole((prev) => (prev === 'Governance' ? 'All Roles' : 'Governance'));
              setCurrentPage(1);
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              selectedRole === 'Governance'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Building2 size={15} />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition-colors ${
                  selectedRole === 'Governance'
                    ? 'bg-black text-white border-black'
                    : 'bg-gray-100 text-gray-700 border-gray-200/80'
                }`}
              >
                Governance
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.governance}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Procure & Finance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
