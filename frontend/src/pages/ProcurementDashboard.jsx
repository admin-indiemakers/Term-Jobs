import React, { useState, useEffect, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Check,
  X,
  Eye,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  Download,
  Receipt,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  Loader2,
  FileText,
  Briefcase,
  Users,
  ChevronDown,
  ArrowRight,
  CheckSquare,
  Crown
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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

function formatCurrency(val) {
  if (typeof val === 'object') return '₹0';
  const n = Number(val || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ProcurementDashboard() {
  const { user, token } = useAuth();
  const [sowList, setSowList] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cross-Check & Customization State (for the active SOW)
  const [editForm, setEditForm] = useState({
    charge_rate_buyer: 1450,
    rate_to_worker: 1015,
    start_date: '2026-09-15',
    months: 6,
    billing_cycle: 'Monthly',
    payment_terms: 30,
    overtime_15x: true,
    expenses_reimbursable: false,
    extension_permitted: true,
    bgv_warranty: true,
  });

  // Action / Modal states
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const loadSows = () => {
    setLoading(true);
    request('/api/workforce/procurement/sow-agreements', { token })
      .then((data) => {
        const list = Array.isArray(data?.sow_agreements) ? data.sow_agreements : [];
        setSowList(list);
        if (list.length > 0) {
          const pending = list.find((s) => (s?.status || '').toLowerCase().includes('sent') || !(s?.status || '').toLowerCase().includes('reject'));
          const target = pending || list[0];
          if (!selectedCandidateId || !list.some(s => (s?.candidate_id || s?._id) === selectedCandidateId)) {
            setSelectedCandidateId(target?.candidate_id || target?._id);
          }
        }
        setError('');
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load SOW agreements.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSows();
  }, [token]);

  // Active Selected SOW
  const activeSow = useMemo(() => {
    if (!sowList.length) return null;
    return sowList.find((s) => (s?.candidate_id || s?._id) === selectedCandidateId) || sowList[0];
  }, [sowList, selectedCandidateId]);

  // Sync editForm when active SOW changes
  useEffect(() => {
    if (!activeSow) return;
    const data = activeSow?.sow_data || {};
    const rawBuyer = data.charge_rate_buyer || data.raw_charge_rate || (typeof data.charge_rate === 'string' || typeof data.charge_rate === 'number' ? String(data.charge_rate).replace(/[^\d.]/g, '') : '') || 828;
    const buyerRate = parseFloat(rawBuyer) || 828;
    const workerRate = parseFloat(data.rate_to_worker || Math.round(buyerRate * 0.7186)) || 595;
    const cycleStr = typeof data.billing_cycle === 'string' && data.billing_cycle ? data.billing_cycle : 'Monthly';
    const startDateStr = typeof data.commencement === 'string' && data.commencement ? data.commencement : typeof data.start_date === 'string' && data.start_date ? data.start_date : '2026-09-01';

    setEditForm({
      charge_rate_buyer: buyerRate,
      rate_to_worker: workerRate,
      start_date: startDateStr,
      months: parseInt(data.duration_months || data.months || 6, 10) || 6,
      billing_cycle: cycleStr,
      payment_terms: parseInt(data.payment_terms || 30, 10) || 30,
      overtime_15x: data.overtime_15x !== false,
      expenses_reimbursable: data.expenses_reimbursable === true,
      extension_permitted: data.extension_permitted !== false,
      bgv_warranty: data.bgv_warranty !== false,
    });
  }, [activeSow]);

  // Live Computed Commercials
  const supplierMargin = useMemo(() => {
    const buyer = Number(editForm.charge_rate_buyer) || 0;
    const worker = Number(editForm.rate_to_worker) || 0;
    if (buyer <= 0) return '0.0%';
    const margin = ((buyer - worker) / buyer) * 100;
    return `${margin.toFixed(1)}%`;
  }, [editForm.charge_rate_buyer, editForm.rate_to_worker]);

  const projectedSpend = useMemo(() => {
    const data = activeSow?.sow_data || {};
    if (data.grand_total && Number(data.grand_total) > 0) {
      return Number(data.grand_total);
    }
    const buyer = Number(editForm.charge_rate_buyer) || 850;
    const total = buyer * 173;
    return total;
  }, [activeSow, editForm.charge_rate_buyer]);

  const expiryDate = useMemo(() => {
    try {
      const d = new Date(editForm.start_date || '2026-09-15');
      if (isNaN(d.getTime())) return '2027-03-15';
      d.setMonth(d.getMonth() + (Number(editForm.months) || 6));
      return d.toISOString().split('T')[0];
    } catch {
      return '2027-03-15';
    }
  }, [editForm.start_date, editForm.months]);

  // Handlers
  const handleApprove = async () => {
    if (!activeSow) return;
    const candidateId = activeSow.candidate_id || activeSow.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      await request(`/api/workforce/procurement/sow/${candidateId}/approve`, {
        method: 'POST',
        token,
      });
      setSuccess(`✨ Work Order authorized by Procurement & forwarded to Company Director for final approval for ${safeString(activeSow.sow_data?.deployed_personnel, 'candidate')}!`);
      loadSows();
    } catch (err) {
      setError(err.message || 'Failed to approve Work Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectorApprove = async () => {
    if (!activeSow) return;
    const candidateId = activeSow.candidate_id || activeSow.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      await request(`/api/workforce/procurement/sow/${candidateId}/director-approve`, {
        method: 'POST',
        token,
      });
      setSuccess(`👑 Work Order formally signed & approved by Company Director for ${safeString(activeSow.sow_data?.deployed_personnel, 'candidate')}!`);
      loadSows();
    } catch (err) {
      setError(err.message || 'Failed to approve as Director.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendRevision = async () => {
    if (!activeSow || !revisionNotes.trim()) return;
    const candidateId = activeSow.candidate_id || activeSow.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      await request(`/api/workforce/procurement/sow/${candidateId}/request-revision`, {
        method: 'POST',
        token,
        body: { revision_notes: revisionNotes.trim() },
      });
      setSuccess('Revision notes sent back to Recruiter.');
      setShowRevisionModal(false);
      setRevisionNotes('');
      loadSows();
    } catch (err) {
      setError(err.message || 'Failed to request revision.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeSow) return;
    const candidateId = activeSow.candidate_id || activeSow.workorder_id;
    setActionLoading(true);
    setError('');
    try {
      await request(`/api/workforce/procurement/sow/${candidateId}/reject`, {
        method: 'POST',
        token,
        body: { rejection_notes: rejectNotes.trim() || 'Commercial terms rejected by Procurement.' },
      });
      setSuccess('Work Order rejected.');
      setShowRejectModal(false);
      setRejectNotes('');
      loadSows();
    } catch (err) {
      setError(err.message || 'Failed to reject Work Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!activeSow) return;
    const data = activeSow.sow_data || {};
    const text = `================================================================================
WORK STATEMENT & ENGAGEMENT SCHEDULE
${safeString(data.ws_number, 'WSOW-2026-0412')} · issued under ${safeString(data.msa_ref, 'MSA-TB-2024-11')} · ${safeString(data.company_name || user?.tenant_name, 'Bearitt')}
================================================================================

This Work Order is issued by ${safeString(data.company_name || user?.tenant_name, 'Bearitt')} ("Company") to ${safeString(data.supplier_name, 'TalentBridge Staffing Pvt Ltd')} ("Supplier") and governs the deployment of one contract personnel resource under the Master Services Agreement referenced above.

1. PERSONNEL AND ROLE
--------------------------------------------------------------------------------
Deployed personnel : ${safeString(data.deployed_personnel, 'Sandeep Rao')}
Role               : ${safeString(data.role, 'DevOps engineer')}
Reporting to       : ${safeString(data.reporting_to, 'Arun Deshpande, Engineering')}
Place of work      : ${safeString(data.place_of_work, 'Gurgaon')}

2. TERM
--------------------------------------------------------------------------------
Commencement       : ${safeString(editForm.start_date, '2026-09-01')}
Expiry             : ${expiryDate}
Duration           : ${editForm.months} months
${editForm.extension_permitted ? 'Extension          : Permitted by written amendment only.' : ''}

3. CHARGES AND BILLING
--------------------------------------------------------------------------------
Billing basis      : Hourly, against approved timesheets
Charge rate        : ₹${editForm.charge_rate_buyer} per hour
Supplier Margin    : ${supplierMargin} (Worker Rate: ₹${editForm.rate_to_worker}/hr)
Billing Cycle      : ${safeString(editForm.billing_cycle, 'Monthly')} (Payment Terms: ${editForm.payment_terms} days)
Standard work day  : 8 hours
Overtime           : ${editForm.overtime_15x ? 'Chargeable at 1.5x hourly rate' : 'Standard hourly rate'}
Expenses           : ${editForm.expenses_reimbursable ? 'Reimbursable against verified receipts' : 'Non-reimbursable'}
30-Day Billing Spend: ${formatCurrency(projectedSpend)}

APPROVAL WORKFLOW
--------------------------------------------------------------------------------
1. Procurement Authorization: ${safeString(activeSow?.procurement_approved_by || activeSow?.approved_by || `${user?.name || 'ADITI'} (Procurement)`)}
2. Company Director Approval : ${safeString(activeSow?.director_approved_by || (isDirectorApproved ? 'Approved by Director' : 'Pending Director Approval'))}
Timestamp: ${new Date().toISOString()}
================================================================================`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeString(data.ws_number, 'WSOW-2026')}_${safeString(data.deployed_personnel, 'Worker').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sowData = activeSow?.sow_data || {};
  const rawStatus = (activeSow?.status || sowData?.status || '').trim();
  const isDirectorApproved = rawStatus === 'Approved by Director' || rawStatus === 'Approved' || rawStatus === 'ACTIVE';
  const isPendingDirector = !isDirectorApproved && (rawStatus === 'Pending Director Approval' || rawStatus.toLowerCase().includes('approved by procurement') || activeSow?.procurement_authorized === true);
  const isRevision = rawStatus.toLowerCase().includes('revision');
  const isRejected = rawStatus.toLowerCase().includes('reject');

  if (loading && sowList.length === 0) {
    return (
      <div className="w-full min-w-0 p-12 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 size={28} className="animate-spin text-black" />
        <p className="text-xs font-semibold text-gray-500">Loading Work Orders for Procurement...</p>
      </div>
    );
  }

  if (!loading && (!activeSow || sowList.length === 0)) {
    return (
      <div className="w-full min-w-0 pb-16 space-y-4 text-left font-sans">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-10 text-center shadow-xs space-y-3">
          <FileText size={40} className="mx-auto text-gray-400" />
          <h3 className="text-base font-extrabold text-gray-900">No Work Orders in Inbox</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            There are currently no Work Order billing documents submitted for verification.
          </p>
          <button
            type="button"
            onClick={loadSows}
            className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-xs hover:bg-gray-900 cursor-pointer"
          >
            Refresh Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top 6-Step Workflow Stage Bar */}
      <div className="bg-[#1C1D21] text-white rounded-2xl p-3.5 sm:px-6 shadow-sm flex items-center justify-between overflow-x-auto text-xs font-medium">
        <div className="flex items-center gap-6 sm:gap-10 shrink-0">
          {/* Step 1: Procurement Verification */}
          <div className="flex items-center gap-2 text-white">
            <span className={`w-5 h-5 rounded-full ${isPendingDirector || isDirectorApproved ? 'bg-emerald-600' : 'bg-blue-600'} text-white font-extrabold text-[11px] flex items-center justify-center`}>
              01
            </span>
            <div className="leading-tight">
              <div className="font-bold">Generate contract</div>
              <div className="text-[10px] text-gray-400">{String(user?.name || 'Aditi').split(' ')[0]} (Procurement)</div>
            </div>
          </div>

          {/* Step 2: Director Approval */}
          <div className={`flex items-center gap-2 ${isDirectorApproved ? 'text-white' : isPendingDirector ? 'text-amber-300' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full ${isDirectorApproved ? 'bg-emerald-600 text-white' : isPendingDirector ? 'bg-amber-500 text-black animate-pulse' : 'bg-gray-800 text-gray-300'} font-bold text-[11px] flex items-center justify-center`}>
              02
            </span>
            <div className="leading-tight">
              <div className="font-bold">Director approval</div>
              <div className="text-[10px] text-gray-400">Executive Sign-off</div>
            </div>
          </div>

          {/* Step 3: Countersign */}
          <div className="flex items-center gap-2 text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 font-bold text-[11px] flex items-center justify-center">
              03
            </span>
            <div className="leading-tight">
              <div className="font-medium text-gray-300">Countersign</div>
              <div className="text-[10px] text-gray-500">{String(sowData.supplier_name || 'Vendor').split(' ')[0]}</div>
            </div>
          </div>

          {/* Step 4: Log hours */}
          <div className="flex items-center gap-2 text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 font-bold text-[11px] flex items-center justify-center">
              04
            </span>
            <div className="leading-tight">
              <div className="font-medium text-gray-300">Log hours</div>
              <div className="text-[10px] text-gray-500">{String(sowData.deployed_personnel || 'Worker').split(' ')[0]}</div>
            </div>
          </div>

          {/* Step 5: Approve hours */}
          <div className="flex items-center gap-2 text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 font-bold text-[11px] flex items-center justify-center">
              05
            </span>
            <div className="leading-tight">
              <div className="font-medium text-gray-300">Approve hours</div>
              <div className="text-[10px] text-gray-500">Hiring Manager</div>
            </div>
          </div>

          {/* Step 6: Invoice & Pay */}
          <div className="flex items-center gap-2 text-gray-400">
            <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 font-bold text-[11px] flex items-center justify-center">
              06
            </span>
            <div className="leading-tight">
              <div className="font-medium text-gray-300">Invoice & Pay</div>
              <div className="text-[10px] text-gray-500">Finance / AP</div>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate / Work Order Selector Strip for Procurement Verification */}
      {sowList.length > 0 && (
        <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
              <FileCheck2 size={15} className="text-blue-600" />
              <span>Work Order Verification Inbox:</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {sowList.map((item) => {
                const isCurrent = (item.candidate_id || item._id) === selectedCandidateId;
                const d = item.sow_data || {};
                const st = (item.status || d.status || 'Sent to Procurement').trim();
                const itemIsDirectorApproved = st === 'Approved by Director' || st === 'Approved' || st === 'ACTIVE';
                const itemIsPendingDirector = !itemIsDirectorApproved && (st === 'Pending Director Approval' || st.toLowerCase().includes('approved by procurement'));
                const itemIsRejected = st.toLowerCase().includes('reject');
                const itemIsRevision = st.toLowerCase().includes('revision');

                return (
                  <button
                    key={item.candidate_id || item._id}
                    type="button"
                    onClick={() => setSelectedCandidateId(item.candidate_id || item._id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                      isCurrent
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span>{safeString(d.deployed_personnel || item.candidate_name, 'Worker')}</span>
                    <span
                      className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : itemIsDirectorApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : itemIsPendingDirector
                          ? 'bg-indigo-100 text-indigo-800'
                          : itemIsRejected
                          ? 'bg-red-100 text-red-800'
                          : itemIsRevision
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {itemIsDirectorApproved
                        ? '✓ Approved by Director'
                        : itemIsPendingDirector
                        ? '⏳ Pending Director'
                        : itemIsRejected
                        ? 'Rejected'
                        : itemIsRevision
                        ? 'Revision'
                        : 'Pending Verification'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={loadSows}
            className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Inbox</span>
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main 3-Column Layout: Left Rail (Who's Involved) + Center (Candidate Cross-Check Form) + Right (Paper SOW Document) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Rail: 2 Cols — Who's Involved & Handoff Log */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              WHO'S INVOLVED
            </div>

            <div className="space-y-2.5">
              {/* 1. Procurement */}
              <div className="flex items-center gap-2.5 p-1.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-7 h-7 rounded-full bg-blue-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {String(user?.name || 'AD').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-gray-900 truncate">{safeString(user?.name, 'Aditi')}</div>
                  <div className="text-[10px] text-gray-500">Procurement Lead</div>
                </div>
                <span className={`w-2 h-2 rounded-full ${isPendingDirector || isDirectorApproved ? 'bg-emerald-500' : 'bg-blue-600'} shrink-0`} />
              </div>

              {/* 2. Company Director */}
              <div className={`flex items-center gap-2.5 p-1.5 rounded-xl border transition-colors ${
                isDirectorApproved ? 'bg-emerald-50/70 border-emerald-200' : isPendingDirector ? 'bg-indigo-50/70 border-indigo-200' : 'border-transparent hover:bg-gray-50'
              }`}>
                <div className="w-7 h-7 rounded-full bg-indigo-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  CD
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-gray-900 truncate">
                    {activeSow?.director_approved_by || 'Company Director'}
                  </div>
                  <div className="text-[10px] text-gray-500">Executive Approval</div>
                </div>
                {isDirectorApproved ? (
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                ) : isPendingDirector ? (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                ) : null}
              </div>

              {/* 3. Vendor Recruiter */}
              <div className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {String(sowData.supplier_name || 'TB').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-gray-900 truncate">{safeString(activeSow?.recruiter_name, 'Vendor Recruiter')}</div>
                  <div className="text-[10px] text-gray-500 truncate">{safeString(sowData.supplier_name, 'TalentBridge')}</div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">EXT</span>
              </div>

              {/* 4. Candidate / Contract worker */}
              <div className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {String(sowData.deployed_personnel || 'WO').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-gray-900 truncate">{safeString(sowData.deployed_personnel, 'Sandeep Rao')}</div>
                  <div className="text-[10px] text-gray-500">Contract worker</div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">EXT</span>
              </div>

              {/* 5. Hiring manager */}
              <div className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {String(sowData.reporting_to || 'HM').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-gray-900 truncate">{safeString(sowData.reporting_to, 'Arun Deshpande')}</div>
                  <div className="text-[10px] text-gray-500">Hiring manager</div>
                </div>
              </div>

              {/* 6. Finance / AP */}
              <div className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  FA
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-gray-900 truncate">Finance / AP</div>
                  <div className="text-[10px] text-gray-500">Commercial Sign-Off</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              HANDOFF LOG
            </div>
            <div className="text-xs text-gray-500 leading-relaxed">
              {activeSow?.submitted_at ? (
                <div>
                  <div className="font-semibold text-gray-800">Work Order Submitted</div>
                  <div className="text-[10px] text-gray-400">{formatDate(activeSow.submitted_at)}</div>
                  {isPendingDirector && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-indigo-700 font-semibold">
                      ✓ Procurement Authorized · Routed to Director
                    </div>
                  )}
                  {isDirectorApproved && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-emerald-700 font-semibold">
                      ✓ Director Approved · Fully Activated
                    </div>
                  )}
                </div>
              ) : (
                'Nothing yet. Release Work Order from recruiter to start.'
              )}
            </div>
          </div>
        </div>

        {/* Center Column: 5 Cols — Candidate Details & Commercial Cross-Check Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Generate the work order</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-bold text-gray-800">{safeString(sowData.deployed_personnel, 'Candidate')}</span> is selected. This produces the Work Order that makes them billable.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold uppercase ${
                isDirectorApproved
                  ? 'bg-emerald-100 text-emerald-800'
                  : isPendingDirector
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : isRejected
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {isDirectorApproved
                  ? 'Approved by Director'
                  : isPendingDirector
                  ? 'Pending Director Approval'
                  : safeString(activeSow?.status, 'Draft')}
              </span>
            </div>

            {/* Commercials Card (Fixed from Work Order & Requisition) */}
            <div className="border border-gray-200/90 rounded-2xl p-4 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  COMMERCIALS
                </div>
                <span className="text-[10px] font-bold text-gray-400">Fixed from Work Order</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Charge rate to buyer (₹/hr)
                  </label>
                  <div className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-xl select-all flex items-center justify-between shadow-2xs">
                    <span>{editForm.charge_rate_buyer}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Rate to worker (₹/hr)
                  </label>
                  <div className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-xl select-all flex items-center justify-between shadow-2xs">
                    <span>{editForm.rate_to_worker}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Supplier margin</span>
                <span className="font-extrabold font-mono text-gray-900">{supplierMargin}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Billing cycle spend (30 days)</span>
                <span className="font-extrabold font-mono text-emerald-600">{formatCurrency(projectedSpend)}</span>
              </div>
            </div>

            {/* Term and Cycle Card (Fixed from Work Order & Requisition) */}
            <div className="border border-gray-200/90 rounded-2xl p-4 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  TERM AND CYCLE
                </div>
                <span className="text-[10px] font-bold text-gray-400">Fixed from Work Order</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Start</label>
                  <div className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-xl select-all flex items-center justify-between shadow-2xs">
                    <span>{formatDate(editForm.start_date)}</span>
                    <Calendar size={13} className="text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Months</label>
                  <div className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-xl select-all flex items-center justify-between shadow-2xs">
                    <span>{editForm.months}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Billing cycle</label>
                  <div className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-xl select-all flex items-center justify-between shadow-2xs">
                    <span>{safeString(editForm.billing_cycle, 'Monthly')}</span>
                    <ChevronDown size={13} className="text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Payment terms (days)</label>
                  <div className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-xl select-all flex items-center justify-between shadow-2xs">
                    <span>{editForm.payment_terms}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Clauses Toggles Card (Fixed Governing Policies) */}
            <div className="border border-gray-200/90 rounded-2xl p-4 bg-gray-50/50 space-y-2.5">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  CLAUSES
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">Fixed governing terms established in Work Order & Requisition.</p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 shadow-2xs">
                  <span className="text-xs font-bold text-gray-900">Overtime chargeable at 1.5×</span>
                  {editForm.overtime_15x ? (
                    <div className="w-4.5 h-4.5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                  ) : (
                    <div className="w-4.5 h-4.5 rounded border border-gray-300 bg-white shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 shadow-2xs">
                  <span className="text-xs font-bold text-gray-900">Expenses reimbursable</span>
                  {editForm.expenses_reimbursable ? (
                    <div className="w-4.5 h-4.5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                  ) : (
                    <div className="w-4.5 h-4.5 rounded border border-gray-300 bg-white shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 shadow-2xs">
                  <span className="text-xs font-bold text-gray-900">Extension permitted by amendment</span>
                  {editForm.extension_permitted ? (
                    <div className="w-4.5 h-4.5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                  ) : (
                    <div className="w-4.5 h-4.5 rounded border border-gray-300 bg-white shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 shadow-2xs">
                  <span className="text-xs font-bold text-gray-900">Background verification warranty</span>
                  {editForm.bgv_warranty ? (
                    <div className="w-4.5 h-4.5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                  ) : (
                    <div className="w-4.5 h-4.5 rounded border border-gray-300 bg-white shrink-0" />
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar with 2-Stage Approval Routing */}
            <div className="pt-2 flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Request Revision
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>

                {!isPendingDirector && !isDirectorApproved && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 size={13} className="animate-spin text-white" /> : <CheckCircle2 size={14} />}
                    <span>Authorize & Send to Director</span>
                  </button>
                )}

                {isPendingDirector && (
                  <div className="flex items-center gap-2">
                    <div className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center gap-1.5">
                      <Check size={13} className="text-indigo-600" />
                      <span>Procurement Authorized</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDirectorApprove}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Grant final executive approval as Company Director"
                    >
                      {actionLoading ? <Loader2 size={13} className="animate-spin text-white" /> : <Crown size={14} />}
                      <span>Director Sign-Off</span>
                    </button>
                  </div>
                )}

                {isDirectorApproved && (
                  <div className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>✓ Approved by Director</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 5 Cols — Formatted Paper SOW & Engagement Schedule Document */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-gray-300 rounded-2xl p-6 sm:p-8 shadow-md text-gray-900 space-y-6 text-left relative">
            {/* Header / Meta */}
            <div className="text-center space-y-1 pb-4 border-b border-gray-200">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-900">
                WORK ORDER & ENGAGEMENT SCHEDULE
              </h3>
              <p className="text-[10px] text-gray-500 font-mono">
                {safeString(sowData.ws_number, 'WSOW-2026-0412')} · issued under {safeString(sowData.msa_ref, 'MSA-TB-2024-11')} · {safeString(sowData.company_name || user?.tenant_name, 'Bearitt')}
              </p>
            </div>

            {/* Preamble */}
            <p className="text-xs text-gray-700 leading-relaxed">
              This Work Order is issued by <strong>{safeString(sowData.company_name || user?.tenant_name, 'Bearitt')}</strong> ("Company") to <strong>{safeString(sowData.supplier_name, 'TalentBridge Staffing Pvt Ltd')}</strong> ("Supplier") and governs the deployment of one contract personnel resource under the Master Services Agreement referenced above.
            </p>

            {/* Section 1: Personnel and Role */}
            <div className="space-y-2">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-blue-900">
                1. PERSONNEL AND ROLE
              </div>
              <div className="grid grid-cols-12 text-xs py-1">
                <span className="col-span-5 text-gray-500">Deployed personnel</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{safeString(sowData.deployed_personnel, 'ARJUN M')}</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Role</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{safeString(sowData.role, 'DevSecOps Engineer')}</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Reporting to</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{safeString(sowData.reporting_to, 'Arun Deshpande, Engineering')}</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Place of work</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{safeString(sowData.place_of_work, 'Remote')}</span>
              </div>
            </div>

            {/* Section 2: Term */}
            <div className="space-y-2">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-blue-900">
                2. TERM
              </div>
              <div className="grid grid-cols-12 text-xs py-1">
                <span className="col-span-5 text-gray-500">Commencement</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{safeString(editForm.start_date, '2026-09-01')}</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Expiry</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{expiryDate}</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Duration</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{editForm.months} months</span>
              </div>

              {editForm.extension_permitted && (
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-snug">
                  The Company may extend this engagement by written amendment. Extension is not automatic and does not arise by continued performance.
                </div>
              )}
            </div>

            {/* Section 3: Charges and Billing */}
            <div className="space-y-2">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-blue-900">
                3. CHARGES AND BILLING
              </div>
              <div className="grid grid-cols-12 text-xs py-1">
                <span className="col-span-5 text-gray-500">Billing basis</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">Hourly, against approved timesheets</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Charge rate to Company</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">₹{editForm.charge_rate_buyer} per hour</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Standard working day</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">8 hours</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Billing cycle</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">{safeString(editForm.billing_cycle, 'Monthly')} (Net {editForm.payment_terms} days)</span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Overtime clause</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">
                  {editForm.overtime_15x ? 'Chargeable at 1.5× hourly rate' : 'Standard hourly rate'}
                </span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Expenses clause</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">
                  {editForm.expenses_reimbursable ? 'Reimbursable against verified receipts' : 'Non-reimbursable'}
                </span>
              </div>
              <div className="grid grid-cols-12 text-xs py-1 border-t border-gray-100">
                <span className="col-span-5 text-gray-500">Background verification</span>
                <span className="col-span-7 font-bold text-gray-900 text-right">
                  {editForm.bgv_warranty ? 'Warranted & Cleared' : 'Standard'}
                </span>
              </div>

              <div className="grid grid-cols-12 text-sm pt-3 border-t-2 border-gray-200 font-extrabold">
                <span className="col-span-5 text-gray-900">30-Day Billing Spend</span>
                <span className="col-span-7 text-emerald-600 text-right font-mono">{formatCurrency(projectedSpend)}</span>
              </div>
            </div>

            {/* Document Signature Stamp */}
            <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-[11px] text-gray-500">
              <div>
                <span className="font-bold text-gray-800 block">1. Procurement Authorization:</span>
                <span className="text-gray-600">
                  {activeSow?.procurement_approved_by || activeSow?.sow_data?.procurement_approved_by || (isPendingDirector || isDirectorApproved ? `${user?.name || 'ADITI'} (Procurement Lead)` : 'Pending Verification')}
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-800 block">2. Director Approval:</span>
                <span className={isDirectorApproved ? 'font-bold text-emerald-700' : 'text-indigo-700 font-semibold'}>
                  {isDirectorApproved
                    ? (activeSow?.director_approved_by || activeSow?.sow_data?.director_approved_by || 'Company Director')
                    : (isPendingDirector ? '⏳ Pending Director Sign-Off' : 'Pending Step 1')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revision Modal */}
      {showRevisionModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowRevisionModal(false)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Request Revision from Recruiter</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Enter notes specifying which rates, clauses, or term parameters need adjustment.
            </p>
            <textarea
              rows={4}
              required
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g. Please adjust buyer rate to ₹1450 and confirm 30-day payment cycle."
              className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
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
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Reject Work Order?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              Please enter the reason for rejecting this work order.
            </p>
            <textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason for commercial rejection..."
              className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
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
