import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Receipt, DollarSign,
  Clock, Filter, ChevronDown, ChevronUp, FileText, Eye, ExternalLink, X,
  Search, ShieldCheck
} from 'lucide-react';

export default function ExpenseApprovals() {
  const { token } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState(null);

  const loadExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/workforce/expenses', { token });
      setExpenses(data?.expenses || []);
      setPendingCount(data?.pending_count || 0);
      setTotalPendingAmount(data?.total_amount || 0);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError(err.message || 'Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExpenses(); }, [token]);

  const approvedCount = useMemo(() => expenses.filter((e) => e.status === 'Approved').length, [expenses]);
  const rejectedCount = useMemo(() => expenses.filter((e) => e.status === 'Rejected').length, [expenses]);
  const totalCount = expenses.length;

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchesFilter =
        filter === 'ALL'
          ? true
          : filter === 'Pending'
          ? (e.status === 'Pending' || e.status === 'Submitted')
          : e.status === filter;

      if (!matchesFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (e.candidate_name || '').toLowerCase().includes(q) ||
        (e.candidate_id || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.work_order_number || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      );
    });
  }, [expenses, filter, searchQuery]);

  const handleApprove = async (expId) => {
    setActionLoading(expId);
    try {
      await request(`/api/workforce/expenses/${expId}/approve`, {
        method: 'POST',
        token,
        body: { notes: '' },
      });
      await loadExpenses();
    } catch (err) {
      console.error('Approve failed:', err);
      alert(err.message || 'Failed to approve expense');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await request(`/api/workforce/expenses/${rejectModal}/reject`, {
        method: 'POST',
        token,
        body: { notes: rejectReason },
      });
      setRejectModal(null);
      setRejectReason('');
      await loadExpenses();
    } catch (err) {
      console.error('Reject failed:', err);
      alert(err.message || 'Failed to reject expense');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (s) => {
    if (s === 'Approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
          <CheckCircle size={12} className="text-emerald-600" />
          Approved
        </span>
      );
    }
    if (s === 'Pending' || s === 'Submitted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
          <Clock size={12} className="text-amber-600" />
          Pending Audit
        </span>
      );
    }
    if (s === 'Rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
          <XCircle size={12} className="text-rose-600" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
        {s}
      </span>
    );
  };

  const categoryIcon = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('travel')) return '✈️';
    if (c.includes('meal') || c.includes('food')) return '🍽️';
    if (c.includes('equipment') || c.includes('hardware')) return '💻';
    if (c.includes('internet') || c.includes('connectivity')) return '🌐';
    if (c.includes('office') || c.includes('supplies')) return '🏢';
    return '📋';
  };

  const filterTabs = [
    { key: 'ALL', label: 'All Claims', count: totalCount },
    { key: 'Pending', label: 'Pending Audit', count: expenses.filter((e) => e.status === 'Pending' || e.status === 'Submitted').length },
    { key: 'Approved', label: 'Approved', count: approvedCount },
    { key: 'Rejected', label: 'Rejected', count: rejectedCount },
  ];

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1 font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-exp-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-exp-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-exp-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 4px; }
        .custom-exp-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
      `}</style>

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • WORKFORCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Expense Approvals
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Audit and approve reimbursement claims and receipt vouchers submitted by your team.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadExpenses}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-shrink-0">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Pending Claims</div>
            <div className="text-xl font-black text-amber-600 mt-0.5">{pendingCount}</div>
            <div className="text-[10px] text-gray-400">Needs review</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shadow-2xs">
            <Clock size={19} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Pending Amount</div>
            <div className="text-xl font-black text-purple-700 mt-0.5">₹{totalPendingAmount.toLocaleString()}</div>
            <div className="text-[10px] text-gray-400">Total pipeline</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600 shadow-2xs">
            <DollarSign size={19} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Approved</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">{approvedCount}</div>
            <div className="text-[10px] text-gray-400">Cleared for payout</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-2xs">
            <CheckCircle size={19} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Total Claims</div>
            <div className="text-xl font-black text-blue-600 mt-0.5">{totalCount}</div>
            <div className="text-[10px] text-gray-400">Lifetime logged</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-2xs">
            <Receipt size={19} />
          </div>
        </div>
      </div>

      {/* Navigation Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-white/40 backdrop-blur-xl border border-white/70 rounded-2xl shadow-2xs overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                filter === tab.key
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-white/60'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate, category, WO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white/50 backdrop-blur-xl border border-white/80 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-2xs transition"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 custom-exp-scroll">
        {loading ? (
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-16 text-center">
            <div className="w-10 h-10 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto mb-3" />
            <div className="text-xs font-semibold text-gray-500">Loading expense claims...</div>
          </div>
        ) : error ? (
          <div className="bg-white/40 backdrop-blur-2xl border border-red-200/60 rounded-2xl p-12 text-center">
            <AlertTriangle size={32} className="mx-auto mb-2 text-red-500" />
            <div className="text-sm font-bold text-red-700">{error}</div>
            <button
              onClick={loadExpenses}
              className="mt-3 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-16 text-center shadow-xs">
            <CheckCircle size={36} className="mx-auto mb-2.5 text-emerald-500" />
            <div className="text-sm font-extrabold text-gray-900">
              {filter === 'Pending' ? 'All Pending Claims Audited' : 'No Expense Claims Found'}
            </div>
            <div className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {filter === 'Pending'
                ? 'Great job! All team expense requests have been reviewed.'
                : 'Expense claims submitted by your workforce team will appear here automatically.'}
            </div>
          </div>
        ) : (
          filtered.map((exp) => {
            const isExpanded = expandedId === exp.id;
            const isPending = exp.status === 'Pending' || exp.status === 'Submitted';

            return (
              <div
                key={exp.id}
                className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:border-blue-200/60 transition overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-white flex items-center justify-center text-lg flex-shrink-0 shadow-2xs">
                      {categoryIcon(exp.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-gray-900 truncate">
                          {exp.candidate_name || 'Team Member'}
                        </span>
                        {exp.candidate_id && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100/70 px-1.5 py-0.2 rounded border border-gray-200/60">
                            {exp.candidate_id}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-gray-700 bg-white/70 px-2 py-0.5 rounded-full border border-gray-200/60">
                          {exp.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>Date: <strong className="text-gray-700 font-medium">{exp.date_label || exp.date}</strong></span>
                        {exp.work_order_number && (
                          <span>• WO: <strong className="text-gray-700 font-medium">{exp.work_order_number}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between md:justify-end flex-shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                    <div className="text-right">
                      <div className="text-base font-black text-gray-900">
                        ₹{Number(exp.amount || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">Claim Amount</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {statusBadge(exp.status)}

                      {isPending && (
                        <div className="flex items-center gap-1.5 ml-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleApprove(exp.id); }}
                            disabled={actionLoading === exp.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                            title="Quick Approve"
                          >
                            <CheckCircle size={13} />
                            <span>{actionLoading === exp.id ? '...' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRejectModal(exp.id); }}
                            disabled={actionLoading === exp.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold border border-rose-200 transition cursor-pointer disabled:opacity-50"
                            title="Quick Reject"
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                        className="p-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-500 hover:text-black border border-white/80 transition cursor-pointer"
                        title={isExpanded ? 'Collapse' : 'Expand Details'}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100/80 bg-white/30 backdrop-blur-md p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
                      <div className="bg-white/60 rounded-xl p-3 border border-white/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Candidate</div>
                        <div className="text-xs font-bold text-gray-900">{exp.candidate_name || '—'}</div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">{exp.candidate_id || '—'}</div>
                      </div>

                      <div className="bg-white/60 rounded-xl p-3 border border-white/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Work Order</div>
                        <div className="text-xs font-bold text-gray-900">{exp.work_order_number || 'Internal Workforce'}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">Allocated Project</div>
                      </div>

                      <div className="bg-white/60 rounded-xl p-3 border border-white/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Submission Date</div>
                        <div className="text-xs font-bold text-gray-900">{exp.date_label || exp.date}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">Expense Incurred</div>
                      </div>
                    </div>

                    {exp.description && (
                      <div className="mb-3.5 bg-white/60 rounded-xl p-3 border border-white/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Expense Description</div>
                        <p className="text-xs text-gray-700 leading-relaxed">{exp.description}</p>
                      </div>
                    )}

                    {exp.receipt_name && (
                      <div className="mb-3.5 flex items-center justify-between bg-blue-50/50 border border-blue-100/70 rounded-xl p-3">
                        <div className="flex items-center gap-2.5">
                          <FileText size={17} className="text-[#0066FF]" />
                          <div>
                            <div className="text-xs font-bold text-gray-900">{exp.receipt_name}</div>
                            <div className="text-[10.5px] text-gray-500">Official receipt voucher attachment</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPreviewReceipt(exp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition cursor-pointer shadow-xs"
                        >
                          <Eye size={13} />
                          <span>Preview Voucher</span>
                        </button>
                      </div>
                    )}

                    {exp.notes && (
                      <div className="mb-3.5 bg-white/60 rounded-xl p-3 border border-white/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notes / Remarks</div>
                        <p className="text-xs text-gray-700 leading-relaxed">{exp.notes}</p>
                      </div>
                    )}

                    {/* Pending Actions */}
                    {isPending && (
                      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setRejectModal(exp.id)}
                          disabled={actionLoading === exp.id}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold border border-rose-200 transition cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          <span>Reject Claim</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(exp.id)}
                          disabled={actionLoading === exp.id}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <CheckCircle size={13} />
                          <span>{actionLoading === exp.id ? 'Approving...' : 'Approve Claim'}</span>
                        </button>
                      </div>
                    )}

                    {/* Audit Trail info */}
                    {exp.status === 'Approved' && exp.approved_by && (
                      <div className="pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-emerald-700 font-medium">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>Approved by {exp.approved_by} on {exp.approved_at ? new Date(exp.approved_at).toLocaleDateString() : '—'}</span>
                      </div>
                    )}
                    {exp.status === 'Rejected' && exp.rejected_by && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-rose-700 font-medium">
                          <XCircle size={14} className="text-rose-600" />
                          <span>Rejected by {exp.rejected_by} on {exp.rejected_at ? new Date(exp.rejected_at).toLocaleDateString() : '—'}</span>
                        </div>
                        {exp.rejection_reason && (
                          <div className="text-[11px] text-gray-500 mt-1 pl-5">
                            Reason: <span className="text-gray-800 font-medium">{exp.rejection_reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/80" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Reject Expense Claim</h3>
            <p className="text-xs text-gray-500 mb-3.5">
              Please specify the audit reason for rejecting this expense claim.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing valid GST tax invoice, exceeding client meal allowance..."
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
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {actionLoading === rejectModal ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && (() => {
        let receiptUrl = previewReceipt.receipt_url || '';
        if (!receiptUrl && previewReceipt.receipt_name) {
          const match = expenses.find(e => e.receipt_name === previewReceipt.receipt_name && e.receipt_url?.startsWith('data:'));
          if (match) receiptUrl = match.receipt_url;
        }
        const isImage = receiptUrl.startsWith('data:image/') || previewReceipt.receipt_name?.match(/\.(png|jpg|jpeg|webp)$/i);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setPreviewReceipt(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-white/80 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center font-bold">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                      <span>{previewReceipt.receipt_name || 'Receipt Document'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100/70 text-[#0066FF]">
                        {isImage ? 'Image Receipt' : 'PDF Receipt'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Candidate: <strong className="text-gray-800">{previewReceipt.candidate_name}</strong> • Category: <strong className="text-gray-800">{previewReceipt.category}</strong> • Amount: <strong className="text-gray-800">₹{previewReceipt.amount?.toLocaleString()}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {receiptUrl && (
                    <a
                      href={receiptUrl}
                      download={previewReceipt.receipt_name || 'receipt.pdf'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition shadow-xs"
                    >
                      <ExternalLink size={13} />
                      {isImage ? 'Open / Download Image' : 'Open / Download PDF'}
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewReceipt(null)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50/80 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[460px]">
                {receiptUrl ? (
                  isImage ? (
                    <img src={receiptUrl} alt="Receipt Attachment" className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-lg border border-gray-200" />
                  ) : (
                    <iframe
                      src={receiptUrl}
                      className="w-full h-[72vh] rounded-xl border border-gray-200 shadow-sm bg-white"
                      title="Receipt PDF Preview"
                    />
                  )
                ) : (
                  <div className="text-center p-8 bg-white border border-gray-200/80 rounded-2xl shadow-xs max-w-md w-full">
                    <FileText size={36} className="text-[#0066FF] mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-gray-900 mb-1">{previewReceipt.receipt_name}</h4>
                    <p className="text-xs text-gray-500 mb-4">
                      Expense Claim: <strong className="text-gray-900">₹{previewReceipt.amount} ({previewReceipt.category})</strong> logged on {previewReceipt.date_label || previewReceipt.date}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
