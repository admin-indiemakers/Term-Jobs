import { currentBillingMonth } from '../utils/billingPeriod';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Check,
  X,
  Eye,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Printer,
  Crown,
  FileCheck2,
  Loader2,
  Receipt
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

export default function DirectorWorkOrders() {
  const loadVersionRef = useRef(0);
  const [selectedMonth, setSelectedMonth] = useState(() => currentBillingMonth());
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [showSowModal, setShowSowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-dismiss banners
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 2500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REVISION' | 'REJECTED'

  // Modals & Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const loadWorkOrders = async () => {
    const version = ++loadVersionRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await request(`/api/workforce/director/work-orders?period=${selectedMonth}`, { token, noCache: true });
      if (version !== loadVersionRef.current) return;
      const list = Array.isArray(res?.work_orders) ? res.work_orders : [];
      setWorkOrders(list);
      if (list.length > 0) {
        const pending = list.find((w) => {
          const st = (w.status || '').toLowerCase();
          return st.includes('pending') || st.includes('sent') || !st.includes('reject');
        });
        const target = pending || list[0];
        if (!selectedCandidateId || !list.some(w => (w.candidate_id || w.workorder_id || w._id) === selectedCandidateId)) {
          setSelectedCandidateId(target.candidate_id || target.workorder_id || target._id);
        }
      }
    } catch (err) {
      console.error('Failed to load director work orders:', err);
      if (version !== loadVersionRef.current) return;
      setError(err?.message || 'Failed to load Work Orders.');
    } finally {
      if (version === loadVersionRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadWorkOrders();
    }
  }, [token, selectedMonth]);

  // Active Selected Work Order
  const activeWo = useMemo(() => {
    if (!workOrders.length) return null;
    return workOrders.find((w) => (w.candidate_id || w.workorder_id || w._id) === selectedCandidateId) || workOrders[0];
  }, [workOrders, selectedCandidateId]);

  const sowData = activeWo?.sow_data || {};
  const rawStatus = (activeWo?.status || sowData?.status || 'Pending Director Approval').trim();
  const isDirectorApproved = rawStatus === 'Paid' || rawStatus === 'Approved by Director' || rawStatus === 'Approved' || rawStatus === 'ACTIVE' || activeWo?.director_approved === true || sowData?.director_approved === true;
  const isPendingDirector = !isDirectorApproved && (rawStatus === 'Pending Director Approval' || rawStatus.toLowerCase().includes('approved by procurement') || activeWo?.procurement_authorized === true);
  const isRevision = rawStatus.toLowerCase().includes('revision');
  const isRejected = rawStatus.toLowerCase().includes('reject');

  // Computed metrics
  const kpiStats = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let procurementClearedCount = 0;
    let revisionCount = 0;
    let rejectedCount = 0;
    let totalSpend = 0;

    workOrders.forEach((w) => {
      const st = (w.status || w.sow_data?.status || '').trim();
      const d = w.sow_data || {};
      const isApp = st === 'Paid' || st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE' || w.director_approved === true || d.director_approved === true;
      const isPend = !isApp && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement') || w.procurement_authorized);
      const isRev = st.toLowerCase().includes('revision');
      const isRej = st.toLowerCase().includes('reject');

      if (isPend) pendingCount++;
      if (isApp) approvedCount++;
      if (w.procurement_authorized || isApp || isPend) procurementClearedCount++;
      if (isRev) revisionCount++;
      if (isRej) rejectedCount++;

      const buyerRate = d.raw_charge_rate || (typeof d.charge_rate === 'string' ? d.charge_rate.replace(/[^\d.]/g, '') : '') || 2200;
      const spend = Number(d.calculated_grand_total || d.grand_total || (parseFloat(buyerRate) * (parseFloat(d.regular_hours || 4) || 173)) || 0);
      totalSpend += spend;
    });

    return {
      pending: pendingCount,
      approved: approvedCount,
      procurementCleared: procurementClearedCount,
      revision: revisionCount,
      rejected: rejectedCount,
      totalSpend
    };
  }, [workOrders]);

  // Filtered List
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      const d = w.sow_data || {};
      const st = (w.status || d.status || '').trim();
      const isApp = st === 'Paid' || st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE' || w.director_approved === true || d.director_approved === true;
      const isPend = !isApp && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement') || w.procurement_authorized);
      const isRev = st.toLowerCase().includes('revision');
      const isRej = st.toLowerCase().includes('reject');

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (d.deployed_personnel && d.deployed_personnel.toLowerCase().includes(q)) ||
        (w.candidate_name && w.candidate_name.toLowerCase().includes(q)) ||
        (d.role && d.role.toLowerCase().includes(q)) ||
        (w.role && w.role.toLowerCase().includes(q)) ||
        (d.company_name && d.company_name.toLowerCase().includes(q)) ||
        (w.company_name && w.company_name.toLowerCase().includes(q)) ||
        (d.supplier_name && d.supplier_name.toLowerCase().includes(q)) ||
        (w.vendor_name && w.vendor_name.toLowerCase().includes(q)) ||
        (d.ws_number && d.ws_number.toLowerCase().includes(q)) ||
        (w.candidate_id && w.candidate_id.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && isPend) ||
        (statusFilter === 'APPROVED' && isApp) ||
        (statusFilter === 'REVISION' && isRev) ||
        (statusFilter === 'REJECTED' && isRej);

      return matchSearch && matchStatus;
    });
  }, [workOrders, searchQuery, statusFilter]);

  // Executive Director Approval Handler
  const handleDirectorApprove = async () => {
    if (!activeWo) return;
    const candidateId = activeWo.candidate_id || activeWo.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      const res = await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/director-approve?period=${selectedMonth}`, {
        method: 'POST',
        token,
      });
      setSuccessMsg(`👑 Work Order formally signed & approved by Company Director for ${safeString(sowData.deployed_personnel, 'Candidate')}!`);
      const approverName = res?.approved_by || `${user?.name || 'Director'} (Director)`;
      const approvedAtTime = res?.approved_at || new Date().toISOString();

      setWorkOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((w) => {
          const wId = w.candidate_id || w.workorder_id || w._id;
          if (wId === candidateId) {
            return {
              ...w,
              status: 'Approved by Director',
              sow_status: 'Approved by Director',
              agreement_status: 'Approved',
              director_approved: true,
              director_approved_by: approverName,
              director_approved_at: approvedAtTime,
              sow_data: {
                ...(w.sow_data || {}),
                status: 'Approved by Director',
                director_approved_by: approverName,
                director_approved_at: approvedAtTime,
              },
            };
          }
          return w;
        })
      );
      loadWorkOrders();
    } catch (err) {
      setError(err.message || 'Failed to approve Work Order as Director.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendRevision = async () => {
    if (!activeWo || !revisionNotes.trim()) return;
    const candidateId = activeWo.candidate_id || activeWo.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/request-revision?period=${selectedMonth}`, {
        method: 'POST',
        token,
        body: { revision_notes: revisionNotes.trim() },
      });
      setSuccessMsg('Commercial revision feedback sent back to Talent Vendor.');
      setShowRevisionModal(false);
      setRevisionNotes('');
      loadWorkOrders();
    } catch (err) {
      setError(err.message || 'Failed to request revision.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeWo) return;
    const candidateId = activeWo.candidate_id || activeWo.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/reject?period=${selectedMonth}`, {
        method: 'POST',
        token,
        body: { rejection_notes: rejectNotes.trim() || 'Commercial terms rejected by Company Director.' },
      });
      setSuccessMsg('Work Order rejected.');
      setShowRejectModal(false);
      setRejectNotes('');
      setWorkOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((w) => {
          const wId = w.candidate_id || w.workorder_id || w._id;
          if (wId === candidateId) {
            return {
              ...w,
              status: 'Rejected by Director',
              sow_status: 'Rejected by Director',
              director_approved: false,
              sow_data: {
                ...(w.sow_data || {}),
                status: 'Rejected by Director',
              },
            };
          }
          return w;
        })
      );
      loadWorkOrders();
    } catch (err) {
      setError(err.message || 'Failed to reject Work Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const activeTenantName = user?.company_name || user?.tenant_name || 'TERM JOBS';

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Embedded Print Styling for Clean A4 Single-Page Document Printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #director-work-order-print, #director-work-order-print * {
            visibility: visible;
          }
          #director-work-order-print {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            {activeTenantName} • EXECUTIVE GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Director Work Orders & SOW Sign-off
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            Inspect commercial rate schedules, timesheet breakdowns, and grant final executive Director sign-off for Work Orders authorized by Procurement.
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
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                  setSelectedCandidateId(null);
                  setWorkOrders([]);
                  setLoading(true);
                  ++loadVersionRef.current;
                }
              }}
              className="text-xs font-extrabold bg-transparent text-gray-900 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={loadWorkOrders}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-800 text-xs font-bold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Work Orders</span>
          </button>
        </div>
      </div>

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

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="p-1 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/60 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Content Area: Left Directory Table Card + Right Vertical Stat Cards */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3.5 items-start pt-1">
        {/* Left Column: Main Work Order Approvals Directory Card */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
            {/* Top Controls Row: Title & Subtitle on Left, Search Bar on Right */}
            <div className="pb-3.5 border-b border-gray-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">Work Order Approvals</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review commercial terms, deployed personnel SOW, and grant executive Director sign-off.
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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate, role, SOW..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-xl focus:outline-none focus:border-black focus:bg-white transition-all shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
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
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'ALL'
                        ? 'bg-black text-white shadow-2xs font-extrabold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    All {workOrders.length > 0 ? `(${workOrders.length})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('PENDING')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'PENDING'
                        ? 'bg-black text-white shadow-2xs font-extrabold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Pending Sign-off {kpiStats.pending > 0 ? `(${kpiStats.pending})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('APPROVED')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'APPROVED'
                        ? 'bg-black text-white shadow-2xs font-extrabold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Approved by Director {kpiStats.approved > 0 ? `(${kpiStats.approved})` : ''}
                  </button>
                  {kpiStats.revision > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('REVISION')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        statusFilter === 'REVISION'
                          ? 'bg-black text-white shadow-2xs font-extrabold'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Revision Requested ({kpiStats.revision})
                    </button>
                  )}
                  {kpiStats.rejected > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('REJECTED')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        statusFilter === 'REJECTED'
                          ? 'bg-black text-white shadow-2xs font-extrabold'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Rejected ({kpiStats.rejected})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="py-14 text-center text-xs text-gray-400 font-medium space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-gray-400" />
                <p>Loading Work Orders for Director governance...</p>
              </div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                  <Receipt size={20} />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {searchQuery.trim()
                    ? `No work orders found matching "${searchQuery.trim()}".`
                    : `No work orders found for ${selectedMonth}.`}
                </p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
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
                      <th className="w-[14%] py-3 px-3 text-left">Rate & Value</th>
                      <th className="w-[15%] py-3 px-3 text-left">Procurement</th>
                      <th className="w-[15%] py-3 px-3 text-left">Director Sign-off</th>
                      <th className="w-[15%] py-3 px-3.5 text-right">Statement of Work</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWorkOrders.map((item) => {
                      const d = item.sow_data || {};
                      const st = (item.status || d.status || 'Pending Director Approval').trim();
                      const itemIsApproved = st === 'Paid' || st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE' || item.director_approved === true || d.director_approved === true;
                      const itemIsPending = !itemIsApproved && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement') || item.procurement_authorized);
                      const itemIsRejected = st.toLowerCase().includes('reject');
                      const itemIsRevision = st.toLowerCase().includes('revision');
                      const buyerRate = d.raw_charge_rate || (typeof d.charge_rate === 'string' ? d.charge_rate.replace(/[^\d.]/g, '') : '') || 2200;
                      const totalValue = d.calculated_grand_total || d.grand_total || (parseFloat(buyerRate) * (parseFloat(d.regular_hours || 4) || 173));
                      const candidateId = item.candidate_id || item.workorder_id || item._id;

                      return (
                        <tr
                          key={candidateId}
                          onClick={() => {
                            setSelectedCandidateId(candidateId);
                            setShowSowModal(true);
                          }}
                          className="hover:bg-white/60 transition-colors cursor-pointer group"
                        >
                          {/* Candidate / Work Order */}
                          <td className="w-[23%] py-3.5 px-3.5 align-middle">
                            <div className="font-bold text-gray-900 text-[13px] truncate" title={safeString(d.deployed_personnel || item.candidate_name, 'Candidate')}>
                              {safeString(d.deployed_personnel || item.candidate_name, 'Candidate')}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono font-normal mt-0.5 truncate">
                              {d.ws_number || item.candidate_id || 'WO-PENDING'} • {safeString(d.role || item.role, 'Specialist')}
                            </div>
                          </td>

                          {/* Company & Supplier */}
                          <td className="w-[18%] py-3.5 px-3 align-middle">
                            <div className="font-semibold text-gray-800 truncate" title={safeString(d.company_name || item.company_name, '—')}>
                              {safeString(d.company_name || item.company_name || activeTenantName, '—')}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium mt-0.5 truncate" title={safeString(d.supplier_name || item.vendor_name, 'Direct Applicant')}>
                              {safeString(d.supplier_name || item.vendor_name, 'Direct Applicant')}
                            </div>
                          </td>

                          {/* Rate & Value */}
                          <td className="w-[14%] py-3.5 px-3 align-middle">
                            <div className="font-black text-gray-900 text-[13px]">
                              {formatCurrency(totalValue)}
                            </div>
                            <div className="text-[10px] font-semibold text-gray-400 mt-0.5">
                              ₹{buyerRate}/hr · {safeString(d.billing_cycle, 'Monthly')}
                            </div>
                          </td>

                          {/* Procurement */}
                          <td className="w-[15%] py-3.5 px-3 align-middle">
                            {item.procurement_authorized || itemIsApproved || itemIsPending || d.procurement_approved_by ? (
                              <div>
                                <div className="text-gray-900 font-bold flex items-center gap-1 truncate">
                                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  <span className="truncate">{safeString(item.procurement_approved_by || d.procurement_approved_by, 'Aditi (Procurement)')}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  {formatDate(item.procurement_approved_at || d.procurement_approved_at)}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock size={11} className="shrink-0" />
                                Pending Verification
                              </span>
                            )}
                          </td>

                          {/* Director Sign-off */}
                          <td className="w-[15%] py-3.5 px-3 align-middle">
                            {itemIsApproved ? (
                              <div>
                                <div className="text-gray-900 font-bold flex items-center gap-1 truncate">
                                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  <span className="truncate">{safeString(item.director_approved_by || d.director_approved_by, `${user?.name || 'Director'} (Director)`)}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  {formatDate(item.director_approved_at || d.director_approved_at)}
                                </div>
                              </div>
                            ) : itemIsRejected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <XCircle size={11} className="shrink-0" />
                                Rejected
                              </span>
                            ) : itemIsRevision ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle size={11} className="shrink-0" />
                                Revision Requested
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Pending Sign-off
                              </span>
                            )}
                          </td>

                          {/* Actions: View Statement Button */}
                          <td className="w-[15%] py-3.5 px-3.5 align-middle text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidateId(candidateId);
                                setShowSowModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 group-hover:bg-gray-900"
                              title="View Statement of Work"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
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

        {/* Right Column: 4 Metric Stat Cards Stacked Vertically */}
        <div className="w-full lg:w-44 xl:w-48 shrink-0 flex flex-col gap-2.5 lg:sticky lg:top-4 self-start">
          {/* Stat Card 1: Pending Director Sign-off */}
          <div
            onClick={() => setStatusFilter('PENDING')}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-white/85 border-amber-400/60 ring-1 ring-amber-400/30 shadow-sm'
                : kpiStats.pending > 0
                ? 'bg-white/40 border-amber-300/80 ring-1 ring-amber-400/20 hover:bg-white/60'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
            title="Filter by Pending Sign-off"
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                <Crown size={15} />
              </div>
              {kpiStats.pending > 0 ? (
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
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {loading ? '…' : kpiStats.pending}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Pending Sign-off
              </div>
            </div>
          </div>

          {/* Stat Card 2: Procurement Authorized */}
          <div
            onClick={() => setStatusFilter('ALL')}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              statusFilter === 'ALL'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
            title="View All Submissions"
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
                <FileCheck2 size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Verified
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {loading ? '…' : kpiStats.procurementCleared}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Procurement Authorized
              </div>
            </div>
          </div>

          {/* Stat Card 3: Fully Approved & Active */}
          <div
            onClick={() => setStatusFilter('APPROVED')}
            className={`backdrop-blur-2xl border rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px] cursor-pointer transition-all ${
              statusFilter === 'APPROVED'
                ? 'bg-white/85 border-emerald-400/60 ring-1 ring-emerald-400/30 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
            }`}
            title="Filter by Fully Approved Work Orders"
          >
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                <ShieldCheck size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Executed
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {loading ? '…' : kpiStats.approved}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Fully Approved & Active
              </div>
            </div>
          </div>

          {/* Stat Card 4: Monthly Committed Spend */}
          <div
            className="backdrop-blur-2xl border border-white/70 bg-white/40 rounded-2xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[102px]"
            title={`Total Monthly Committed Spend for ${selectedMonth}`}
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
              <div className="text-lg sm:text-[19px] font-black text-gray-900 tracking-tight leading-none truncate" title={formatCurrency(kpiStats.totalSpend)}>
                {loading ? '…' : formatCurrency(kpiStats.totalSpend)}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Monthly Spend
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statement of Work Full Document Modal */}
      {showSowModal && activeWo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowSowModal(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-white/90 overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header with Title and Executive Actions */}
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
              <div className="space-y-0.5">
                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <span>Statement of Work & Work Order</span>
                  <span>•</span>
                  <span className="font-mono text-gray-700 font-bold">{safeString(sowData.ws_number, activeWo.candidate_id || 'WO-2026')}</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                  <span>{safeString(sowData.deployed_personnel || activeWo.candidate_name, 'Candidate')}</span>
                  <span className="text-xs text-gray-500 font-normal">
                    · {safeString(sowData.role || activeWo.role, 'Specialist')}
                  </span>
                </h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold transition border border-gray-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="Print or Save Signed PDF"
                >
                  <Printer size={13} />
                  <span className="hidden sm:inline">Print / Save PDF</span>
                </button>

                {!isDirectorApproved && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRevisionModal(true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold transition border border-gray-200 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      Request Revision
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition border border-red-200 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {isDirectorApproved ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>✓ Approved by Director</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDirectorApprove}
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-extrabold transition cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 size={13} className="animate-spin text-white" /> : <Crown size={13} className="text-amber-400" />}
                    <span>Director Sign-Off & Approve</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSowModal(false)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-black transition cursor-pointer shadow-2xs ml-1"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable Paper SOW Document */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
              {/* Status Callout Banner */}
              {isPendingDirector && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 flex items-center justify-between no-print shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Crown className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <strong>Awaiting Final Company Director Sign-off:</strong> This Work Order was formally verified and released by Procurement Lead{' '}
                      <span className="font-bold">{safeString(activeWo.procurement_approved_by || 'Aditi (Procurement)')}</span>. Granting Director approval unlocks full activation & timesheets.
                    </div>
                  </div>
                </div>
              )}

              {/* Physical PDF Paper Document */}
              <div
                id="director-work-order-print"
                className="bg-white rounded-2xl border border-gray-300 shadow-sm p-6 sm:p-8 text-gray-900 font-sans space-y-6 text-left"
              >
                {/* Header */}
                <div className="border-b-2 border-gray-900 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="text-[11px] font-extrabold tracking-widest text-gray-500 uppercase flex items-center gap-1.5">
                      <span>STATEMENT OF WORK & WORK ORDER</span>
                      <span>·</span>
                      <span className="text-black font-black">EXECUTIVE SCHEDULE</span>
                    </div>
                    <h2 className="text-2xl font-black text-black tracking-tight mt-1 flex items-center gap-2">
                      <span>WORK STATEMENT:</span>
                      <span className="font-mono">{safeString(sowData.ws_number, 'WSOW-2026-0412')}</span>
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">
                      Issued under Master Service Agreement{' '}
                      <span className="font-bold text-gray-900">{safeString(sowData.msa_ref, 'MSA-2026-TERMS')}</span> ·{' '}
                      <span className="font-semibold text-gray-900">{safeString(sowData.company_name || activeTenantName, 'Bearitt')}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                      isDirectorApproved
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : isPendingDirector
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-gray-100 text-gray-800 border-gray-300'
                    }`}>
                      {isDirectorApproved
                        ? '✓ Director Approved'
                        : isPendingDirector
                        ? 'Pending Director Sign-off'
                        : safeString(activeWo.status, 'Draft')}
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      Period: {safeString(sowData.billing_cycle, 'Monthly')}
                    </span>
                  </div>
                </div>

                {/* Section 1: Personnel and Scope */}
                <div>
                  <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-black"></span>
                    1. Personnel and Engagement Scope
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Deployed Personnel</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.deployed_personnel || activeWo.candidate_name, '—')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Designation / Role</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.role || activeWo.role, '—')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Reporting Manager</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.reporting_to, 'Arun Deshpande, Engineering')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Place of Work</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.place_of_work, 'Hybrid / Bangalore HQ')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Commencement Date</div>
                      <div className="text-sm font-bold text-black mt-0.5">{formatDate(sowData.commencement || '2026-09-01')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Expiry Date</div>
                      <div className="text-sm font-bold text-black mt-0.5">{formatDate(sowData.expiry || '2027-08-31')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Duration</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.duration, '12 Months')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Talent Vendor</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.supplier_name, 'Asimovex / TalentBridge')}</div>
                    </div>
                  </div>
                </div>

                {/* Section 2: MSA Billing Rate & Overtime Terms */}
                <div>
                  <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-black"></span>
                    2. MSA Billing Rate & Overtime Terms
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Base Hourly Rate (₹)</div>
                      <div className="text-base font-black text-black mt-0.5">
                        ₹{sowData.raw_charge_rate || 2200}/hr
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Billing Cycle</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.billing_cycle, 'Monthly')}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Overtime Multiplier</div>
                      <div className="text-sm font-bold text-emerald-700 mt-0.5">1.5× Base Hourly Rate</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">Payment Terms</div>
                      <div className="text-sm font-bold text-black mt-0.5">{safeString(sowData.payment_terms, 'Net 30 days')}</div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Approved Hours Breakdown */}
                <div>
                  <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-black"></span>
                    3. Approved Timesheet Hours Breakdown
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[11px] border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-4">Hour Type</th>
                          <th className="py-2.5 px-4">Hours Approved</th>
                          <th className="py-2.5 px-4">Billing Rate</th>
                          <th className="py-2.5 px-4 text-right">Line Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-gray-900">
                        <tr>
                          <td className="py-2.5 px-4 font-bold">Standard Regular Hours</td>
                          <td className="py-2.5 px-4">{sowData.regular_hours || 4} hrs</td>
                          <td className="py-2.5 px-4 font-medium">₹{sowData.raw_charge_rate || 2200} / hr</td>
                          <td className="py-2.5 px-4 text-right font-bold text-black">
                            ₹{((parseFloat(sowData.raw_charge_rate || 2200)) * (parseFloat(sowData.regular_hours || 4))).toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-emerald-800">Overtime Hours (&gt;40h/wk)</td>
                          <td className="py-2.5 px-4">{sowData.overtime_hours || 0} hrs</td>
                          <td className="py-2.5 px-4 text-emerald-800 font-semibold">1.5× Rate</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                            ₹{((parseFloat(sowData.raw_charge_rate || 2200) * 1.5) * (parseFloat(sowData.overtime_hours || 0))).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total Summary Box */}
                <div className="bg-black text-white p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      TOTAL AUTHORIZED WORK ORDER COMMITMENT
                    </div>
                    <div className="text-3xl font-black text-[#22C55E] tracking-tight mt-1">
                      {formatCurrency(sowData.calculated_grand_total || sowData.grand_total || ((parseFloat(sowData.raw_charge_rate || 2200)) * (parseFloat(sowData.regular_hours || 4))))}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 font-medium">
                      Net 30 Days Commercial Terms · Backed by MSA Rate Schedule
                    </div>
                  </div>

                  <div className="no-print">
                    {!isDirectorApproved && (
                      <button
                        type="button"
                        onClick={handleDirectorApprove}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 size={14} className="animate-spin text-white" /> : <Crown size={14} />}
                        <span>Approve as Director</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dual Signature Audit Stamp */}
                <div className="pt-6 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
                  <div>
                    <span className="font-bold text-gray-800 block">1. Procurement Team Authorization:</span>
                    <div className="border-b border-gray-900 pb-1 mt-1 font-bold text-indigo-900">
                      {safeString(activeWo.procurement_approved_by || sowData.procurement_approved_by || 'ADITI (Procurement Lead)')}
                    </div>
                    <div className="text-gray-500 mt-1">Authorized for Commercial Dispatch</div>
                  </div>

                  <div>
                    <span className="font-bold text-gray-800 block">2. Company Director Executive Sign-off:</span>
                    <div className="border-b border-gray-900 pb-1 mt-1 font-bold text-black">
                      {isDirectorApproved
                        ? (activeWo.director_approved_by || sowData.director_approved_by || `${user?.name || 'Company Director'} (Director)`)
                        : '⏳ Awaiting Executive Director Sign-Off'}
                    </div>
                    <div className="text-gray-500 mt-1">For {safeString(sowData.company_name || activeTenantName, 'Company Board')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Feedback Modal */}
      {showRevisionModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowRevisionModal(false)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Request Commercial Revision</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Enter notes specifying the terms or rates the talent vendor must adjust.
            </p>
            <textarea
              rows={4}
              required
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g. Please adjust the base billing rate to ₹1800/hr before final executive approval."
              className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black"
            />
            <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendRevision}
                disabled={!revisionNotes.trim() || actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Send Revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Reject Work Order?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              Enter the reason for rejecting this Work Order deployment.
            </p>
            <textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black"
            />
            <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
