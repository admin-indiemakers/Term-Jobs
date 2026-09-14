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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A0A0A]"></div>
      </div>
    );
  }

  return (
    <div className="w-full pb-8 space-y-4 font-sans antialiased text-[#0A0A0A]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0A0A0A] text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10 animate-fade-in text-[13px] font-medium">
          <CheckCircle2 size={18} className="text-[#22C55E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#0A0A0A] text-white rounded-2xl px-6 py-5 sm:px-7 sm:py-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-md uppercase">
              ENTERPRISE CONTRACTOR MANAGEMENT
            </span>
            <span className="text-[11px] font-bold tracking-widest text-[#8A8A85] uppercase">
              WORKERS DIRECTORY & BILLING ENGINE
            </span>
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>Workers Roster & Work Order Generator</span>
          </h1>
          <p className="text-[13.5px] text-[#A3A39E] mt-0.5 font-normal">
            Manage contract workforce, filter billing cycles, generate Work Order packages, and submit to Procurement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'roster' ? 'detail' : 'roster')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer flex items-center gap-1.5"
          >
            {viewMode === 'roster' ? <FileText size={14} /> : <Users size={14} />}
            <span>{viewMode === 'roster' ? 'Work Order Billing View' : 'Master Workers Roster'}</span>
          </button>
        </div>
      </div>

      {/* Fleet Summary Cards Across 100+ Contractors */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
          <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Total Deployed Fleet</div>
          <div className="text-[20px] font-extrabold text-[#0A0A0A] mt-1">{rosterStats.totalCount} Contractors</div>
          <div className="text-[11.5px] text-[#60605B] mt-0.5 font-medium">Active placements</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
          <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Total Active Spend</div>
          <div className="text-[20px] font-extrabold text-[#0A0A0A] mt-1">
            ₹{rosterStats.totalSpend > 0 ? rosterStats.totalSpend.toLocaleString() : '0'}
          </div>
          <div className="text-[11.5px] text-[#60605B] mt-0.5 font-medium">Approved hours & expenses</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
          <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Total Approved Hours</div>
          <div className="text-[20px] font-extrabold text-[#0A0A0A] mt-1">{rosterStats.totalHours} hrs</div>
          <div className="text-[11.5px] text-[#166534] mt-0.5 font-semibold">Base & 1.5x Overtime</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
          <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Pending Procurement</div>
          <div className="text-[20px] font-extrabold text-[#92400e] mt-1">{rosterStats.pendingProcurement} Work Orders</div>
          <div className="text-[11.5px] text-[#60605B] mt-0.5 font-medium">Sent to procurement</div>
        </div>

        <div className="bg-[#0A0A0A] text-white rounded-2xl p-4 col-span-2 lg:col-span-1 shadow-md">
          <div className="text-[11px] font-bold text-[#A3A39E] uppercase tracking-wider">Draft Work Orders</div>
          <div className="text-[20px] font-black text-[#22C55E] mt-1">{rosterStats.draftCount} Ready</div>
          <div className="text-[11px] text-[#A3A39E] mt-0.5 font-medium">Ready for review & send</div>
        </div>
      </div>

      {/* VIEW MODE 1: MASTER WORKERS ROSTER TABLE (OPTIMIZED FOR 100+ WORKERS) */}
      {viewMode === 'roster' && (
        <div className="space-y-4">
          {/* Roster Controls: Search + Filter Pills */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#EAEAE6] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8A85]" />
              <input
                type="text"
                placeholder="Search across 100+ contractors by name, role, client, or WO #..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#F7F7F5] border border-[#E0E0DC] text-[#0A0A0A] text-[13.5px] font-medium rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#F7F7F5] p-1.5 rounded-xl border border-[#EAEAE6]">
              {[
                { id: 'ALL', label: 'All Contractors' },
                { id: 'Draft', label: 'Draft Work Orders' },
                { id: 'Sent to Procurement', label: 'Sent to Procurement' },
                { id: 'Has Overtime', label: 'Has Overtime' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setStatusFilter(f.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-[#0A0A0A] text-white shadow-xs'
                      : 'text-[#60605B] hover:bg-[#EAEAE6]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Master Roster Table */}
          <div className="bg-white rounded-2xl border border-[#EAEAE6] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#F4F4F0] text-[#70706B] font-extrabold uppercase text-[11px] border-b border-[#EAEAE6]">
                  <tr>
                    <th className="py-3.5 px-4">Personnel & Role</th>
                    <th className="py-3.5 px-4">Client Company</th>
                    <th className="py-3.5 px-4">Billing Rate / Cycle</th>
                    <th className="py-3.5 px-4">Approved Hours</th>
                    <th className="py-3.5 px-4">Total Work Order Billing</th>
                    <th className="py-3.5 px-4">Work Order Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAE6] text-[#0A0A0A]">
                  {paginatedWorkers.length > 0 ? (
                    paginatedWorkers.map((w) => (
                      <tr key={w.candidate_id} className="hover:bg-[#FDFDFB] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#0A0A0A] text-white font-black text-[12px] flex items-center justify-center uppercase shrink-0">
                              {(w.candidate_name || 'W').charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-[#0A0A0A]">{w.candidate_name}</div>
                              <div className="text-[11.5px] text-[#60605B] font-medium">{w.role} · {w.ws_number}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#0A0A0A]">
                          {w.company_name}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#0A0A0A]">{w.billing_rate}</div>
                          <div className="text-[11px] text-[#70706B] font-medium">{w.billing_cycle} cycle</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-[#0A0A0A]">{w.total_approved_hours || 0} hrs</div>
                          {w.overtime_hours > 0 ? (
                            <span className="text-[10.5px] font-extrabold text-[#166534] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              +{w.overtime_hours}h OT (1.5x)
                            </span>
                          ) : (
                            <span className="text-[10.5px] text-[#70706B] font-medium">Standard Hours</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-black text-[#0A0A0A]">
                          ₹{(w.total_billing_amount || 0).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 min-w-[210px]">
                          <WorkOrderProgressBar
                            status={w.sow_status || w.agreement_status}
                            paymentStatus={w.payment_status}
                            variant="compact"
                          />
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenDetail(w.candidate_id)}
                            className="px-3.5 py-1.5 bg-[#0A0A0A] hover:bg-[#252525] text-white text-[12px] font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                          >
                            <span>Manage SOW</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-[#70706B] text-[13.5px] font-medium">
                        No contractors match the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-[#F8F8F6] px-4 py-3 border-t border-[#EAEAE6] flex items-center justify-between text-[12.5px] font-semibold text-[#60605B]">
              <div>
                Showing <span className="font-bold text-[#0A0A0A]">{paginatedWorkers.length}</span> of{' '}
                <span className="font-bold text-[#0A0A0A]">{filteredWorkers.length}</span> contractors
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-[#E0E0DC] rounded-lg text-[#0A0A0A] hover:bg-[#F0F0ED] disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <span className="text-[12px] font-bold text-[#0A0A0A]">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-[#E0E0DC] rounded-lg text-[#0A0A0A] hover:bg-[#F0F0ED] disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DEDICATED WORKER SOW & BILLING SHEET DETAIL */}
      {viewMode === 'detail' && (
        <div className="space-y-4">
          {/* Top Detail Navigation Bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setViewMode('roster')}
              className="px-3.5 py-1.5 bg-[#F4F4F0] hover:bg-[#EAEAE6] text-[#0A0A0A] text-[12.5px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={15} />
              <span>Back to Master Roster ({filteredWorkers.length})</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Prev / Next Worker Rapid Switcher */}
              <div className="flex items-center gap-1 bg-[#F7F7F5] px-2 py-1 rounded-xl border border-[#EAEAE6]">
                <button
                  onClick={() => handleNavigateWorker('prev')}
                  disabled={selectedIndex <= 0}
                  className="p-1 text-[#0A0A0A] hover:bg-[#EAEAE6] rounded disabled:opacity-30 cursor-pointer"
                  title="Previous Worker"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="text-[12px] font-bold text-[#0A0A0A] px-2">
                  Worker {selectedIndex >= 0 ? selectedIndex + 1 : 1} of {filteredWorkers.length}
                </span>

                <button
                  onClick={() => handleNavigateWorker('next')}
                  disabled={selectedIndex < 0 || selectedIndex >= filteredWorkers.length - 1}
                  className="p-1 text-[#0A0A0A] hover:bg-[#EAEAE6] rounded disabled:opacity-30 cursor-pointer"
                  title="Next Worker"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Worker Dropdown */}
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="bg-[#F7F7F5] border border-[#E0E0DC] text-[#0A0A0A] text-[13px] font-bold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
              >
                {filteredWorkers.map((w) => (
                  <option key={w.candidate_id} value={w.candidate_id}>
                    {w.candidate_name} ({w.company_name})
                  </option>
                ))}
              </select>

              {/* Billing Cycle Dropdown */}
              <div className="flex items-center gap-1 bg-[#F7F7F5] p-1 rounded-xl border border-[#EAEAE6]">
                {['Monthly', 'Fortnightly', 'Weekly', 'Yearly'].map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
                      billingCycle === cycle ? 'bg-[#0A0A0A] text-white shadow-xs' : 'text-[#60605B] hover:bg-[#EAEAE6]'
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
            <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
              <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Billing Rate</div>
              <div className="text-[19px] font-extrabold text-[#0A0A0A] mt-1">{sowData.charge_rate}</div>
              <div className="text-[11.5px] text-[#60605B] mt-0.5 font-medium">Standard 8h day</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
              <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Billing Cycle</div>
              <div className="text-[19px] font-extrabold text-[#0A0A0A] mt-1">{billingCycle}</div>
              <div className="text-[11.5px] text-[#60605B] mt-0.5 font-medium">{sowData.payment_terms || 'Net 30'}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
              <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Approved Hours</div>
              <div className="text-[19px] font-extrabold text-[#0A0A0A] mt-1">
                {sowData.regular_hours + sowData.overtime_hours} hrs
              </div>
              <div className="text-[11.5px] text-[#166534] mt-0.5 font-semibold">
                {sowData.regular_hours}h Base + {sowData.overtime_hours}h OT (1.5x)
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EAEAE6] shadow-xs">
              <div className="text-[11px] font-bold text-[#8A8A85] uppercase tracking-wider">Approved Expenses</div>
              <div className="text-[19px] font-extrabold text-[#0A0A0A] mt-1">
                ₹{calculatedTotalExpenses.toLocaleString()}
              </div>
              <div className="text-[11.5px] text-[#60605B] mt-0.5 font-medium">Approved by Hiring Manager</div>
            </div>

            <div className="bg-[#0A0A0A] text-white rounded-2xl p-4 col-span-2 lg:col-span-1 shadow-md">
              <div className="text-[11px] font-bold text-[#A3A39E] uppercase tracking-wider">Total Work Order Billing</div>
              <div className="text-[20px] font-black text-[#22C55E] mt-1">
                ₹{calculatedGrandTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#A3A39E] mt-0.5 font-medium">Base + Overtime + Expenses</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#EAEAE6] pt-1">
            <button
              onClick={() => setActiveTab('sow')}
              className={`px-4 py-2.5 text-[13.5px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'sow' ? 'border-[#0A0A0A] text-[#0A0A0A]' : 'border-transparent text-[#70706B] hover:text-[#0A0A0A]'
              }`}
            >
              <FileText size={16} />
              <span>Work Order & Billing Sheet (Editable)</span>
            </button>

            <button
              onClick={() => setActiveTab('timesheets')}
              className={`px-4 py-2.5 text-[13.5px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'timesheets' ? 'border-[#0A0A0A] text-[#0A0A0A]' : 'border-transparent text-[#70706B] hover:text-[#0A0A0A]'
              }`}
            >
              <Clock size={16} />
              <span>Approved Timesheets</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2.5 text-[13.5px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'expenses' ? 'border-[#0A0A0A] text-[#0A0A0A]' : 'border-transparent text-[#70706B] hover:text-[#0A0A0A]'
              }`}
            >
              <Receipt size={16} />
              <span>Approved Expenses</span>
            </button>

            <button
              onClick={() => setActiveTab('contract')}
              className={`px-4 py-2.5 text-[13.5px] font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'contract' ? 'border-[#0A0A0A] text-[#0A0A0A]' : 'border-transparent text-[#70706B] hover:text-[#0A0A0A]'
              }`}
            >
              <Building size={16} />
              <span>Contract Details & MSA</span>
            </button>
          </div>

          {/* TAB CONTENT 1: SOW & BILLING SHEET */}
          {activeTab === 'sow' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#EAEAE6] shadow-sm p-6 sm:p-9 space-y-7">
                {/* Header Document Titles */}
                <div className="border-b border-[#EAEAE6] pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="text-[11px] font-bold tracking-widest text-[#70706B] uppercase">
                      STATEMENT OF WORK & BILLING STATEMENT · {billingCycle.toUpperCase()} CYCLE
                    </div>
                    <h2 className="text-[22px] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                      WORK STATEMENT: {sowData.ws_number || 'WO-2026'}
                    </h2>
                    <p className="text-[13px] text-[#60605B] mt-0.5">
                      Issued under Master Service Agreement <span className="font-semibold text-[#0A0A0A]">{sowData.msa_ref || 'MSA-2026'}</span> · {sowData.company_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadTxt}
                      className="px-3.5 py-1.5 bg-[#F4F4F0] hover:bg-[#EAEAE6] text-[#0A0A0A] rounded-xl text-[12px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Download size={14} />
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
                  <h3 className="text-[13px] font-extrabold text-[#0A0A0A] tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0A0A0A]"></span>
                    1. Personnel and Engagement Scope
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-[#F8F8F6] p-4 rounded-xl border border-[#EAEAE6]">
                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Deployed Personnel</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.deployed_personnel}
                          onChange={(e) => handleFieldChange('deployed_personnel', e.target.value)}
                          className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13.5px] w-full focus:outline-none"
                        />
                      ) : (
                        <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{sowData.deployed_personnel || '—'}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Designation / Role</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.role}
                          onChange={(e) => handleFieldChange('role', e.target.value)}
                          className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13.5px] w-full focus:outline-none"
                        />
                      ) : (
                        <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{sowData.role || '—'}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Reporting Manager</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.reporting_to}
                          onChange={(e) => handleFieldChange('reporting_to', e.target.value)}
                          className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13.5px] w-full focus:outline-none"
                        />
                      ) : (
                        <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{sowData.reporting_to || '—'}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Place of Work</div>
                      {editMode ? (
                        <input
                          type="text"
                          value={sowData.place_of_work}
                          onChange={(e) => handleFieldChange('place_of_work', e.target.value)}
                          className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13.5px] w-full focus:outline-none"
                        />
                      ) : (
                        <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{sowData.place_of_work || '—'}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: MSA CHARGES & BILLING RATE */}
                <div>
                  <h3 className="text-[13px] font-extrabold text-[#0A0A0A] tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0A0A0A]"></span>
                    2. MSA Billing Rate & Overtime Terms
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-[#F8F8F6] p-4 rounded-xl border border-[#EAEAE6]">
                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Billing Rate</div>
                      {editMode ? (
                        <input
                          type="number"
                          value={sowData.raw_charge_rate}
                          onChange={(e) => handleFieldChange('raw_charge_rate', e.target.value)}
                          className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13.5px] w-full focus:outline-none"
                        />
                      ) : (
                        <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{sowData.charge_rate}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Billing Cycle</div>
                      <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{billingCycle}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Overtime Multiplier</div>
                      <div className="text-[14px] font-bold text-[#166534] mt-0.5">1.5× Base Hourly Rate</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#70706B]">Payment Terms</div>
                      <div className="text-[14px] font-bold text-[#0A0A0A] mt-0.5">{sowData.payment_terms || 'Net 30 days'}</div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: APPROVED TIMESHEET HOURS BREAKDOWN */}
                <div>
                  <h3 className="text-[13px] font-extrabold text-[#0A0A0A] tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0A0A0A]"></span>
                    3. Approved Timesheet Hours & Overtime Billing Breakdown
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-[#EAEAE6]">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-[#F4F4F0] text-[#70706B] font-bold uppercase text-[11px] border-b border-[#EAEAE6]">
                        <tr>
                          <th className="py-3 px-4">Hour Type</th>
                          <th className="py-3 px-4">Hours Approved</th>
                          <th className="py-3 px-4">Billing Rate / Multiplier</th>
                          <th className="py-3 px-4 text-right">Line Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAEAE6] text-[#0A0A0A]">
                        <tr>
                          <td className="py-3 px-4 font-bold">Standard Regular Hours</td>
                          <td className="py-3 px-4">
                            {editMode ? (
                              <input
                                type="number"
                                value={sowData.regular_hours}
                                onChange={(e) => handleFieldChange('regular_hours', e.target.value)}
                                className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13px] w-24 focus:outline-none"
                              />
                            ) : (
                              <span>{sowData.regular_hours} hrs</span>
                            )}
                          </td>
                          <td className="py-3 px-4">₹{sowData.raw_charge_rate} / hr</td>
                          <td className="py-3 px-4 text-right font-bold">₹{calculatedBaseCost.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-bold text-[#166534]">Overtime Hours (&gt;40h/wk)</td>
                          <td className="py-3 px-4">
                            {editMode ? (
                              <input
                                type="number"
                                value={sowData.overtime_hours}
                                onChange={(e) => handleFieldChange('overtime_hours', e.target.value)}
                                className="bg-amber-100/90 text-amber-950 font-bold px-2 py-0.5 rounded text-[13px] w-24 focus:outline-none"
                              />
                            ) : (
                              <span className="text-[#166534] font-bold">{sowData.overtime_hours} hrs</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#166534] font-semibold">
                            1.5× Rate (₹{(sowData.raw_charge_rate * 1.5).toLocaleString()} / hr)
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#166534]">₹{calculatedOtCost.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-[#F8F8F6] font-extrabold text-[13.5px]">
                          <td colSpan="3" className="py-3 px-4 text-right">Subtotal Hours Billing:</td>
                          <td className="py-3 px-4 text-right">₹{(calculatedBaseCost + calculatedOtCost).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 4: APPROVED HIRING MANAGER EXPENSES */}
                <div>
                  <h3 className="text-[13px] font-extrabold text-[#0A0A0A] tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0A0A0A]"></span>
                    4. Approved Additional Expenses (Hiring Manager Approved)
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-[#EAEAE6]">
                    {sowData.expense_items.length > 0 ? (
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-[#F4F4F0] text-[#70706B] font-bold uppercase text-[11px] border-b border-[#EAEAE6]">
                          <tr>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4">Approval Date</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAEAE6] text-[#0A0A0A]">
                          {sowData.expense_items.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="py-3 px-4 font-bold">{item.category}</td>
                              <td className="py-3 px-4 text-[#60605B]">{item.description}</td>
                              <td className="py-3 px-4">{item.approved_at || '—'}</td>
                              <td className="py-3 px-4 text-right font-bold">₹{parseFloat(item.amount || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                          <tr className="bg-[#F8F8F6] font-extrabold text-[13.5px]">
                            <td colSpan="3" className="py-3 px-4 text-right">Subtotal Expenses:</td>
                            <td className="py-3 px-4 text-right">₹{calculatedTotalExpenses.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 bg-[#F8F8F6] text-center text-[#70706B] text-[13px] font-medium">
                        No approved expenses recorded in database for this worker.
                      </div>
                    )}
                  </div>
                </div>

                {/* GRAND TOTAL INVOICE SUMMARY BOX */}
                <div className="bg-[#0A0A0A] text-white p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                  <div>
                    <div className="text-[11px] font-bold text-[#A3A39E] uppercase tracking-widest">
                      TOTAL WORK ORDER & INVOICE BILLING AMOUNT
                    </div>
                    <div className="text-[28px] font-black text-[#22C55E] tracking-tight mt-0.5">
                      ₹{calculatedGrandTotal.toLocaleString()}
                    </div>
                    <div className="text-[12px] text-[#A3A39E] mt-0.5 font-medium">
                      Includes Base Pay (₹{calculatedBaseCost.toLocaleString()}) + Overtime (₹{calculatedOtCost.toLocaleString()}) + Approved Expenses (₹{calculatedTotalExpenses.toLocaleString()})
                    </div>
                  </div>

                  <button
                    onClick={handleSendToProcurement}
                    disabled={isSending}
                    className="px-6 py-3 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold rounded-xl text-[14px] transition-all cursor-pointer shadow-lg flex items-center gap-2 shrink-0"
                  >
                    {isSending ? <RefreshCw size={17} className="animate-spin" /> : <Send size={17} />}
                    <span>Send to Procurement</span>
                  </button>
                </div>

                {/* SIGNATURE BLOCKS */}
                <div className="pt-6 border-t border-[#EAEAE6] grid grid-cols-1 sm:grid-cols-2 gap-8 text-[13px]">
                  <div>
                    <div className="border-b border-[#0A0A0A] pb-2 font-bold text-[#0A0A0A]">
                      {sowData.signatory_supplier || 'Authorised Signatory'}
                    </div>
                    <div className="text-[#60605B] mt-1 font-medium">For {sowData.supplier_name || 'Supplier Vendor'}</div>
                  </div>

                  <div>
                    <div className="border-b border-[#0A0A0A] pb-2 font-bold text-[#0A0A0A]">
                      {sowData.signatory_company || 'Procurement / Director'}
                    </div>
                    <div className="text-[#60605B] mt-1 font-medium">For {sowData.company_name || 'Client Company'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: APPROVED TIMESHEETS */}
          {activeTab === 'timesheets' && (
            <div className="bg-white rounded-2xl border border-[#EAEAE6] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold text-[#0A0A0A]">Approved Timesheets Breakdown</h3>
                <span className="text-[12px] font-bold text-[#166534] bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                  Verified from MongoDB records
                </span>
              </div>

              {loadingTimesheets ? (
                <div className="py-8 text-center text-[#70706B] text-[13px]">Loading timesheets...</div>
              ) : dbTimesheets.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#EAEAE6]">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#F4F4F0] text-[#70706B] font-bold uppercase text-[11px] border-b border-[#EAEAE6]">
                      <tr>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Regular Hours</th>
                        <th className="py-3 px-4">Overtime Hours</th>
                        <th className="py-3 px-4">Total Hours</th>
                        <th className="py-3 px-4">Approval Date</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEAE6] text-[#0A0A0A]">
                      {dbTimesheets.map((ts) => (
                        <tr key={ts.id}>
                          <td className="py-3 px-4 font-bold">{ts.period_label || ts.week_start_date || 'Weekly Period'}</td>
                          <td className="py-3 px-4">{ts.total_regular_hours || ts.total_hours || 0} hrs</td>
                          <td className="py-3 px-4 text-[#166534] font-bold">{ts.total_overtime_hours || 0} hrs</td>
                          <td className="py-3 px-4 font-extrabold">{ts.total_hours || 0} hrs</td>
                          <td className="py-3 px-4 text-[#60605B]">{ts.approved_at_human || ts.submitted_at || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded">
                              {ts.status || 'APPROVED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-[#70706B] text-[13.5px] font-medium bg-[#F8F8F6] rounded-xl border border-[#EAEAE6]">
                  No approved timesheets found in database for this candidate.
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 3: APPROVED EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="bg-white rounded-2xl border border-[#EAEAE6] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold text-[#0A0A0A]">Hiring Manager Approved Expenses</h3>
                <span className="text-[12px] font-bold text-[#166534] bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                  Verified from MongoDB records
                </span>
              </div>

              {sowData.expense_items.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#EAEAE6]">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#F4F4F0] text-[#70706B] font-bold uppercase text-[11px] border-b border-[#EAEAE6]">
                      <tr>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Approval Date</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEAE6] text-[#0A0A0A]">
                      {sowData.expense_items.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-3 px-4 font-bold">{item.category}</td>
                          <td className="py-3 px-4 text-[#60605B]">{item.description}</td>
                          <td className="py-3 px-4">{item.approved_at || '—'}</td>
                          <td className="py-3 px-4 text-right font-bold">₹{parseFloat(item.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-[#70706B] text-[13.5px] font-medium bg-[#F8F8F6] rounded-xl border border-[#EAEAE6]">
                  No approved expenses recorded in database for this worker.
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 4: CONTRACT & MSA DETAILS */}
          {activeTab === 'contract' && (
            <div className="bg-white rounded-2xl border border-[#EAEAE6] p-6 shadow-xs space-y-4">
              <h3 className="text-[16px] font-extrabold text-[#0A0A0A]">Contract & MSA Reference Terms</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                <div className="p-4 bg-[#F8F8F6] rounded-xl border border-[#EAEAE6] space-y-2">
                  <div><span className="font-semibold text-[#70706B]">MSA Ref Number:</span> <span className="font-bold text-[#0A0A0A]">{sowData.msa_ref || '—'}</span></div>
                  <div><span className="font-semibold text-[#70706B]">Work Order Ref:</span> <span className="font-bold text-[#0A0A0A]">{sowData.ws_number || '—'}</span></div>
                  <div><span className="font-semibold text-[#70706B]">Contract Period:</span> <span className="font-bold text-[#0A0A0A]">{sowData.commencement} to {sowData.expiry} ({sowData.duration})</span></div>
                </div>

                <div className="p-4 bg-[#F8F8F6] rounded-xl border border-[#EAEAE6] space-y-2">
                  <div><span className="font-semibold text-[#70706B]">Standard Working Day:</span> <span className="font-bold text-[#0A0A0A]">{sowData.standard_work_day}</span></div>
                  <div><span className="font-semibold text-[#70706B]">Overtime Terms:</span> <span className="font-bold text-[#166534]">1.5× rate for hours &gt; 40/week</span></div>
                  <div><span className="font-semibold text-[#70706B]">Payment Terms:</span> <span className="font-bold text-[#0A0A0A]">{sowData.payment_terms || '—'}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
