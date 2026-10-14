import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Users,
  CheckCircle2,
  Save,
  Eye,
  Edit3,
  Download,
  Send,
  Clock,
  Receipt,
  FileText,
  Calendar,
  Building,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  SlidersHorizontal,
  Check,
  Zap,
  AlertCircle
} from 'lucide-react';
import WorkOrderProgressBar from '../../components/WorkOrderProgressBar';

export default function Workers() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryWorker = searchParams.get('worker') || '';

  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [viewMode, setViewMode] = useState('roster'); // 'roster' | 'detail'
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Roster Search & Filter state (designed for 100+ contractors)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Draft' | 'Sent to Procurement' | 'Has Overtime'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Tabs & SOW document state
  const [activeTab, setActiveTab] = useState('sow'); // 'sow' | 'timesheets' | 'expenses' | 'contract'
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Real DB timesheets for the selected candidate
  const [dbTimesheets, setDbTimesheets] = useState([]);
  const [loadingTimesheets, setLoadingTimesheets] = useState(false);

  // Billing Cycle selection
  const [billingCycle, setBillingCycle] = useState('Monthly');
  const [cyclePeriod, setCyclePeriod] = useState('Current Period (Sep 2026)');

  // Form / SOW state initialized from MongoDB
  const [sowData, setSowData] = useState({
    ws_number: '',
    msa_ref: '',
    company_name: '',
    supplier_name: '',
    supplier_suffix: '',
    deployed_personnel: '',
    role: '',
    reporting_to: '',
    place_of_work: '',
    commencement: '',
    expiry: '',
    duration: '',
    notice: '',
    billing_basis: 'Hourly, against approved timesheets',
    charge_rate: '₹0 per hour',
    raw_charge_rate: 0,
    overtime_multiplier: '1.5x base hourly rate',
    standard_work_day: '8 hours',
    billing_cycle: 'Monthly',
    payment_terms: '',
    supplier_margin: '',
    regular_hours: 0,
    overtime_hours: 0,
    base_cost: 0,
    overtime_cost: 0,
    expense_items: [],
    total_expenses: 0,
    grand_total: 0,
    signatory_supplier: 'Authorised Signatory',
    signatory_company: 'Procurement / Director',
    status: 'Draft',
    submitted_at: null,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch Workers list from MongoDB
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    request('/api/workforce/workers', { token })
      .then((data) => {
        if (isMounted && data?.workers) {
          setWorkers(data.workers);
          if (queryWorker) {
            setSelectedWorkerId(queryWorker);
            setViewMode('detail');
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [token, queryWorker]);

  // Filtered Roster for 100+ contractors search
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const q = searchQuery.toLowerCase().strip ? searchQuery.toLowerCase().strip() : searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        w.candidate_name?.toLowerCase().includes(q) ||
        w.role?.toLowerCase().includes(q) ||
        w.company_name?.toLowerCase().includes(q) ||
        w.ws_number?.toLowerCase().includes(q) ||
        w.candidate_email?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'Draft') return w.sow_status === 'Draft';
      if (statusFilter === 'Sent to Procurement') return w.sow_status === 'Sent to Procurement';
      if (statusFilter === 'Has Overtime') return (w.overtime_hours || 0) > 0;
      return true;
    });
  }, [workers, searchQuery, statusFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredWorkers.slice(start, start + itemsPerPage);
  }, [filteredWorkers, currentPage]);

  // Index of currently selected worker in filtered list for Prev/Next navigation
  const selectedIndex = useMemo(() => {
    return filteredWorkers.findIndex((w) => w.candidate_id === selectedWorkerId);
  }, [filteredWorkers, selectedWorkerId]);

  const selectedWorker = useMemo(() => {
    return workers.find((w) => w.candidate_id === selectedWorkerId) || workers[0] || null;
  }, [workers, selectedWorkerId]);

  // Aggregate stats across all 100+ contractors
  const rosterStats = useMemo(() => {
    const totalCount = workers.length;
    const totalSpend = workers.reduce((sum, w) => sum + (w.total_billing_amount || 0), 0);
    const totalHours = workers.reduce((sum, w) => sum + (w.total_approved_hours || 0), 0);
    const pendingProcurement = workers.filter((w) => w.sow_status === 'Sent to Procurement').length;
    const draftCount = workers.filter((w) => w.sow_status === 'Draft' || !w.sow_status).length;
    return { totalCount, totalSpend, totalHours, pendingProcurement, draftCount };
  }, [workers]);

  // Load SOW data when selected worker or billing cycle changes
  useEffect(() => {
    if (!selectedWorkerId) return;

    request(`/api/workforce/workers/${selectedWorkerId}/sow?billing_cycle=${encodeURIComponent(billingCycle)}&cycle_period=${encodeURIComponent(cyclePeriod)}`, { token })
      .then((data) => {
        if (data?.sow_data) {
          setSowData((prev) => ({
            ...prev,
            ...data.sow_data,
            billing_cycle: billingCycle,
            cycle_period: cyclePeriod,
          }));
        }
      })
      .catch(() => {});
  }, [selectedWorkerId, billingCycle, cyclePeriod, token]);

  // Fetch real timesheets for selected candidate
  useEffect(() => {
    if (!selectedWorkerId) return;
    setLoadingTimesheets(true);
    request('/api/workforce/timesheets', { token })
      .then((data) => {
        const list = (data?.timesheets || []).filter(
          (t) => t.candidate_id === selectedWorkerId || t.workorder_id === selectedWorkerId
        );
        setDbTimesheets(list);
      })
      .catch(() => setDbTimesheets([]))
      .finally(() => setLoadingTimesheets(false));
  }, [selectedWorkerId, token]);

  // Dynamic calculations for edit mode
  const calculatedBaseCost = useMemo(() => {
    const rate = parseFloat(sowData.raw_charge_rate || 0);
    const hrs = parseFloat(sowData.regular_hours || 0);
    return rate * hrs;
  }, [sowData.raw_charge_rate, sowData.regular_hours]);

  const calculatedOtCost = useMemo(() => {
    const rate = parseFloat(sowData.raw_charge_rate || 0);
    const otHrs = parseFloat(sowData.overtime_hours || 0);
    return otHrs * (rate * 1.5);
  }, [sowData.raw_charge_rate, sowData.overtime_hours]);

  const calculatedTotalExpenses = useMemo(() => {
    if (!Array.isArray(sowData.expense_items)) return 0;
    return sowData.expense_items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }, [sowData.expense_items]);

  const calculatedGrandTotal = useMemo(() => {
    return calculatedBaseCost + calculatedOtCost + calculatedTotalExpenses;
  }, [calculatedBaseCost, calculatedOtCost, calculatedTotalExpenses]);

  const handleFieldChange = (field, value) => {
    setSowData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenDetail = (workerId) => {
    setSelectedWorkerId(workerId);
    setViewMode('detail');
  };

  const handleNavigateWorker = (direction) => {
    if (selectedIndex < 0) return;
    const newIdx = direction === 'next' ? selectedIndex + 1 : selectedIndex - 1;
    if (newIdx >= 0 && newIdx < filteredWorkers.length) {
      setSelectedWorkerId(filteredWorkers[newIdx].candidate_id);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...sowData,
        base_cost: calculatedBaseCost,
        overtime_cost: calculatedOtCost,
        total_expenses: calculatedTotalExpenses,
        grand_total: calculatedGrandTotal,
        billing_cycle: billingCycle,
      };

      await request(`/api/workforce/workers/${selectedWorkerId}/sow/save-draft`, {
        method: 'POST',
        token,
        body: { sow_data: payload }
      });
      showToast('✨ Work Order Billing sheet draft saved.');
    } catch {
      showToast('⚠️ Failed to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToProcurement = async () => {
    setIsSending(true);
    try {
      const payload = {
        ...sowData,
        base_cost: calculatedBaseCost,
        overtime_cost: calculatedOtCost,
        total_expenses: calculatedTotalExpenses,
        grand_total: calculatedGrandTotal,
        billing_cycle: billingCycle,
        status: 'Sent to Procurement'
      };

      const res = await request(`/api/workforce/workers/${selectedWorkerId}/sow/send-to-procurement`, {
        method: 'POST',
        token,
        body: { sow_data: payload }
      });

      setSowData((prev) => ({ ...prev, status: 'Sent to Procurement' }));
      setWorkers((prev) =>
        prev.map((w) => (w.candidate_id === selectedWorkerId ? { ...w, sow_status: 'Sent to Procurement' } : w))
      );
      showToast(`🚀 ${res.message || 'Work Order Billing Sheet sent to Procurement successfully!'}`);
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Failed to send to Procurement.'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadTxt = () => {
    const text = `================================================================================
WORK ORDER & BILLING SHEET (ENTERPRISE DIRECTORY RECORD)
Work Statement No: ${sowData.ws_number} · MSA Ref: ${sowData.msa_ref}
Client: ${sowData.company_name} | Vendor: ${sowData.supplier_name}
================================================================================

1. PERSONNEL & ROLE DETAILS
--------------------------------------------------------------------------------
Deployed Personnel : ${sowData.deployed_personnel}
Role               : ${sowData.role}
Reporting Manager  : ${sowData.reporting_to}
Place of Work      : ${sowData.place_of_work}
Commencement Date  : ${sowData.commencement}
Expiry Date        : ${sowData.expiry}
Engagement Duration: ${sowData.duration}

2. CONTRACT & BILLING TERMS
--------------------------------------------------------------------------------
Billing Rate       : ${sowData.charge_rate}
Billing Cycle      : ${billingCycle} (${cyclePeriod})
Standard Work Day  : ${sowData.standard_work_day}
Overtime Rule      : Hours > 40 per week @ 1.5x rate
Payment Terms      : ${sowData.payment_terms}
Supplier Margin    : ${sowData.supplier_margin}

3. APPROVED TIMESHEETS & OVERTIME BREAKDOWN
--------------------------------------------------------------------------------
Regular Hours Approved  : ${sowData.regular_hours} hrs @ ₹${sowData.raw_charge_rate}/hr = ₹${calculatedBaseCost.toLocaleString()}
Overtime Hours Approved : ${sowData.overtime_hours} hrs @ 1.5x (₹${sowData.raw_charge_rate * 1.5}/hr) = ₹${calculatedOtCost.toLocaleString()}
Base & Overtime Subtotal: ₹${(calculatedBaseCost + calculatedOtCost).toLocaleString()}

4. APPROVED HIRING MANAGER ADDITIONAL EXPENSES
--------------------------------------------------------------------------------
${sowData.expense_items.length > 0 ? sowData.expense_items.map((item, idx) => `${idx + 1}. [${item.category}] ${item.description} - Approved on ${item.approved_at}: ₹${parseFloat(item.amount).toLocaleString()}`).join('\n') : 'No additional approved expenses for this cycle.'}
Approved Expenses Total : ₹${calculatedTotalExpenses.toLocaleString()}

================================================================================
TOTAL INVOICE BILLING AMOUNT: ₹${calculatedGrandTotal.toLocaleString()}
================================================================================

Status: ${sowData.status}
Generated via Term Jobs Recruiter Vendor Portal
`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sowData.ws_number || 'WO'}_Billing_Sheet.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded Work Order Billing Sheet text document.`);
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-y-auto pb-4 font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 animate-fade-in text-[13px] font-medium backdrop-blur-xl">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • WORKFORCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Workers Roster & Work Orders
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Manage contract workforce, filter billing cycles, generate Work Order packages, and submit to Procurement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setViewMode(viewMode === 'roster' ? 'detail' : 'roster')}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {viewMode === 'roster' ? <FileText size={13} /> : <Users size={13} />}
            <span>{viewMode === 'roster' ? 'Work Order Billing View' : 'Master Workers Roster'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. FLEET SUMMARY GLASSMORHPIC METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Deployed Fleet</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{rosterStats.totalCount}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Active placements</div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Active Spend</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
            ₹{rosterStats.totalSpend > 0 ? rosterStats.totalSpend.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Approved hours & expenses</div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Approved Hours</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{rosterStats.totalHours} hrs</div>
          <div className="text-[11px] text-emerald-700 mt-1 font-semibold">Base & 1.5x Overtime</div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pending Procurement</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{rosterStats.pendingProcurement}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Sent to procurement</div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] col-span-2 lg:col-span-1 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Draft Work Orders</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{rosterStats.draftCount}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Ready for review & send</div>
        </div>
      </div>

      {/* VIEW MODE 1: MASTER WORKERS ROSTER TABLE */}
      {viewMode === 'roster' && (
        <div className="space-y-3">
          {/* ── 3. MAIN GLASSMORHPIC TABLE CONTAINER ── */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
            {/* Roster Controls: Search + Filter Pills */}
            <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-black/[0.04]">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contractors by name, role, client, or WO #..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all font-medium"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'All Contractors' },
                  { id: 'Draft', label: 'Draft' },
                  { id: 'Sent to Procurement', label: 'In Procurement' },
                  { id: 'Has Overtime', label: 'Overtime' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setStatusFilter(f.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition shadow-3xs cursor-pointer ${
                      statusFilter === f.id
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 backdrop-blur-md'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Master Roster Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-black/[0.04] text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">
                    <th className="py-3 pl-3 pr-3">Personnel & Role</th>
                    <th className="py-3 px-3">Client Company</th>
                    <th className="py-3 px-3">Billing Rate / Cycle</th>
                    <th className="py-3 px-3">Approved Hours</th>
                    <th className="py-3 px-3">Total Work Order Billing</th>
                    <th className="py-3 px-3">Work Order Status</th>
                    <th className="py-3 pr-3 pl-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {paginatedWorkers.length > 0 ? (
                    paginatedWorkers.map((w) => (
                      <tr key={w.candidate_id} className="hover:bg-white/60 transition-colors">
                        <td className="py-3 pl-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-3xs uppercase">
                              {(w.candidate_name || 'W').charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs sm:text-[13px] font-extrabold text-gray-900">{w.candidate_name}</div>
                              <div className="text-[11px] text-gray-400 font-medium">{w.role} · {w.ws_number}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs font-semibold text-gray-900">
                          {w.company_name}
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-xs font-bold text-gray-900">{w.billing_rate}</div>
                          <div className="text-[10.5px] text-gray-400 font-medium">{w.billing_cycle} cycle</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-xs font-extrabold text-gray-900">{w.total_approved_hours || 0} hrs</div>
                          {w.overtime_hours > 0 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              +{w.overtime_hours}h OT (1.5x)
                            </span>
                          ) : (
                            <span className="text-[10.5px] text-gray-400 font-medium">Standard Hours</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-xs font-extrabold text-gray-900">
                          ₹{(w.total_billing_amount || 0).toLocaleString()}
                        </td>

                        <td className="py-3 px-3 min-w-[210px]">
                          <WorkOrderProgressBar
                            status={w.sow_status || w.agreement_status}
                            paymentStatus={w.payment_status}
                            variant="compact"
                          />
                        </td>

                        <td className="py-3 pr-3 pl-3 text-right">
                          <button
                            onClick={() => handleOpenDetail(w.candidate_id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <span>Manage SOW</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400 text-xs font-medium">
                        <AlertCircle size={24} className="mx-auto mb-2 text-gray-300" />
                        <div>No contractors match the filter criteria.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pt-3 mt-2 border-t border-black/[0.04] flex items-center justify-between text-xs font-medium text-gray-500">
              <div>
                Showing <span className="font-bold text-gray-900">{paginatedWorkers.length}</span> of{' '}
                <span className="font-bold text-gray-900">{filteredWorkers.length}</span> contractors
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-bold text-gray-900 px-1">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DEDICATED WORKER SOW & BILLING SHEET DETAIL */}
      {viewMode === 'detail' && (
        <div className="space-y-3">
          {/* Top Detail Navigation Bar */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setViewMode('roster')}
              className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={13} />
              <span>Back to Master Roster ({filteredWorkers.length})</span>
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Prev / Next Worker Rapid Switcher */}
              <div className="flex items-center gap-1 bg-white/60 backdrop-blur-md px-2 py-1 rounded-xl border border-white/80 shadow-3xs">
                <button
                  onClick={() => handleNavigateWorker('prev')}
                  disabled={selectedIndex <= 0}
                  className="p-1 text-gray-700 hover:text-black hover:bg-black/5 rounded-lg disabled:opacity-30 cursor-pointer transition-all"
                  title="Previous Worker"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="text-[11px] font-bold text-gray-900 px-1.5">
                  Worker {selectedIndex >= 0 ? selectedIndex + 1 : 1} of {filteredWorkers.length}
                </span>

                <button
                  onClick={() => handleNavigateWorker('next')}
                  disabled={selectedIndex < 0 || selectedIndex >= filteredWorkers.length - 1}
                  className="p-1 text-gray-700 hover:text-black hover:bg-black/5 rounded-lg disabled:opacity-30 cursor-pointer transition-all"
                  title="Next Worker"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Worker Dropdown */}
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="bg-white/60 backdrop-blur-md border border-white/80 text-gray-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black shadow-3xs cursor-pointer"
              >
                {filteredWorkers.map((w) => (
                  <option key={w.candidate_id} value={w.candidate_id}>
                    {w.candidate_name} ({w.company_name})
                  </option>
                ))}
              </select>

              {/* Billing Cycle Dropdown */}
              <div className="flex items-center gap-1 bg-white/60 backdrop-blur-md p-1 rounded-xl border border-white/80 shadow-3xs">
                {['Monthly', 'Fortnightly', 'Weekly', 'Yearly'].map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      billingCycle === cycle ? 'bg-black text-white shadow-xs' : 'text-gray-600 hover:text-black hover:bg-white/60'
                    }`}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billing Rate</div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">{sowData.charge_rate}</div>
              <div className="text-[11px] text-gray-500 mt-1 font-medium">Standard 8h day</div>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billing Cycle</div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">{billingCycle}</div>
              <div className="text-[11px] text-gray-500 mt-1 font-medium">{sowData.payment_terms || 'Net 30'}</div>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Approved Hours</div>
              <div className="text-2xl font-extrabold text-emerald-600 tracking-tight mt-1">
                {sowData.regular_hours + sowData.overtime_hours} hrs
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-semibold">
                {sowData.regular_hours}h Base + {sowData.overtime_hours}h OT (1.5x)
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Approved Expenses</div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                ₹{calculatedTotalExpenses.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 font-medium">Approved by Hiring Manager</div>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] col-span-2 lg:col-span-1 flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Work Order Billing</div>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                ₹{calculatedGrandTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 font-medium">Base + Overtime + Expenses</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/40 backdrop-blur-xl border border-white/70 rounded-2xl shadow-2xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('sow')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'sow'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-white/60'
              }`}
            >
              <FileText size={14} />
              <span>Work Order & Billing Sheet (Editable)</span>
            </button>

            <button
              onClick={() => setActiveTab('timesheets')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'timesheets'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-white/60'
              }`}
            >
              <Clock size={14} />
              <span>Approved Timesheets</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'expenses'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-white/60'
              }`}
            >
              <Receipt size={14} />
              <span>Approved Expenses</span>
            </button>

            <button
              onClick={() => setActiveTab('contract')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'contract'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-white/60'
              }`}
            >
              <Building size={14} />
              <span>Contract Details & MSA</span>
            </button>
          </div>

          {/* TAB CONTENT 1: SOW & BILLING SHEET */}
          {activeTab === 'sow' && (
            <div className="space-y-4">
              <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-5 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-6">
                {/* Header Document Titles */}
                <div className="border-b border-black/[0.04] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">
                      STATEMENT OF WORK & BILLING STATEMENT · {billingCycle.toUpperCase()} CYCLE
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                      WORK STATEMENT: {sowData.ws_number || 'WO-2026'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Issued under Master Service Agreement <span className="font-semibold text-gray-900">{sowData.msa_ref || 'MSA-2026'}</span> · {sowData.company_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadTxt}
                      className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>Download Document</span>
                    </button>
                  </div>
                </div>

                {/* 4-Stage Governance & Settlement Timeline */}
                <WorkOrderProgressBar
                  status={sowData.status}
                  variant="full"
                />

                {/* SECTION 1: PERSONNEL & ROLE */}
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    1. Personnel and Engagement Scope
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/80 shadow-3xs">
                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Deployed Personnel</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.deployed_personnel}
                          onChange={(e) => handleFieldChange('deployed_personnel', e.target.value)}
                          className="bg-amber-50 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full focus:outline-none border border-amber-200 mt-1"
                        />
                      ) : (
                        <div className="text-xs font-bold text-gray-900 mt-1">{sowData.deployed_personnel || '—'}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Designation / Role</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.role}
                          onChange={(e) => handleFieldChange('role', e.target.value)}
                          className="bg-amber-50 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full focus:outline-none border border-amber-200 mt-1"
                        />
                      ) : (
                        <div className="text-xs font-bold text-gray-900 mt-1">{sowData.role || '—'}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Reporting Manager</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.reporting_to}
                          onChange={(e) => handleFieldChange('reporting_to', e.target.value)}
                          className="bg-amber-50 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full focus:outline-none border border-amber-200 mt-1"
                        />
                      ) : (
                        <div className="text-xs font-bold text-gray-900 mt-1">{sowData.reporting_to || '—'}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Place of Work</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.place_of_work}
                          onChange={(e) => handleFieldChange('place_of_work', e.target.value)}
                          className="bg-amber-50 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full focus:outline-none border border-amber-200 mt-1"
                        />
                      ) : (
                        <div className="text-xs font-bold text-gray-900 mt-1">{sowData.place_of_work || '—'}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: MSA CHARGES & BILLING RATE */}
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    2. MSA Billing Rate & Overtime Terms
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/80 shadow-3xs">
                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Billing Rate</div>
                      {editMode ? (
                        <input
                          type="number"
                          value={sowData.raw_charge_rate}
                          onChange={(e) => handleFieldChange('raw_charge_rate', e.target.value)}
                          className="bg-amber-50 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full focus:outline-none border border-amber-200 mt-1"
                        />
                      ) : (
                        <div className="text-xs font-bold text-gray-900 mt-1">{sowData.charge_rate}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Billing Cycle</div>
                      <div className="text-xs font-bold text-gray-900 mt-1">{billingCycle}</div>
                    </div>

                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Overtime Multiplier</div>
                      <div className="text-xs font-bold text-emerald-700 mt-1">1.5× Base Hourly Rate</div>
                    </div>

                    <div>
                      <div className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Payment Terms</div>
                      <div className="text-xs font-bold text-gray-900 mt-1">{sowData.payment_terms || 'Net 30 days'}</div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: APPROVED TIMESHEET HOURS BREAKDOWN */}
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    3. Approved Timesheet Hours & Overtime Billing Breakdown
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-black/[0.04]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-black/[0.04] text-[10px] font-extrabold uppercase tracking-wider text-gray-400 bg-white/30">
                          <th className="py-2.5 px-3">Hour Type</th>
                          <th className="py-2.5 px-3">Hours Approved</th>
                          <th className="py-2.5 px-3">Billing Rate / Multiplier</th>
                          <th className="py-2.5 px-3 text-right">Line Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.03]">
                        <tr className="hover:bg-white/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-gray-900">Standard Regular Hours</td>
                          <td className="py-2.5 px-3 text-gray-700">
                            {editMode ? (
                              <input
                                type="number"
                                value={sowData.regular_hours}
                                onChange={(e) => handleFieldChange('regular_hours', e.target.value)}
                                className="bg-amber-50 text-amber-950 font-bold px-2 py-0.5 rounded text-xs w-20 focus:outline-none border border-amber-200"
                              />
                            ) : (
                              <span>{sowData.regular_hours} hrs</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">₹{sowData.raw_charge_rate} / hr</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">₹{calculatedBaseCost.toLocaleString()}</td>
                        </tr>
                        <tr className="hover:bg-white/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-emerald-700">Overtime Hours (&gt;40h/wk)</td>
                          <td className="py-2.5 px-3">
                            {editMode ? (
                              <input
                                type="number"
                                value={sowData.overtime_hours}
                                onChange={(e) => handleFieldChange('overtime_hours', e.target.value)}
                                className="bg-amber-50 text-amber-950 font-bold px-2 py-0.5 rounded text-xs w-20 focus:outline-none border border-amber-200"
                              />
                            ) : (
                              <span className="text-emerald-700 font-bold">{sowData.overtime_hours} hrs</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-700 font-medium">
                            1.5× Rate (₹{(sowData.raw_charge_rate * 1.5).toLocaleString()} / hr)
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">₹{calculatedOtCost.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-white/50 font-extrabold text-xs">
                          <td colSpan="3" className="py-2.5 px-3 text-right text-gray-700">Subtotal Hours Billing:</td>
                          <td className="py-2.5 px-3 text-right text-gray-900">₹{(calculatedBaseCost + calculatedOtCost).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 4: APPROVED HIRING MANAGER EXPENSES */}
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    4. Approved Additional Expenses (Hiring Manager Approved)
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-black/[0.04]">
                    {sowData.expense_items.length > 0 ? (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-black/[0.04] text-[10px] font-extrabold uppercase tracking-wider text-gray-400 bg-white/30">
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3">Approval Date</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03]">
                          {sowData.expense_items.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-white/60 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-gray-900">{item.category}</td>
                              <td className="py-2.5 px-3 text-gray-600">{item.description}</td>
                              <td className="py-2.5 px-3 text-gray-500">{item.approved_at || '—'}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900">₹{parseFloat(item.amount || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                          <tr className="bg-white/50 font-extrabold text-xs">
                            <td colSpan="3" className="py-2.5 px-3 text-right text-gray-700">Subtotal Expenses:</td>
                            <td className="py-2.5 px-3 text-right text-gray-900">₹{calculatedTotalExpenses.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 bg-white/30 text-center text-gray-400 text-xs font-medium">
                        No approved expenses recorded in database for this worker.
                      </div>
                    )}
                  </div>
                </div>

                {/* GRAND TOTAL INVOICE SUMMARY BOX */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/90 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                      TOTAL WORK ORDER & INVOICE BILLING AMOUNT
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
                      ₹{calculatedGrandTotal.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-medium">
                      Includes Base Pay (₹{calculatedBaseCost.toLocaleString()}) + Overtime (₹{calculatedOtCost.toLocaleString()}) + Approved Expenses (₹{calculatedTotalExpenses.toLocaleString()})
                    </div>
                  </div>

                  <button
                    onClick={handleSendToProcurement}
                    disabled={isSending}
                    className="px-5 py-2.5 bg-black hover:bg-gray-900 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Send to Procurement</span>
                  </button>
                </div>

                {/* SIGNATURE BLOCKS */}
                <div className="pt-4 border-t border-black/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
                  <div>
                    <div className="border-b border-gray-900 pb-2 font-bold text-gray-900">
                      {sowData.signatory_supplier || 'Authorised Signatory'}
                    </div>
                    <div className="text-gray-500 mt-1 font-medium">For {sowData.supplier_name || 'Supplier Vendor'}</div>
                  </div>

                  <div>
                    <div className="border-b border-gray-900 pb-2 font-bold text-gray-900">
                      {sowData.signatory_company || 'Procurement / Director'}
                    </div>
                    <div className="text-gray-500 mt-1 font-medium">For {sowData.company_name || 'Client Company'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: APPROVED TIMESHEETS */}
          {activeTab === 'timesheets' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900">Approved Timesheets Breakdown</h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Verified from records
                </span>
              </div>

              {loadingTimesheets ? (
                <div className="py-8 text-center text-gray-400 text-xs">Loading timesheets...</div>
              ) : dbTimesheets.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-black/[0.04]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.04] text-[10px] font-extrabold uppercase tracking-wider text-gray-400 bg-white/30">
                        <th className="py-2.5 px-3">Period</th>
                        <th className="py-2.5 px-3">Regular Hours</th>
                        <th className="py-2.5 px-3">Overtime Hours</th>
                        <th className="py-2.5 px-3">Total Hours</th>
                        <th className="py-2.5 px-3">Approval Date</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03]">
                      {dbTimesheets.map((ts) => (
                        <tr key={ts.id} className="hover:bg-white/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-gray-900">{ts.period_label || ts.week_start_date || 'Weekly Period'}</td>
                          <td className="py-2.5 px-3 text-gray-700">{ts.total_regular_hours || ts.total_hours || 0} hrs</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-bold">{ts.total_overtime_hours || 0} hrs</td>
                          <td className="py-2.5 px-3 font-extrabold text-gray-900">{ts.total_hours || 0} hrs</td>
                          <td className="py-2.5 px-3 text-gray-500">{ts.approved_at_human || ts.submitted_at || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold rounded-full">
                              {ts.status || 'APPROVED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs font-medium bg-white/30 rounded-xl border border-white/70">
                  No approved timesheets found in database for this candidate.
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 3: APPROVED EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900">Hiring Manager Approved Expenses</h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Verified from records
                </span>
              </div>

              {sowData.expense_items.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-black/[0.04]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.04] text-[10px] font-extrabold uppercase tracking-wider text-gray-400 bg-white/30">
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Approval Date</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03]">
                      {sowData.expense_items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-white/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-gray-900">{item.category}</td>
                          <td className="py-2.5 px-3 text-gray-600">{item.description}</td>
                          <td className="py-2.5 px-3 text-gray-500">{item.approved_at || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">₹{parseFloat(item.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs font-medium bg-white/30 rounded-xl border border-white/70">
                  No approved expenses recorded in database for this worker.
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 4: CONTRACT & MSA DETAILS */}
          {activeTab === 'contract' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              <h3 className="text-sm font-extrabold text-gray-900">Contract & MSA Reference Terms</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-3xs space-y-2">
                  <div><span className="font-semibold text-gray-500">MSA Ref Number:</span> <span className="font-bold text-gray-900">{sowData.msa_ref || '—'}</span></div>
                  <div><span className="font-semibold text-gray-500">Work Order Ref:</span> <span className="font-bold text-gray-900">{sowData.ws_number || '—'}</span></div>
                  <div><span className="font-semibold text-gray-500">Contract Period:</span> <span className="font-bold text-gray-900">{sowData.commencement} to {sowData.expiry} ({sowData.duration})</span></div>
                </div>

                <div className="p-4 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-3xs space-y-2">
                  <div><span className="font-semibold text-gray-500">Standard Working Day:</span> <span className="font-bold text-gray-900">{sowData.standard_work_day}</span></div>
                  <div><span className="font-semibold text-gray-500">Overtime Terms:</span> <span className="font-bold text-emerald-700">1.5× rate for hours &gt; 40/week</span></div>
                  <div><span className="font-semibold text-gray-500">Payment Terms:</span> <span className="font-bold text-gray-900">{sowData.payment_terms || '—'}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
