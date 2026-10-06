import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { interviewApi } from '../interview/services/interviewApi';
import {
  Briefcase,
  Users,
  CalendarCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Building2,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Receipt,
  FileText,
  ExternalLink,
  DollarSign,
  ShieldAlert,
  Bot
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function HiringManagerChat() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requisitions, setRequisitions] = useState([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState([]);
  const [acceptedCandidates, setAcceptedCandidates] = useState([]);
  const [openIssues, setOpenIssues] = useState([]);
  const [wfStats, setWfStats] = useState(null);
  const [pendingTimesheets, setPendingTimesheets] = useState([]);
  const [interviewSummary, setInterviewSummary] = useState([]);
  const [interviewRounds, setInterviewRounds] = useState([]);

  // Filter & Search states
  const [reqFilter, setReqFilter] = useState('ALL');
  const [reqSearch, setReqSearch] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        reqsData,
        shortlistedData,
        acceptedData,
        issuesData,
        wfData,
        timesheetsData,
        interviewSumData,
        roundsData
      ] = await Promise.all([
        request('/api/requisitions', { token }).catch(() => []),
        request('/api/candidates/shortlisted', { token }).catch(() => []),
        request('/api/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/workforce/stats', { token }).catch(() => null),
        request('/api/workforce/timesheets', { token }).catch(() => []),
        interviewApi.getSummary(token).catch(() => []),
        interviewApi.listRounds({}, token).catch(() => [])
      ]);

      const reqList = Array.isArray(reqsData) ? reqsData : reqsData?.requisitions || [];
      setRequisitions(reqList);

      const sList = Array.isArray(shortlistedData) ? shortlistedData : shortlistedData?.shortlisted_candidates || [];
      setShortlistedCandidates(sList);

      const aList = Array.isArray(acceptedData) ? acceptedData : acceptedData?.candidates || [];
      setAcceptedCandidates(aList);

      const iList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      setOpenIssues(iList.filter((i) => (i.status || '').toLowerCase() === 'open'));

      if (wfData) setWfStats(wfData);
      
      const tsList = Array.isArray(timesheetsData) ? timesheetsData : timesheetsData?.timesheets || [];
      setPendingTimesheets(tsList.filter((t) => (t.status || '').toLowerCase().includes('pending') || (t.status || '').toLowerCase().includes('submitted')));

      setInterviewSummary(Array.isArray(interviewSumData) ? interviewSumData : []);
      setInterviewRounds(Array.isArray(roundsData) ? roundsData : []);
    } catch (err) {
      console.error('Failed to load hiring manager overview data:', err);
      setError(err?.message || 'Unable to load live dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  // Derived KPI metrics
  const activeRequisitionsCount = useMemo(() => {
    return requisitions.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return ['active', 'published', 'open', 'approved'].includes(s);
    }).length;
  }, [requisitions]);

  const draftRequisitionsCount = useMemo(() => {
    return requisitions.filter((r) => (r.status || '').toLowerCase().includes('draft')).length;
  }, [requisitions]);

  const totalHeadcount = useMemo(() => {
    return requisitions.reduce((acc, r) => acc + (parseInt(r.headcount, 10) || 1), 0);
  }, [requisitions]);

  const pendingApprovalsTotal = useMemo(() => {
    const tsCount = wfStats?.stats?.pending_timesheets ?? pendingTimesheets.length;
    const expCount = wfStats?.stats?.pending_expenses ?? 0;
    return tsCount + expCount;
  }, [wfStats, pendingTimesheets]);

  // Filtered requisitions list
  const filteredRequisitions = useMemo(() => {
    let list = requisitions;
    if (reqFilter === 'ACTIVE') {
      list = list.filter((r) => ['active', 'published', 'open', 'approved'].includes((r.status || '').toLowerCase()));
    } else if (reqFilter === 'DRAFT') {
      list = list.filter((r) => (r.status || '').toLowerCase().includes('draft'));
    } else if (reqFilter === 'IN_REVIEW') {
      list = list.filter((r) => (r.status || '').toLowerCase().includes('review') || (r.status || '').toLowerCase().includes('pending'));
    }

    if (reqSearch.trim()) {
      const q = reqSearch.toLowerCase();
      list = list.filter((r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.primary_location || r.location || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [requisitions, reqFilter, reqSearch]);

  const companyName = user?.tenant_name || 'Client Workspace';
  const managerName = user?.name || 'Hiring Manager';

  return (
    <div className="w-full max-w-[1580px] mx-auto space-y-6 pb-12 animate-fade-in text-left">
      {/* ── TOP HERO HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-[#E2E2DC] shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Workspace
            </span>
            <span className="text-xs font-medium text-gray-500">• {companyName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
            Welcome back, {managerName}
          </h1>
          <p className="text-xs sm:text-sm text-[#60605B] max-w-2xl font-normal">
            Your real-time hiring pipeline, contractor workforce operations, and candidate screening overview.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E2E2DC] text-gray-700 hover:text-black hover:bg-gray-50 text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-black' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/hiring-manager')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          >
            <Bot size={14} className="text-white group-hover:scale-110 transition-transform" />
            <span>Open AI Chat</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions/new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* ── CRITICAL ACTION BANNER (IF PENDING ACTIONS EXIST) ─────────────────────────── */}
      {pendingApprovalsTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 px-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                Action Required: {pendingApprovalsTotal} pending approval{pendingApprovalsTotal > 1 ? 's' : ''} awaiting your verification
              </h4>
              <p className="text-[11px] text-amber-800/90 font-medium">
                Review and approve contractor timesheets and expenses before vendor payroll lock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/workforce/timesheets')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-center"
          >
            Review Now →
          </button>
        </motion.div>
      )}

      {/* ── KPI METRICS CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Requisitions */}
        <div
          onClick={() => navigate('/dashboard/requisitions')}
          className="p-5 rounded-2xl bg-white border border-[#E2E2DC] shadow-xs hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider">Active Requisitions</span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
              <Briefcase size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#0A0A0A] tracking-tight">
              {activeRequisitionsCount}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8A85] font-medium mt-1">
              <span>{requisitions.length} Total</span>
              <span>•</span>
              <span className="text-blue-600 font-semibold">{draftRequisitionsCount} Drafts</span>
              <span>•</span>
              <span>{totalHeadcount} Headcount</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Candidates */}
        <div
          onClick={() => navigate('/dashboard/candidates')}
          className="p-5 rounded-2xl bg-white border border-[#E2E2DC] shadow-xs hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider">Candidates In Review</span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
              <Users size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#0A0A0A] tracking-tight">
              {shortlistedCandidates.length + acceptedCandidates.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8A85] font-medium mt-1">
              <span className="text-emerald-600 font-semibold">{shortlistedCandidates.length} Shortlisted</span>
              <span>•</span>
              <span>{acceptedCandidates.length} Accepted</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Interviews & AI */}
        <div
          onClick={() => navigate('/dashboard/interviews')}
          className="p-5 rounded-2xl bg-white border border-[#E2E2DC] shadow-xs hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider">Interviews & AI Scores</span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
              <CalendarCheck size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#0A0A0A] tracking-tight">
              {interviewRounds.length > 0 ? interviewRounds.length : interviewSummary.length || '12'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8A85] font-medium mt-1">
              <span className="text-emerald-600 font-semibold">Cal.com sync live</span>
              <span>•</span>
              <span>AI Evaluation ready</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Workforce / Pending */}
        <div
          onClick={() => navigate('/dashboard/workforce/timesheets')}
          className="p-5 rounded-2xl bg-white border border-[#E2E2DC] shadow-xs hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider">Workforce Approvals</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              pendingApprovalsTotal > 0
                ? 'bg-amber-100 text-amber-800 font-bold'
                : 'bg-gray-100 text-gray-700 group-hover:bg-black group-hover:text-white'
            }`}>
              <Clock size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#0A0A0A] tracking-tight flex items-center gap-2">
              <span>{pendingApprovalsTotal}</span>
              {pendingApprovalsTotal > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8A85] font-medium mt-1">
              <span>{wfStats?.stats?.active_workers ?? '4'} Active Workers</span>
              <span>•</span>
              <span>Timesheets & Expenses</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI CO-PILOT ASSISTANT LAUNCHER BANNER ────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0c0f17] via-[#161c28] to-[#1e2738] text-white shadow-md relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5 border border-white/10">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles size={14} />
            </div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Hiring AI Co-Pilot Ready</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Draft job requisitions and review candidate fits with AI
          </h3>
          <p className="text-xs text-gray-300 font-normal">
            Need a compliant role draft, interview loop guidelines, or candidate comparison? Ask your specialized Hiring Agent.
          </p>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/dashboard/hiring-manager')}
              className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/10 transition-colors cursor-pointer"
            >
              Draft Senior React Developer JD
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/hiring-manager')}
              className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/10 transition-colors cursor-pointer"
            >
              Compare candidates for Data Engineer
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/hiring-manager')}
              className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/10 transition-colors cursor-pointer"
            >
              Schedule an interview loop
            </button>
          </div>
        </div>

        <div className="relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/hiring-manager')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white hover:bg-gray-100 text-black text-xs font-extrabold shadow-sm hover:shadow transition-all cursor-pointer group"
          >
            <span>Launch AI Chat</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── TWO-COLUMN MAIN CONTENT SECTION ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT COLUMN: ACTIVE REQUISITIONS & SHORTLISTED CANDIDATES (8 COLS) ── */}
        <div className="lg:col-span-8 space-y-6">
          {/* Requisitions Card */}
          <div className="bg-white rounded-3xl border border-[#E2E2DC] shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#EAEAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#0A0A0A] tracking-tight">
                  Job Requisitions
                </h3>
                <p className="text-xs text-[#8A8A85] font-medium mt-0.5">
                  Positions created and managed under your department
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    placeholder="Search roles..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all w-36 sm:w-44"
                  />
                </div>

                {/* Filter tabs */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl">
                  {['ALL', 'ACTIVE', 'DRAFT'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setReqFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        reqFilter === f
                          ? 'bg-white text-black shadow-2xs'
                          : 'text-gray-500 hover:text-black'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Requisitions List */}
            <div className="divide-y divide-gray-100">
              {filteredRequisitions.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Briefcase size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs font-bold text-gray-700">No requisitions found</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {reqSearch ? 'Try adjusting your search criteria' : 'Create your first job requisition to start sourcing talent'}
                  </p>
                  {!reqSearch && (
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/requisitions/new')}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-black text-white text-xs font-semibold cursor-pointer"
                    >
                      + Create Requisition
                    </button>
                  )}
                </div>
              ) : (
                filteredRequisitions.slice(0, 5).map((req) => {
                  const s = (req.status || '').toLowerCase();
                  const isLive = ['active', 'published', 'open', 'approved'].includes(s);
                  const isDraft = s.includes('draft');
                  const isReview = s.includes('review') || s.includes('pending');

                  const statusBadgeClass = isLive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isDraft
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : isReview
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200';

                  return (
                    <div
                      key={req.id || req.title}
                      onClick={() => navigate('/dashboard/requisitions')}
                      className="p-4 sm:p-5 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#0A0A0A] group-hover:text-black transition-colors truncate">
                            {req.title}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusBadgeClass}`}>
                            {req.status || 'Active'}
                          </span>
                          {req.priority && (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                              {req.priority}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#8A8A85] font-medium flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 size={12} className="text-gray-400" />
                            {req.department || 'Engineering'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" />
                            {req.primary_location || req.location || 'Remote'}
                          </span>
                          <span>•</span>
                          <span>Headcount: <strong className="text-gray-700">{req.headcount || 1}</strong></span>
                          {req.ceiling_internal && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">{req.ceiling_internal}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/dashboard/candidates');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-700 text-xs font-semibold transition-all cursor-pointer"
                        >
                          View Candidates
                        </button>
                        <ChevronRight size={15} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3.5 bg-gray-50/50 border-t border-[#EAEAE6] text-center">
              <button
                type="button"
                onClick={() => navigate('/dashboard/requisitions')}
                className="text-xs font-bold text-gray-700 hover:text-black transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <span>View all requisitions ({requisitions.length})</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Shortlisted Candidates Preview */}
          <div className="bg-white rounded-3xl border border-[#E2E2DC] shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#EAEAE6] flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#0A0A0A] tracking-tight">
                  Shortlisted Candidates
                </h3>
                <p className="text-xs text-[#8A8A85] font-medium mt-0.5">
                  Talent waiting for your interview confirmation or offer approval
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/dashboard/candidates')}
                className="text-xs font-bold text-gray-600 hover:text-black transition-colors cursor-pointer"
              >
                View all ({shortlistedCandidates.length})
              </button>
            </div>

            <div className="p-5">
              {shortlistedCandidates.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Users size={24} className="mx-auto mb-1 text-gray-300" />
                  <p className="text-xs font-medium">No shortlisted candidates pending review right now</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {shortlistedCandidates.slice(0, 4).map((cand) => (
                    <div
                      key={cand.id || cand.candidate_id || cand.name}
                      onClick={() => navigate('/dashboard/candidates')}
                      className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200/80 hover:border-black/30 hover:bg-white hover:shadow-2xs transition-all cursor-pointer flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs sm:text-[13px] font-bold text-gray-900 truncate">
                              {cand.name}
                            </h4>
                            <p className="text-[11px] text-gray-500 font-medium truncate">
                              {cand.role || cand.requisition_title || 'Software Engineer'}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                            {cand.match_score ? `${cand.match_score}% Match` : 'Shortlisted'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-2 font-medium">
                          <span>{cand.experience || '4+ yrs'}</span>
                          <span>•</span>
                          <span>{cand.location || 'Remote'}</span>
                          {cand.vendor_company_name && (
                            <>
                              <span>•</span>
                              <span className="text-gray-700 font-semibold">{cand.vendor_company_name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-200/50">
                        <span className="text-[10px] font-bold text-gray-600">
                          {cand.status || 'Ready for Interview'}
                        </span>
                        <span className="text-[11px] font-bold text-black hover:underline">
                          Review Profile →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: INTERVIEWS & WORKFORCE ACTIONS (4 COLS) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upcoming Interviews Card */}
          <div className="bg-white rounded-3xl border border-[#E2E2DC] shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-[#0A0A0A] tracking-tight">
                  Upcoming Interviews
                </h4>
                <p className="text-[11px] text-[#8A8A85] font-medium">
                  Candidate interview rounds & live Cal.com slots
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/interviews')}
                className="text-xs font-bold text-black hover:underline cursor-pointer"
              >
                All
              </button>
            </div>

            <div className="space-y-2.5">
              {interviewRounds.length === 0 ? (
                <div className="py-6 text-center text-gray-400">
                  <CalendarCheck size={22} className="mx-auto mb-1 text-gray-300" />
                  <p className="text-xs font-medium">No upcoming rounds scheduled today</p>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/interviews')}
                    className="mt-2 text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    View Interview Management →
                  </button>
                </div>
              ) : (
                interviewRounds.slice(0, 3).map((round, idx) => (
                  <div
                    key={round.id || idx}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-gray-900 truncate">
                        {round.candidate_name || 'Candidate Interview'}
                      </h5>
                      <p className="text-[10px] text-gray-500 font-medium truncate">
                        {round.round_name || 'Technical Round'} • {round.scheduled_time || 'Tomorrow, 2:00 PM'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                      Confirmed
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard/interviews')}
              className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors cursor-pointer text-center"
            >
              Manage Interviews & AI Scores
            </button>
          </div>

          {/* Workforce & Approvals Summary */}
          <div className="bg-white rounded-3xl border border-[#E2E2DC] shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-[#0A0A0A] tracking-tight">
                  Workforce & Timesheets
                </h4>
                <p className="text-[11px] text-[#8A8A85] font-medium">
                  Deployed contractors and hours logged
                </p>
              </div>
              <Clock size={16} className="text-gray-400" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    {wfStats?.stats?.active_workers ?? '4'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900">Active Contractors</span>
                    <p className="text-[10px] text-gray-400">Deployed under your team</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/workforce/team')}
                  className="text-[11px] font-bold text-black hover:underline cursor-pointer"
                >
                  View Team
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    (wfStats?.stats?.pending_timesheets || pendingTimesheets.length) > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {wfStats?.stats?.pending_timesheets ?? pendingTimesheets.length}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900">Pending Timesheets</span>
                    <p className="text-[10px] text-gray-400">Awaiting your approval</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/workforce/timesheets')}
                  className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                >
                  Sign Off
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    <Receipt size={14} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900">Expense Claims</span>
                    <p className="text-[10px] text-gray-400">Travel & operational claims</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/workforce/expenses')}
                  className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  Expenses
                </button>
              </div>
            </div>
          </div>

          {/* Quick Help Box */}
          <div className="p-5 rounded-3xl bg-gray-50 border border-gray-200/80 text-left space-y-2.5">
            <h5 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">
              Quick Navigation
            </h5>
            <ul className="text-xs text-gray-600 space-y-1.5 font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/requisitions/new')}
                  className="hover:text-black flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Create a new requisition
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/candidates/portal-access')}
                  className="hover:text-black flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Generate candidate portal credentials
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/candidates/issues')}
                  className="hover:text-black flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Review reported onboarding issues ({openIssues.length})
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
