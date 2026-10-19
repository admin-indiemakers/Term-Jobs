import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import VendorBilling from './recruiter/VendorBilling';
import CandidateOfferLetterSection from '../components/CandidateOfferLetterSection';
import { isValidCompanyName } from '../utils/adminDashboard';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Award,
  Layers,
  Trash2,
  X,
  PlusCircle,
  FileText,
  Receipt,
  DollarSign,
  Zap,
  LogOut
} from 'lucide-react';

const formatMatchScore = (score) => {
  const value = Number(score);
  return score !== null && score !== undefined && score !== '' && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : '—';
};

export default function SuperAdminCandidateManagement() {
  const { token, user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'billing' ? 'billing' : rawTab === 'contracts' ? 'contracts' : 'selections';

  const handleTabChange = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabKey === 'billing' || tabKey === 'contracts') {
      nextParams.set('tab', tabKey);
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams);
  };

  const [contractCandidate, setContractCandidate] = useState(null);

  const [selections, setSelections] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total_selected: 0, companies_count: 0, avg_match_score: null, scored_candidates_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Pagination for high-volume feeds
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10, 25, 50

  // Reset to first page when company, search, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompany, searchQuery, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(selections.length / pageSize));
  const paginatedSelections = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return selections.slice(startIndex, startIndex + pageSize);
  }, [selections, currentPage, pageSize]);

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
          const validCompanies = (res.companies || []).filter(isValidCompanyName);
          setCompanies(validCompanies);
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
    <div className="w-full min-w-0 pb-16 space-y-4 text-left" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Top Header: Unboxed, Transparent, Clean Big Typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-emerald-800 tracking-wider uppercase mb-1 flex items-center gap-1.5 flex-wrap">
            <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">TERM JOBS</span>
            <span>•</span>
            <span>SUPER ADMIN CONSOLE</span>
            <span>•</span>
            <span className="text-emerald-700 font-black">
              {activeTab === 'billing'
                ? 'CANDIDATE BILLING & WORK ORDERS'
                : activeTab === 'contracts'
                ? 'EMPLOYMENT CONTRACTS & OFFER LETTERS'
                : 'CANDIDATE MANAGEMENT'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {activeTab === 'billing'
              ? 'Candidate Billing & Work Orders'
              : activeTab === 'contracts'
              ? 'Employment Contracts & Offer Letters'
              : 'Candidate Selections'}
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80">
              {activeTab === 'billing' ? 'Work Orders & SOW' : activeTab === 'contracts' ? '5-Page Legal PDF' : 'Live Feed'}
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            {activeTab === 'billing'
              ? 'Candidate work order timesheets, contractor billings, approved overtime, and client SOW disbursements.'
              : activeTab === 'contracts'
              ? 'Review, customize CTC salary breakdowns & legal terms, and issue formal 5-page employment agreements to selected candidates.'
              : 'Real-time feed and oversight of candidates shortlisted and selected by hiring managers across partner companies.'}
          </p>
        </div>

        {/* Top Right Actions: Notification Bell, Refresh, 48h Shortlists, Simulate Selection & Sign out */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          <NotificationBell />

          {activeTab === 'selections' ? (
            <>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-3 py-1.5 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-gray-700 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Refresh Selections"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <Link
                to="/dashboard/interviews"
                className="px-3 py-1.5 rounded-xl border border-amber-300/80 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer no-underline active:scale-95"
                title="Open 48-Hour Shortlist Automation & Interview Scores"
              >
                <Zap size={13} className="text-amber-600 fill-current" />
                <span>48h Shortlists</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <PlusCircle size={14} />
                <span>+ Simulate Selection</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleTabChange('selections')}
              className="px-3 py-1.5 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-gray-800 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <UserCheck size={14} className="text-emerald-600" />
              <span>Back to Selections</span>
            </button>
          )}

          <button
            onClick={logout}
            type="button"
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs - Rounded Glassmorphic Tab Bar Container */}
      <div className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => handleTabChange('selections')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
            activeTab === 'selections'
              ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
              : 'text-gray-700 hover:text-black hover:bg-white/60'
          }`}
        >
          <UserCheck size={14} className={activeTab === 'selections' ? 'text-emerald-600' : 'text-gray-500'} />
          <span>Selected Candidates</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'selections' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-gray-100 text-gray-600'
          }`}>
            {stats.total_selected || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('contracts')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
            activeTab === 'contracts'
              ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
              : 'text-gray-700 hover:text-black hover:bg-white/60'
          }`}
        >
          <FileText size={14} className={activeTab === 'contracts' ? 'text-teal-600' : 'text-gray-500'} />
          <span>Contracts & Offer Letters</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200/80">
            5-Page Legal
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('billing')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
            activeTab === 'billing'
              ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
              : 'text-gray-700 hover:text-black hover:bg-white/60'
          }`}
        >
          <Receipt size={14} className={activeTab === 'billing' ? 'text-amber-600' : 'text-gray-500'} />
          <span>Candidate Billing</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200/80">
            Invoicing
          </span>
        </button>
      </div>

      {activeTab === 'billing' ? (
        <div className="w-full">
          <VendorBilling isEmbedded={true} />
        </div>
      ) : activeTab === 'contracts' ? (
        <div className="w-full space-y-6">
          {/* Contracts Header / Selector */}
          {contractCandidate ? (
            <div className="space-y-4">
              <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setContractCandidate(null)}
                    className="px-3.5 py-2 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-gray-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    <span>← All Selected Candidates</span>
                  </button>
                  <div className="h-6 w-px bg-gray-200" />
                  <div>
                    <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                      SUPER ADMIN FORMAL EMPLOYMENT AGREEMENT
                    </div>
                    <div className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                      {contractCandidate.candidate_name} · <span className="text-emerald-700">{contractCandidate.company_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      {contractCandidate.requisition_title || 'Software Professional'} · {contractCandidate.candidate_email || 'No email'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-800 text-xs font-extrabold border border-emerald-500/20">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Accepted Candidate</span>
                  </span>
                </div>
              </div>

              {/* 5-Page Corporate Employment Contract Editor & Dispatch */}
              <CandidateOfferLetterSection
                candidateId={contractCandidate.id || contractCandidate.selection_id || contractCandidate.submission_id}
                candidateName={contractCandidate.candidate_name}
                candidateEmail={contractCandidate.candidate_email}
                jobTitle={contractCandidate.requisition_title || contractCandidate.candidate_title}
                companyName={contractCandidate.company_name}
                location={contractCandidate.location || 'Bengaluru / Hybrid'}
                onOfferSent={() => {
                  setSuccessMsg(`✓ Formal Employment Contract & Offer Letter sent to ${contractCandidate.candidate_name}!`);
                  loadData(true);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-extrabold text-emerald-700 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                    <span>SUPER ADMIN LEGAL CONSOLE</span>
                    <span>•</span>
                    <span>5-PAGE FORMAL AGREEMENTS</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                    Candidate Contracts & Corporate Agreements
                  </h2>
                  <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-0.5 max-w-2xl">
                    Select any accepted candidate to review, customize CTC salary breakdowns, edit legal clauses, and dispatch formal 5-page employment agreements directly to their candidate portal.
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-extrabold border border-emerald-200">
                    {selections.length} Candidates Available
                  </span>
                </div>
              </div>

              {selections.length === 0 ? (
                <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 text-gray-400 mx-auto flex items-center justify-center shadow-3xs">
                    <FileText size={26} />
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900">
                    No Candidates Selected Yet
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    When hiring managers accept candidates, they appear here for Super Admin contract drafting and formal issuance.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {selections.map((cand) => (
                    <div
                      key={cand.id || cand.selection_id}
                      className="bg-white/70 hover:bg-white/95 backdrop-blur-md border border-white/80 hover:border-emerald-300/80 rounded-2xl p-4 sm:p-5 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between gap-3.5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 text-[11px] font-extrabold border border-emerald-500/20">
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            <span>{cand.company_name}</span>
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">
                            {formatDate(cand.selected_at)}
                          </span>
                        </div>

                        <div className="text-base sm:text-lg font-black text-gray-950">
                          {cand.candidate_name}
                        </div>

                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                            <Briefcase size={13} className="text-gray-400" />
                            <span>{cand.requisition_title || 'Role'}</span>
                          </div>
                          {cand.candidate_email && (
                            <div className="text-gray-400 text-xs">
                              ✉ {cand.candidate_email}
                            </div>
                          )}
                          <div className="text-gray-500 text-xs">
                            Hiring Manager: <strong className="text-gray-700">{cand.hiring_manager_name || 'Hiring Manager'}</strong>
                          </div>
                        </div>

                        {cand.notes && (
                          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 text-xs text-amber-900 italic">
                            "{cand.notes}"
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                        <div className="text-xs font-black text-emerald-700">
                          {formatMatchScore(cand.match_score)} Match Fit
                        </div>

                        <button
                          type="button"
                          onClick={() => setContractCandidate(cand)}
                          className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <FileText size={13} />
                          <span>Draft & Issue Contract →</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {/* Main Grid: 2 Column Desktop Layout matching SuperAdminDashboard */}
      <div className="flex flex-col lg:flex-row gap-3.5 sm:gap-4 items-start w-full">
        {/* Left Column: Single Unified Glassmorphic Candidate Selections Card (Exact Requisition Overview Style) */}
        <div className="flex-1 min-w-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
          <div>
            {/* Top Controls Row: Search Input + Company & Sort Dropdowns (Matching Image 2 Reference Tab) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0 mb-1">
              {/* Search Input Bar with ⌘K Badge */}
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by candidate, role, or company..."
                  className="w-full pl-9 pr-12 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
                    <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded-md bg-white/80 border border-gray-200/80 shadow-3xs">
                      ⌘ K
                    </span>
                  </div>
                )}
              </div>

              {/* Dropdown Filters on Right (Matching Image 2 Reference Tab) */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                {/* Company Filter Dropdown */}
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={selectedCompany}
                    onChange={(e) => {
                      setSelectedCompany(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all shadow-3xs cursor-pointer focus:outline-none pr-8 appearance-none"
                  >
                    <option value="All">All Companies ({selections.length})</option>
                    {companies.map((comp) => (
                      <option key={comp} value={comp}>
                        {comp}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Sort Dropdown */}
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all shadow-3xs cursor-pointer focus:outline-none pr-8 appearance-none"
                  >
                    <option value="newest">Newest First</option>
                    <option value="score">Highest Match</option>
                    <option value="company">Company (A-Z)</option>
                    <option value="name">Candidate (A-Z)</option>
                  </select>
                  <ChevronDown size={13} className="text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Content: Loading / Empty / Single Line Rows matching Image 2 */}
            {loading ? (
              <div className="py-14 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black mr-2.5"></div>
                Loading candidate selections...
              </div>
            ) : selections.length === 0 ? (
              <div className="py-14 text-center text-xs text-gray-400 font-medium flex-1 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={24} className="text-gray-400 opacity-60" />
                <span>No candidate selections found matching your search.</span>
              </div>
            ) : (
              <div className="flex-1 min-h-0 mt-1">
                {/* Mobile View: Compact Cards (< md) */}
                <div className="block md:hidden space-y-2.5 pb-2">
                  {paginatedSelections.map((cand) => (
                    <div
                      key={cand.id || cand.selection_id}
                      onClick={() => setActiveCandidateDetail(cand)}
                      className="p-3 rounded-2xl border border-white/80 hover:border-gray-300/80 bg-white/60 hover:bg-white/90 backdrop-blur-md shadow-3xs transition-all cursor-pointer text-left"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs mt-0.5 bg-slate-900 text-white font-bold text-xs">
                            {cand.candidate_name ? cand.candidate_name.slice(0, 2).toUpperCase() : 'CA'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-[13px] leading-snug truncate hover:underline cursor-pointer">
                              {cand.candidate_name}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                              {cand.candidate_email || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200/80 shadow-3xs">
                            Selected
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-black border border-amber-200/80 shadow-3xs">
                            {formatMatchScore(cand.match_score)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-black/[0.04] flex items-center justify-between gap-2 text-xs">
                        <div className="truncate text-gray-700 font-medium text-[11px]">
                          <span>{cand.requisition_title || 'Role'}</span>
                          <span className="text-gray-400 mx-1">•</span>
                          <span className="text-gray-500 font-normal">{cand.company_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContractCandidate(cand);
                              handleTabChange('contracts');
                            }}
                            className="px-2 py-1 text-[10.5px] font-bold text-white bg-black hover:bg-gray-800 rounded-lg shadow-3xs cursor-pointer flex items-center gap-1"
                          >
                            <FileText size={11} />
                            <span>Contract</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCandidateDetail(cand);
                            }}
                            className="px-2 py-1 text-[10.5px] font-semibold text-gray-700 bg-white/80 hover:bg-white border border-gray-200/80 rounded-lg shadow-3xs cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Full Single-Line Table (>= md, exactly matching Image 2 reference tab) */}
                <div className="hidden md:block overflow-x-auto no-scrollbar">
                  <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                      <tr className="text-xs font-medium text-gray-400">
                        <th className="py-2.5 px-3">Candidate</th>
                        <th className="py-2.5 px-3">Company</th>
                        <th className="py-2.5 px-3">Role & Req</th>
                        <th className="py-2.5 px-3">Hiring Manager</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Selected On</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03]">
                      {paginatedSelections.map((cand) => (
                        <tr
                          key={cand.id || cand.selection_id}
                          className="transition-colors relative bg-transparent hover:bg-white/40 group"
                        >
                          {/* 1. Candidate Name + Email + Dark Circle Avatar */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs bg-slate-900 text-white font-bold text-xs">
                                {cand.candidate_name ? cand.candidate_name.slice(0, 2).toUpperCase() : 'CA'}
                              </div>
                              <div className="min-w-0">
                                <div
                                  onClick={() => setActiveCandidateDetail(cand)}
                                  className="font-bold text-gray-900 text-[13px] leading-tight truncate hover:underline cursor-pointer"
                                >
                                  {cand.candidate_name}
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium truncate mt-0.5 max-w-[150px]">
                                  {cand.candidate_email || '—'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Company (Pill badge styled like Image 2 Department) */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200/60 truncate max-w-[120px]">
                              {cand.company_name}
                            </span>
                          </td>

                          {/* 3. Role & Requisition */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-gray-900 text-xs truncate max-w-[160px]">
                              {cand.requisition_title || 'Role'}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                              {cand.requisition_ref ? `REQ #${cand.requisition_ref.replace('REQ-', '')}` : '—'}
                            </div>
                          </td>

                          {/* 4. Hiring Manager */}
                          <td className="py-3 px-3 text-xs text-gray-700 font-medium whitespace-nowrap">
                            {cand.hiring_manager_name || '—'}
                          </td>

                          {/* 5. Status & Fit (Emerald pill styled like Image 2 Published) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/80 shadow-3xs">
                                Selected
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10.5px] font-black border border-amber-200/80 shadow-3xs">
                                {formatMatchScore(cand.match_score)}
                              </span>
                            </div>
                          </td>

                          {/* 6. Selected On (styled like Image 2 Posted On) */}
                          <td className="py-3 px-3 whitespace-nowrap text-xs text-gray-600">
                            <div className="font-medium text-gray-800">{formatDate(cand.selected_at).split(',')[0]}</div>
                            <div className="text-[10px] text-gray-400">{getRelativeTime(cand.selected_at)}</div>
                          </td>

                          {/* 7. Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContractCandidate(cand);
                                  handleTabChange('contracts');
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-black hover:bg-gray-800 rounded-lg shadow-3xs cursor-pointer flex items-center gap-1 transition-all active:scale-95"
                              >
                                <FileText size={11} />
                                <span>Issue Contract</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCandidateDetail(cand);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-gray-700 bg-white/80 hover:bg-white border border-gray-200/80 rounded-lg shadow-3xs cursor-pointer transition-all active:scale-95"
                              >
                                Details
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDeleteSelection(cand.id || cand.selection_id, e)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove record"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Pagination Bar (Matching Image 2 Reference Tab Footer) */}
          <div className="mt-3 pt-2.5 border-t border-black/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
            <div className="text-gray-500 font-medium text-[11.5px]">
              Showing <span className="font-bold text-gray-900">{selections.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span>–<span className="font-bold text-gray-900">{Math.min(currentPage * pageSize, selections.length)}</span> of{' '}
              <span className="font-bold text-gray-900">{selections.length}</span> {selections.length === 1 ? 'candidate' : 'candidates'}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] text-gray-500 mr-2">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white/60 border border-white/80 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-gray-800 cursor-pointer focus:outline-none shadow-3xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-xl border border-white/80 bg-white/70 text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-3xs"
              >
                <ChevronLeft size={12} />
                <span>Previous</span>
              </button>

              <div className="px-1.5 font-bold text-gray-800 text-xs">
                {currentPage} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded-xl border border-white/80 bg-white/70 text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-3xs"
              >
                <span>Next</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 4 Vertical Metric Cards (Exact Super Admin Dashboard Style) */}
        <div className="w-full lg:w-60 xl:w-64 shrink-0 flex flex-col gap-3">
          {/* Metric 1: Selected Candidates */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between gap-3 hover:bg-white/50 transition-all">
            <div>
              <div className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                {stats.total_selected}
              </div>
              <div className="text-xs font-bold text-gray-700 mt-1">
                Selected Candidates
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <Sparkles size={10} />
                <span>Accepted & Shortlisted</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/80 border border-white/90 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <UserCheck size={18} />
            </div>
          </div>

          {/* Metric 2: Partner Companies */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between gap-3 hover:bg-white/50 transition-all">
            <div>
              <div className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                {companies.length}
              </div>
              <div className="text-xs font-bold text-gray-700 mt-1">
                Partner Companies
              </div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                <Building2 size={10} />
                <span>Available to filter</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/80 border border-white/90 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 size={18} />
            </div>
          </div>

          {/* Metric 3: Avg Candidate Fit */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between gap-3 hover:bg-white/50 transition-all">
            <div>
              <div className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                {stats.avg_match_score == null ? '—' : `${stats.avg_match_score}%`}
              </div>
              <div className="text-xs font-bold text-gray-700 mt-1">
                Avg Candidate Fit
              </div>
              <div className="text-[10px] text-amber-600 font-semibold mt-0.5 flex items-center gap-1 truncate">
                <TrendingUp size={10} />
                <span>{stats.scored_candidates_count ? `${stats.scored_candidates_count} scored` : 'No scored yet'}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/80 border border-white/90 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Award size={18} />
            </div>
          </div>

          {/* Metric 4: Quick Shortcuts / Automation */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-gray-900 tracking-tight">Quick Shortcuts</div>
              <span className="text-[10px] text-gray-400 font-semibold">Super Admin</span>
            </div>

            <Link
              to="/dashboard/interviews"
              className="w-full p-2.5 rounded-xl bg-white/70 hover:bg-white border border-white/80 text-amber-900 text-xs font-bold transition flex items-center justify-between shadow-3xs cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Zap size={12} className="fill-amber-500" />
                </div>
                <span className="truncate">48h Shortlists</span>
              </div>
              <ChevronRight size={13} className="text-gray-400 group-hover:text-black transition-colors" />
            </Link>

            <button
              type="button"
              onClick={() => setIsSimulateModalOpen(true)}
              className="w-full p-2.5 rounded-xl bg-white/70 hover:bg-white border border-white/80 text-gray-800 text-xs font-bold transition flex items-center justify-between shadow-3xs cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0">
                  <PlusCircle size={12} />
                </div>
                <span className="truncate">+ Simulate Selection</span>
              </div>
              <ChevronRight size={13} className="text-gray-400 group-hover:text-black transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Candidate Detail Modal / Drawer */}
      {activeCandidateDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
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
              <div className="bg-white/70 border border-gray-200/80 rounded-2xl p-4 space-y-2 shadow-3xs">
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
                  <div className="font-extrabold text-emerald-700 mt-0.5">{formatMatchScore(activeCandidateDetail.match_score)} Match Fit</div>
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

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-100 flex-wrap">
              <button
                type="button"
                onClick={(e) => handleDeleteSelection(activeCandidateDetail.id || activeCandidateDetail.selection_id, e)}
                className="px-3.5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition cursor-pointer"
              >
                Delete Record
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cand = activeCandidateDetail;
                    setActiveCandidateDetail(null);
                    setContractCandidate(cand);
                    handleTabChange('contracts');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <FileText size={14} />
                  <span>Draft & Issue Contract →</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCandidateDetail(null)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Simulate Selection Modal */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/80 rounded-3xl max-w-md w-full p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] space-y-4 animate-scaleUp">
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
              <p className="text-gray-500">Fields marked <span className="font-bold text-red-600">*</span> are required.</p>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Candidate Name <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  required
                  value={simulateForm.candidate_name}
                  onChange={(e) => setSimulateForm({ ...simulateForm, candidate_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Company Name <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  required
                  value={simulateForm.company_name}
                  onChange={(e) => setSimulateForm({ ...simulateForm, company_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Requisition / Role <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  required
                  value={simulateForm.requisition_title}
                  onChange={(e) => setSimulateForm({ ...simulateForm, requisition_title: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Hiring Manager Name <span className="font-normal text-gray-500">(optional)</span></label>
                <input
                  type="text"
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
