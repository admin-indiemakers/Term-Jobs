import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
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
  Loader2
} from 'lucide-react';

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
    statuses: ['PendingApproval', 'Pending_Approval', 'Pending Approval', 'Pending'],
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
    statuses: ['Draft', 'Drafted', 'Intake', 'Structuring', 'PendingApproval', 'Pending_Approval', 'Pending Approval', 'Pending', 'Published', 'Active', 'Open', 'Closed', 'Completed', 'Filled'],
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
  const s = (status || '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'published' || s === 'active' || s === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Published
      </span>
    );
  }
  if (s === 'pendingapproval' || s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending Approval
      </span>
    );
  }
  if (s === 'draft' || s === 'drafted' || s === 'intake' || s === 'structuring') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        Drafted
      </span>
    );
  }
  if (s === 'closed' || s === 'completed' || s === 'filled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
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
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const prevTokenRef = useRef(token);

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  const loadData = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && hasLoadedRef.current && prevTokenRef.current === token) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      // 1. Fetch requisitions first so table renders immediately
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

      // 2. Fetch profiles non-blocking in background to enrich company names if needed
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

  const handleDeleteRequisition = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${confirmDelete.id}`, { method: 'DELETE', token });
      setInfo(`Requisition "${confirmDelete.title || 'Untitled'}" deleted successfully.`);
      setConfirmDelete(null);
      loadData(true);
    } catch (err) {
      setError(err.message || 'Failed to delete requisition.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = (reqItem, e) => {
    e?.stopPropagation();
    setConfirmDelete(reqItem);
    setActiveMenuId(null);
  };

  // Live Section Counts
  const counts = useMemo(() => {
    const normalize = (s) => (s || '').toLowerCase().replace(/[\s_]+/g, '');
    const published = requisitions.filter((r) =>
      ['published', 'active', 'open'].includes(normalize(r.status))
    ).length;
    const pending_approval = requisitions.filter((r) =>
      ['pendingapproval', 'pending'].includes(normalize(r.status))
    ).length;
    const drafted = requisitions.filter((r) =>
      ['draft', 'drafted', 'intake', 'structuring'].includes(normalize(r.status))
    ).length;
    const completed = requisitions.filter((r) =>
      ['closed', 'completed', 'filled'].includes(normalize(r.status))
    ).length;
    const history = requisitions.length;

    return { published, pending_approval, drafted, completed, history };
  }, [requisitions]);

  const currentConfig = SECTION_CONFIG[activeTab] || SECTION_CONFIG.published;

  const departmentsList = useMemo(() => {
    const set = new Set(requisitions.map((r) => r.department).filter(Boolean));
    return ['All Departments', ...Array.from(set)];
  }, [requisitions]);

  const statusOptions = ['All Status', 'Published', 'Pending Approval', 'Drafted', 'Completed'];

  // Filtered Rows
  const filteredRows = useMemo(() => {
    let list = requisitions;
    const normalize = (s) => (s || '').toLowerCase().replace(/[\s_]+/g, '');

    if (activeTab !== 'history') {
      const allowed = (currentConfig.statuses || []).map((s) => normalize(s));
      list = list.filter((r) => allowed.includes(normalize(r.status)));
    }

    if (selectedDept !== 'All Departments') {
      list = list.filter((r) => (r.department || '').toLowerCase() === selectedDept.toLowerCase());
    }

    if (selectedStatus !== 'All Status') {
      const sMap = {
        'Published': ['published', 'active', 'open'],
        'Pending Approval': ['pendingapproval', 'pending'],
        'Drafted': ['draft', 'drafted', 'intake', 'structuring'],
        'Completed': ['closed', 'completed', 'filled'],
      };
      const allowed = sMap[selectedStatus] || [];
      list = list.filter((r) => allowed.includes(normalize(r.status)));
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
  }, [requisitions, activeTab, currentConfig, selectedDept, selectedStatus, searchQuery]);

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 sm:gap-3.5 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area (shrink-0) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • CONTRACT PIPELINE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Requisitions Management
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Create, track, and manage hiring requisitions for contract roles.
          </p>
        </div>

        {/* Action Button: + New Requisition */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions/new')}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>+ New Requisition</span>
          </button>
        </div>
      </div>

      {/* 5 Status Tab Cards Bar (shrink-0) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 shrink-0">
        {Object.entries(SECTION_CONFIG).map(([key, config]) => {
          const isActive = activeTab === key;
          const count = counts[key] || 0;
          const Icon = config.icon;

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveTab(key);
                navigate(config.to);
              }}
              className={`p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-2 transition-all cursor-pointer ${isActive
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white/40 hover:bg-white/60 backdrop-blur-2xl border border-white/70 text-gray-700 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]'
                }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {Icon && <Icon size={15} className={isActive ? 'text-white' : 'text-gray-600'} />}
                <span className="text-xs font-bold truncate">{config.title}</span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold shrink-0 ${isActive
                    ? 'bg-white text-black shadow-2xs'
                    : 'bg-gray-200/80 text-gray-700'
                  }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications (shrink-0) */}
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

      {/* Main Glassmorphic Table Card (Flex-1 Fills Remaining Height) */}
      <div className="flex-1 min-h-0 max-h-[calc(100vh-260px)] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-3.5 sm:p-4.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
        {/* Table Top Controls Row: Search Input + Department Filter + Status Filter + Filter Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
          {/* Search Input Bar */}
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, department, or keyword..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Department Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeptDropdown(!showDeptDropdown);
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
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${selectedDept === dept
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
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${selectedStatus === st
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

            {/* Filter Toggle Action Button */}
            <button
              type="button"
              className="w-8.5 h-8.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-600 hover:text-black hover:bg-white shadow-3xs transition-all cursor-pointer"
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
            Loading requisitions...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="text-sm font-bold text-gray-800">No requisitions in {currentConfig.title}</div>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Create a new contract requirement to start candidate sourcing.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/requisitions/new')}
              className="mt-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-xs hover:bg-gray-900 transition-colors"
            >
              + Create Requisition
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1 min-h-0 mt-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">TITLE</th>
                  <th className="py-2.5 px-3">DEPARTMENT</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">CREATED</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {filteredRows.map((r) => {
                  const isMenuOpen = activeMenuId === r.id;

                  return (
                    <tr
                      key={r.id}
                      className="bg-transparent hover:bg-white/35 transition-colors relative"
                    >
                      {/* Title Column with Briefcase Icon Box */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-black/[0.04] border border-black/[0.04] flex items-center justify-center text-gray-700 shrink-0">
                            <Briefcase size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-xs sm:text-[13.5px] leading-tight truncate">
                              {r.title || 'Untitled Role'}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {r.department || 'Engineering'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department Column */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-100/90 text-gray-700 border border-gray-200/70">
                          {r.department || 'Engineering'}
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="py-3 px-3">
                        <RequisitionStatusBadge status={r.status || 'Published'} />
                      </td>

                      {/* Created Column */}
                      <td className="py-3 px-3">
                        <div className="text-xs font-medium text-gray-700 leading-tight">
                          {formatDate(r.created_at)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {timeAgo(r.created_at)}
                        </div>
                      </td>

                      {/* Actions Column: View Details Pill Button + 3 Dots Button */}
                      <td className="py-3 px-3 text-right relative">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                            className="px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-xs font-bold text-gray-900 border border-gray-200/80 shadow-3xs flex items-center gap-1 cursor-pointer transition-all hover:shadow-2xs"
                          >
                            <span>View Details</span>
                            <ArrowRight size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(isMenuOpen ? null : r.id);
                            }}
                            className="w-8 h-8 rounded-full bg-white/60 hover:bg-white border border-gray-200/60 flex items-center justify-center text-gray-500 hover:text-black shadow-3xs transition-all cursor-pointer"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>

                        {/* Floating Action Menu Dropdown */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-3 top-10 w-40 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-1 z-30 animate-in fade-in zoom-in-95 text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/dashboard/requisitions/${r.id}`);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <Eye size={13} className="text-gray-500" />
                              <span>View Requisition</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/dashboard/requisitions/${r.id}/candidates`);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-gray-700 hover:text-black hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <Users size={13} className="text-gray-500" />
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

        {/* Table Footer with Pagination Controls (shrink-0) */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] shrink-0 text-xs text-gray-400">
          <div>
            Showing 1–{filteredRows.length} of {filteredRows.length} requisitions
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="w-7 h-7 rounded-lg bg-white/40 border border-white/60 flex items-center justify-center text-gray-400 disabled:opacity-40 cursor-not-allowed shadow-3xs"
            >
              <ChevronLeft size={13} />
            </button>

            <button
              type="button"
              className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-900 shadow-3xs"
            >
              1
            </button>

            <button
              type="button"
              disabled
              className="w-7 h-7 rounded-lg bg-white/40 border border-white/60 flex items-center justify-center text-gray-400 disabled:opacity-40 cursor-not-allowed shadow-3xs"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal Popup */}
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
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently remove <strong>{confirmDelete.title || 'Untitled'}</strong> ({confirmDelete.department || 'General'}). This action cannot be undone.
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

