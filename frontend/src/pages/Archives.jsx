import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  ArrowLeft,
  Building2,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Clock
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

export default function Archives() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [acting, setActing] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'tenant' | 'user'
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(null);

  const load = () => {
    setLoading(true);
    request('/api/auth/archives', { token })
      .then((data) => setArchives(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  // Auto-dismiss notification after 2 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleRestore = async (item) => {
    setActing(item.id);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/archives/${item.id}/restore`, { method: 'POST', token });
      setSuccess(`"${item.displayName}" has been restored successfully.`);
      setConfirmRestore(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to restore item');
    } finally {
      setActing(null);
    }
  };

  const handlePermanentDelete = async (item) => {
    setActing(item.id);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/archives/${item.id}`, { method: 'DELETE', token });
      setSuccess(`"${item.displayName}" permanently deleted.`);
      setConfirmPermanentDelete(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete archived item');
    } finally {
      setActing(null);
    }
  };

  const filteredArchives = useMemo(() => {
    return archives.filter((a) => {
      if (filter === 'tenant' && a.item_type !== 'tenant') return false;
      if (filter === 'user' && a.item_type !== 'user') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const data = a.original_data || {};
        const matchName = (data.name || '').toLowerCase().includes(q);
        const matchEmail = (data.email || '').toLowerCase().includes(q);
        const matchId = (a.id || '').toLowerCase().includes(q);
        const matchReason = (a.reason || '').toLowerCase().includes(q);
        return matchName || matchEmail || matchId || matchReason;
      }
      return true;
    });
  }, [archives, filter, searchQuery]);

  const tenantCount = useMemo(() => archives.filter((a) => a.item_type === 'tenant').length, [archives]);
  const userCount = useMemo(() => archives.filter((a) => a.item_type === 'user').length, [archives]);

  return (
    <div
      className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto min-h-screen"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Banner Card */}
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
              DATA RETENTION
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Archived Records
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Audit and restore deleted companies and user accounts. Records stored here can be restored back to production with a single click.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Super Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {archives.length} archived records
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {tenantCount} companies
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {userCount} user accounts
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/dashboard/superadmin"
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            TOTAL ARCHIVED
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {archives.length}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Deleted records stored
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            COMPANIES
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {tenantCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Archived buyer & vendor tenants
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            USER ACCOUNTS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {userCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Archived login credentials
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

      {/* Archives Data Table Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${filter === 'all'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All ({archives.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('tenant')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${filter === 'tenant'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Companies ({tenantCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('user')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${filter === 'user'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Users ({userCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived name, ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>
        </div>

        {/* Data Table with in-built scroll & sticky header */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading archives...</div>
        ) : filteredArchives.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No archived items found matching your criteria.
          </div>
        ) : (
          <div
            className="overflow-x-auto overflow-y-auto pr-1"
            style={{
              maxHeight: '480px',
              minHeight: '260px',
            }}
          >
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-3 px-3">TYPE</th>
                  <th className="py-3 px-3">NAME</th>
                  <th className="py-3 px-3">DETAILS</th>
                  <th className="py-3 px-3">ARCHIVED BY</th>
                  <th className="py-3 px-3">REASON</th>
                  <th className="py-3 px-3">JOINED DATE</th>
                  <th className="py-3 px-3">ENDED DATE</th>
                  <th className="py-3 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredArchives.map((a) => {
                  const data = a.original_data || {};
                  const isTenant = a.item_type === 'tenant';
                  const displayName = isTenant ? data.name : (data.name || data.email);
                  const detail = isTenant
                    ? `${data.tenant_type || 'client'} • ID: ${(data.id || a.id || '').slice(0, 8)}`
                    : `${data.email || '—'} • ${data.role || 'User'} • ID: ${(data.id || a.id || '').slice(0, 8)}`;
                  const isActing = acting === a.id;
                  const itemPayload = { id: a.id, displayName };

                  const joinedDate = data.created_at || data.joined_at || data.joined_date || a.created_at;
                  const endedDate = a.archived_at || data.deleted_at || data.ended_date || data.ended_at;

                  return (
                    <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Type Badge */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          {isTenant ? <Building2 size={12} className="text-gray-500" /> : <User size={12} className="text-gray-500" />}
                          {isTenant ? 'Company' : 'User'}
                        </span>
                      </td>

                      {/* Name with Avatar */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(displayName || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{displayName || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] text-gray-500">{detail}</span>
                      </td>

                      {/* Archived By */}
                      <td className="py-3.5 px-3">
                        <span className="text-gray-600 font-medium">{a.archived_by || 'Super Admin'}</span>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-3">
                        <span className="text-gray-500">{a.reason || 'Deleted by admin'}</span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-3">
                        <span className="text-gray-600 font-medium">{formatDate(joinedDate)}</span>
                      </td>

                      {/* Ended Date */}
                      <td className="py-3.5 px-3">
                        <span className="text-gray-600 font-medium">{formatDate(endedDate)}</span>
                      </td>

                      {/* Actions (Restore & Permanent Delete) */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmRestore(itemPayload)}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw size={12} />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmPermanentDelete(itemPayload)}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal Popup: Restore */}
      {confirmRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setConfirmRestore(null)}
        >
          <div
            className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Restore Record</h3>
                <p className="text-xs text-gray-500">Restore back to production</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to restore <strong className="text-gray-900">{confirmRestore.displayName}</strong>?
              This record will immediately become active again.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestore(confirmRestore)}
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw size={13} />
                <span>Confirm Restore</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Popup: Permanent Delete */}
      {confirmPermanentDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setConfirmPermanentDelete(null)}
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
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Permanently Delete</h3>
                <p className="text-xs text-gray-500">Irreversible action</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-gray-900">{confirmPermanentDelete.displayName}</strong>?
              This action cannot be undone and will erase all associated archived data.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmPermanentDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePermanentDelete(confirmPermanentDelete)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
