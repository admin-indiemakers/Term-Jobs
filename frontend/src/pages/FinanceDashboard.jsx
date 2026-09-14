import React, { useState, useEffect, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Check,
  Eye,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  UserCheck,
  ShieldCheck,
  Send,
  Filter,
  ChevronRight,
  Download,
  Printer,
  FileCheck2,
  Loader2,
  TrendingUp,
  Receipt,
  Sparkles,
  ArrowRight,
  CreditCard,
  Building,
  CheckSquare,
  BadgePercent,
  Wallet,
  FileText
} from 'lucide-react';

function safeString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return fallback;
  return String(val);
}

function formatDate(iso) {
  if (!iso || typeof iso === 'object') return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

function formatCurrency(val) {
  if (typeof val === 'object') return '₹0';
  const n = Number(val || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function FinanceDashboard() {
  const { token, user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [summary, setSummary] = useState({
    ready_for_payment_count: 0,
    paid_count: 0,
    total_payable_amount: 0,
    total_paid_amount: 0,
    total_count: 0
  });
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tabs & Search
  const [activeTab, setActiveTab] = useState('READY'); // 'READY' | 'ALL' | 'PAID' | 'PENDING_DIRECTOR'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('PAYMENT'); // 'PAYMENT' | 'DOCUMENT'

  // Payment processing state
  const [actionLoading, setActionLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('NEFT/RTGS');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadFinanceWorkOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request('/api/workforce/finance/work-orders', { token });
      const list = Array.isArray(res?.work_orders) ? res.work_orders : [];
      setWorkOrders(list);
      setSummary({
        ready_for_payment_count: res?.ready_for_payment_count || 0,
        paid_count: res?.paid_count || 0,
        total_payable_amount: res?.total_payable_amount || 0,
        total_paid_amount: res?.total_paid_amount || 0,
        total_count: res?.total_count || list.length
      });

      if (list.length > 0) {
        // Default select first ready for payment, else first item
        const ready = list.find((w) => {
          const st = (w.status || '').toLowerCase();
          return st.includes('director') || st.includes('ready') || st === 'approved by director';
        });
        const target = ready || list[0];
        if (!selectedCandidateId || !list.some((w) => (w.candidate_id || w.workorder_id || w._id) === selectedCandidateId)) {
          setSelectedCandidateId(target.candidate_id || target.workorder_id || target._id);
        }
      }
    } catch (err) {
      console.error('Failed to load finance work orders:', err);
      setError(err?.message || 'Failed to load Work Orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFinanceWorkOrders();
    }
  }, [token]);

  // Active Selected Work Order
  const activeWo = useMemo(() => {
    if (!workOrders.length) return null;
    return workOrders.find((w) => (w.candidate_id || w.workorder_id || w._id) === selectedCandidateId) || workOrders[0];
  }, [workOrders, selectedCandidateId]);

  const sowData = activeWo?.sow_data || {};
  const rawStatus = (activeWo?.status || sowData?.status || 'Pending Director Approval').trim();
  const isDirectorApproved =
    rawStatus === 'Approved by Director' ||
    rawStatus === 'Approved' ||
    rawStatus.toLowerCase().includes('director') ||
    activeWo?.ready_for_payment === true;
  const isPaid =
    rawStatus === 'Paid' ||
    rawStatus.toLowerCase() === 'paid' ||
    activeWo?.payment_status === 'Paid' ||
    sowData?.payment_status === 'Paid';

  // Filtered List
  const filteredList = useMemo(() => {
    return workOrders.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const cName = safeString(item.candidate_name).toLowerCase();
      const rTitle = safeString(item.requisition_title).toLowerCase();
      const vName = safeString(item.vendor_name).toLowerCase();
      const woNum = safeString(item.work_order_number || item.candidate_id).toLowerCase();
      const matchesSearch = !q || cName.includes(q) || rTitle.includes(q) || vName.includes(q) || woNum.includes(q);

      if (!matchesSearch) return false;

      const st = (item.status || '').toLowerCase();
      const isItemPaid = st === 'paid' || item.payment_status === 'Paid';
      const isItemReady = !isItemPaid && (st.includes('director') || item.ready_for_payment === true);

      if (activeTab === 'READY') return isItemReady;
      if (activeTab === 'PAID') return isItemPaid;
      if (activeTab === 'PENDING_DIRECTOR') return !isItemReady && !isItemPaid;
      return true; // 'ALL'
    });
  }, [workOrders, searchQuery, activeTab]);

  // Open Payment Modal with auto-generated reference
  const handleOpenPaymentModal = () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setTransactionRef(`UTR-IND-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${randomSuffix}`);
    setPaymentNotes('Settled via standard 30-day corporate disbursement cycle.');
    setShowPaymentModal(true);
  };

  // Submit Payment Disbursal
  const handleProcessPayment = async () => {
    if (!activeWo) return;
    const cid = activeWo.candidate_id || activeWo._id;
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await request(`/api/workforce/finance/work-orders/${cid}/process-payment`, {
        method: 'POST',
        token,
        body: {
          payment_method: paymentMethod,
          transaction_reference: transactionRef,
          notes: paymentNotes
        }
      });
      setSuccessMsg(res?.message || `Payment of ${formatCurrency(activeWo.total_amount || 0)} successfully disbursed!`);
      setShowPaymentModal(false);
      await loadFinanceWorkOrders();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      console.error('Failed to process payment:', err);
      setError(err?.message || 'Failed to process payment disbursement.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0A0A0A] pb-24">
      {/* Header */}
      <div className="border-b border-[#EAEAE6] bg-white sticky top-0 z-20 px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wallet className="w-3.5 h-3.5" />
                Finance & Accounts Payable
              </span>
              <span className="text-xs text-[#70706B]">• Full 3-Stage Governance Complete</span>
            </div>
            <h1 className="text-2xl font-black text-[#0A0A0A] tracking-tight mt-1 flex items-center gap-2.5">
              Work Order Settlement & Payments
            </h1>
            <p className="text-xs text-[#70706B] mt-0.5">
              Review Director-approved Work Orders, verify commercial billing amounts, and disburse corporate payments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadFinanceWorkOrders}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-[#EAEAE6] hover:bg-[#F3F3EF] transition-all text-[#40403B] shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Financial KPI Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white border border-[#EAEAE6] shadow-xs hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between text-xs text-[#70706B] font-medium">
              <span>Ready for Payment</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#0A0A0A] mt-2">
              {summary.ready_for_payment_count}
            </div>
            <div className="text-[11.5px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span>Director Approved</span> • Ready to disburse
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#EAEAE6] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#70706B] font-medium">
              <span>Total Payable Amount</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-700 mt-2">
              {formatCurrency(summary.total_payable_amount)}
            </div>
            <div className="text-[11.5px] text-[#70706B] mt-1">
              Outstanding approved work orders
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#EAEAE6] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#70706B] font-medium">
              <span>Disbursed / Paid</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-blue-700 mt-2">
              {summary.paid_count}
            </div>
            <div className="text-[11.5px] text-[#70706B] mt-1">
              Settled contracts
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#EAEAE6] shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#70706B] font-medium">
              <span>Total Disbursed Amount</span>
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-700 mt-2">
              {formatCurrency(summary.total_paid_amount)}
            </div>
            <div className="text-[11.5px] text-[#70706B] mt-1">
              Historical settled payments
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-white border border-[#EAEAE6] rounded-xl p-3 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            <button
              onClick={() => setActiveTab('READY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'READY'
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#50504B] hover:bg-[#F3F3EF]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Ready for Payment
              {summary.ready_for_payment_count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold ml-1">
                  {summary.ready_for_payment_count}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#50504B] hover:bg-[#F3F3EF]'
              }`}
            >
              All Items ({workOrders.length})
            </button>

            <button
              onClick={() => setActiveTab('PAID')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'PAID'
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#50504B] hover:bg-[#F3F3EF]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Paid / Settled ({summary.paid_count})
            </button>

            <button
              onClick={() => setActiveTab('PENDING_DIRECTOR')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'PENDING_DIRECTOR'
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#50504B] hover:bg-[#F3F3EF]'
              }`}
            >
              Awaiting Director
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A95]" />
            <input
              type="text"
              placeholder="Search candidate, role, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 rounded-lg text-xs bg-[#F8F9FA] border border-[#EAEAE6] focus:outline-none focus:border-[#0A0A0A] transition-all"
            />
          </div>
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of Work Orders (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <div className="bg-white border border-[#EAEAE6] rounded-xl p-8 text-center text-xs text-[#70706B] flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#0A0A0A]" />
                <span>Loading Finance Work Orders...</span>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="bg-white border border-[#EAEAE6] rounded-xl p-8 text-center">
                <FileText className="w-8 h-8 text-[#9A9A95] mx-auto mb-2" />
                <div className="text-xs font-bold text-[#0A0A0A]">No Work Orders Found</div>
                <div className="text-[11px] text-[#70706B] mt-1">
                  {activeTab === 'READY'
                    ? 'There are currently no Director-approved Work Orders pending payment.'
                    : 'No work orders match the current filter criteria.'}
                </div>
              </div>
            ) : (
              filteredList.map((wo) => {
                const woId = wo.candidate_id || wo.workorder_id || wo._id;
                const isSelected = (activeWo?.candidate_id || activeWo?.workorder_id || activeWo?._id) === woId;
                const st = wo.status || 'Pending';
                const isItemPaid = st === 'Paid' || wo.payment_status === 'Paid';
                const isItemReady = !isItemPaid && (st.includes('Director') || wo.ready_for_payment === true);

                const cName = wo.candidate_name || wo.sow_data?.deployed_personnel || wo.sow_data?.candidate_name || 'Candidate';
                const rTitle = wo.requisition_title || wo.sow_data?.role || wo.sow_data?.requisition_title || 'Contract Role';
                const vName = wo.vendor_name || wo.recruiter_name || wo.sow_data?.supplier_name || 'Supplier Vendor';
                const totAmount = wo.total_amount ?? wo.sow_data?.grand_total ?? wo.sow_data?.calculated_grand_total ?? 0;
                const woNum = wo.work_order_number || wo.sow_data?.ws_number || `WO-${safeString(woId).slice(-6).toUpperCase()}`;

                return (
                  <div
                    key={woId}
                    onClick={() => setSelectedCandidateId(woId)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? 'bg-white border-[#0A0A0A] shadow-md ring-1 ring-[#0A0A0A]'
                        : 'bg-white border-[#EAEAE6] hover:border-[#CACAC6] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#0A0A0A] truncate">
                            {cName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F3F3EF] text-[#60605B]">
                            {woNum}
                          </span>
                        </div>
                        <div className="text-xs text-[#50504B] font-medium truncate mt-0.5">
                          {rTitle}
                        </div>
                      </div>

                      {/* Status Pill */}
                      {isItemPaid ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          PAID
                        </span>
                      ) : isItemReady ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Ready for Payment
                        </span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-gray-100 text-gray-700">
                          {st}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#F0F0EC] text-[11px] text-[#70706B]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-[#9A9A95]" />
                        <span className="truncate">{vName}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 font-bold text-[#0A0A0A]">
                        <span className="text-[#8A8A85] font-normal">Amount:</span>
                        <span className="text-emerald-700">{formatCurrency(totAmount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Financial Console & Settlement Terminal (7 cols) */}
          <div className="lg:col-span-7">
            {activeWo ? (() => {
              const activeCandidateName = activeWo.candidate_name || sowData.deployed_personnel || sowData.candidate_name || 'Candidate';
              const activeReqTitle = activeWo.requisition_title || sowData.role || sowData.requisition_title || 'Contract Position';
              const activeVendorName = activeWo.vendor_name || activeWo.recruiter_name || sowData.supplier_name || 'Supplier Vendor';
              const activeTotalAmount = activeWo.total_amount ?? sowData.grand_total ?? sowData.calculated_grand_total ?? 0;
              const activeBaseRate = activeWo.rate ?? activeWo.base_rate ?? sowData.charge_rate_buyer ?? sowData.raw_charge_rate ?? activeTotalAmount;
              const activeWorkOrderNumber = activeWo.work_order_number || sowData.ws_number || `WO-${safeString(activeWo.candidate_id || activeWo._id).slice(-6).toUpperCase()}`;
              const activeBillingPeriod = activeWo.billing_period || sowData.cycle_period || '30-Day Billing Cycle';
              const activeRateType = activeWo.rate_type || sowData.billing_basis || 'Monthly / Hourly Fixed';

              return (
              <div className="bg-white border border-[#EAEAE6] rounded-xl shadow-xs overflow-hidden">
                {/* Panel Header */}
                <div className="p-5 border-b border-[#EAEAE6] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-[#0A0A0A]">
                        {activeCandidateName}
                      </h2>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-[#EAEAE6] text-[#50504B]">
                        {activeWorkOrderNumber}
                      </span>
                    </div>
                    <p className="text-xs text-[#70706B] mt-0.5">
                      {activeReqTitle} • {activeVendorName}
                    </p>
                  </div>

                  {/* Mode Toggles */}
                  <div className="flex items-center gap-1 bg-white border border-[#EAEAE6] p-1 rounded-lg">
                    <button
                      onClick={() => setViewMode('PAYMENT')}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'PAYMENT'
                          ? 'bg-[#0A0A0A] text-white shadow-xs'
                          : 'text-[#60605B] hover:text-[#0A0A0A]'
                      }`}
                    >
                      Payment Console
                    </button>
                    <button
                      onClick={() => setViewMode('DOCUMENT')}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'DOCUMENT'
                          ? 'bg-[#0A0A0A] text-white shadow-xs'
                          : 'text-[#60605B] hover:text-[#0A0A0A]'
                      }`}
                    >
                      Work Order Doc
                    </button>
                  </div>
                </div>

                {/* 3-Stage Governance Pipeline Bar */}
                <div className="p-4 bg-[#FBFBFA] border-b border-[#EAEAE6]">
                  <div className="text-[11px] font-bold text-[#70706B] uppercase tracking-wider mb-2">
                    Governance & Approval Workflow
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-bold flex flex-col items-center justify-center gap-1 shadow-2xs">
                      <div className="flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        1. Procurement
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium">Verified & Authorized</span>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-bold flex flex-col items-center justify-center gap-1 shadow-2xs">
                      <div className="flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        2. Director
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium">Executive Approved</span>
                    </div>

                    <div
                      className={`p-2 rounded-lg border font-bold flex flex-col items-center justify-center gap-1 shadow-2xs ${
                        isPaid
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : isDirectorApproved
                          ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[11px]">
                        {isPaid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        3. Finance Disbursal
                      </div>
                      <span className="text-[10px] font-semibold">
                        {isPaid ? 'Payment Disbursed' : 'Ready for Payment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* View Mode 1: Payment Console */}
                {viewMode === 'PAYMENT' && (
                  <div className="p-6 space-y-6">
                    {/* Commercials Summary */}
                    <div>
                      <div className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider mb-3">
                        Commercials & Payment Breakdown
                      </div>
                      <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#EAEAE6] space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#70706B]">Contract Term</span>
                          <span className="font-bold text-[#0A0A0A]">
                            {activeBillingPeriod}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#70706B]">Rate Type</span>
                          <span className="font-medium text-[#0A0A0A]">{activeRateType}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#70706B]">Base Rate Amount</span>
                          <span className="font-medium text-[#0A0A0A]">
                            {formatCurrency(activeBaseRate)}
                          </span>
                        </div>
                        {activeWo.approved_expenses > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#70706B]">Approved Expenses / Reimbursements</span>
                            <span className="font-medium text-[#0A0A0A]">
                              +{formatCurrency(activeWo.approved_expenses)}
                            </span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-[#EAEAE6] flex justify-between items-center">
                          <div>
                            <span className="text-xs font-bold text-[#0A0A0A] block">Total Payable to Vendor</span>
                            <span className="text-[11px] text-[#70706B]">Includes all taxes and approved billable hours</span>
                          </div>
                          <span className="text-2xl font-black text-emerald-700">
                            {formatCurrency(activeTotalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Settlement Actions */}
                    {isPaid ? (
                      <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          Payment Successfully Settled & Disbursed
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3 text-xs text-emerald-800">
                          <div>
                            <span className="text-emerald-600 text-[11px] block">Disbursal Method:</span>
                            <span className="font-bold">{activeWo.payment_method || 'NEFT/RTGS Transfer'}</span>
                          </div>
                          <div>
                            <span className="text-emerald-600 text-[11px] block">Transaction Reference:</span>
                            <span className="font-mono font-bold">{activeWo.transaction_reference || 'UTR-SETTLED'}</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-700">
                            Payment timestamp: {formatDate(activeWo.payment_date || new Date().toISOString())}
                          </span>
                          <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/50 shadow-2xs cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Remittance Advice
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-xl bg-white border-2 border-emerald-200 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-[#0A0A0A]">
                                Executive Authorization Verified
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Ready to Disburse
                              </span>
                            </div>
                            <p className="text-xs text-[#70706B] mt-1">
                              This Work Order has been formally approved by the Company Director. As the Financial Officer, you can now disburse corporate funds and mark this work order as paid.
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center gap-3">
                          <button
                            onClick={handleOpenPaymentModal}
                            disabled={actionLoading}
                            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4" />
                            Process & Disburse Payment ({formatCurrency(activeTotalAmount)})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* View Mode 2: Work Order Agreement Document */}
                {viewMode === 'DOCUMENT' && (
                  <div className="p-6">
                    <div className="border border-[#EAEAE6] rounded-xl p-6 bg-[#FCFCFA] font-sans text-xs space-y-4">
                      <div className="flex items-center justify-between pb-4 border-b border-[#EAEAE6]">
                        <div>
                          <div className="font-mono text-sm font-black text-[#0A0A0A]">
                            WORK ORDER / SOW AGREEMENT
                          </div>
                          <div className="text-[11px] text-[#70706B]">
                            Reference: {activeWorkOrderNumber}
                          </div>
                        </div>
                        <button
                          onClick={handlePrint}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#EAEAE6] text-[11px] font-bold text-[#40403B] hover:bg-[#F3F3EF] cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print SOW
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-[#8A8A85] uppercase tracking-wider block font-bold">Candidate:</span>
                          <span className="font-bold text-[#0A0A0A] text-sm">{activeCandidateName}</span>
                          <span className="block text-[#70706B]">{activeReqTitle}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8A8A85] uppercase tracking-wider block font-bold">Vendor Agency:</span>
                          <span className="font-bold text-[#0A0A0A] text-sm">{activeVendorName}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] text-[#8A8A85] uppercase tracking-wider block font-bold">Scope of Work:</span>
                        <p className="text-[#40403B] mt-1 bg-white p-3 rounded-lg border border-[#EAEAE6]">
                          {sowData.scope_of_work || sowData.deliverables || 'Execution of full professional contractor duties as specified in the master contract and verified by Procurement & Director.'}
                        </p>
                      </div>

                      <div className="pt-2 grid grid-cols-3 gap-2">
                        <div className="bg-white p-3 rounded-lg border border-[#EAEAE6]">
                          <span className="text-[10px] text-[#8A8A85] block font-bold">Billing Cycle:</span>
                          <span className="font-bold text-[#0A0A0A]">{activeBillingPeriod}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-[#EAEAE6]">
                          <span className="text-[10px] text-[#8A8A85] block font-bold">Director Signoff:</span>
                          <span className="font-bold text-emerald-700">Verified & Approved</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-[#EAEAE6]">
                          <span className="text-[10px] text-[#8A8A85] block font-bold">Total Disbursal:</span>
                          <span className="font-bold text-[#0A0A0A]">{formatCurrency(activeTotalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })() : (
              <div className="bg-white border border-[#EAEAE6] rounded-xl p-12 text-center text-xs text-[#70706B]">
                Select a Work Order from the list to view billing details and process payment.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {showPaymentModal && activeWo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#EAEAE6] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEAE6]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0A0A]">Disburse Payment</h3>
                  <p className="text-[11px] text-[#70706B]">Authorize Corporate Settlement</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-[#8A8A85] hover:bg-[#F3F3EF] cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[11px] text-emerald-800 font-bold block">Payable to {activeWo.vendor_name || 'Vendor'}</span>
                  <span className="text-[10px] text-emerald-600">For {activeWo.candidate_name} ({activeWo.requisition_title})</span>
                </div>
                <span className="text-lg font-black text-emerald-900">
                  {formatCurrency(activeWo.total_amount)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#0A0A0A] mb-1">Disbursal Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F8F9FA] border border-[#EAEAE6] text-xs font-semibold focus:outline-none focus:border-[#0A0A0A]"
                >
                  <option value="NEFT/RTGS">NEFT / RTGS Corporate Bank Transfer</option>
                  <option value="Direct Wire">Direct Wire Transfer</option>
                  <option value="Corporate ACH">Corporate Automated Clearing House (ACH)</option>
                  <option value="Corporate Card">Corporate Virtual Card</option>
                  <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0A0A0A] mb-1">
                  Transaction / UTR Reference ID
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. UTR-IND-2026-982312"
                  className="w-full px-3 py-2 rounded-lg bg-[#F8F9FA] border border-[#EAEAE6] font-mono text-xs focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0A0A0A] mb-1">Disbursal Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F8F9FA] border border-[#EAEAE6] text-xs focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAEAE6]">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg text-[#60605B] hover:bg-[#F3F3EF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Disburse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
