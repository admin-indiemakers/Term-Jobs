import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  ChevronRight,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  User,
  Building2,
  ShieldCheck,
  Send,
  X,
  Sparkles,
  Printer,
  Check
} from 'lucide-react';

export default function VendorBilling() {
  const { user, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [kpiStats, setKpiStats] = useState({
    active_contractors: 0,
    total_billable_hours: 0,
    total_approved_expenses: 0,
    total_invoice_value: 0
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');

  // Selected Candidate Drawer / Detail View
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');

  // Invoice Actions
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch billing overview
  const loadOverview = async (monthVal) => {
    setLoading(true);
    setError('');
    try {
      const q = monthVal ? `?month=${monthVal}` : '';
      const res = await request(`/api/vendor-billing/overview${q}`, { token });
      if (res && res.status === 'success') {
        setCandidates(res.candidates || []);
        setKpiStats(res.kpi_stats || {});
      }
    } catch (err) {
      console.error('Failed to load vendor billing:', err);
      setError(err.message || 'Unable to load billing overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(selectedMonth);
  }, [token, selectedMonth]);

  // Fetch single candidate breakdown
  const handleSelectCandidate = async (cand) => {
    const cid = cand.workorder_id || cand.id;
    setSelectedCandidateId(cid);
    setLoadingBreakdown(true);
    setBreakdownError('');
    try {
      const q = selectedMonth ? `?month=${selectedMonth}` : '';
      const res = await request(`/api/vendor-billing/candidate/${encodeURIComponent(cid)}${q}`, { token });
      if (res && res.status === 'success') {
        setBreakdownData(res.data);
      }
    } catch (err) {
      console.error('Failed to load breakdown:', err);
      setBreakdownError(err.message || 'Unable to load detailed billing breakdown.');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!breakdownData || !selectedCandidateId) return;
    setIsGeneratingInvoice(true);
    try {
      const res = await request('/api/vendor-billing/invoices/generate', {
        token,
        method: 'POST',
        body: {
          workorder_id: selectedCandidateId,
          period: selectedMonth
        }
      });
      if (res && res.status === 'success') {
        showToast(`Invoice ${res.invoice?.invoice_number || ''} generated successfully!`);
        // Refresh breakdown & overview
        handleSelectCandidate({ workorder_id: selectedCandidateId });
        loadOverview(selectedMonth);
      }
    } catch (err) {
      alert(err.message || 'Failed to generate invoice');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId, newStatus) => {
    try {
      await request(`/api/vendor-billing/invoices/${invoiceId}/status`, {
        token,
        method: 'POST',
        body: { status: newStatus }
      });
      showToast(`Invoice marked as ${newStatus}`);
      handleSelectCandidate({ workorder_id: selectedCandidateId });
      loadOverview(selectedMonth);
    } catch (err) {
      alert(err.message || 'Failed to update invoice status');
    }
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.candidate_name && c.candidate_name.toLowerCase().includes(q)) ||
        (c.work_order_number && c.work_order_number.toLowerCase().includes(q)) ||
        (c.workorder_id && c.workorder_id.toLowerCase().includes(q)) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        (c.company_name && c.company_name.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'READY' && c.billing_status === 'Ready to Invoice') ||
        (statusFilter === 'INVOICED' && c.billing_status === 'Invoiced') ||
        (statusFilter === 'PAID' && c.billing_status === 'Paid') ||
        (statusFilter === 'AWAITING' && c.billing_status === 'Awaiting Timesheet');

      return matchSearch && matchStatus;
    });
  }, [candidates, searchQuery, statusFilter]);

  const currencySymbol = '₹';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-3 rounded-xl shadow-2xl animate-fade-in text-sm font-medium border border-[#333]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                Vendor Billing & Invoicing
              </h1>
            </div>
            <p className="text-sm text-[#6B7280] mt-1.5 ml-11.5">
              Manage contractor timesheets, weekly overtime pricing breakdowns, approved expenses, and monthly client invoices.
            </p>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-[#D1D5DB] rounded-xl px-3.5 py-2 shadow-xs">
              <Calendar className="w-4 h-4 text-[#6B7280] mr-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-semibold text-[#111827] bg-transparent focus:outline-hidden cursor-pointer"
              >
                <option value="2026-09">September 2026</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-07">July 2026</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Active Contractors
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1">
                {kpiStats.active_contractors}
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Agreement Accepted
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#374151]">
              <User className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Billable Hours
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1">
                {kpiStats.total_billable_hours}h
              </div>
              <div className="text-xs text-[#6B7280] font-medium mt-1">
                Approved Timesheets
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#374151]">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Approved Expenses
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1">
                {currencySymbol}{Number(kpiStats.total_approved_expenses || 0).toLocaleString()}
              </div>
              <div className="text-xs text-[#6B7280] font-medium mt-1">
                Travel & Incidentals
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#374151]">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Total Billable Value
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1">
                {currencySymbol}{Number(kpiStats.total_invoice_value || 0).toLocaleString()}
              </div>
              <div className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Net 30 Terms
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-xs">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by candidate, role, work order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent text-[#111827] placeholder-[#9CA3AF]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Candidates' },
              { id: 'READY', label: 'Ready to Invoice' },
              { id: 'INVOICED', label: 'Invoiced' },
              { id: 'PAID', label: 'Paid' },
              { id: 'AWAITING', label: 'Awaiting Timesheet' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#0A0A0A] text-white shadow-xs'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Candidate Panels Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#E5E7EB]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A0A0A]" />
              <p className="text-sm text-[#6B7280] font-medium mt-3">Loading candidate billing records...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E7EB]">
              <Receipt className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3 opacity-50" />
              <h3 className="text-base font-bold text-[#111827]">No candidate billing records found</h3>
              <p className="text-sm text-[#6B7280] mt-1">
                Candidates with accepted agreements and active work orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCandidates.map((cand) => {
                const isSelected = selectedCandidateId === (cand.workorder_id || cand.id);
                return (
                  <div
                    key={cand.id || cand.workorder_id}
                    onClick={() => handleSelectCandidate(cand)}
                    className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer relative overflow-hidden group hover:shadow-md ${
                      isSelected
                        ? 'border-black ring-2 ring-black/10'
                        : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                    }`}
                  >
                    {/* Status Pill */}
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#F3F4F6] text-[#4B5563] font-mono tracking-tight">
                        {cand.work_order_number || 'WO-2026'}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          cand.billing_status === 'Invoiced'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : cand.billing_status === 'Paid'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : cand.billing_status === 'Ready to Invoice'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {cand.billing_status}
                      </span>
                    </div>

                    {/* Candidate Info */}
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                        {cand.candidate_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-[#0A0A0A] truncate group-hover:text-black">
                          {cand.candidate_name}
                        </h3>
                        <p className="text-xs text-[#6B7280] font-medium truncate mt-0.5">
                          {cand.role}
                        </p>
                        <p className="text-xs text-[#9CA3AF] truncate mt-0.5">
                          {cand.company_name}
                        </p>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#F3F4F6] text-xs">
                      <div className="bg-[#F9FAFB] p-2.5 rounded-xl">
                        <div className="text-[#9CA3AF] font-medium text-[11px]">Billable Hours</div>
                        <div className="font-bold text-[#111827] mt-0.5">
                          {cand.total_hours}h{' '}
                          {cand.total_overtime_hours > 0 && (
                            <span className="text-amber-600 font-semibold text-[10px]">
                              (+{cand.total_overtime_hours}h OT)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-[#F9FAFB] p-2.5 rounded-xl">
                        <div className="text-[#9CA3AF] font-medium text-[11px]">Base Rate</div>
                        <div className="font-bold text-[#111827] mt-0.5">
                          {cand.curr_symbol}{cand.hourly_rate}/hr
                        </div>
                      </div>
                    </div>

                    {/* Total Value & Action footer */}
                    <div className="mt-4 flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[11px] text-[#9CA3AF] block">Total Amount</span>
                        <span className="text-base font-extrabold text-[#0A0A0A]">
                          {cand.curr_symbol}{Number(cand.gross_amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <button
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0A0A0A] group-hover:translate-x-0.5 transition-transform"
                      >
                        View Breakdown <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Candidate Breakdown Floating Drawer (with in-built scroll & rounded corners) */}
      {selectedCandidateId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end p-3 sm:p-5 md:p-6 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedCandidateId(null);
              setBreakdownData(null);
            }
          }}
        >
          <div className="bg-white w-full max-w-2xl lg:max-w-3xl h-[calc(100vh-1.5rem)] sm:h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3rem)] rounded-3xl shadow-2xl border border-[#E5E7EB] flex flex-col overflow-hidden animate-slide-left">
            {/* 1. Floating Drawer Header (Fixed at top) */}
            <div className="p-6 sm:px-8 pb-5 border-b border-[#E5E7EB] bg-white shrink-0 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#0A0A0A] text-white font-mono">
                    {breakdownData?.candidate?.work_order_number || 'WO-2026'}
                  </span>
                  <span className="text-xs text-[#6B7280] font-medium">
                    ID: {breakdownData?.candidate?.workorder_id}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-[#0A0A0A] mt-2">
                  {breakdownData?.candidate?.name || 'Candidate Breakdown'}
                </h2>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {breakdownData?.candidate?.role} · {breakdownData?.candidate?.company_name}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedCandidateId(null);
                  setBreakdownData(null);
                }}
                className="p-2 rounded-xl text-[#6B7280] hover:bg-[#F3F4F6] hover:text-black transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Inbuilt Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 custom-scrollbar">
              {loadingBreakdown ? (
                <div className="py-24 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                  <p className="text-sm text-[#6B7280] mt-3 font-medium">Calculating timesheets and rate schedules...</p>
                </div>
              ) : breakdownError ? (
                <div className="p-6 my-6 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-200">
                  {breakdownError}
                </div>
              ) : breakdownData ? (
                <>
                  {/* Reference Image 2 Table: WEEK | HOURS | REGULAR | OVER 40 */}
                  <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
                        Monthly Timesheet Hours ({breakdownData.period_label})
                      </span>
                      <span className="text-xs font-medium text-[#6B7280]">
                        Standard 40h/week cap
                      </span>
                    </div>

                    <div className="p-5">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                            <th className="pb-3 font-semibold">WEEK</th>
                            <th className="pb-3 font-semibold text-center">HOURS</th>
                            <th className="pb-3 font-semibold text-right">REGULAR</th>
                            <th className="pb-3 font-semibold text-right">OVER 40</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F3F4F6]">
                          {breakdownData.weeks?.map((w, idx) => (
                            <tr key={idx} className="hover:bg-[#F9FAFB]/60 transition-colors">
                              <td className="py-3.5 text-[#111827]">
                                <div className="font-semibold text-[13.5px]">{w.week_label}</div>
                                {w.week_period && (
                                  <div className="text-[11px] text-[#6B7280] font-normal mt-0.5">
                                    {w.week_period}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 text-center">
                                <span
                                  className={`inline-block border rounded-lg px-3.5 py-1 font-semibold text-sm ${
                                    w.hours > 0
                                      ? 'border-[#D1D5DB] bg-white text-[#111827] shadow-2xs'
                                      : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF]'
                                  }`}
                                >
                                  {w.hours}
                                </span>
                              </td>
                              <td className="py-3.5 text-right font-medium text-[#374151]">
                                {w.regular}
                              </td>
                              <td className="py-3.5 text-right font-bold text-amber-600">
                                {w.over_40 > 0 ? w.over_40 : 0}
                              </td>
                            </tr>
                          ))}

                          {/* Summary Row */}
                          <tr className="border-t-2 border-[#E5E7EB] font-bold text-[#111827]">
                            <td className="pt-4 pb-2 text-[#4B5563]">Regular hours</td>
                            <td className="pt-4 pb-2 text-center">—</td>
                            <td className="pt-4 pb-2 text-right text-base font-bold">
                              {breakdownData.summary?.regular_hours}
                            </td>
                            <td className="pt-4 pb-2 text-right text-base font-bold text-[#6B7280]">
                              —
                            </td>
                          </tr>

                          <tr className="font-bold text-[#111827]">
                            <td className="py-2 text-[#4B5563]">Overtime hours</td>
                            <td className="py-2 text-center">—</td>
                            <td className="py-2 text-right">—</td>
                            <td className="py-2 text-right text-base font-bold text-amber-600">
                              {breakdownData.summary?.overtime_hours > 0 ? breakdownData.summary.overtime_hours : 0}
                            </td>
                          </tr>

                          <tr className="border-t border-[#E5E7EB] font-black text-black">
                            <td className="pt-3 pb-2 text-sm uppercase tracking-wide">Total submitted</td>
                            <td className="pt-3 pb-2 text-center">—</td>
                            <td className="pt-3 pb-2 text-right text-lg" colSpan={2}>
                              {breakdownData.summary?.total_submitted}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notice Box 1: Golden Overtime Alert (Matching Reference Image 2) */}
                  {breakdownData.summary?.overtime_hours > 0 && (
                    <div className="bg-[#FEF9E7] border border-[#FDE68A] rounded-2xl p-4.5 text-[#92400E]">
                      <div className="font-bold text-sm">
                        {breakdownData.notices?.overtime_callout?.title || 'Overtime hours at 1.5×'}
                      </div>
                      <p className="text-xs text-[#B45309] mt-1 font-medium">
                        {breakdownData.notices?.overtime_callout?.description || 'Flagged to Hiring Manager individually rather than bulk approved.'}
                      </p>
                    </div>
                  )}

                  {/* Notice Box 2: Purple Transparency Alert (Matching Reference Image 2) */}
                  <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-4.5 text-[#3730A3]">
                    <div className="font-bold text-sm">
                      {breakdownData.notices?.rate_notice?.title || 'You never see the charge rate'}
                    </div>
                    <p className="text-xs text-[#4338CA] mt-1 font-medium">
                      {breakdownData.notices?.rate_notice?.description || 'Your rate and what the buyer pays are governed under standard master services schedule.'}
                    </p>
                  </div>

                  {/* Approved Expenses Breakdown */}
                  {breakdownData.expenses && breakdownData.expenses.length > 0 && (
                    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
                          Approved Expenses Receipts ({breakdownData.expenses.length})
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Total: {currencySymbol}{Number(breakdownData.financials?.expenses_subtotal || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="divide-y divide-[#F3F4F6] mt-2">
                        {breakdownData.expenses.map((exp, idx) => (
                          <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-semibold text-[#111827]">{exp.category || 'General Expense'}</div>
                              <div className="text-[11px] text-[#6B7280]">{exp.merchant || exp.notes || exp.date}</div>
                            </div>
                            <div className="font-bold text-[#0A0A0A]">
                              {currencySymbol}{Number(exp.amount || 0).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing and Billing Calculation Breakdown */}
                  <div className="bg-[#0A0A0A] text-white rounded-2xl p-6 shadow-xl space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                      Commercial Invoice Computation
                    </div>

                    <div className="space-y-2 pt-2 text-sm">
                      <div className="flex justify-between text-[#D1D5DB]">
                        <span>Regular Hours ({breakdownData.summary?.regular_hours}h × {currencySymbol}{breakdownData.rates?.hourly_rate}/h)</span>
                        <span className="font-semibold text-white">
                          {currencySymbol}{Number(breakdownData.financials?.regular_subtotal || 0).toLocaleString()}
                        </span>
                      </div>

                      {breakdownData.summary?.overtime_hours > 0 && (
                        <div className="flex justify-between text-[#D1D5DB]">
                          <span>
                            Overtime 1.5× ({breakdownData.summary?.overtime_hours}h × {currencySymbol}{breakdownData.rates?.overtime_rate}/h)
                          </span>
                          <span className="font-semibold text-amber-400">
                            {currencySymbol}{Number(breakdownData.financials?.overtime_subtotal || 0).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {breakdownData.financials?.expenses_subtotal > 0 && (
                        <div className="flex justify-between text-[#D1D5DB]">
                          <span>Approved Candidate Expenses</span>
                          <span className="font-semibold text-emerald-400">
                            {currencySymbol}{Number(breakdownData.financials?.expenses_subtotal || 0).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-xs text-[#9CA3AF] pt-1">
                        <span>Supplier Placement Margin</span>
                        <span>{breakdownData.candidate?.supplier_margin || '30%'}</span>
                      </div>
                    </div>

                    <div className="border-t border-[#262626] pt-4 mt-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[#9CA3AF] font-bold">Total Billable Amount</div>
                        <div className="text-xs text-[#6B7280]">Payment Terms: {breakdownData.candidate?.payment_terms || 'Net 30 days'}</div>
                      </div>
                      <div className="text-2xl font-black text-white">
                        {currencySymbol}{Number(breakdownData.financials?.total_invoice_amount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* 3. Floating Bottom Actions Bar (Fixed at bottom) */}
            {breakdownData && (
              <div className="p-5 sm:px-8 border-t border-[#E5E7EB] bg-white shrink-0 flex items-center justify-between gap-3 shadow-xs">
                <div className="text-xs text-[#6B7280] font-medium">
                  {breakdownData.invoice ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Invoice {breakdownData.invoice.invoice_number} ({breakdownData.invoice.status})
                    </span>
                  ) : (
                    <span>Ready for billing generation</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {breakdownData.invoice && breakdownData.invoice.status !== 'Paid' && (
                    <button
                      onClick={() => handleUpdateInvoiceStatus(breakdownData.invoice.id, 'Paid')}
                      className="px-4 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                    >
                      Mark Paid
                    </button>
                  )}

                  <button
                    onClick={handleGenerateInvoice}
                    disabled={isGeneratingInvoice}
                    className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-[#262626] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingInvoice ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                    {breakdownData.invoice ? 'Re-generate Invoice' : 'Generate Vendor Invoice'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
