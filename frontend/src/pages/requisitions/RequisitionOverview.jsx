import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import {
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Check,
  Filter as FilterIcon,
  AlertCircle,
  X,
  FileText,
  Clock,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const SECTION_CONFIG = {
  published: {
    title: 'Published',
    caption: 'Live requisitions currently visible to partner vendors.',
    statuses: ['Published', 'Active', 'Open'],
    to: '/dashboard/requisitions/published',
  },
  drafted: {
    title: 'Drafted',
    caption: 'Requisitions in progress — AI assistant intake, structuring, and approval.',
    statuses: ['Draft', 'Drafted', 'Intake', 'Structuring', 'PendingApproval', 'Pending_Approval'],
    to: '/dashboard/requisitions/drafted',
  },
  completed: {
    title: 'Completed',
    caption: 'Closed roles and filled requisitions.',
    statuses: ['Closed', 'Completed', 'Filled'],
    to: '/dashboard/requisitions/completed',
  },
  history: {
    title: 'All History',
    caption: 'Audit trail of all requisition states across this workspace.',
    statuses: ['Draft', 'Drafted', 'Intake', 'Structuring', 'PendingApproval', 'Pending_Approval', 'Published', 'Active', 'Open', 'Closed', 'Completed', 'Filled'],
    to: '/dashboard/requisitions/history',
  },
};

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

export default function RequisitionOverview({ section }) {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const initialSection = useMemo(() => {
    if (section) return section;
    const p = location.pathname.toLowerCase();
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
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reqs, profiles] = await Promise.all([
        request('/requisitions', { token }).catch(() => []),
        request('/company-profiles', { token }).catch(() => []),
      ]);

      const profileMap = Object.fromEntries(
        (Array.isArray(profiles) ? profiles : []).map((p) => [p.id, p.name])
      );

      const reqList = Array.isArray(reqs) ? reqs : reqs?.requisitions || [];
      const rows = reqList.map((r) => ({
        ...r,
        company_name: r.company_name || profileMap[r.company_profile_id] || user?.tenant_name || 'Client',
      }));

      setRequisitions(rows);
    } catch (err) {
      console.error('Failed to load requisitions:', err);
      setError(err.message || 'Unable to load requisitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleDelete = async (reqItem, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete "${reqItem.title || 'this requisition'}" permanently? This cannot be undone.`)) {
      return;
    }
    setBusyId(reqItem.id);
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${reqItem.id}`, { method: 'DELETE', token });
      setInfo(`Requisition "${reqItem.title}" deleted.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete requisition.');
    } finally {
      setBusyId('');
    }
  };

  // Section Counts Calculation from live data
  const counts = useMemo(() => {
    const normalize = (s) => (s || '').toLowerCase();
    const drafted = requisitions.filter((r) =>
      ['draft', 'drafted', 'intake', 'structuring', 'pendingapproval', 'pending_approval'].includes(normalize(r.status))
    ).length;
    const published = requisitions.filter((r) =>
      ['published', 'active', 'open'].includes(normalize(r.status))
    ).length;
    const completed = requisitions.filter((r) =>
      ['closed', 'completed', 'filled'].includes(normalize(r.status))
    ).length;
    const history = requisitions.length;

    return { drafted, published, completed, history };
  }, [requisitions]);

  const currentConfig = SECTION_CONFIG[activeTab] || SECTION_CONFIG.published;

  // Filtered Rows
  const filteredRows = useMemo(() => {
    let list = requisitions;
    const normalize = (s) => (s || '').toLowerCase();

    if (activeTab !== 'history') {
      const allowed = (currentConfig.statuses || []).map((s) => s.toLowerCase());
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
  }, [requisitions, activeTab, currentConfig, searchQuery]);

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • CONTRACT PIPELINE
          </div>
          <h1 className="text-2xl sm:text-[1.65rem] font-extrabold text-gray-900 tracking-tight">
            Requisitions Management
          </h1>
          <p className="text-xs text-gray-500 font-normal mt-0.5 max-w-2xl">
            {currentConfig.caption}
          </p>

          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● {currentConfig.title}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {filteredRows.length} {filteredRows.length === 1 ? 'requisition' : 'requisitions'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions/new')}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>+ New Requisition</span>
          </button>
        </div>
      </div>

      {info && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{info}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card with Tabs and Search */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* Navigation Tab Bar & Search Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl overflow-x-auto">
            {Object.entries(SECTION_CONFIG).map(([key, config]) => {
              const isActive = activeTab === key;
              const count = counts[key] || 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveTab(key);
                    navigate(config.to);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-black hover:bg-white/60'
                  }`}
                >
                  <span>{config.title}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, dept..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-400">Loading requisitions...</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="text-sm font-bold text-gray-800">No requisitions in {currentConfig.title}</div>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Create a new contract requirement to start candidate sourcing and AI intake.
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
          <div
            className="overflow-x-auto overflow-y-auto pr-1"
            style={{ maxHeight: '480px', minHeight: '220px' }}
          >
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-2.5 px-3">TITLE & DEPARTMENT</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">CREATED</th>
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-gray-900">{r.title || 'Untitled Role'}</div>
                      <div className="text-[10px] text-gray-400">{r.department || 'Engineering'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-3 text-gray-500 font-medium text-[11px]">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                        className="font-bold text-gray-900 hover:text-black text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                      >
                        View Details →
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(r, e)}
                        disabled={busyId === r.id}
                        className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer text-xs"
                        title="Delete Requisition"
                      >
                        <Trash2 size={13} className="inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
