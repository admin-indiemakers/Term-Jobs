import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import VendorBilling from './recruiter/VendorBilling';
import {
  Building2,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  Calendar,
  Briefcase,
  UserCheck,
  Bell,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  Trash2,
  X,
  PlusCircle,
  FileText,
  Receipt,
  DollarSign
} from 'lucide-react';

export default function SuperAdminCandidateManagement() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'billing' ? 'billing' : 'selections';

  const handleTabChange = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabKey === 'billing') {
      nextParams.set('tab', 'billing');
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams);
  };

  const [selections, setSelections] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total_selected: 0, companies_count: 0, avg_match_score: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modal / Drawer state
  const [activeCandidateDetail, setActiveCandidateDetail] = useState(null);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateForm, setSimulateForm] = useState({
    candidate_name: '',
    candidate_email: '',
    company_name: '',
    requisition_title: '',
    hiring_manager_name: '',
    match_score: '',
    notes: '',
  });

  const loadData = useCallback(async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedCompany && selectedCompany !== 'All') {
        params.append('company', selectedCompany);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (sortBy) {
        params.append('sort_by', sortBy);
      }

      const res = await request(`/api/superadmin/candidate-management?${params.toString()}`, { token });
      if (res && res.status === 'success') {
        setSelections(res.selections || []);
        if (res.companies) {
          setCompanies(res.companies);
        }
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load candidate selections:', err);
      setError(err?.message || 'Failed to load candidate management data.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedCompany, searchQuery, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Handle deleting a selection record
  const handleDeleteSelection = async (selectionId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this candidate selection record?')) {
      return;
    }
    try {
      await request(`/api/superadmin/candidate-management/${selectionId}`, {
        method: 'DELETE',
        token,
      });
      setSelections((prev) => prev.filter((s) => s.id !== selectionId && s.selection_id !== selectionId));
      setSuccessMsg('Candidate selection record removed.');
      if (activeCandidateDetail?.id === selectionId) {
        setActiveCandidateDetail(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to delete candidate selection.');
    }
  };

  // Handle simulating a candidate selection
  const handleSimulateSubmit = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setError('');
    try {
      const res = await request('/api/superadmin/candidate-management/simulate-selection', {
        method: 'POST',
        token,
        body: simulateForm,
      });
      setIsSimulateModalOpen(false);
      setSuccessMsg(`🎉 Notification sent: Candidate ${simulateForm.candidate_name} has been selected by ${simulateForm.company_name}!`);
      loadData(true);
    } catch (err) {
      setError(err?.message || 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  // Format date helper
  const formatDate = (iso) => {
    if (!iso) return 'Recent';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // Relative time helper
  const getRelativeTime = (iso) => {
    if (!iso) return 'recently';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="w-full min-w-0 pb-12 space-y-6 text-left" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1 flex items-center gap-1.5">
            <span>TERM JOBS</span>
            <span>•</span>
            <span>SUPER ADMIN CONSOLE</span>
            <span>•</span>
            <span className="text-emerald-600 font-black">
              {activeTab === 'billing' ? 'CANDIDATE BILLING & WORK ORDERS' : 'CANDIDATE MANAGEMENT'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            {activeTab === 'billing' ? 'Candidate Billing & Work Orders' : 'Candidate Management'}
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/80">
              {activeTab === 'billing' ? 'Work Orders & SOW' : 'Live Feed'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            {activeTab === 'billing'
              ? 'Candidate work order timesheets, contractor billings, approved overtime, and client SOW disbursements.'
              : 'Real-time feed and oversight of candidates shortlisted and selected by hiring managers across partner companies. Filter instantly by company.'}
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Super Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold border border-gray-200">
              {stats.total_selected} Total Selected
            </span>
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold border border-gray-200">
              {stats.companies_count || companies.length} Partner Companies
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {activeTab === 'selections' ? (
            <>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Refresh Selections"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-md"
              >
                <PlusCircle size={15} />
                <span>+ Simulate Selection</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleTabChange('selections')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UserCheck size={14} className="text-emerald-600" />
              <span>Back to Selected Candidates</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-1.5 shadow-xs flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          onClick={() => handleTabChange('selections')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'selections'
              ? 'bg-black text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <UserCheck size={16} className={activeTab === 'selections' ? 'text-white' : 'text-gray-500'} />
          <span>Selected Candidates & Live Alerts</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'selections' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
          }`}>
            {stats.total_selected || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('billing')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'billing'
              ? 'bg-black text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Receipt size={16} className={activeTab === 'billing' ? 'text-white' : 'text-gray-500'} />
          <span>Candidate Billing & Work Orders</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'billing' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            Invoicing
          </span>
        </button>
      </div>

      {activeTab === 'billing' ? (
        <div className="w-full">
          <VendorBilling isEmbedded={true} />
        </div>
      ) : (
        <>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-500 hover:text-emerald-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Selected Candidates
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              {stats.total_selected}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <Sparkles size={12} />
              <span>Shortlisted & Accepted</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Hiring Companies
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              {companies.length}
            </div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
              <Building2 size={12} />
              <span>With active selections</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Building2 size={22} />
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Avg Candidate Fit
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              {stats.avg_match_score || 92}%
            </div>
            <div className="text-[11px] text-amber-600 font-semibold mt-0.5 flex items-center gap-1">
              <TrendingUp size={12} />
              <span>AI Evaluation Score</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Award size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              <Building2 size={14} className="text-gray-500" />
              <span>Filter by Company:</span>
            </div>

            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="text-xs font-bold bg-white border border-gray-300 text-gray-900 rounded-xl px-3 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-black cursor-pointer min-w-[180px]"
            >
              <option value="All">All Companies ({selections.length})</option>
              {companies.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>

            {/* Quick Pills for Top Companies */}
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCompany('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedCompany === 'All'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {companies.slice(0, 5).map((comp) => (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setSelectedCompany(comp)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedCompany.toLowerCase() === comp.toLowerCase()
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {comp}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar & View Mode Toggle */}
          <div className="flex items-center gap-2.5">
            <div className="relative min-w-[220px] sm:min-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidate, role, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-8 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-gray-700 cursor-pointer focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="score">Highest Match</option>
              <option value="company">Company (A-Z)</option>
              <option value="name">Candidate (A-Z)</option>
            </select>

            <div className="flex items-center border border-gray-200 rounded-xl p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                }`}
                title="Notification Cards View"
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                }`}
                title="Table View"
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-3"></div>
          <div className="text-xs font-bold">Loading candidate selections...</div>
        </div>
      ) : selections.length === 0 ? (
        <div className="bg-white border border-gray-200/90 rounded-2xl p-12 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 text-gray-400 mx-auto flex items-center justify-center">
            <UserCheck size={30} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              No Selected Candidates Found
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {selectedCompany !== 'All'
                ? `No candidates have been selected by ${selectedCompany} yet.`
                : 'Whenever a hiring manager shortlists and selects a candidate, the live notification and record will appear right here.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            {selectedCompany !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedCompany('All')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Clear Company Filter
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSimulateModalOpen(true)}
              className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              + Simulate Demo Selection
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Notification Cards Feed */
        <div className="space-y-3.5">
          {selections.map((cand) => (
            <div
              key={cand.id || cand.selection_id}
              onClick={() => setActiveCandidateDetail(cand)}
              className="bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all cursor-pointer relative group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Left side: Notification Headline & Details */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  {/* Notification Banner Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>Selected by Company</span>
                    </span>

                    <span className="text-xs text-gray-400 font-medium">
                      • {getRelativeTime(cand.selected_at)}
                    </span>

                    <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
                      ({formatDate(cand.selected_at)})
                    </span>
                  </div>

                  {/* Primary Notification Message Text */}
                  <div className="text-base sm:text-lg font-black text-gray-950 tracking-tight leading-snug">
                    Candidate <span className="text-emerald-700 underline decoration-emerald-300 underline-offset-4">{cand.candidate_name}</span> has been selected by <span className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/80">{cand.company_name}</span>
                  </div>

                  {/* Role, Requisition and Hiring Manager Meta */}
                  <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap pt-0.5">
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                      <Briefcase size={13} className="text-gray-500 shrink-0" />
                      <span className="font-semibold text-gray-900">{cand.requisition_title || 'Role'}</span>
                      {cand.requisition_ref && (
                        <span className="text-gray-400 text-[11px] font-mono">({cand.requisition_ref})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500">
                      <UserCheck size={13} className="text-gray-400 shrink-0" />
                      <span>Hiring Manager: <strong className="text-gray-800">{cand.hiring_manager_name || 'Hiring Manager'}</strong></span>
                    </div>

                    {cand.candidate_email && (
                      <div className="text-gray-400 text-xs truncate">
                        ✉ {cand.candidate_email}
                      </div>
                    )}
                  </div>

                  {/* Notes / Remarks if available */}
                  {cand.notes && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 max-w-3xl">
                      <span className="font-bold text-amber-950">Manager Note: </span>
                      {cand.notes}
                    </div>
                  )}
                </div>

                {/* Right side: Score Pill & Action Buttons */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-black shadow-2xs">
                    <Award size={13} className="text-amber-400" />
                    <span>{Math.round(cand.match_score || 92)}% Fit</span>
                  </div>

                  <div className="flex items-center gap-1 pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCandidateDetail(cand);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSelection(cand.id || cand.selection_id, e)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition cursor-pointer"
                      title="Remove record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Structured Table View */
        <div className="bg-white border border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-900 uppercase font-extrabold text-[10.5px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-4">Selected By (Company)</th>
                  <th className="py-3.5 px-4">Role / Requisition</th>
                  <th className="py-3.5 px-4">Hiring Manager</th>
                  <th className="py-3.5 px-4">Match Fit</th>
                  <th className="py-3.5 px-4">Selected At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selections.map((cand) => (
                  <tr
                    key={cand.id || cand.selection_id}
                    onClick={() => setActiveCandidateDetail(cand)}
                    className="hover:bg-gray-50/80 transition cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-gray-950 text-[13px]">
                        {cand.candidate_name}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {cand.candidate_email || 'No email provided'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200/90 font-bold text-gray-900">
                        <Building2 size={12} className="text-gray-500" />
                        <span>{cand.company_name}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">
                        {cand.requisition_title || 'Position'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {cand.requisition_ref}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-800">
                      {cand.hiring_manager_name || 'Hiring Manager'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-black text-[11px] border border-emerald-200">
                        {Math.round(cand.match_score || 92)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                      {formatDate(cand.selected_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSelection(cand.id || cand.selection_id, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Candidate Detail Modal / Drawer */}
      {activeCandidateDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                  ● Candidate Selected
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  {activeCandidateDetail.candidate_name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Selected by {activeCandidateDetail.company_name} on {formatDate(activeCandidateDetail.selected_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCandidateDetail(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-gray-900 text-sm">
                  {activeCandidateDetail.notification_message}
                </div>
                <div className="text-gray-500">
                  {activeCandidateDetail.notes || 'Hiring manager confirmed candidate acceptance for onboarding.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Company</div>
                  <div className="font-extrabold text-gray-900 mt-0.5">{activeCandidateDetail.company_name}</div>
                </div>

                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Match Score</div>
                  <div className="font-extrabold text-emerald-700 mt-0.5">{Math.round(activeCandidateDetail.match_score || 92)}% Match Fit</div>
                </div>

                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Role / Title</div>
                  <div className="font-bold text-gray-900 mt-0.5 truncate">{activeCandidateDetail.requisition_title || 'Software Professional'}</div>
                </div>

                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Hiring Manager</div>
                  <div className="font-bold text-gray-900 mt-0.5 truncate">{activeCandidateDetail.hiring_manager_name || 'Hiring Manager'}</div>
                </div>

                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 col-span-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Candidate Email</div>
                  <div className="font-semibold text-gray-800 mt-0.5">{activeCandidateDetail.candidate_email || 'Not provided'}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={(e) => handleDeleteSelection(activeCandidateDetail.id || activeCandidateDetail.selection_id, e)}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition cursor-pointer"
              >
                Delete Record
              </button>

              <button
                type="button"
                onClick={() => setActiveCandidateDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Simulate Selection Modal */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">
                  Simulate Candidate Selection
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Test the Hiring Manager selection alert in real time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSimulateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Candidate Name</label>
                <input
                  type="text"
                  required
                  value={simulateForm.candidate_name}
                  onChange={(e) => setSimulateForm({ ...simulateForm, candidate_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={simulateForm.company_name}
                  onChange={(e) => setSimulateForm({ ...simulateForm, company_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Requisition / Role</label>
                <input
                  type="text"
                  required
                  value={simulateForm.requisition_title}
                  onChange={(e) => setSimulateForm({ ...simulateForm, requisition_title: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Hiring Manager Name</label>
                <input
                  type="text"
                  required
                  value={simulateForm.hiring_manager_name}
                  onChange={(e) => setSimulateForm({ ...simulateForm, hiring_manager_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSimulateModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                >
                  {simulating ? 'Sending...' : 'Trigger Selection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
