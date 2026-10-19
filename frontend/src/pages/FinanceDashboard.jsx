import { currentBillingMonth } from '../utils/billingPeriod';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  FileText,
  X
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
  const loadVersionRef = useRef(0);
  const [selectedMonth, setSelectedMonth] = useState(() => currentBillingMonth());
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
    const version = ++loadVersionRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await request(`/api/workforce/finance/work-orders?period=${selectedMonth}`, { token, noCache: true });
      if (version !== loadVersionRef.current) return;
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
      if (version !== loadVersionRef.current) return;
      setError(err?.message || 'Failed to load Work Orders.');
    } finally {
      if (version === loadVersionRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFinanceWorkOrders();
    }
  }, [token, selectedMonth]);

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
      const res = await request(`/api/workforce/finance/work-orders/${cid}/process-payment?period=${selectedMonth}`, {
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
    <div className="min-h-screen bg-transparent p-4 sm:p-7 space-y-6 max-w-7xl mx-auto text-left font-sans pb-24">
      {/* Embedded Print Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #finance-work-order-print, #finance-work-order-print * {
            visibility: visible;
          }
          #finance-work-order-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              {user?.tenant_name || 'TERM JOBS'} • FINANCIAL OPERATIONS
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-white/70 border border-white/90 text-gray-800 shadow-2xs">
              <Wallet className="w-3 h-3 text-black" />
              Accounts Payable
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Work Order Settlement & Payments
          </h1>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 my-3">
            Billing month
            <input type="month" aria-label="Billing month" min="0001-01" max="9999-12" value={selectedMonth}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                if (!/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(value)) {
                  e.target.value = selectedMonth;
                  setError('Billing month must have a four-digit year (0001–9999).');
                  return;
                }
                setError('');
                setSelectedMonth(value); setSelectedCandidateId(null); setWorkOrders([]); setLoading(true); ++loadVersionRef.current;
              }}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 !text-gray-900" />
          </label>

          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            Review Director-approved Work Orders, verify commercial billing amounts, and disburse corporate payments with 3-stage governance warrants.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadFinanceWorkOrders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="p-4 bg-gray-50 border border-gray-300 rounded-2xl text-xs text-gray-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-black" />
            <span className="font-semibold">{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-gray-600 hover:text-black cursor-pointer font-bold">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-gray-50 border border-gray-300 rounded-2xl text-xs text-gray-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-black" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-gray-600 hover:text-black cursor-pointer font-bold">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Financial KPI Highlights (Monochrome Black & White, Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Ready for Payment */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400">
              Ready for Payment
            </div>
            <div className="text-xl font-black text-black mt-0.5 leading-tight flex items-center gap-1.5">
              <span>{summary.ready_for_payment_count}</span>
              {summary.ready_for_payment_count > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              )}
            </div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-gray-400" />
              <span>Director Approved • Disbursal Ready</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center font-bold shadow-3xs shrink-0 border border-black/5">
            <CreditCard className="w-4 h-4 text-black" />
          </div>
        </div>

        {/* Card 2: Total Payable Amount */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400">
              Total Payable Amount
            </div>
            <div className="text-xl font-black text-black mt-0.5 leading-tight">
              {formatCurrency(summary.total_payable_amount)}
            </div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-gray-400" />
              <span>Approved active work orders</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center font-bold shadow-3xs shrink-0 border border-black/5">
            <DollarSign className="w-4 h-4 text-black" />
          </div>
        </div>

        {/* Card 3: Disbursed / Paid */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400">
              Disbursed / Paid
            </div>
            <div className="text-xl font-black text-black mt-0.5 leading-tight">
              {summary.paid_count}
            </div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-gray-400" />
              <span>Settled contracts</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center font-bold shadow-3xs shrink-0 border border-black/5">
            <FileCheck2 className="w-4 h-4 text-black" />
          </div>
        </div>

        {/* Card 4: Total Disbursed Amount */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between transition-all hover:shadow-xs">
          <div>
            <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400">
              Total Disbursed
            </div>
            <div className="text-xl font-black text-black mt-0.5 leading-tight">
              {formatCurrency(summary.total_paid_amount)}
            </div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5 text-gray-400" />
              <span>Historical settled payments</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-black/5 text-black flex items-center justify-center font-bold shadow-3xs shrink-0 border border-black/5">
            <Receipt className="w-4 h-4 text-black" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar (Glassmorphic) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-1.5 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('READY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'READY'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-white/60'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'READY' ? 'text-white' : 'text-gray-400'}`} />
            <span>Ready for Payment</span>
            {summary.ready_for_payment_count > 0 ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'READY' ? 'bg-white text-black' : 'bg-black text-white shadow-xs'}`}>
                {summary.ready_for_payment_count}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/5 text-gray-500">
                0
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-white/60'
            }`}
          >
            <span>All Items</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-700'}`}>
              {workOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PAID')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PAID'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-white/60'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'PAID' ? 'text-white' : 'text-gray-400'}`} />
            <span>Paid / Settled</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'PAID' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-700'}`}>
              {summary.paid_count}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING_DIRECTOR')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'PENDING_DIRECTOR'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-white/60'
            }`}
          >
            <span>Awaiting Director</span>
          </button>
        </div>

        <div className="relative w-full md:w-72 px-1 pb-1 md:pb-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search candidate, role, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 rounded-xl text-xs bg-white/70 backdrop-blur-md border border-gray-200/80 focus:outline-none focus:border-black focus:bg-white transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: List of Work Orders (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-10 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
              <Loader2 className="w-6 h-6 animate-spin text-gray-900" />
              <span className="font-semibold">Loading Finance Work Orders...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-10 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
              <FileText className="w-9 h-9 text-gray-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-gray-900">No Work Orders Found</div>
              <div className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
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
                  className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                    isSelected
                      ? 'bg-white/95 border-black shadow-md ring-1 ring-black'
                      : 'bg-white/70 backdrop-blur-md border-white/90 hover:border-gray-300 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-gray-900 truncate">
                          {cName}
                        </span>
                        <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-lg bg-gray-100/90 text-gray-700 font-bold border border-gray-200/50">
                          {woNum}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-medium truncate mt-1">
                        {rTitle}
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isItemPaid ? (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-black text-white border border-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                        PAID
                      </span>
                    ) : isItemReady ? (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-white text-black border border-black/30 flex items-center gap-1 shadow-3xs">
                        <Sparkles className="w-3 h-3 text-black" />
                        Ready to Pay
                      </span>
                    ) : (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {st}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span className="truncate font-medium">{vName}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 font-bold text-gray-900">
                      <span className="text-gray-400 font-normal text-[10.5px]">Amount:</span>
                      <span className="text-black font-black text-xs">{formatCurrency(totAmount)}</span>
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
              <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-5 overflow-hidden">
                {/* Panel Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-black text-gray-900">
                        {activeCandidateName}
                      </h2>
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-white/70 border border-white/90 text-gray-700 font-bold shadow-3xs">
                        {activeWorkOrderNumber}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {activeReqTitle} • <strong className="text-gray-700">{activeVendorName}</strong>
                    </p>
                  </div>

                  {/* Mode Toggles */}
                  <div className="flex items-center gap-1 bg-white/70 backdrop-blur-md border border-white/90 p-1 rounded-xl shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('PAYMENT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'PAYMENT'
                          ? 'bg-black text-white shadow-xs'
                          : 'text-gray-600 hover:text-black hover:bg-white/60'
                      }`}
                    >
                      Payment Console
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('DOCUMENT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'DOCUMENT'
                          ? 'bg-black text-white shadow-xs'
                          : 'text-gray-600 hover:text-black hover:bg-white/60'
                      }`}
                    >
                      Work Order Doc
                    </button>
                  </div>
                </div>

                {/* 3-Stage Governance Pipeline Bar */}
                <div className="p-4 bg-white/50 backdrop-blur-md rounded-2xl border border-white/90 space-y-2.5 shadow-2xs">
                  <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Governance & Approval Workflow
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-3 rounded-xl bg-white/80 border border-emerald-200/80 text-emerald-900 font-bold flex flex-col items-center justify-center gap-1 shadow-3xs">
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>1. Procurement</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium">Verified & Authorized</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/80 border border-emerald-200/80 text-emerald-900 font-bold flex flex-col items-center justify-center gap-1 shadow-3xs">
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>2. Director</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium">Executive Approved</span>
                    </div>

                    <div
                      className={`p-3 rounded-xl border font-bold flex flex-col items-center justify-center gap-1 shadow-3xs ${
                        isPaid
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : isDirectorApproved
                          ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-400/30'
                          : 'bg-white/80 border-gray-200 text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        {isPaid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span>3. Finance Disbursal</span>
                      </div>
                      <span className="text-[10px] font-semibold">
                        {isPaid ? 'Payment Disbursed' : 'Ready for Payment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* View Mode 1: Payment Console */}
                {viewMode === 'PAYMENT' && (
                  <div className="space-y-5">
                    {/* Commercials Summary */}
                    <div className="space-y-3">
                      <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                        Commercials & Payment Breakdown
                      </div>
                      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/90 space-y-3 shadow-2xs">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Contract Term</span>
                          <span className="font-bold text-gray-900">
                            {activeBillingPeriod}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Rate Basis</span>
                          <span className="font-medium text-gray-900">{activeRateType}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Base Rate Amount</span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(activeBaseRate)}
                          </span>
                        </div>
                        {activeWo.approved_expenses > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Approved Expenses / Reimbursements</span>
                            <span className="font-semibold text-emerald-700">
                              +{formatCurrency(activeWo.approved_expenses)}
                            </span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                          <div>
                            <span className="text-xs font-black text-gray-900 block">Total Payable to Vendor</span>
                            <span className="text-[10.5px] text-gray-400">Includes all taxes and approved billable hours</span>
                          </div>
                          <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                            {formatCurrency(activeTotalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Settlement Actions */}
                    {isPaid ? (
                      <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span>Payment Successfully Settled & Disbursed</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-emerald-900">
                          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-3xs">
                            <span className="text-emerald-600 text-[10.5px] block font-bold uppercase">Disbursal Method</span>
                            <span className="font-bold mt-0.5 block">{activeWo.payment_method || 'NEFT/RTGS Transfer'}</span>
                          </div>
                          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-3xs">
                            <span className="text-emerald-600 text-[10.5px] block font-bold uppercase">Transaction Reference</span>
                            <span className="font-mono font-bold mt-0.5 block">{activeWo.transaction_reference || 'UTR-SETTLED'}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-700 font-medium">
                            Payment timestamp: {formatDate(activeWo.payment_date || new Date().toISOString())}
                          </span>
                          <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/50 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Remittance Advice</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl bg-white/70 backdrop-blur-md border-2 border-emerald-200/90 shadow-2xs space-y-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-gray-900">
                              Executive Authorization Verified
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Ready to Disburse
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            This Work Order has been formally authorized by Procurement and approved by the Company Director. As Financial Accounts Officer, you can now disburse corporate funds and record the settlement.
                          </p>
                        </div>

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleOpenPaymentModal}
                            disabled={actionLoading}
                            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Process & Disburse Payment ({formatCurrency(activeTotalAmount)})</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* View Mode 2: Work Order Agreement Document */}
                {viewMode === 'DOCUMENT' && (
                  <div className="space-y-4" id="finance-work-order-print">
                    <div className="border border-white/90 rounded-2xl p-6 bg-white/80 backdrop-blur-md font-sans text-xs space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                        <div>
                          <div className="font-mono text-sm font-black text-gray-900">
                            WORK ORDER / SOW AGREEMENT
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 font-medium">
                            Reference: {activeWorkOrderNumber}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handlePrint}
                          className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs cursor-pointer transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print SOW</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Candidate</span>
                          <span className="font-bold text-gray-900 text-sm mt-0.5 block">{activeCandidateName}</span>
                          <span className="block text-gray-500 text-xs">{activeReqTitle}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Vendor Agency</span>
                          <span className="font-bold text-gray-900 text-sm mt-0.5 block">{activeVendorName}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Scope of Work</span>
                        <p className="text-gray-700 mt-1 bg-white p-3 rounded-xl border border-gray-100 font-medium leading-relaxed">
                          {sowData.scope_of_work || sowData.deliverables || 'Execution of full professional contractor duties as specified in the master contract and verified by Procurement & Director.'}
                        </p>
                      </div>

                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-3xs">
                          <span className="text-[10px] text-gray-400 block font-bold uppercase">Billing Cycle</span>
                          <span className="font-bold text-gray-900 mt-0.5 block">{activeBillingPeriod}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-3xs">
                          <span className="text-[10px] text-gray-400 block font-bold uppercase">Director Signoff</span>
                          <span className="font-bold text-emerald-700 mt-0.5 block">Verified & Approved</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-3xs">
                          <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Disbursal</span>
                          <span className="font-black text-gray-900 mt-0.5 block text-sm">{formatCurrency(activeTotalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-12 text-center text-xs text-gray-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
              Select a Work Order from the list to view billing details and process payment.
            </div>
          )}
        </div>
      </div>

      {/* Payment Processing Modal (Matching Director Modal Glassmorphism) */}
      {showPaymentModal && activeWo && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shadow-3xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Disburse Payment</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Authorize Corporate Settlement</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex justify-between items-center shadow-3xs">
                <div>
                  <span className="text-[11px] text-emerald-800 font-bold block">Payable to {activeWo.vendor_name || 'Vendor'}</span>
                  <span className="text-[10.5px] text-emerald-600 font-medium">For {activeWo.candidate_name} ({activeWo.requisition_title})</span>
                </div>
                <span className="text-xl font-black text-emerald-900">
                  {formatCurrency(activeWo.total_amount)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5 uppercase text-[10.5px] tracking-wider">Disbursal Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 !text-gray-900 placeholder:!text-gray-400 text-xs font-semibold focus:outline-none focus:bg-white focus:border-black cursor-pointer transition-all"
                >
                  <option value="NEFT/RTGS">NEFT / RTGS Corporate Bank Transfer</option>
                  <option value="Direct Wire">Direct Wire Transfer</option>
                  <option value="Corporate ACH">Corporate Automated Clearing House (ACH)</option>
                  <option value="Corporate Card">Corporate Virtual Card</option>
                  <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5 uppercase text-[10.5px] tracking-wider">
                  Transaction / UTR Reference ID
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. UTR-IND-2026-982312"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 !text-gray-900 placeholder:!text-gray-400 font-mono text-xs focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5 uppercase text-[10.5px] tracking-wider">Disbursal Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 !text-gray-900 placeholder:!text-gray-400 text-xs focus:outline-none focus:bg-white focus:border-black font-medium transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Disburse</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
