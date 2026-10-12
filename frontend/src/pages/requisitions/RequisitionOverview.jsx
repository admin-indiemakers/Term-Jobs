import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { getSearchShortcutKey } from '../../utils/keyboardShortcuts';
import {
  Plus,
  Search,
  Trash2,
  Check,
  AlertCircle,
  X,
  FileText,
  Clock,
  Briefcase,
  CheckCircle2,
  History,
  Hourglass,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  SlidersHorizontal,
  Users,
  Eye,
  AlertTriangle,
  Link2
} from 'lucide-react';
import {
  isPendingApprovalStatus,
  isPublishedStatus,
  isDraftedStatus,
  isCompletedStatus,
  matchesRequisitionSection,
  matchesRequisitionStatusFilter,
  calculateRequisitionCounts,
} from '../../utils/requisitionStatus';

const SECTION_CONFIG = {
  published: {
    title: 'Published',
    icon: Briefcase,
    statuses: ['Published', 'Active', 'Open'],
    to: '/dashboard/requisitions/published',
  },
  pending_approval: {
    title: 'Pending Approval',
    icon: Hourglass,
    statuses: [
      'PendingApproval',
      'Pending_Approval',
      'Pending Approval',
      'Pending-Approval',
      'Pending',
      'Pending Director Approval',
      'Pending Director Signoff',
      'Awaiting Approval',
      'AwaitingApproval',
      'Waiting For Approval',
      'Needs Approval',
    ],
    to: '/dashboard/requisitions/pending-approval',
  },
  drafted: {
    title: 'Drafted',
    icon: FileText,
    caption: 'Requisitions in progress — draft parameters and role specifications.',
    statuses: ['Draft', 'Drafted', 'Intake', 'Structuring'],
    to: '/dashboard/requisitions/drafted',
  },
  completed: {
    title: 'Completed',
    icon: CheckCircle2,
    statuses: ['Closed', 'Completed', 'Filled'],
    to: '/dashboard/requisitions/completed',
  },
  history: {
    title: 'All History',
    icon: History,
    statuses: [
      'Draft', 'Drafted', 'Intake', 'Structuring',
      'PendingApproval', 'Pending_Approval', 'Pending Approval', 'Pending-Approval', 'Pending', 'Pending Director Approval', 'Pending Director Signoff', 'Awaiting Approval', 'AwaitingApproval', 'Waiting For Approval', 'Needs Approval',
      'Published', 'Active', 'Open',
      'Closed', 'Completed', 'Filled'
    ],
    to: '/dashboard/requisitions/history',
  },
};

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

function timeAgo(iso) {
  if (!iso) return '2 days ago';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '2 days ago';
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '2 days ago';
  }
}

function RequisitionStatusBadge({ status }) {
  if (isPublishedStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Published
      </span>
    );
  }
  if (isPendingApprovalStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending Approval
      </span>
    );
  }
  if (isDraftedStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-600 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Drafted
      </span>
    );
  }
  if (isCompletedStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-600 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      {status || 'Draft'}
    </span>
  );
}

