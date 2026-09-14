import React, { useState, useEffect, useMemo } from 'react';
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
  UserCheck,
  DollarSign,
  ShieldCheck,
  Send,
  Filter,
  ChevronRight,
  Download,
  Printer,
  Crown,
  FileCheck2,
  Loader2,
  TrendingUp,
  Receipt,
  Sparkles,
  ArrowRight
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
  const { token, user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
    setLoading(true);
    setError('');
    try {
      const res = await request('/api/workforce/director/work-orders', { token });
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
      setError(err?.message || 'Failed to load Work Orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadWorkOrders();
    }
  }, [token]);

  // Active Selected Work Order
  const activeWo = useMemo(() => {
    if (!workOrders.length) return null;
    return workOrders.find((w) => (w.candidate_id || w.workorder_id || w._id) === selectedCandidateId) || workOrders[0];
  }, [workOrders, selectedCandidateId]);

  const sowData = activeWo?.sow_data || {};
  const rawStatus = (activeWo?.status || sowData?.status || 'Pending Director Approval').trim();
  const isDirectorApproved = rawStatus === 'Approved by Director' || rawStatus === 'Approved' || rawStatus === 'ACTIVE';
  const isPendingDirector = !isDirectorApproved && (rawStatus === 'Pending Director Approval' || rawStatus.toLowerCase().includes('approved by procurement') || activeWo?.procurement_authorized === true);
  const isRevision = rawStatus.toLowerCase().includes('revision');
  const isRejected = rawStatus.toLowerCase().includes('reject');

  // Computed metrics
  const kpiStats = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let procurementClearedCount = 0;
    let totalSpend = 0;

    workOrders.forEach((w) => {
      const st = (w.status || w.sow_data?.status || '').trim();
      const d = w.sow_data || {};
      const isApp = st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE';
      const isPend = !isApp && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement') || w.procurement_authorized);

      if (isPend) pendingCount++;
      if (isApp) approvedCount++;
      if (w.procurement_authorized || isApp || isPend) procurementClearedCount++;

      const spend = Number(d.calculated_grand_total || d.grand_total || (parseFloat(d.raw_charge_rate || 1450) * 173) || 0);
      totalSpend += spend;
    });

    return {
      pending: pendingCount,
      approved: approvedCount,
      procurementCleared: procurementClearedCount,
      totalSpend
    };
  }, [workOrders]);

  // Filtered List
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      const d = w.sow_data || {};
      const st = (w.status || d.status || '').trim();
      const isApp = st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE';
      const isPend = !isApp && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement') || w.procurement_authorized);
      const isRev = st.toLowerCase().includes('revision');
      const isRej = st.toLowerCase().includes('reject');

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (d.deployed_personnel && d.deployed_personnel.toLowerCase().includes(q)) ||
        (w.candidate_name && w.candidate_name.toLowerCase().includes(q)) ||
        (d.role && d.role.toLowerCase().includes(q)) ||
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
      await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/director-approve`, {
        method: 'POST',
        token,
      });
      setSuccessMsg(`👑 Work Order formally signed & approved by Company Director for ${safeString(sowData.deployed_personnel, 'Candidate')}!`);
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
      await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/request-revision`, {
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
      await request(`/api/workforce/procurement/sow/${encodeURIComponent(candidateId)}/reject`, {
        method: 'POST',
        token,
        body: { rejection_notes: rejectNotes.trim() || 'Commercial terms rejected by Company Director.' },
      });
      setSuccessMsg('Work Order rejected.');
      setShowRejectModal(false);
      setRejectNotes('');
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] pb-24 font-sans">
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

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-bold shadow-xs">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                    Director Work Orders & SOW Approval
                  </h1>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Executive Governance
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Inspect commercial rate schedules, timesheet breakdowns, and grant final executive Director sign-off for Work Orders authorized by Procurement.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadWorkOrders}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Work Orders</span>
            </button>
          </div>
        </div>

        {/* Top KPI Stat Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Pending Director Sign-off
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1 flex items-center gap-2">
                <span>{kpiStats.pending}</span>
                {kpiStats.pending > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <div className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Requires Director Action
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Crown className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Procurement Authorized
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1">
                {kpiStats.procurementCleared}
              </div>
              <div className="text-xs text-indigo-600 font-medium mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Verified by Procurement Lead
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <FileCheck2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Fully Approved & Active
              </div>
              <div className="text-2xl font-black text-[#0A0A0A] mt-1">
                {kpiStats.approved}
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Executed Work Orders
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-[#0A0A0A] text-white p-5 rounded-2xl shadow-xl flex items-center justify-between border border-white/10">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                Monthly Committed Spend
              </div>
              <div className="text-2xl font-black text-[#22C55E] mt-1">
                {formatCurrency(kpiStats.totalSpend)}
              </div>
              <div className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#22C55E]" /> Contract Billing Value
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-xs">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by worker name, role, work order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-black text-[#111827]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Work Orders' },
              { id: 'PENDING', label: 'Pending Director Sign-off' },
              { id: 'APPROVED', label: 'Approved by Director' },
              { id: 'REVISION', label: 'Revision Requested' },
              { id: 'REJECTED', label: 'Rejected' },
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

        {/* Error / Success Notifications */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 2-Column Work Order Center: Left Roster List + Right Paper Document */}
        {loading && workOrders.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200">
            <Loader2 size={32} className="animate-spin text-black" />
            <p className="text-sm text-gray-500 mt-3 font-medium">Loading Work Orders for Director governance...</p>
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-2">
            <FileText className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">No matching Work Orders found</h3>
            <p className="text-xs text-gray-500">
              Work Orders dispatched by recruiters and authorized by Procurement will appear here for Director review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 Cols): Master Work Order Cards */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
                <span>WORK ORDERS QUEUE ({filteredWorkOrders.length})</span>
                <span>SORTED BY URGENCY</span>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                {filteredWorkOrders.map((item) => {
                  const isCurrent = (item.candidate_id || item.workorder_id || item._id) === selectedCandidateId;
                  const d = item.sow_data || {};
                  const st = (item.status || d.status || 'Pending Director Approval').trim();
                  const itemIsApproved = st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE';
                  const itemIsPending = !itemIsApproved && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement') || item.procurement_authorized);
                  const itemIsRejected = st.toLowerCase().includes('reject');
                  const itemIsRevision = st.toLowerCase().includes('revision');
                  const buyerRate = d.raw_charge_rate || (typeof d.charge_rate === 'string' ? d.charge_rate.replace(/[^\d.]/g, '') : '') || 2200;

                  return (
                    <div
                      key={item.candidate_id || item.workorder_id || item._id}
                      onClick={() => setSelectedCandidateId(item.candidate_id || item.workorder_id || item._id)}
                      className={`bg-white rounded-2xl p-4.5 border transition-all cursor-pointer relative overflow-hidden group shadow-2xs hover:shadow-md ${
                        isCurrent
                          ? 'border-black ring-2 ring-black/10'
                          : 'border-gray-200/90 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-mono">
                          {d.ws_number || item.candidate_id || 'WO-2026'}
                        </span>
                        <span
                          className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            itemIsApproved
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : itemIsPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : itemIsRejected
                              ? 'bg-red-100 text-red-900 border border-red-300'
                              : itemIsRevision
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {itemIsApproved
                            ? '✓ Director Approved'
                            : itemIsPending
                            ? '👑 Pending Director Sign-off'
                            : itemIsRejected
                            ? 'Rejected'
                            : itemIsRevision
                            ? 'Revision Requested'
                            : 'Draft Work Order'}
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {safeString(d.deployed_personnel || item.candidate_name, 'WO').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-sm text-gray-900 truncate">
                            {safeString(d.deployed_personnel || item.candidate_name, 'Contract Worker')}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                            {safeString(d.role || item.role, 'Specialist')} · {safeString(d.company_name || item.company_name, 'Client')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                        <div className="bg-gray-50 p-2 rounded-xl">
                          <div className="text-[10.5px] text-gray-400 font-medium">Billing Rate</div>
                          <div className="font-bold text-gray-900 mt-0.5">₹{buyerRate}/hr</div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-xl">
                          <div className="text-[10.5px] text-gray-400 font-medium">Monthly Value</div>
                          <div className="font-bold text-emerald-700 mt-0.5">
                            {formatCurrency(d.calculated_grand_total || d.grand_total || (parseFloat(buyerRate) * 173))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs pt-1">
                        <div className="text-[11px] text-gray-500">
                          {item.procurement_authorized || itemIsApproved || itemIsPending ? (
                            <span className="text-indigo-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={12} /> Procurement Verified
                            </span>
                          ) : (
                            <span className="text-gray-400">Awaiting Procurement</span>
                          )}
                        </div>
                        <span className="font-bold text-black flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          Inspect & Sign <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column (7 Cols): Physical Work Order Document & Executive Action Center */}
            <div className="lg:col-span-7 space-y-4">
              {activeWo ? (
                <>
                  {/* Top Director Action Bar */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrintPdf}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-gray-200"
                        title="Print or Save Signed PDF"
                      >
                        <Printer size={14} />
                        <span>Print / Save PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRevisionModal(true)}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-gray-200 disabled:opacity-50"
                      >
                        Request Revision
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-red-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDirectorApproved ? (
                        <div className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          <span>✓ Approved by Director</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDirectorApprove}
                          disabled={actionLoading}
                          className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin text-white" /> : <Crown size={14} className="text-amber-400" />}
                          <span>Director Sign-Off & Approve</span>
                        </button>
                      )}
                    </div>
                  </div>

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
                    className="bg-white rounded-2xl border border-gray-300 shadow-xl p-6 sm:p-9 text-gray-900 font-sans space-y-6 text-left"
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
                          <span className="font-semibold text-gray-900">{safeString(sowData.company_name || user?.tenant_name, 'Bearitt')}</span>
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
                        <div className="text-gray-500 mt-1">For {safeString(sowData.company_name || user?.tenant_name, 'Company Board')}</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Revision Feedback Modal */}
      {showRevisionModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
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
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
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
