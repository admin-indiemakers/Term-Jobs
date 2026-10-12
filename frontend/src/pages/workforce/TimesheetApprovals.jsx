import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  RefreshCw, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  AlertTriangle, Filter, FileText,
} from 'lucide-react';

export default function TimesheetApprovals() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [timesheets, setTimesheets] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const candidateFilter = searchParams.get('candidate') || '';

  const loadTimesheets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/workforce/timesheets', { token });
      setTimesheets(data?.timesheets || []);
      setPendingCount(data?.pending_count || 0);
    } catch (err) {
      console.error('Failed to load timesheets:', err);
      setError(err.message || 'Failed to load timesheet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTimesheets(); }, [token]);

  const filtered = useMemo(() => {
    let list = timesheets;
    if (filter !== 'ALL') {
      list = list.filter((t) => t.status === filter);
    }
    if (candidateFilter) {
      list = list.filter((t) => t.candidate_id === candidateFilter);
    }
    return list;
  }, [timesheets, filter, candidateFilter]);

  const approvedCount = timesheets.filter((t) => t.status === 'APPROVED').length;
  const totalHoursThisWeek = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    return timesheets
      .filter((t) => t.status === 'APPROVED' && new Date(t.approved_at || t.updated_at) >= weekStart)
      .reduce((sum, t) => sum + (t.total_hours || 0), 0);
  }, [timesheets]);

  const handleApprove = async (tsId) => {
    setActionLoading(tsId);
    try {
      await request(`/api/workforce/timesheets/${tsId}/approve`, {
        method: 'POST',
        token,
        body: { notes: '' },
      });
      await loadTimesheets();
    } catch (err) {
      console.error('Approve failed:', err);
      alert(err.message || 'Failed to approve timesheet');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await request(`/api/workforce/timesheets/${rejectModal}/reject`, {
        method: 'POST',
        token,
        body: { reason: rejectReason },
      });
      setRejectModal(null);
      setRejectReason('');
      await loadTimesheets();
    } catch (err) {
      console.error('Reject failed:', err);
      alert(err.message || 'Failed to reject timesheet');
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor = (s) => {
    if (s === 'APPROVED') return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={13} /> };
    if (s === 'SUBMITTED') return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={13} /> };
    if (s === 'REJECTED') return { bg: '#fee2e2', text: '#991b1b', icon: <XCircle size={13} /> };
    if (s === 'DRAFT') return { bg: '#f3f4f6', text: '#6b7280', icon: <FileText size={13} /> };
    return { bg: '#f3f4f6', text: '#6b7280', icon: null };
  };

  const filterTabs = [
    { key: 'ALL', label: 'All', count: timesheets.length },
    { key: 'SUBMITTED', label: 'Pending', count: timesheets.filter((t) => t.status === 'SUBMITTED').length },
    { key: 'APPROVED', label: 'Approved', count: timesheets.filter((t) => t.status === 'APPROVED').length },
    { key: 'REJECTED', label: 'Rejected', count: timesheets.filter((t) => t.status === 'REJECTED').length },
  ];

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1 font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-cand-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-cand-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 4px; }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
      `}</style>

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • ATTENDANCE & BILLING
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Timesheet Approvals
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Review, audit, and approve weekly timesheets submitted by your workforce.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadTimesheets}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP 3 GLASSMORHPIC METRIC CARDS ── */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PENDING APPROVAL</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{pendingCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">APPROVED TIMESHEETS</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{approvedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-xs">
            <CheckCircle size={18} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">HOURS THIS WEEK</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{totalHoursThisWeek.toFixed(1)}h</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
            <FileText size={18} />
          </div>
        </div>
      </div>

      {/* ── 3. FILTER PILL TABS ── */}
      <div className="shrink-0 flex items-center gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-3xs cursor-pointer flex items-center gap-1.5 ${
              filter === tab.key
                ? 'bg-black text-white shadow-xs'
                : 'bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 backdrop-blur-md'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 4. MAIN GLASSMORHPIC CONTAINER ── */}
      <div className="flex-1 min-h-[360px] md:min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">

        {/* Timesheet Cards */}
        <div className="flex-1 overflow-y-auto custom-cand-scroll pr-1 space-y-3">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-xs font-medium flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin text-gray-400" />
              <span>Loading timesheets...</span>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-red-500" />
              <div className="text-xs text-red-600 font-medium">{error}</div>
              <button onClick={loadTimesheets} className="mt-2.5 px-3.5 py-1.5 bg-black text-white text-xs font-bold rounded-xl cursor-pointer">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center bg-white/50 backdrop-blur-md rounded-2xl border border-white/80 max-w-md mx-auto my-auto">
              <CheckCircle size={32} className="mx-auto mb-3 text-emerald-500" />
              <div className="text-sm font-extrabold text-gray-900">
                {filter === 'SUBMITTED' ? 'No pending timesheets to review' : 'No timesheets found'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {filter === 'SUBMITTED' ? 'All caught up! Timesheets submitted by your team will appear here.' : 'Timesheets will appear here once submitted.'}
              </p>
            </div>
          ) : (
            filtered.map((ts) => {
              const isExpanded = expandedId === ts.id;
              const sc = statusColor(ts.status);
              const entries = ts.daily_entries || [];
              const hasExceptions = ts.has_exceptions || (ts.exception_flags || []).length > 0;

              return (
                <div key={ts.id} className="bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl overflow-hidden shadow-3xs hover:border-black/20 transition-all">
                  {/* Header Row */}
                  <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center text-xs font-bold shadow-3xs">
                        {(ts.candidate_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs sm:text-[13px] font-extrabold text-gray-900">
                          {ts.candidate_name || 'Candidate'}
                        </div>
                        <div className="text-[10.5px] text-gray-400 font-mono">{ts.candidate_id}</div>
                      </div>
                      <div className="hidden md:block pl-2 text-xs text-gray-600 font-medium border-l border-gray-200">
                        <span>{ts.week_start_date}</span>
                        <span className="mx-1">–</span>
                        <span>{ts.week_end_date}</span>
                      </div>
                      <div className="hidden lg:block text-xs text-gray-400">
                        {ts.requisition_title}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                      {/* Hours pill */}
                      <div className="text-right px-2.5 py-1 bg-white/80 rounded-xl border border-gray-100 shadow-3xs">
                        <span className="text-xs font-extrabold text-gray-900">{ts.total_hours || 0}h</span>
                        <span className="text-[10px] text-gray-400 ml-1">/ {ts.expected_hours || 40}h</span>
                      </div>

                      {/* Exception flag */}
                      {hasExceptions && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 rounded-xl border border-amber-200">
                          <AlertTriangle size={12} className="text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-800">
                            {(ts.exception_flags || []).length} issue{(ts.exception_flags || []).length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {/* Status badge */}
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {sc.icon}
                        <span>{ts.status}</span>
                      </span>

                      {/* Action buttons */}
                      {ts.status === 'SUBMITTED' && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleApprove(ts.id); }}
                            disabled={actionLoading === ts.id}
                            className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            {actionLoading === ts.id ? '...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRejectModal(ts.id); }}
                            disabled={actionLoading === ts.id}
                            className="px-3.5 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition shadow-3xs disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Expand toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ts.id)}
                        className="p-1.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 text-gray-600 transition cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Daily Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-black/[0.04] bg-white/40 px-4 py-3.5 space-y-3">
                      {/* Exception flags */}
                      {hasExceptions && (
                        <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle size={13} className="text-amber-600" />
                            <span className="text-xs font-bold text-amber-900">AI Flagged Discrepancies</span>
                          </div>
                          {(ts.exception_flags || []).map((flag, i) => (
                            <div key={i} className="text-xs text-amber-800 ml-4">• {flag}</div>
                          ))}
                        </div>
                      )}

                      {/* Daily grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {entries.map((entry, i) => (
                          <div
                            key={i}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              entry.hours > 0
                                ? 'bg-white border-white/90 shadow-3xs'
                                : 'bg-gray-100/60 border-transparent text-gray-400'
                            }`}
                          >
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
                              {entry.day || `Day ${i + 1}`}
                            </div>
                            <div className="text-xs font-extrabold text-gray-900">{entry.hours || 0}h</div>
                          </div>
                        ))}
                      </div>

                      {/* Notes */}
                      {ts.notes && (
                        <div className="p-3 bg-white/80 rounded-xl border border-white/90 text-xs text-gray-700">
                          <strong className="block text-gray-900 mb-0.5">Employee Notes:</strong>
                          {ts.notes}
                        </div>
                      )}

                      {/* Approval Info */}
                      {ts.status === 'APPROVED' && ts.approved_by && (
                        <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle size={13} className="text-emerald-600" />
                          <span>Approved by {ts.approved_by} on {ts.approved_at_human || ts.approved_at}</span>
                        </div>
                      )}

                      {ts.status === 'REJECTED' && ts.rejection_reason && (
                        <div className="p-3 bg-red-50/90 rounded-xl border border-red-200 text-xs text-red-700">
                          <strong className="block text-red-900 mb-0.5">Rejection reason:</strong>
                          {ts.rejection_reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/80" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Reject Timesheet</h3>
            <p className="text-xs text-gray-500 mb-3.5">
              Please specify the audit reason for rejecting this timesheet submission.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Hours do not match project sprint logs, missing task breakdown..."
              className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black resize-none h-24"
            />
            <div className="flex gap-2.5 mt-4 justify-end">
              <button
                type="button"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === rejectModal}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {actionLoading === rejectModal ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
