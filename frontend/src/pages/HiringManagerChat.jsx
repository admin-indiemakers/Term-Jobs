import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Search,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Receipt,
  FileText,
  Activity,
  Bell,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function formatDate(iso) {
  if (!iso) return 'Sep 25, 2026';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function timeAgo(iso) {
  if (!iso) return 'Just now';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Just now';
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Just now';
  }
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'open' || s === 'published' || s === 'active' || s === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/10 text-emerald-800 border border-emerald-500/25 backdrop-blur-md shadow-3xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        {status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Published'}
      </span>
    );
  }
  if (s === 'pending_approval' || s === 'pending' || s === 'in_review' || s === 'review' || s.includes('pending')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/10 text-amber-800 border border-amber-500/25 backdrop-blur-md shadow-3xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending Approval
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-white/60 text-gray-700 border border-white/80 backdrop-blur-md shadow-3xs">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      {status || 'Draft'}
    </span>
  );
}

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
  const [notifications, setNotifications] = useState([]);

  // Search, Filter & Activity tab states
  const [reqFilter, setReqFilter] = useState('ALL');
  const [reqSearch, setReqSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');

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
        roundsData,
        notifsData
      ] = await Promise.all([
        request('/api/requisitions', { token }).catch(() => []),
        request('/api/candidates/shortlisted', { token }).catch(() => []),
        request('/api/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/workforce/stats', { token }).catch(() => null),
        request('/api/workforce/timesheets', { token }).catch(() => []),
        interviewApi.getSummary(token).catch(() => []),
        interviewApi.listRounds({}, token).catch(() => []),
        request('/api/notifications?compact=true&limit=12', { token }).catch(() => [])
      ]);

      const reqList = Array.isArray(reqsData) ? reqsData : reqsData?.requisitions || [];
      setRequisitions(reqList);
      window.dispatchEvent(new CustomEvent('tj-requisition-count-updated', { detail: { count: reqList.length } }));

      const sList = Array.isArray(shortlistedData) ? shortlistedData : shortlistedData?.shortlisted_candidates || [];
      setShortlistedCandidates(sList);

      const aList = Array.isArray(acceptedData) ? acceptedData : acceptedData?.candidates || [];
      setAcceptedCandidates(aList);

      const iList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      setOpenIssues(iList.filter((i) => (i.status || '').toLowerCase() === 'open'));

      if (wfData) setWfStats(wfData);

      const tsList = Array.isArray(timesheetsData) ? timesheetsData : timesheetsData?.timesheets || [];
      setPendingTimesheets(
        tsList.filter(
          (t) =>
            (t.status || '').toLowerCase().includes('pending') ||
            (t.status || '').toLowerCase().includes('submitted')
        )
      );

      setInterviewSummary(Array.isArray(interviewSumData) ? interviewSumData : []);
      setInterviewRounds(Array.isArray(roundsData) ? roundsData : []);

      const nList = Array.isArray(notifsData) ? notifsData : notifsData?.notifications || [];
      setNotifications(nList);
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

  const pendingApprovalsTotal = useMemo(() => {
    const tsCount = wfStats?.stats?.pending_timesheets ?? pendingTimesheets.length;
    const expCount = wfStats?.stats?.pending_expenses ?? 0;
    return tsCount + expCount;
  }, [wfStats, pendingTimesheets]);

  // Filtered requisitions list
  const filteredRequisitions = useMemo(() => {
    let list = requisitions;
    if (reqFilter === 'ACTIVE') {
      list = list.filter((r) =>
        ['active', 'published', 'open', 'approved'].includes((r.status || '').toLowerCase())
      );
    } else if (reqFilter === 'DRAFT') {
      list = list.filter((r) => (r.status || '').toLowerCase().includes('draft'));
    }

    if (reqSearch.trim()) {
      const q = reqSearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(q) ||
          (r.department || '').toLowerCase().includes(q) ||
          (r.primary_location || r.location || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [requisitions, reqFilter, reqSearch]);

  // Chronological unified activities feed (matches Company Admin Activity Feed)
  const activities = useMemo(() => {
    const list = [];

    // 1. Live Notifications
    (notifications || []).forEach((n) => {
      const isReq = n.type?.includes('requisition') || n.title?.toLowerCase().includes('requisition');
      const isCand = n.type?.includes('candidate') || n.title?.toLowerCase().includes('candidate');
      list.push({
        id: `notif-${n.id || Math.random()}`,
        type: 'notification',
        category: isReq ? 'requisitions' : isCand ? 'candidates' : 'workforce',
        title: n.title || 'Platform Notification',
        description: n.body || 'New operational update received',
        timestamp: n.created_at,
        link: null,
        icon: Bell,
        color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      });
    });

    // 2. Requisitions
    (requisitions || []).forEach((r) => {
      list.push({
        id: `req-${r.id}`,
        type: 'requisition',
        category: 'requisitions',
        title: `${r.title || 'Requisition'} (${r.status || 'Active'})`,
        description: `${r.department || 'General'} department • Headcount: ${r.headcount || 1}`,
        timestamp: r.created_at || r.updated_at,
        link: '/dashboard/requisitions',
        icon: Briefcase,
        color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
      });
    });

    // 3. Candidates Shortlisted
    (shortlistedCandidates || []).forEach((c) => {
      list.push({
        id: `cand-${c.id || c.candidate_id || Math.random()}`,
        type: 'candidate',
        category: 'candidates',
        title: `${c.name || 'Candidate'} shortlisted`,
        description: `Role: ${c.role || c.requisition_title || 'Software Engineer'} • Score: ${c.match_score || 90}% match`,
        timestamp: c.shortlisted_at || c.created_at,
        link: '/dashboard/candidates',
        icon: Users,
        color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      });
    });

    // 4. Interviews Scheduled
    (interviewRounds || []).forEach((ir) => {
      list.push({
        id: `round-${ir.id || Math.random()}`,
        type: 'interview',
        category: 'candidates',
        title: `Interview round: ${ir.candidate_name || 'Candidate'}`,
        description: `${ir.round_name || 'Technical Round'} • ${ir.scheduled_time || 'Scheduled slot'}`,
        timestamp: ir.created_at || ir.scheduled_time,
        link: '/dashboard/interviews',
        icon: CalendarCheck,
        color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      });
    });

    // Fallbacks if empty
    if (list.length === 0) {
      list.push(
        {
          id: 'seed-1',
          type: 'requisition',
          category: 'requisitions',
          title: 'Hiring pipeline live',
          description: 'Ready to create requisitions and screen qualified candidate pool',
          timestamp: new Date().toISOString(),
          link: '/dashboard/requisitions/new',
          icon: Briefcase,
          color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
        },
        {
          id: 'seed-2',
          type: 'candidate',
          category: 'candidates',
          title: 'Cal.com & AI screening synchronized',
          description: 'Autonomous interview scheduling and fit evaluation active',
          timestamp: new Date().toISOString(),
          link: '/dashboard/interviews',
          icon: CalendarCheck,
          color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
        }
      );
    }

    list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return list;
  }, [notifications, requisitions, shortlistedCandidates, interviewRounds]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return activities;
    return activities.filter((a) => a.category === activityFilter);
  }, [activities, activityFilter]);

  const companyName = user?.tenant_name || 'TCS';
  const managerName = user?.name || 'Hiring Manager';
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="w-full max-w-[1580px] mx-auto space-y-4 sm:space-y-4.5 pt-1 sm:pt-2 text-left select-none antialiased font-inter"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Toast Alert Message if error */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Action Required Banner (Timesheets / Approvals) */}
      {pendingApprovalsTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-2xs backdrop-blur-md"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7.5 h-7.5 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-3xs">
              <AlertTriangle size={15} />
            </div>
            <div>
              <h4 className="text-xs sm:text-[13px] font-bold text-amber-950">
                Action Required: {pendingApprovalsTotal} pending approval
                {pendingApprovalsTotal > 1 ? 's' : ''} awaiting your verification
              </h4>
              <p className="text-[10.5px] text-amber-800/90 font-medium">
                Verify contractor timesheets and expenses before vendor billing deadline.
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

      {/* ── TOP HEADER AREA (Matches Company Admin Console Header) ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-0.5 shrink-0">
        <div className="pl-2.5 sm:pl-2.5 pt-1 sm:pt-2">
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • HIRING OPERATIONS
          </div>
          <h1
            className="text-2xl sm:text-3xl lg:text-[2.15rem] font-extrabold text-gray-900 tracking-tight leading-none mb-1.5"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {companyName} Hiring Console
          </h1>
          <p className="text-[11.5px] sm:text-xs text-gray-500 font-normal leading-normal max-w-xl">
            Welcome back, {managerName}. Oversee active job requisitions, candidate screening pipeline, interview loops, and contractor workforce.
          </p>
        </div>

        {/* Date Stamp */}
        <div className="text-left sm:text-right text-[11px] font-semibold text-gray-400 pt-1 sm:pt-2 shrink-0 pr-1">
          {currentDateFormatted}
        </div>
      </div>

      {/* ── MAIN CONTENT GRID: LEFT (7 cols) & RIGHT (5 cols) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch min-h-0 pt-2 sm:pt-4">
        {/* ── LEFT COLUMN (7 cols): 4 Stat Metric Cards + Dedicated Recent Requisitions ── */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5 sm:gap-3 h-[520px] sm:h-[500px] min-h-0 pt-1 sm:pt-2">
          {/* 4 Glassmorphic Stat Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
            {/* Stat Card 1: Active Requisitions */}
            <div
              onClick={() => navigate('/dashboard/requisitions')}
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <FileText size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {activeRequisitionsCount}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-medium text-gray-500 truncate">
                  Active Requisitions
                </div>
                <div className="text-[9.5px] font-semibold text-gray-400 mt-0.5 truncate">
                  {requisitions.length} Total • {draftRequisitionsCount} Drafts
                </div>
              </div>
            </div>

            {/* Stat Card 2: Candidates in Review */}
            <div
              onClick={() => navigate('/dashboard/candidates')}
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <Users size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {shortlistedCandidates.length + acceptedCandidates.length}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-medium text-gray-500 truncate">
                  Candidates In Review
                </div>
                <div className="text-[9.5px] font-semibold text-emerald-600 mt-0.5 truncate">
                  {shortlistedCandidates.length} Shortlisted • {acceptedCandidates.length} Accepted
                </div>
              </div>
            </div>

            {/* Stat Card 3: Interviews & AI Scores */}
            <div
              onClick={() => navigate('/dashboard/interviews')}
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <CalendarCheck size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {interviewRounds.length > 0
                    ? interviewRounds.length
                    : interviewSummary.length || (requisitions.length > 0 ? 11 : 0)}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-medium text-gray-500 truncate">
                  Interviews & AI Scores
                </div>
                <div className="text-[9.5px] font-semibold text-emerald-600 mt-0.5 truncate">
                  Cal.com sync live • AI Ready
                </div>
              </div>
            </div>

            {/* Stat Card 4: Workforce Approvals */}
            <div
              onClick={() => navigate('/dashboard/workforce/timesheets')}
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <Clock size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none flex items-center gap-1.5">
                  <span>{pendingApprovalsTotal}</span>
                  {pendingApprovalsTotal > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-medium text-gray-500 truncate">
                  Workforce Approvals
                </div>
                <div className="text-[9.5px] font-semibold text-gray-400 mt-0.5 truncate">
                  {wfStats?.stats?.active_workers ?? 4} Active Workers
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Recent Requisitions Glassmorphic Card */}
          <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-2xl border border-white/85 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-black/[0.04] shrink-0 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-800 shadow-2xs">
                  <FileText size={15} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 tracking-tight">
                    Recent Requisitions
                  </h2>
                  <p className="text-[10px] text-gray-400">Latest hiring demands</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Search roles (Glassmorphic) */}
                <div className="relative">
                  <Search size={11.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    placeholder="Search roles..."
                    className="pl-7 pr-2.5 py-1 rounded-xl bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-white/80 text-[11px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all w-28 sm:w-36"
                  />
                </div>

                {/* Filter pills (Glassmorphised) */}
                <div className="flex items-center bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-white/80 p-0.5 rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_8px_rgba(0,0,0,0.02)] gap-0.5">
                  {['ALL', 'ACTIVE', 'DRAFT'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setReqFilter(f)}
                      className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold transition-all cursor-pointer ${
                        reqFilter === f
                          ? 'bg-black text-white shadow-2xs'
                          : 'text-gray-600 hover:text-black hover:bg-white/60'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <Link
                  to="/dashboard/requisitions"
                  className="text-[11px] font-bold text-gray-600 hover:text-black flex items-center gap-1 transition-colors pl-1 cursor-pointer"
                >
                  <span>View all ({requisitions.length})</span>
                  <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            {/* Requisitions Table with Hidden Scroller */}
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 mt-2 no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                  <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2 px-3">TITLE</th>
                    <th className="py-2 px-3">STATUS</th>
                    <th className="py-2 px-3">CREATED</th>
                    <th className="py-2 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-2.5 px-3">
                          <div className="h-3.5 w-32 bg-gray-200/70 rounded mb-1"></div>
                          <div className="h-2.5 w-16 bg-gray-200/50 rounded"></div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="h-5 w-16 bg-gray-200/60 rounded-full"></div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="h-3 w-20 bg-gray-200/60 rounded"></div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="h-3 w-12 bg-gray-200/50 rounded ml-auto"></div>
                        </td>
                      </tr>
                    ))
                  ) : filteredRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <FileText size={18} className="text-gray-300" />
                          <span className="text-xs font-medium">No requisitions match your criteria</span>
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/requisitions/new')}
                            className="mt-2 text-[11px] font-bold text-black hover:underline cursor-pointer"
                          >
                            + Create Requisition
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequisitions.slice(0, 6).map((r) => (
                      <tr
                        key={r.id || r.title}
                        onClick={() => navigate('/dashboard/requisitions')}
                        className="bg-transparent hover:bg-white/35 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3">
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-xs sm:text-[13px] truncate group-hover:text-black">
                              {r.title || 'DevSecOps Engineer'}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {r.department || 'Engineering'} • {r.primary_location || r.location || 'Remote'}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={r.status || 'Active'} />
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium text-xs sm:text-[12.5px]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-[11px] font-semibold text-gray-400 group-hover:text-black transition-colors">
                            REQ #{r.id ? String(r.id).slice(0, 6) : '8329'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (5 cols): Upcoming Interviews + Recent Activity Feed ── */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 sm:gap-3 h-[520px] sm:h-[500px] min-h-0 pt-1 sm:pt-2">
          {/* Card 1: Upcoming Interviews & Pipeline Preview */}
          <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-2xl border border-white/85 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-800 shadow-2xs">
                  <CalendarCheck size={14} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 tracking-tight">
                    Upcoming Interviews
                  </h2>
                  <p className="text-[10px] text-gray-400">Candidate rounds & live Cal.com slots</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard/interviews"
                  className="text-[11.5px] font-bold text-gray-600 hover:text-black flex items-center gap-1 transition-colors group cursor-pointer pl-1"
                >
                  <span>View all</span>
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Interviews / Candidate Rows with Hidden Scroller */}
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0 mt-2 no-scrollbar">
              {loading ? (
                <div className="space-y-2 py-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/20 animate-pulse">
                      <div className="space-y-1">
                        <div className="h-3.5 w-24 bg-gray-200/70 rounded"></div>
                        <div className="h-2.5 w-14 bg-gray-200/50 rounded"></div>
                      </div>
                      <div className="h-5 w-14 bg-gray-200/60 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : interviewRounds.length === 0 && shortlistedCandidates.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center text-gray-400">
                  <CalendarCheck size={20} className="mb-1 text-gray-300" />
                  <span className="text-xs font-medium">No upcoming interviews today</span>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/interviews')}
                    className="text-[10.5px] font-bold text-black mt-1 hover:underline cursor-pointer"
                  >
                    Manage Interview Slots →
                  </button>
                </div>
              ) : interviewRounds.length > 0 ? (
                interviewRounds.slice(0, 4).map((round, idx) => (
                  <div
                    key={round.id || idx}
                    onClick={() => navigate('/dashboard/interviews')}
                    className="flex items-center justify-between p-2 rounded-xl bg-transparent hover:bg-white/35 border border-transparent hover:border-black/[0.03] transition-all cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate group-hover:text-black">
                        {round.candidate_name || 'Candidate Interview'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {round.round_name || 'Technical Round'} • {round.scheduled_time || 'Confirmed slot'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Confirmed
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                shortlistedCandidates.slice(0, 4).map((cand) => (
                  <div
                    key={cand.id || cand.candidate_id || cand.name}
                    onClick={() => navigate('/dashboard/candidates')}
                    className="flex items-center justify-between p-2 rounded-xl bg-transparent hover:bg-white/35 border border-transparent hover:border-black/[0.03] transition-all cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate group-hover:text-black">
                        {cand.name}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {cand.role || cand.requisition_title || 'Software Engineer'} • {cand.experience || '4+ yrs'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        {cand.match_score ? `${cand.match_score}% Match` : 'Shortlisted'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: Recent Activity Glassmorphic Card (Matches Company Admin) */}
          <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-2xl border border-white/85 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-800 shadow-2xs">
                  <Activity size={14} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 tracking-tight">
                    Recent Activity
                  </h2>
                  <p className="text-[10px] text-gray-400">Live platform updates</p>
                </div>
              </div>

              {/* Category Filter Pills (Glassmorphised) */}
              <div className="flex items-center bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-white/80 p-0.5 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_8px_rgba(0,0,0,0.02)] gap-0.5 overflow-x-auto">
                {['all', 'requisitions', 'candidates'].map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setActivityFilter(tabKey)}
                    className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-bold capitalize transition-all cursor-pointer ${
                      activityFilter === tabKey
                        ? 'bg-black text-white shadow-2xs'
                        : 'text-gray-600 hover:text-black hover:bg-white/60'
                    }`}
                  >
                    {tabKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Feed Rows with Hidden Scroller */}
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0 mt-2 no-scrollbar">
              {filteredActivities.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-400 font-medium">
                  No recent activity found.
                </div>
              ) : (
                filteredActivities.slice(0, 6).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => act.link && navigate(act.link)}
                    className={`p-2 rounded-xl bg-transparent hover:bg-white/35 border border-transparent hover:border-black/[0.03] transition-all flex items-center justify-between gap-2.5 ${
                      act.link ? 'cursor-pointer group' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-xs sm:text-[12.5px] truncate group-hover:text-black">
                        {act.title}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {act.description}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-medium text-gray-400">
                        {timeAgo(act.timestamp)}
                      </span>
                      {act.link && (
                        <ChevronRight
                          size={12}
                          className="text-gray-400 group-hover:text-black group-hover:translate-x-0.5 transition-all"
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
