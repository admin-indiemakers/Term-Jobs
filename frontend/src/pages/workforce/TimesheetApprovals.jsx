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
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Hero */}
      <div className="bg-[#1a1a1a] text-white px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#a0a09a] mb-1">
              <span>WORKFORCE</span>
              <span>›</span>
              <span className="text-white">Timesheets</span>
            </div>
            <h1 className="text-[1.35rem] font-bold tracking-tight">Timesheet Approvals</h1>
            <p className="text-[0.82rem] text-[#a0a09a] mt-0.5">
              Review and approve weekly timesheets submitted by your team
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadTimesheets} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-[0.82rem] font-medium hover:bg-white/15 transition">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center">
                <Clock size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Pending Approval</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{pendingCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#16a34a] flex items-center justify-center">
                <CheckCircle size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Approved</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{approvedCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#2563eb] flex items-center justify-center">
                <FileText size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Hours This Week</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{totalHoursThisWeek.toFixed(1)}h</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-[0.82rem] font-semibold transition ${
                filter === tab.key
                  ? 'bg-[#1a1a1a] text-white'
                  : 'bg-white border border-[#eaeae6] text-[#4a4a45] hover:bg-[#f0f0ec]'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[0.72rem] ${filter === tab.key ? 'text-white/70' : 'text-[#8a8a85]'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Timesheet Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-[#eaeae6] p-12 text-center text-[0.88rem] text-[#8a8a85]">
              Loading timesheets...
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-[#eaeae6] p-12 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-[#dc2626]" />
              <div className="text-[0.92rem] text-[#dc2626] font-medium">{error}</div>
              <button onClick={loadTimesheets} className="mt-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-[0.82rem] rounded-lg">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#eaeae6] p-12 text-center">
              <CheckCircle size={32} className="mx-auto mb-3 text-[#16a34a]" />
              <div className="text-[0.92rem] text-[#4a4a45] font-medium">
                {filter === 'SUBMITTED' ? 'No pending timesheets to review' : 'No timesheets found'}
              </div>
              <div className="text-[0.78rem] text-[#8a8a85] mt-1">
                {filter === 'SUBMITTED' ? 'All caught up! Timesheets submitted by your team will appear here.' : 'Timesheets will appear here once submitted.'}
              </div>
            </div>
          ) : (
            filtered.map((ts) => {
              const isExpanded = expandedId === ts.id;
              const sc = statusColor(ts.status);
              const entries = ts.daily_entries || [];
              const hasExceptions = ts.has_exceptions || (ts.exception_flags || []).length > 0;

              return (
                <div key={ts.id} className="bg-white rounded-xl border border-[#eaeae6] overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-[0.92rem] font-semibold text-[#1a1a1a]">
                          {ts.candidate_name || 'Unknown'}
                        </div>
                        <div className="text-[0.72rem] text-[#8a8a85] font-mono">{ts.candidate_id}</div>
                      </div>
                      <div className="text-[0.82rem] text-[#4a4a45]">
                        <span className="font-medium">{ts.week_start_date}</span>
                        <span className="mx-1">–</span>
                        <span>{ts.week_end_date}</span>
                      </div>
                      <div className="text-[0.82rem] text-[#8a8a85]">
                        {ts.requisition_title}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Hours */}
                      <div className="text-right">
                        <div className="text-[1.1rem] font-bold text-[#1a1a1a]">{ts.total_hours || 0}h</div>
                        <div className="text-[0.68rem] text-[#8a8a85]">/ {ts.expected_hours || 40}h</div>
                      </div>

                      {/* Exception flag */}
                      {hasExceptions && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#fef3c7] rounded-lg">
                          <AlertTriangle size={13} className="text-[#f59e0b]" />
                          <span className="text-[0.72rem] font-semibold text-[#92400e]">
                            {(ts.exception_flags || []).length} issue{(ts.exception_flags || []).length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {/* Status badge */}
                      <span
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {sc.icon}
                        {ts.status}
                      </span>

                      {/* Action buttons */}
                      {ts.status === 'SUBMITTED' && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(ts.id); }}
                            disabled={actionLoading === ts.id}
                            className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-[0.82rem] font-semibold hover:bg-[#15803d] transition disabled:opacity-50"
                          >
                            {actionLoading === ts.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRejectModal(ts.id); }}
                            disabled={actionLoading === ts.id}
                            className="px-4 py-2 rounded-lg bg-white border border-[#e5e7eb] text-[#dc2626] text-[0.82rem] font-semibold hover:bg-[#fee2e2] transition disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ts.id)}
                        className="p-2 rounded-lg hover:bg-[#f0f0ec] transition"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded daily breakdown */}
                  {isExpanded && (
                    <div className="border-t border-[#eaeae6] bg-[#fafaf8] px-5 py-4">
                      {/* Exception flags */}
                      {hasExceptions && (
                        <div className="mb-4 p-3 bg-[#fef3c7] rounded-lg border border-[#fde68a]">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle size={14} className="text-[#f59e0b]" />
                            <span className="text-[0.78rem] font-semibold text-[#92400e]">AI Flagged Issues</span>
                          </div>
                          {(ts.exception_flags || []).map((flag, i) => (
                            <div key={i} className="text-[0.78rem] text-[#92400e] ml-5">• {flag}</div>
                          ))}
                        </div>
                      )}

                      {/* Daily grid */}
                      <div className="grid grid-cols-7 gap-2">
                        {entries.map((entry, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border text-center ${
                              entry.hours > 0
                                ? 'bg-white border-[#d1d5cc]'
                                : 'bg-[#f0f0ec] border-transparent'
                            }`}
                          >
                            <div className="text-[0.68rem] text-[#8a8a85] font-semibold uppercase mb-1">
                              {entry.day}
                            </div>
                            <div className="text-[0.72rem] text-[#b0b0aa] mb-1">{entry.day_number || entry.date?.slice(-2)}</div>
                            <div className={`text-[1.1rem] font-bold ${entry.hours > 0 ? 'text-[#1a1a1a]' : 'text-[#d1d5cc]'}`}>
                              {entry.hours || 0}h
                            </div>
                            {entry.task && (
                              <div className="text-[0.65rem] text-[#8a8a85] mt-1 truncate" title={entry.task}>
                                {entry.task}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Notes */}
                      {ts.notes && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-[#eaeae6]">
                          <div className="text-[0.72rem] text-[#8a8a85] font-semibold uppercase mb-1">Notes</div>
                          <div className="text-[0.82rem] text-[#4a4a45]">{ts.notes}</div>
                        </div>
                      )}

                      {/* Approval info */}
                      {ts.status === 'APPROVED' && ts.approved_by && (
                        <div className="mt-3 text-[0.78rem] text-[#16a34a]">
                          ✓ Approved by {ts.approved_by} on {ts.approved_at_human || ts.approved_at}
                        </div>
                      )}
                      {ts.status === 'REJECTED' && ts.rejection_reason && (
                        <div className="mt-3 p-3 bg-[#fee2e2] rounded-lg">
                          <div className="text-[0.78rem] text-[#991b1b] font-semibold">Rejection reason:</div>
                          <div className="text-[0.82rem] text-[#991b1b]">{ts.rejection_reason}</div>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[1.1rem] font-bold text-[#1a1a1a] mb-2">Reject Timesheet</h3>
            <p className="text-[0.82rem] text-[#8a8a85] mb-4">
              Please provide a reason for rejecting this timesheet. The candidate will be notified.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Hours don't match project logs, missing task descriptions..."
              className="w-full px-3 py-2.5 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a] resize-none h-24"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-lg bg-white border border-[#eaeae6] text-[#4a4a45] text-[0.85rem] font-medium hover:bg-[#f0f0ec] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === rejectModal}
                className="px-4 py-2 rounded-lg bg-[#dc2626] text-white text-[0.85rem] font-semibold hover:bg-[#b91c1c] transition disabled:opacity-50"
              >
                {actionLoading === rejectModal ? 'Rejecting...' : 'Reject Timesheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
