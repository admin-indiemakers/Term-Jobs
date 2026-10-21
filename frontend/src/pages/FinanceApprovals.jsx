import { Link } from 'react-router-dom';
import { billingApprovalState, billingReviewLink } from '../utils/billingApprovalState';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import { currentBillingMonth, billingCycle } from '../utils/billingPeriod';
import {
  Receipt,
  Clock,
  CheckCircle2,
  DollarSign,
  Search,
  X,
  RefreshCw,
  Calendar,
  Building,
  ShieldCheck,
  Eye,
  FileText,
  Check,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  CreditCard,
  UserCheck
} from 'lucide-react';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function FinanceApprovals() {
  const { token, user } = useAuth();
  const [month, setMonth] = useState(() => currentBillingMonth());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState('');
  const decisionInFlight = useRef(false);

  useEffect(() => {
    setDecisionNotes('');
    setDecisionError('');
  }, [selectedRow]);

  async function decideBilling(approve) {
    if (decisionInFlight.current || user?.role !== 'Director' || !selectedRow || !billingApprovalState(selectedRow).pendingDirector) return;
    if (!approve && !decisionNotes.trim()) {
      setDecisionError('Enter a rejection reason so the submitter knows what must change.');
      return;
    }
    const row = selectedRow;
    const candidateId = row.candidate_id || row.workorder_id;
    if (!candidateId || !row.period) {
      setDecisionError('This bill is missing its candidate or billing period. Refresh before approving.');
      return;
    }
    decisionInFlight.current = true;
    setDecisionLoading(true);
    setDecisionError('');
    setDecisionSuccess('');
    try {
      const result = await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/${approve ? 'director-approve' : 'reject'}?period=${encodeURIComponent(row.period)}`, {
        method: 'POST', token, body: approve ? {} : { rejection_notes: decisionNotes.trim() },
      });
      if (result?.status !== 'success') throw new Error(result?.message || 'The decision could not be saved.');
      setRows((previous) => previous.map((item) =>
        (item.candidate_id || item.workorder_id) === candidateId && item.period === row.period
          ? { ...item, status: approve ? 'Approved by Director' : 'Rejected by Director', director_approved: approve, ready_for_payment: approve,
              director_approved_by: approve ? result.approved_by : '', director_approved_at: approve ? result.approved_at : '',
              procurement_authorized: approve, rejection_notes: approve ? '' : decisionNotes.trim() }
          : item
      ));
      setSelectedRow(null);
      setDecisionSuccess(approve ? 'Director sign-off saved. This bill is ready for Finance payment.' : 'Bill rejected. The submitter must correct and resubmit it through Procurement.');
      setRefresh((value) => value + 1);
    } catch (err) {
      setDecisionError(err.message || 'Unable to save the decision.');
    } finally {
      decisionInFlight.current = false;
      setDecisionLoading(false);
    }
  }


  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    request(`/api/workforce/finance/work-orders?period=${month}`, { token, noCache: true })
      .then((data) => {
        if (active) setRows(data.work_orders || []);
      })
      .catch((err) => {
        if (active) {
          setRows([]);
          setError(err.message || 'Failed to load financial approval work orders.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, month, refresh]);

  const paid = (row) => row.status === 'Paid' || row.payment_status === 'Paid';
  const ready = (row) => !paid(row) && billingApprovalState(row).directorApproved;

  const totalPaidVolume = useMemo(() => {
    return rows.filter(paid).reduce((sum, row) => sum + Number(row.payment_amount ?? row.total_amount ?? 0), 0);
  }, [rows]);

  const totalPendingVolume = useMemo(() => {
    return rows.filter(ready).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows.filter((row) => {
      if (filter === 'Paid') return paid(row);
      if (filter === 'Awaiting Finance') return ready(row);
      return true;
    });

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((row) => {
        const cand = String(row.candidate_name || '').toLowerCase();
        const wo = String(row.work_order_number || '').toLowerCase();
        const comp = String(row.company_name || '').toLowerCase();
        const vend = String(row.vendor_name || '').toLowerCase();
        const ref = String(row.transaction_ref || '').toLowerCase();
        const role = String(row.requisition_title || row.role || '').toLowerCase();
        const proc = String(row.procurement_approved_by || '').toLowerCase();
        const dir = String(row.director_approved_by || row.sow_data?.director_approved_by || '').toLowerCase();

        return (
          cand.includes(term) ||
          wo.includes(term) ||
          comp.includes(term) ||
          vend.includes(term) ||
          ref.includes(term) ||
          role.includes(term) ||
          proc.includes(term) ||
          dir.includes(term)
        );
      });
    }

    return list;
  }, [rows, filter, searchTerm]);

  const activeTenantName = user?.company_name || user?.tenant_name || 'TERM JOBS';

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • FINANCIAL GOVERNANCE & APPROVALS
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Payment Tracking
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            {activeTenantName} · Track Procurement authorization, Director sign-off, and Finance disbursements for {billingCycle(month).label}.
          </p>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Billing Month Selector Pill */}
          <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md border border-white/90 px-3 py-1.5 rounded-xl shadow-2xs">
            <Calendar size={13} className="text-gray-500" />
            <span className="text-[10.5px] font-bold text-gray-500 uppercase">Month:</span>
            <input
              type="month"
              aria-label="Billing month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
              className="text-xs font-extrabold bg-transparent text-gray-900 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => setRefresh((n) => n + 1)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-800 text-xs font-bold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {user?.role === 'Director' && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-950">
          Review pending bills below, or open{' '}
          <Link className="font-bold underline" to={`/dashboard/director/work-orders?period=${month}`}>Billing Approvals</Link>.
          {' '}Both views update the same monthly approval. After Director sign-off, Finance processes payment.
        </div>
      )}

      {decisionSuccess && <p role="status" className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm">{decisionSuccess}</p>}
      {/* Alert Notifications */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-100/60 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Content Area: Left Directory Table Card + Right Vertical Stat Cards (Matches Executive Overview layout) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3.5 items-start pt-1">
        {/* Left Column: Main Billing Approvals Directory Card */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
            {/* Top Controls Row: Title & Subtitle on Left, Search Bar on Right */}
            <div className="pb-3.5 border-b border-gray-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">Billing & Payment Status</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    One monthly billing approval, followed by Finance disbursement. Open a pending bill to approve or reject it. Billing Approvals shows the same decision.
                  </p>
                </div>

                {/* Search Input Bar */}
                <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search candidate, company, UTR..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-xl focus:outline-none focus:border-black focus:bg-white transition-all shadow-2xs"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-0.5 cursor-pointer z-10"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pills Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="inline-flex items-center gap-1 bg-white/60 backdrop-blur-md border border-white/80 p-1 rounded-xl text-[11px] font-bold shadow-2xs overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setFilter('All')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      filter === 'All'
                        ? 'bg-black text-white shadow-2xs font-extrabold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    All {rows.length > 0 ? `(${rows.length})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('Awaiting Finance')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      filter === 'Awaiting Finance'
                        ? 'bg-black text-white shadow-2xs font-extrabold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Awaiting Payment {rows.filter(ready).length > 0 ? `(${rows.filter(ready).length})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('Paid')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      filter === 'Paid'
                        ? 'bg-black text-white shadow-2xs font-extrabold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Paid {rows.filter(paid).length > 0 ? `(${rows.filter(paid).length})` : ''}
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="py-14 text-center text-xs text-gray-400 font-medium space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-gray-400" />
                <p>Loading billing approvals...</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                  <Receipt size={20} />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {searchTerm.trim()
                    ? `No billing submissions found matching "${searchTerm.trim()}".`
                    : `No matching billing submissions for ${billingCycle(month).label}.`}
                </p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-xs font-bold text-gray-900 hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                      <th className="w-[23%] py-3 px-3.5 text-left">Candidate / Work Order</th>
                      <th className="w-[18%] py-3 px-3 text-left">Company & Supplier</th>
                      <th className="w-[14%] py-3 px-3 text-left">Amount</th>
                      <th className="w-[15%] py-3 px-3 text-left">Procurement</th>
                      <th className="w-[15%] py-3 px-3 text-left">Director Sign-off</th>
                      <th className="w-[15%] py-3 px-3.5 text-right">Finance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((row) => {
                      const isRowPaid = paid(row);
                      const isRowReady = ready(row);
                      const directorApprover = row.director_approved_by || row.sow_data?.director_approved_by;
                      const directorApprovedAt = row.director_approved_at || row.sow_data?.director_approved_at;

                      return (
                        <tr
                          key={`${row.candidate_id || row.work_order_number}-${row.period}`}
                          onClick={() => setSelectedRow(row)}
                          className="hover:bg-white/60 transition-colors cursor-pointer"
                        >
                          {/* Candidate / Work Order */}
                          <td className="w-[23%] py-3.5 px-3.5 align-middle">
                            <div className="font-bold text-gray-900 text-[13px] truncate" title={row.candidate_name}>
                              {row.candidate_name || 'Candidate'}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono font-normal mt-0.5 truncate">
                              {row.work_order_number || 'WO-PENDING'} • {row.period}
                            </div>
                          </td>

                          {/* Company & Supplier */}
                          <td className="w-[18%] py-3.5 px-3 align-middle">
                            <div className="font-semibold text-gray-800 truncate" title={row.company_name || 'Not provided'}>
                              {row.company_name || '—'}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium mt-0.5 truncate" title={row.vendor_name || 'Not provided'}>
                              {row.vendor_name || '—'}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="w-[14%] py-3.5 px-3 align-middle">
                            <div className="font-black text-gray-900 text-[13px]">
                              {money(row.total_amount)}
                            </div>
                            <div className="text-[10px] font-semibold text-gray-400 mt-0.5">
                              Total Invoice
                            </div>
                          </td>

                          {/* Procurement */}
                          <td className="w-[15%] py-3.5 px-3 align-middle">
                            {billingApprovalState(row).procurementApproved && row.procurement_approved_by ? (
                              <div>
                                <div className="text-gray-900 font-bold flex items-center gap-1 truncate">
                                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  <span className="truncate">{row.procurement_approved_by}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  {date(row.procurement_approved_at)}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock size={11} className="shrink-0" />
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Director */}
                          <td className="w-[15%] py-3.5 px-3 align-middle">
                            {billingApprovalState(row).directorApproved && directorApprover ? (
                              <div>
                                <div className="text-gray-900 font-bold flex items-center gap-1 truncate">
                                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  <span className="truncate">{directorApprover}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  {date(directorApprovedAt)}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock size={11} className="shrink-0" />
                                Pending Sign-off
                              </span>
                            )}
                            {user?.role === 'Director' && billingApprovalState(row).pendingDirector && (
                              <Link onClick={(event) => event.stopPropagation()} className="block mt-2 text-xs font-bold text-blue-700 underline" to={billingReviewLink(row, month)}>Review bill</Link>
                            )}
                          </td>

                          {/* Finance Status / Action */}
                          <td className="w-[15%] py-3.5 px-3.5 align-middle text-right">
                            {isRowPaid ? (
                              <div className="inline-flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Paid
                                </span>
                                {row.transaction_ref && (
                                  <div className="text-[9.5px] text-gray-400 font-mono mt-0.5 truncate max-w-[140px]" title={row.transaction_ref}>
                                    UTR: {row.transaction_ref}
                                  </div>
                                )}
                              </div>
                            ) : isRowReady ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Awaiting Payment
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {row.status || 'Pending'}
                              </span>
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
        </div>

        {/* Right Column: 4 Metric Stat Cards Stacked Vertically (Matches Executive Overview layout) */}
        <div className="w-full lg:w-44 xl:w-48 shrink-0 flex flex-col gap-2.5 lg:sticky lg:top-4 self-start">
          {/* Stat Card 1: Total Submitted Work Orders */}
          <div
            onClick={() => setFilter('All')}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              filter === 'All'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
            title="View All Submissions"
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
                <Receipt size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Invoices
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {loading ? '…' : rows.length}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Submitted Work Orders
              </div>
            </div>
          </div>

          {/* Stat Card 2: Awaiting Payment */}
          <div
            onClick={() => setFilter('Awaiting Finance')}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              filter === 'Awaiting Finance'
                ? 'bg-white/85 border-amber-400/60 ring-1 ring-amber-400/30 shadow-sm'
                : rows.filter(ready).length > 0
                ? 'bg-white/40 border-amber-300/80 ring-1 ring-amber-400/20 hover:bg-white/60'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
            title="Filter by Awaiting Payment"
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                <Clock size={15} />
              </div>
              {rows.filter(ready).length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Action
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-gray-100 text-gray-500 border border-gray-200/80">
                  Clear
                </span>
              )}
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none flex items-center gap-2">
                <span>{loading ? '…' : rows.filter(ready).length}</span>
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Awaiting Disbursement
              </div>
            </div>
          </div>

          {/* Stat Card 3: Disbursed Invoices */}
          <div
            onClick={() => setFilter('Paid')}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              filter === 'Paid'
                ? 'bg-white/85 border-emerald-400/60 ring-1 ring-emerald-400/30 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
            title="Filter by Paid Invoices"
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                <CheckCircle2 size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Settled
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {loading ? '…' : rows.filter(paid).length}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Disbursed Invoices
              </div>
            </div>
          </div>

          {/* Stat Card 4: Total Disbursed Volume */}
          <div
            className="backdrop-blur-2xl border border-white/70 bg-white/40 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]"
            title={`Total Disbursed for ${billingCycle(month).label}`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs shrink-0">
                <DollarSign size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 truncate max-w-[80px]">
                Volume
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-[19px] font-black text-gray-900 tracking-tight leading-none truncate" title={money(totalPaidVolume)}>
                {loading ? '…' : money(totalPaidVolume)}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Total Disbursed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Detail Modal */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => { if (!decisionInFlight.current) setSelectedRow(null); }}
        >
          <div
            className="relative w-full max-w-xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-white/90 p-6 sm:p-7 text-left space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <div>
                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  Payment Status Details
                </div>
                <h3 className="text-base font-black text-gray-900 mt-0.5">
                  {selectedRow.candidate_name}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedRow.work_order_number} • Period: {selectedRow.period}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { if (!decisionInFlight.current) setSelectedRow(null); }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Commercial Amount Banner */}
            <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-gray-400">Total Invoice Amount</div>
                <div className="text-2xl font-black text-gray-900 mt-0.5">{money(selectedRow.total_amount)}</div>
              </div>
              <div>
                {paid(selectedRow) ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Paid & Disbursed
                  </span>
                ) : ready(selectedRow) ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={13} className="text-amber-600" />
                    Awaiting Payment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                    {selectedRow.status}
                  </span>
                )}
              </div>
            </div>

            {/* Corporate Entities */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-gray-100 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Buyer Company</div>
                <div className="font-bold text-gray-900">{selectedRow.company_name || '—'}</div>
              </div>
              <div className="p-3 bg-white border border-gray-100 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Vendor Supplier</div>
                <div className="font-bold text-gray-900">{selectedRow.vendor_name || '—'}</div>
              </div>
            </div>

            {/* Governance Sign-off Audit Track */}
            <div className="space-y-2 pt-1">
              <div className="text-[10.5px] font-extrabold text-gray-400 uppercase tracking-wider">
                Multi-Tier Approval Trail
              </div>
              <div className="space-y-2">
                {/* 1. Procurement */}
                <div className="p-3 bg-white/70 border border-gray-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedRow.procurement_approved_by ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      1
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Procurement Authorization</div>
                      <div className="text-[10px] text-gray-400">
                        {billingApprovalState(selectedRow).procurementApproved && selectedRow.procurement_approved_by ? `Authorized by ${selectedRow.procurement_approved_by}` : 'Pending authorization'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    {date(selectedRow.procurement_approved_at)}
                  </div>
                </div>

                {/* 2. Director */}
                <div className="p-3 bg-white/70 border border-gray-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedRow.director_approved_by || selectedRow.sow_data?.director_approved_by ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      2
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Director Executive Sign-off</div>
                      <div className="text-[10px] text-gray-400">
                        {billingApprovalState(selectedRow).directorApproved && (selectedRow.director_approved_by || selectedRow.sow_data?.director_approved_by)
                          ? `Signed off by ${selectedRow.director_approved_by || selectedRow.sow_data?.director_approved_by}`
                          : 'Pending director sign-off'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    {date(selectedRow.director_approved_at || selectedRow.sow_data?.director_approved_at)}
                  </div>
                </div>

                {/* 3. Finance */}
                <div className="p-3 bg-white/70 border border-gray-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${paid(selectedRow) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      3
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Finance Settlement & Disbursement</div>
                      <div className="text-[10px] text-gray-400">
                        {paid(selectedRow)
                          ? `Disbursed by ${selectedRow.payment_processed_by || 'Finance Officer'}`
                          : 'Pending fund disbursement'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    {date(selectedRow.payment_processed_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Reference / UTR Details */}
            {selectedRow.transaction_ref && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-xs space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-emerald-800">
                  Bank UTR / Transaction Reference
                </div>
                <div className="font-mono font-bold text-emerald-950 text-xs break-all">
                  {selectedRow.transaction_ref}
                </div>
              </div>
            )}

            {decisionError && <p role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-900">{decisionError}</p>}
            {user?.role === 'Director' && billingApprovalState(selectedRow).pendingDirector && (
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-700">Review this monthly bill before recording your decision. Approval releases it to Finance for disbursement.</p>
                <label className="block text-sm font-semibold text-gray-900" htmlFor="billing-rejection-reason">Reason for rejection</label>
                <textarea id="billing-rejection-reason" value={decisionNotes} disabled={decisionLoading} onChange={(event) => setDecisionNotes(event.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm text-gray-900" placeholder="Required when rejecting" />
                <div className="flex gap-3">
                  <button type="button" disabled={decisionLoading} onClick={() => decideBilling(true)} className="px-4 py-2 rounded-xl bg-black text-white font-bold text-sm disabled:opacity-50">{decisionLoading ? 'Saving…' : 'Approve billing'}</button>
                  <button type="button" disabled={decisionLoading} onClick={() => decideBilling(false)} className="px-4 py-2 rounded-xl border border-red-300 text-red-800 font-bold text-sm disabled:opacity-50">Reject billing</button>
                </div>
              </div>
            )}
            {user?.role === 'Director' && billingApprovalState(selectedRow).pendingDirector && (
              <Link className="block rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900 underline" to={billingReviewLink(selectedRow, month)}>
                Review this month’s bill in Billing Approvals
              </Link>
            )}

            {/* Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => { if (!decisionInFlight.current) setSelectedRow(null); }}
                className="w-full py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
