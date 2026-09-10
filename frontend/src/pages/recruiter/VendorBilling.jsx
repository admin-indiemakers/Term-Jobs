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
  Building,
  ShieldCheck,
  Send,
  X,
  Sparkles,
  Printer,
  Check,
  Edit3,
  Save,
  Eye,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import WorkOrderProgressBar from '../../components/WorkOrderProgressBar';

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

  // Tab inside Drawer: 'pdf' (Editable Work Order PDF) vs 'timesheet' (Timesheet & Calculations)
  const [activeDrawerTab, setActiveDrawerTab] = useState('pdf');

  // Editable Document Form state
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    ws_number: '',
    msa_ref: '',
    deployed_personnel: '',
    role: '',
    company_name: '',
    supplier_name: 'Asimovex / Term-Jobs Talent Solutions',
    reporting_to: '',
    place_of_work: 'Bangalore HQ (Hybrid)',
    commencement: '2026-09-01',
    expiry: '2027-08-31',
    duration: '12 Months',
    raw_charge_rate: 2200,
    charge_rate: '₹2,200/hr',
    standard_work_day: '8 Hours (Standard 40h/week)',
    payment_terms: 'Net 30 days',
    supplier_margin: '30%',
    billing_cycle: 'Monthly',
    regular_hours: 4,
    overtime_hours: 0,
    expense_items: [],
    signatory_supplier: 'Authorised Talent Partner',
    signatory_company: 'Procurement Director / Authorized Officer',
    status: 'Draft'
  });

  // Invoice Actions
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isDispatchingSow, setIsDispatchingSow] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Direct Work Order Dispatch to Procurement
  const handleDispatchSow = async (workorderId) => {
    const targetId = workorderId || selectedCandidateId;
    if (!targetId) return;
    setIsDispatchingSow(true);
    try {
      const res = await request(`/api/vendor-billing/candidate/${encodeURIComponent(targetId)}/dispatch-sow`, {
        method: 'POST',
        token,
        body: { period: selectedMonth }
      });
      if (res && res.status === 'success') {
        showToast(`✨ ${res.message || 'Work Order Billing Package delivered to Procurement successfully!'}`);
        loadOverview(selectedMonth);
        if (selectedCandidateId === targetId) {
          handleSelectCandidate({ workorder_id: targetId }, activeDrawerTab);
        }
      }
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Failed to dispatch Work Order to Procurement.'}`);
    } finally {
      setIsDispatchingSow(false);
    }
  };

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

  // Fetch single candidate breakdown and initialize docForm
  const handleSelectCandidate = async (cand, initialTab = 'pdf') => {
    const cid = cand.workorder_id || cand.candidate_id || cand.id;
    setSelectedCandidateId(cid);
    setActiveDrawerTab(initialTab);
    setLoadingBreakdown(true);
    setBreakdownError('');

    // Prepopulate immediate values from candidate card
    setDocForm((prev) => ({
      ...prev,
      candidate_id: cid,
      workorder_id: cid,
      ws_number: cand.work_order_number || prev.ws_number || 'WO-2026',
      deployed_personnel: cand.candidate_name || prev.deployed_personnel,
      role: cand.role || prev.role,
      company_name: cand.company_name || prev.company_name,
      raw_charge_rate: cand.hourly_rate || prev.raw_charge_rate,
      charge_rate: cand.hourly_rate ? `₹${cand.hourly_rate}/hr` : prev.charge_rate,
      regular_hours: cand.total_hours !== undefined ? cand.total_hours : prev.regular_hours,
      overtime_hours: cand.total_overtime_hours !== undefined ? cand.total_overtime_hours : prev.overtime_hours,
      status: cand.sow_status || prev.status
    }));

    try {
      const q = selectedMonth ? `?month=${selectedMonth}` : '';
      const res = await request(`/api/vendor-billing/candidate/${encodeURIComponent(cid)}${q}`, { token });
      if (res && res.status === 'success') {
        const data = res.data;
        setBreakdownData(data);

        // Sync detailed SOW form
        const sowInfo = data.sow?.sow_data || data.sow || {};
        setDocForm({
          candidate_id: cid,
          workorder_id: cid,
          ws_number: sowInfo.ws_number || data.candidate?.work_order_number || `WO-${cid.slice(0, 8).toUpperCase()}`,
          msa_ref: sowInfo.msa_ref || data.candidate?.msa_ref || 'MSA-2026-TERMS',
          deployed_personnel: sowInfo.deployed_personnel || data.candidate?.name || cand.candidate_name || '',
          role: sowInfo.role || data.candidate?.role || cand.role || '',
          company_name: sowInfo.company_name || data.candidate?.company_name || cand.company_name || 'Enterprise Client',
          supplier_name: sowInfo.supplier_name || 'Asimovex / Term-Jobs Talent Solutions',
          reporting_to: sowInfo.reporting_to || 'Engineering Director',
          place_of_work: sowInfo.place_of_work || 'Hybrid / Bangalore HQ',
          commencement: sowInfo.commencement || '2026-09-01',
          expiry: sowInfo.expiry || '2027-08-31',
          duration: sowInfo.duration || '12 Months',
          raw_charge_rate: sowInfo.raw_charge_rate || data.rates?.hourly_rate || cand.hourly_rate || 2200,
          charge_rate: `₹${sowInfo.raw_charge_rate || data.rates?.hourly_rate || cand.hourly_rate || 2200}/hr`,
          standard_work_day: sowInfo.standard_work_day || '8 Hours (Standard 40h/week)',
          payment_terms: sowInfo.payment_terms || data.candidate?.payment_terms || 'Net 30 days',
          supplier_margin: sowInfo.supplier_margin || data.candidate?.supplier_margin || '30%',
          billing_cycle: data.candidate?.billing_cycle || 'Monthly',
          regular_hours: sowInfo.regular_hours !== undefined ? sowInfo.regular_hours : (data.summary?.regular_hours ?? 4),
          overtime_hours: sowInfo.overtime_hours !== undefined ? sowInfo.overtime_hours : (data.summary?.overtime_hours ?? 0),
          expense_items: data.expenses || sowInfo.expense_items || [],
          signatory_supplier: sowInfo.signatory_supplier || 'Head of Talent Solutions',
          signatory_company: sowInfo.signatory_company || 'Procurement Director / Authorized Officer',
          status: data.sow?.status || cand.sow_status || 'Draft'
        });
      }
    } catch (err) {
      console.error('Failed to load breakdown:', err);
      setBreakdownError(err.message || 'Unable to load detailed billing breakdown.');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleDocFieldChange = (field, value) => {
    setDocForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'raw_charge_rate') {
        updated.charge_rate = `₹${value}/hr`;
      }
      return updated;
    });
  };

  // Live calculations for the editable document
  const calculatedBaseRate = parseFloat(docForm.raw_charge_rate || 0);
  const calculatedRegHrs = parseFloat(docForm.regular_hours || 0);
  const calculatedOtHrs = parseFloat(docForm.overtime_hours || 0);
  const calculatedDocBaseCost = calculatedBaseRate * calculatedRegHrs;
  const calculatedDocOtCost = (calculatedBaseRate * 1.5) * calculatedOtHrs;
  const calculatedDocExpenses = Array.isArray(docForm.expense_items)
    ? docForm.expense_items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
    : 0;
  const calculatedDocGrandTotal = calculatedDocBaseCost + calculatedDocOtCost + calculatedDocExpenses;

  // Save draft work order
  const handleSaveDocDraft = async () => {
    if (!selectedCandidateId) return;
    setIsSavingDoc(true);
    try {
      const payload = {
        ...docForm,
        raw_charge_rate: calculatedBaseRate,
        regular_hours: calculatedRegHrs,
        overtime_hours: calculatedOtHrs,
        calculated_base_cost: calculatedDocBaseCost,
        calculated_ot_cost: calculatedDocOtCost,
        calculated_expenses: calculatedDocExpenses,
        calculated_grand_total: calculatedDocGrandTotal
      };
      const res = await request(`/api/workforce/workers/${encodeURIComponent(selectedCandidateId)}/sow/save-draft`, {
        method: 'POST',
        token,
        body: { sow_data: payload }
      });
      if (res && res.status === 'success') {
        showToast('💾 Work Order draft saved successfully!');
        setIsEditingDoc(false);
        loadOverview(selectedMonth);
      }
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Failed to save draft Work Order.'}`);
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
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
        handleSelectCandidate({ workorder_id: selectedCandidateId }, activeDrawerTab);
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
      handleSelectCandidate({ workorder_id: selectedCandidateId }, activeDrawerTab);
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
      {/* Embedded Print Styling for Clean Single-Page / Multi-Page Work Order Document */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-work-order-doc, #printable-work-order-doc * {
            visibility: visible;
          }
          #printable-work-order-doc {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
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
              Manage contractor timesheets, weekly overtime pricing breakdowns, approved expenses, and editable Work Order PDF packages.
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

        {/* BILLING CYCLE TRACKER & WORK ORDER DISPATCH WINDOW SYSTEM */}
        <div className="mt-6 bg-[#0A0A0A] text-white rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse"></span>
              <span className="text-[11px] font-extrabold tracking-widest text-[#22C55E] uppercase">
                BILLING CYCLE & WORK ORDER DISPATCH SYSTEM
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>Current Cycle: September 2026</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/10 text-[#A3A39E] border border-white/15 font-mono">
                Monthly Cycle · 01 Sep - 30 Sep
              </span>
            </h2>
            <p className="text-xs text-[#A3A39E]">
              Track cycle completion dates, timesheets, approved expenses, and inspect/edit Work Order PDF packages before dispatching to Procurement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 text-left">
              <div className="text-[10px] font-bold text-[#A3A39E] uppercase">Cycle Ends In</div>
              <div className="text-base font-black text-white mt-0.5">20 Days (30 Sep 2026)</div>
            </div>

            <a
              href="/dashboard/recruiter/workers"
              className="px-5 py-2.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Work Order to Procurement</span>
            </a>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-xs">
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
                    onClick={() => handleSelectCandidate(cand, 'pdf')}
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

                    {/* Work Order 4-Stage Governance & Settlement Progress Bar */}
                    <div className="mt-3.5 rounded-xl p-3 text-xs border transition-all flex flex-col gap-2 bg-[#F9FAFB] border-[#E5E7EB]">
                      <WorkOrderProgressBar
                        status={cand.sow_status}
                        paymentStatus={cand.billing_status}
                        variant="compact"
                      />

                      {/* Direct Work Order Dispatch Button */}
                      {cand.sow_status !== 'Approved by Director' && cand.sow_status !== 'Approved' && (
                        <div className="pt-1.5 border-t border-[#E5E7EB] flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDispatchSow(cand.workorder_id || cand.id);
                            }}
                            disabled={isDispatchingSow}
                            className="w-full py-1.5 bg-black hover:bg-gray-800 text-white font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Send size={11} className="text-emerald-400" />
                            <span>
                              {cand.sow_status === 'Pending Director Approval' || cand.sow_status === 'Approved by Procurement'
                                ? 'Re-send Work Order Package'
                                : cand.sow_status === 'Sent to Procurement'
                                ? 'Re-send Work Order to Procurement'
                                : cand.sow_status === 'Revision Requested'
                                ? 'Re-submit Revised Work Order'
                                : 'Release Work Order to Procurement'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Total Value & Action Buttons */}
                    <div className="mt-4 flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[11px] text-[#9CA3AF] block">Total Amount</span>
                        <span className="text-base font-extrabold text-[#0A0A0A]">
                          {cand.curr_symbol}{Number(cand.gross_amount || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Work Order PDF Direct Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCandidate(cand, 'pdf');
                          }}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-black hover:text-white text-gray-800 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-gray-200"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Work Order PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCandidate(cand, 'timesheet');
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#0A0A0A] hover:translate-x-0.5 transition-transform"
                        >
                          Breakdown <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Candidate Breakdown & Work Order PDF Floating Drawer */}
      {selectedCandidateId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end p-2 sm:p-4 md:p-6 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedCandidateId(null);
              setBreakdownData(null);
            }
          }}
        >
          <div className="bg-white w-full max-w-3xl lg:max-w-4xl h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] md:h-[calc(100vh-2.5rem)] rounded-3xl shadow-2xl border border-[#E5E7EB] flex flex-col overflow-hidden animate-slide-left">
            {/* 1. Floating Drawer Header (Fixed at top) */}
            <div className="p-5 sm:px-8 pb-4 border-b border-[#E5E7EB] bg-white shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#0A0A0A] text-white font-mono">
                      {docForm.ws_number || breakdownData?.candidate?.work_order_number || 'WO-2026'}
                    </span>
                    <span className="text-xs text-[#6B7280] font-medium">
                      ID: {breakdownData?.candidate?.workorder_id || selectedCandidateId}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-[#0A0A0A] mt-1.5">
                    {docForm.deployed_personnel || breakdownData?.candidate?.name || 'Candidate Work Order & Billing'}
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {docForm.role || breakdownData?.candidate?.role} · {docForm.company_name || breakdownData?.candidate?.company_name}
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

              {/* 4-Stage Governance & Settlement Timeline */}
              <div className="mt-3.5 no-print">
                <WorkOrderProgressBar
                  status={docForm.status || breakdownData?.sow_status}
                  paymentStatus={breakdownData?.billing_status}
                  variant="full"
                />
              </div>

              {/* Top Drawer Tab Switcher */}
              <div className="flex items-center gap-3 mt-4 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('pdf')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeDrawerTab === 'pdf'
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Work Order Document (Editable PDF)</span>
                  {docForm.status && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                      activeDrawerTab === 'pdf' ? 'bg-white/20 text-white' : 'bg-white text-gray-700'
                    }`}>
                      {docForm.status}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('timesheet')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeDrawerTab === 'timesheet'
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Timesheet & Calculations</span>
                </button>
              </div>
            </div>

            {/* 2. Inbuilt Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-6 custom-scrollbar bg-[#F9FAFB]">
              {loadingBreakdown ? (
                <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                  <p className="text-sm text-[#6B7280] mt-3 font-medium">Loading Work Order document and timesheets...</p>
                </div>
              ) : breakdownError ? (
                <div className="p-6 my-6 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-200">
                  {breakdownError}
                </div>
              ) : activeDrawerTab === 'pdf' ? (
                /* TAB 1: EDITABLE PDF WORK ORDER DOCUMENT VIEW */
                <div className="space-y-4">
                  {/* Top Document Tool / Action Bar */}
                  <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingDoc(!isEditingDoc)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isEditingDoc
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                      >
                        {isEditingDoc ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-amber-600" />}
                        <span>{isEditingDoc ? 'View Clean PDF' : 'Edit Document Details'}</span>
                      </button>

                      {isEditingDoc && (
                        <button
                          type="button"
                          onClick={handleSaveDocDraft}
                          disabled={isSavingDoc}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingDoc ? 'Saving...' : 'Save Draft'}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrintPdf}
                        className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-gray-200"
                        title="Print or Save as PDF via Browser"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print / Save PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDispatchSow(selectedCandidateId)}
                        disabled={isDispatchingSow}
                        className="px-4 py-1.5 bg-[#22C55E] hover:bg-[#16a34a] text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch to Procurement</span>
                      </button>
                    </div>
                  </div>

                  {/* EDIT MODE BANNER */}
                  {isEditingDoc && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between no-print">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Document Edit Mode Active:</strong> You can modify personnel, role, place of work, billing rate (₹/hr), and signatories below. Rates recalculate live.
                        </span>
                      </div>
                      <button
                        onClick={handleSaveDocDraft}
                        className="font-bold underline text-amber-800 hover:text-amber-950 cursor-pointer shrink-0 ml-2"
                      >
                        Save Draft
                      </button>
                    </div>
                  )}

                  {/* REALISTIC PHYSICAL PDF PAPER CONTAINER */}
                  <div
                    id="printable-work-order-doc"
                    className="bg-white rounded-2xl border border-gray-300 shadow-xl p-6 sm:p-10 text-gray-900 font-sans space-y-7 transition-all"
                  >
                    {/* Document Header & Legal Preamble */}
                    <div className="border-b-2 border-gray-900 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="text-[11px] font-extrabold tracking-widest text-gray-500 uppercase flex items-center gap-1.5">
                          <span>STATEMENT OF WORK & WORK ORDER</span>
                          <span>·</span>
                          <span className="text-black font-black">MONTHLY BILLING CYCLE</span>
                        </div>
                        <h2 className="text-2xl font-black text-black tracking-tight mt-1 flex items-center gap-2">
                          <span>WORK STATEMENT:</span>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.ws_number}
                              onChange={(e) => handleDocFieldChange('ws_number', e.target.value)}
                              className="bg-amber-100 font-black text-amber-950 px-2 py-0.5 rounded text-xl border border-amber-300 focus:outline-none"
                            />
                          ) : (
                            <span className="font-mono">{docForm.ws_number || 'WO-2026'}</span>
                          )}
                        </h2>
                        <p className="text-xs text-gray-600 mt-1">
                          Issued under Master Service Agreement{' '}
                          <span className="font-bold text-gray-900">{docForm.msa_ref || 'MSA-2026-TERMS'}</span> ·{' '}
                          <span className="font-semibold text-gray-900">{docForm.company_name || 'Client Company'}</span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                          docForm.status === 'Approved by Director' || docForm.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : docForm.status === 'Pending Director Approval' || docForm.status === 'Approved by Procurement'
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                            : docForm.status === 'Sent to Procurement'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        }`}>
                          {docForm.status || 'Draft'}
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono">
                          Period: {breakdownData?.period_label || 'September 2026'}
                        </span>
                      </div>
                    </div>

                    {/* SECTION 1: PERSONNEL & ENGAGEMENT SCOPE */}
                    <div>
                      <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-black"></span>
                        1. Personnel and Engagement Scope
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Deployed Personnel</div>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.deployed_personnel}
                              onChange={(e) => handleDocFieldChange('deployed_personnel', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.deployed_personnel || '—'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Designation / Role</div>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.role}
                              onChange={(e) => handleDocFieldChange('role', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.role || '—'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Reporting Manager</div>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.reporting_to}
                              onChange={(e) => handleDocFieldChange('reporting_to', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.reporting_to || '—'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Place of Work</div>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.place_of_work}
                              onChange={(e) => handleDocFieldChange('place_of_work', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.place_of_work || '—'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Commencement Date</div>
                          {isEditingDoc ? (
                            <input
                              type="date"
                              value={docForm.commencement}
                              onChange={(e) => handleDocFieldChange('commencement', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.commencement || '2026-09-01'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Expiry Date</div>
                          {isEditingDoc ? (
                            <input
                              type="date"
                              value={docForm.expiry}
                              onChange={(e) => handleDocFieldChange('expiry', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.expiry || '2027-08-31'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Duration</div>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.duration}
                              onChange={(e) => handleDocFieldChange('duration', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.duration || '12 Months'}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Talent Vendor</div>
                          <div className="text-sm font-bold text-black mt-0.5">{docForm.supplier_name || 'Asimovex / Term-Jobs'}</div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: MSA CHARGES & BILLING RATES */}
                    <div>
                      <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-black"></span>
                        2. MSA Billing Rate & Overtime Terms
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Base Hourly Rate (₹)</div>
                          {isEditingDoc ? (
                            <input
                              type="number"
                              value={docForm.raw_charge_rate}
                              onChange={(e) => handleDocFieldChange('raw_charge_rate', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-black px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-base font-black text-black mt-0.5">₹{calculatedBaseRate}/hr</div>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Billing Cycle</div>
                          <div className="text-sm font-bold text-black mt-0.5">{docForm.billing_cycle || 'Monthly'}</div>
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Overtime Multiplier</div>
                          <div className="text-sm font-bold text-emerald-700 mt-0.5">1.5× (₹{(calculatedBaseRate * 1.5).toLocaleString()}/hr)</div>
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold text-gray-500">Payment Terms</div>
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.payment_terms}
                              onChange={(e) => handleDocFieldChange('payment_terms', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none mt-1"
                            />
                          ) : (
                            <div className="text-sm font-bold text-black mt-0.5">{docForm.payment_terms || 'Net 30 days'}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: APPROVED TIMESHEET HOURS BREAKDOWN */}
                    <div>
                      <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-black"></span>
                        3. Approved Timesheet Hours & Overtime Breakdown
                      </h3>

                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[11px] border-b border-gray-200">
                            <tr>
                              <th className="py-3 px-4">Hour Type</th>
                              <th className="py-3 px-4">Hours Approved</th>
                              <th className="py-3 px-4">Billing Rate / Multiplier</th>
                              <th className="py-3 px-4 text-right">Line Total Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-gray-900">
                            <tr>
                              <td className="py-3 px-4 font-bold">Standard Regular Hours</td>
                              <td className="py-3 px-4">
                                {isEditingDoc ? (
                                  <input
                                    type="number"
                                    value={docForm.regular_hours}
                                    onChange={(e) => handleDocFieldChange('regular_hours', e.target.value)}
                                    className="bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded text-xs w-20 border border-amber-300 focus:outline-none"
                                  />
                                ) : (
                                  <span>{calculatedRegHrs} hrs</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-medium">₹{calculatedBaseRate} / hr</td>
                              <td className="py-3 px-4 text-right font-bold text-black">
                                ₹{calculatedDocBaseCost.toLocaleString()}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-3 px-4 font-bold text-emerald-800">Overtime Hours (&gt;40h/wk)</td>
                              <td className="py-3 px-4">
                                {isEditingDoc ? (
                                  <input
                                    type="number"
                                    value={docForm.overtime_hours}
                                    onChange={(e) => handleDocFieldChange('overtime_hours', e.target.value)}
                                    className="bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded text-xs w-20 border border-amber-300 focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-emerald-800 font-bold">{calculatedOtHrs} hrs</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-emerald-800 font-semibold">
                                1.5× Rate (₹{(calculatedBaseRate * 1.5).toLocaleString()} / hr)
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-800">
                                ₹{calculatedDocOtCost.toLocaleString()}
                              </td>
                            </tr>

                            <tr className="bg-gray-50 font-extrabold text-xs">
                              <td colSpan="3" className="py-3 px-4 text-right text-gray-700">Subtotal Hours Billing:</td>
                              <td className="py-3 px-4 text-right text-black">
                                ₹{(calculatedDocBaseCost + calculatedDocOtCost).toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SECTION 4: APPROVED EXPENSES */}
                    {docForm.expense_items && docForm.expense_items.length > 0 && (
                      <div>
                        <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-black"></span>
                          4. Approved Expenses (Hiring Manager Verified)
                        </h3>

                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[11px] border-b border-gray-200">
                              <tr>
                                <th className="py-2.5 px-4">Category</th>
                                <th className="py-2.5 px-4">Description</th>
                                <th className="py-2.5 px-4">Approval Date</th>
                                <th className="py-2.5 px-4 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-gray-900">
                              {docForm.expense_items.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="py-2.5 px-4 font-bold">{item.category}</td>
                                  <td className="py-2.5 px-4 text-gray-600">{item.description || item.notes || item.merchant || '—'}</td>
                                  <td className="py-2.5 px-4">{item.approved_at || item.date || '—'}</td>
                                  <td className="py-2.5 px-4 text-right font-bold">₹{parseFloat(item.amount || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-extrabold text-xs">
                                <td colSpan="3" className="py-2.5 px-4 text-right text-gray-700">Subtotal Expenses:</td>
                                <td className="py-2.5 px-4 text-right text-black">₹{calculatedDocExpenses.toLocaleString()}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* GRAND TOTAL INVOICE SUMMARY BOX */}
                    <div className="bg-black text-white p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                      <div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          TOTAL WORK ORDER & BILLING DISPATCH AMOUNT
                        </div>
                        <div className="text-3xl font-black text-[#22C55E] tracking-tight mt-1">
                          ₹{calculatedDocGrandTotal.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 font-medium">
                          Base Pay (₹{calculatedDocBaseCost.toLocaleString()}) + Overtime (₹{calculatedDocOtCost.toLocaleString()}) + Approved Expenses (₹{calculatedDocExpenses.toLocaleString()})
                        </div>
                      </div>

                      <div className="flex items-center gap-2 no-print">
                        <button
                          type="button"
                          onClick={() => handleDispatchSow(selectedCandidateId)}
                          disabled={isDispatchingSow}
                          className="px-5 py-2.5 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
                        >
                          {isDispatchingSow ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          <span>{docForm.status === 'Sent to Procurement' ? 'Re-send to Procurement' : 'Send to Procurement'}</span>
                        </button>
                      </div>
                    </div>

                    {/* SECTION 5: SIGNATURE BLOCKS */}
                    <div className="pt-6 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
                      <div>
                        <div className="border-b border-gray-900 pb-2">
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.signatory_supplier}
                              onChange={(e) => handleDocFieldChange('signatory_supplier', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none"
                            />
                          ) : (
                            <span className="font-bold text-black">{docForm.signatory_supplier || 'Authorised Talent Partner'}</span>
                          )}
                        </div>
                        <div className="text-gray-600 mt-1 font-medium">For {docForm.supplier_name || 'Asimovex / Term-Jobs'}</div>
                      </div>

                      <div>
                        <div className="border-b border-gray-900 pb-2">
                          {isEditingDoc ? (
                            <input
                              type="text"
                              value={docForm.signatory_company}
                              onChange={(e) => handleDocFieldChange('signatory_company', e.target.value)}
                              className="bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded text-xs w-full border border-amber-300 focus:outline-none"
                            />
                          ) : (
                            <span className="font-bold text-black">{docForm.signatory_company || 'Procurement Director / Authorized Officer'}</span>
                          )}
                        </div>
                        <div className="text-gray-600 mt-1 font-medium">For {docForm.company_name || 'Client Company'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: DETAILED TIMESHEET BREAKDOWN & COMMERCIAL CALCULATIONS */
                <>
                  {/* PROCUREMENT WORK ORDER INTEGRATION CARD */}
                  <div className="bg-[#0A0A0A] text-white p-5 rounded-2xl border border-white/10 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#22C55E]" />
                        <span className="text-xs font-bold text-[#A3A39E] uppercase tracking-wider">
                          Procurement Work Order Integration
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          breakdownData.sow?.status === 'Approved by Director' || breakdownData.sow?.status === 'Approved'
                            ? 'bg-[#22C55E] text-white'
                            : breakdownData.sow?.status === 'Pending Director Approval' || breakdownData.sow?.status === 'Approved by Procurement'
                            ? 'bg-indigo-600 text-white'
                            : breakdownData.sow?.status === 'Sent to Procurement'
                            ? 'bg-amber-500 text-white'
                            : breakdownData.sow?.status === 'Revision Requested'
                            ? 'bg-red-500 text-white'
                            : 'bg-white/20 text-gray-200'
                        }`}
                      >
                        {breakdownData.sow?.status || 'Draft Work Order'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="text-[#A3A39E] text-[10.5px] font-medium">Target Company Procurement</div>
                        <div className="font-bold text-white mt-0.5">{breakdownData.candidate?.company_name || 'Enterprise Client'}</div>
                      </div>
                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="text-[#A3A39E] text-[10.5px] font-medium">Delivery Status</div>
                        <div className="font-bold text-[#22C55E] mt-0.5">
                          {breakdownData.sow?.submitted_at
                            ? `Submitted on ${breakdownData.sow.submitted_at.slice(0, 10)}`
                            : 'Ready to Dispatch'}
                        </div>
                      </div>
                    </div>

                    {/* Revision / Rejection Notes Callout if applicable */}
                    {breakdownData.sow?.revision_notes && (
                      <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 space-y-1">
                        <div className="font-bold text-red-400">Feedback from Procurement:</div>
                        <p>{breakdownData.sow.revision_notes}</p>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                      <div className="text-[11px] text-[#A3A39E]">
                        {breakdownData.sow?.approved_by ? (
                          <span className="text-emerald-400 font-semibold">
                            Authorized by {breakdownData.sow.approved_by}
                          </span>
                        ) : (
                          <span>Releasing delivers the Work Order package directly to client procurement.</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDispatchSow(breakdownData.candidate?.workorder_id)}
                          disabled={isDispatchingSow}
                          className="px-4 py-2 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {breakdownData.sow?.status === 'Sent to Procurement'
                              ? 'Re-send Work Order Package'
                              : breakdownData.sow?.status === 'Revision Requested'
                              ? 'Re-submit Revised Work Order'
                              : 'Dispatch Work Order to Procurement'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

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

                  {/* Overtime & Transparency Callouts */}
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
              )}
            </div>

            {/* 3. Floating Bottom Actions Bar (Fixed at bottom) */}
            {breakdownData && (
              <div className="p-4 sm:px-8 border-t border-[#E5E7EB] bg-white shrink-0 flex items-center justify-between gap-3 shadow-xs no-print">
                <div className="text-xs text-[#6B7280] font-medium">
                  {breakdownData.invoice ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Invoice {breakdownData.invoice.invoice_number} ({breakdownData.invoice.status})
                    </span>
                  ) : (
                    <span>Ready for billing generation & dispatch</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {breakdownData.invoice && breakdownData.invoice.status !== 'Paid' && (
                    <button
                      onClick={() => handleUpdateInvoiceStatus(breakdownData.invoice.id, 'Paid')}
                      className="px-4 py-2 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
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