export default function RequisitionOverview({ section }) {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const initialSection = useMemo(() => {
    if (section) return section;
    const p = location.pathname.toLowerCase();
    if (p.includes('/pending-approval') || p.includes('/pending')) return 'pending_approval';
    if (p.includes('/drafted')) return 'drafted';
    if (p.includes('/completed')) return 'completed';
    if (p.includes('/history')) return 'history';
    return 'published';
  }, [section, location.pathname]);

  const [activeTab, setActiveTab] = useState(initialSection);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const searchInputRef = useRef(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const prevTokenRef = useRef(token);

  useEffect(() => {
    setActiveTab(initialSection);
    setSelectedStatus('All Status');
  }, [initialSection]);

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

  // Close popup menus & dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setShowDeptDropdown(false);
      setShowStatusDropdown(false);
      setShowSectionDropdown(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Auto-dismiss info alerts
  useEffect(() => {
    if (info) {
      const timer = setTimeout(() => setInfo(''), 2500);
      return () => clearTimeout(timer);
    }
  }, [info]);

  const loadData = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && hasLoadedRef.current && prevTokenRef.current === token) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const reqs = await request('/api/requisitions', { token, forceRefresh: force }).catch(() => []);
      const reqList = Array.isArray(reqs) ? reqs : reqs?.requisitions || [];
      const rows = reqList.map((r) => ({
        ...r,
        company_name: r.company_name || user?.tenant_name || 'Client',
      }));

      setRequisitions(rows);
      setLoading(false);
      hasLoadedRef.current = true;
      prevTokenRef.current = token;

      window.dispatchEvent(new CustomEvent('tj-requisition-count-updated', { detail: { count: reqList.length } }));

      request('/api/company-profiles', { token }).then((profiles) => {
        if (Array.isArray(profiles) && profiles.length > 0) {
          const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
          setRequisitions((prev) =>
            prev.map((r) => ({
              ...r,
              company_name: r.company_name || profileMap[r.company_profile_id] || user?.tenant_name || 'Client',
            }))
          );
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load requisitions:', err);
      setError(err.message || 'Unable to load requisitions.');
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [token, user?.tenant_name]);

  useEffect(() => {
    if (!token) return;
    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      hasLoadedRef.current = false;
    }
    if (!hasLoadedRef.current) {
      loadData();
    }
  }, [token, loadData]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      window.dispatchEvent(new CustomEvent('tj-requisition-count-updated', { detail: { count: requisitions.length } }));
    }
  }, [requisitions.length]);

  const handleDeleteRequisition = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${confirmDelete.id}`, { method: 'DELETE', token });
      setInfo(`Requisition "${confirmDelete.title || 'Untitled'}" deleted successfully.`);
      setConfirmDelete(null);
      window.dispatchEvent(new CustomEvent('refresh-hm-data'));
      loadData(true);
    } catch (err) {
      setError(err.message || 'Failed to delete requisition.');
    } finally {
      setDeleting(false);
    }
  };

  // Live Section Counts
  const counts = useMemo(() => {
    return calculateRequisitionCounts(requisitions);
  }, [requisitions]);

  const currentConfig = SECTION_CONFIG[activeTab] || SECTION_CONFIG.published;

  const departmentsList = useMemo(() => {
    const set = new Set(requisitions.map((r) => r.department).filter(Boolean));
    return ['All Departments', ...Array.from(set).sort()];
  }, [requisitions]);

  const statusOptions = ['All Status', 'Published', 'Pending Approval', 'Drafted', 'Completed'];

  // Filtered Rows
  const filteredRows = useMemo(() => {
    let list = requisitions;

    if (activeTab !== 'history') {
      list = list.filter((r) => matchesRequisitionSection(r.status, activeTab));
    }

    if (selectedDept !== 'All Departments') {
      list = list.filter((r) => (r.department || '').toLowerCase() === selectedDept.toLowerCase());
    }

    if (selectedStatus !== 'All Status') {
      list = list.filter((r) => matchesRequisitionStatusFilter(r.status, selectedStatus));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(q) ||
          (r.department || '').toLowerCase().includes(q) ||
          (r.id || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [requisitions, activeTab, selectedDept, selectedStatus, searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedStatus, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── TOP HEADER AREA (Matches Company Admin ManageHiringManagers Header) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • CONTRACT PIPELINE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Requisitions Management
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Create, track, and manage hiring requisitions for contract roles across departments.
          </p>
        </div>

        {/* Top Right: Create Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions/new')}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>+ New Requisition</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs shrink-0">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{info}</span>
        </div>
      )}

      {/* ── MAIN CONTENT AREA: Left Table Card + Right Vertical Metric Stat Cards ── */}
      <div className="flex-1 min-h-[calc(100vh-260px)] flex flex-col lg:flex-row gap-3.5 items-stretch overflow-hidden pt-2.5 sm:pt-4">
        {/* Left: Main Glassmorphic Table Card */}
        <div className="flex-1 min-w-0 h-full min-h-[calc(100vh-260px)] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
          {/* Table Top Controls Row: Search Bar + Section / Department Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
            {/* Search Input Bar with OS-aware shortcut badge or clear button */}
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, role, or department..."
                className="w-full pl-9 pr-14 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded-md bg-white/80 border border-gray-200/80 shadow-3xs hover:text-gray-600 hover:bg-white transition-colors cursor-pointer"
                  title={`Focus search (${getSearchShortcutKey()})`}
                  aria-label={`Focus search (${getSearchShortcutKey()})`}
                >
                  {getSearchShortcutKey()}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Category / Section Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSectionDropdown(!showSectionDropdown);
                    setShowDeptDropdown(false);
                    setShowStatusDropdown(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all flex items-center gap-2 shadow-3xs cursor-pointer"
                >
                  <span>{SECTION_CONFIG[activeTab]?.title || 'All Requisitions'}</span>
                  <ChevronDown size={13} className="text-gray-400" />
                </button>

                {showSectionDropdown && (
                  <div
                    className="absolute right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Object.entries(SECTION_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setActiveTab(key);
                          setSelectedStatus('All Status');
                          setShowSectionDropdown(false);
                          navigate(config.to);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          activeTab === key
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{config.title}</span>
                        {activeTab === key && <Check size={12} />}
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
                    setShowSectionDropdown(false);
                    setShowStatusDropdown(false);
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

              {/* Status Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusDropdown(!showStatusDropdown);
                    setShowSectionDropdown(false);
                    setShowDeptDropdown(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all flex items-center gap-2 shadow-3xs cursor-pointer"
                >
                  <span>{selectedStatus}</span>
                  <ChevronDown size={13} className="text-gray-400" />
                </button>

                {showStatusDropdown && (
                  <div
                    className="absolute right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {statusOptions.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setSelectedStatus(st);
                          setShowStatusDropdown(false);
                          if (st === 'All Status') {
                            setActiveTab('history');
                            navigate('/dashboard/requisitions/history');
                          } else if (st === 'Published') {
                            setActiveTab('published');
                            navigate('/dashboard/requisitions/published');
                          } else if (st === 'Pending Approval') {
                            setActiveTab('pending_approval');
                            navigate('/dashboard/requisitions/pending-approval');
                          } else if (st === 'Drafted') {
                            setActiveTab('drafted');
                            navigate('/dashboard/requisitions/drafted');
                          } else if (st === 'Completed') {
                            setActiveTab('completed');
                            navigate('/dashboard/requisitions/completed');
                          }
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          selectedStatus === st
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{st}</span>
                        {selectedStatus === st && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Table with Hidden Scrollbar */}
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
              Loading requisitions...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex flex-col items-center justify-center gap-2">
              <Briefcase size={22} className="text-gray-400 opacity-60" />
              <span>No requisitions found in {currentConfig.title}.</span>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1 min-h-0 mt-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                  <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">TITLE & ROLE</th>
                    <th className="py-2.5 px-3">DEPARTMENT</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">CREATED</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {paginatedRows.map((r) => {
                    const isMenuOpen = activeMenuId === r.id;

                    return (
                      <tr
                        key={r.id}
                        className="bg-transparent hover:bg-white/35 transition-colors relative"
                      >
                        {/* Title Column with Black Square Rounded Avatar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7.5 h-7.5 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-3xs">
                              <Briefcase size={13} className="text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 text-xs sm:text-[13px] leading-tight truncate">
                                {r.title || 'Untitled Role'}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate mt-0.5">
                                {r.experience_range ? `${r.experience_range} exp • ` : ''}{r.primary_location || r.location || 'Remote'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Department Column */}
                        <td className="py-3 px-3">
                          {r.department && r.department.trim() ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100/90 text-gray-700 border border-gray-200/70">
                              {r.department}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200/60 italic">
                              General
                            </span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-3">
                          <RequisitionStatusBadge status={r.status || 'Published'} />
                        </td>

                        {/* Created Column */}
                        <td className="py-3 px-3 text-gray-600 font-normal text-xs sm:text-[12.5px]">
                          <div>{formatDate(r.created_at)}</div>
                          <div className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-3 px-3 text-right relative">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Details</span>
                              <ArrowRight size={11} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : r.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white/60 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </div>

                          {/* Floating Action Menu Dropdown */}
                          {isMenuOpen && (
                            <div
                              className="absolute right-3 top-10 w-38 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-1 z-30 animate-in fade-in zoom-in-95 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/dashboard/requisitions/${r.id}`);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <Eye size={13} className="text-gray-400" />
                                <span>Details</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/dashboard/requisitions/${r.id}/candidates`);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <Users size={13} className="text-gray-400" />
                                <span>Candidates</span>
                              </button>

                              <div className="h-px bg-black/[0.04] my-1" />

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDelete(r);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                              >
                                <Trash2 size={13} className="text-red-500" />
                                <span>Delete</span>
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

          {/* Table Footer with Pagination matching ManageHiringManagers */}
          <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] shrink-0 text-xs text-gray-400">
            <div>
              Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} requisitions
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

        {/* Right: Metric Stat Cards Stacked Vertically (Exact match to ManageHiringManagers) */}
        <div className="w-full lg:w-44 xl:w-48 shrink-0 flex flex-col gap-2.5">
          {/* Stat Card 1: All History / Total Requisitions */}
          <div
            onClick={() => {
              setActiveTab('history');
              setSelectedStatus('All Status');
              navigate('/dashboard/requisitions/history');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              activeTab === 'history'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <History size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-gray-100 text-gray-700 border border-gray-200/80">
                Archive
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.history}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Total Requisitions
              </div>
            </div>
          </div>

          {/* Stat Card 2: Published */}
          <div
            onClick={() => {
              setActiveTab('published');
              setSelectedStatus('All Status');
              navigate('/dashboard/requisitions/published');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              activeTab === 'published'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Briefcase size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.published}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Published
              </div>
            </div>
          </div>

          {/* Stat Card 3: Pending Approval */}
          <div
            onClick={() => {
              setActiveTab('pending_approval');
              setSelectedStatus('All Status');
              navigate('/dashboard/requisitions/pending-approval');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              activeTab === 'pending_approval'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Hourglass size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Signoff
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.pending_approval}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Pending Approval
              </div>
            </div>
          </div>

          {/* Stat Card 4: Drafted */}
          <div
            onClick={() => {
              setActiveTab('drafted');
              setSelectedStatus('All Status');
              navigate('/dashboard/requisitions/drafted');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              activeTab === 'drafted'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <FileText size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-gray-50 text-gray-600 border border-gray-200">
                Drafts
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.drafted}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Drafted
              </div>
            </div>
          </div>

          {/* Stat Card 5: Completed */}
          <div
            onClick={() => {
              setActiveTab('completed');
              setSelectedStatus('All Status');
              navigate('/dashboard/requisitions/completed');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              activeTab === 'completed'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <CheckCircle2 size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Filled
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {counts.completed}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Completed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Delete Requisition?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              This will permanently remove <strong>{confirmDelete.title || 'Untitled'}</strong> ({confirmDelete.department || 'General'}). This action cannot be undone.
            </p>
            {(confirmDelete.director_approved || confirmDelete.status === 'Published') && (
              <div className="p-3 mb-5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2 shadow-2xs">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> This requisition was approved & published by the Director. Deleting it will immediately notify the Company Director and record the cancellation in the Director Dashboard.
                </span>
              </div>
            )}
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
                onClick={handleDeleteRequisition}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 size={13} className="animate-spin text-white" />}
                <span>Delete Requisition</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
