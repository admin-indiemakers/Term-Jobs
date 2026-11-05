import GoogleCalendarConnect from '../components/GoogleCalendarConnect';
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { upcomingInterviewRounds } from '../interview/utils/upcomingInterviews';
import { interviewApi } from '../interview/services/interviewApi';
import { isPublishedStatus } from '../utils/requisitionStatus';
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
import { NexusPanel, NexusPageHeader, NexusKpiGrid, NexusFilterPills } from '../components/nexus/NexusBits';

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
    let s = String(iso).trim();
    if (s.includes('T') && !s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
      s += 'Z';
    }
    const d = new Date(s);
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Published'}
      </span>
    );
  }
  if (s === 'pending_approval' || s === 'pending' || s === 'in_review' || s === 'review' || s.includes('pending')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending Approval
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#F4F4F5] text-[#52525B] border border-[#E4E4E7]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#8C8478]" />
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
  const [counts, setCounts] = useState(null);
  const [interviewDataError, setInterviewDataError] = useState('');
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
      const [reqList, countsData, notifData] = await Promise.all([
        request('/api/requisitions', { token }).catch(() => []),
        request('/api/hiring-manager/counts', { token }).catch(() => null),
        request('/api/notifications', { token }).catch(() => []),
      ]);

      interviewApi.listRounds({ dashboard: true }, token).then((rounds) => {
        setInterviewRounds(rounds || []);
      }).catch(() => {
        setInterviewDataError('Unable to load rounds');
      });

      setRequisitions(Array.isArray(reqList) ? reqList : []);
      setCounts(countsData);
      setNotifications(Array.isArray(notifData) ? notifData : []);
    } catch (err) {
      setError(err.message || 'Failed to refresh workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token]);

  const upcomingInterviews = useMemo(() => {
    return upcomingInterviewRounds(interviewRounds || [], requisitions || []);
  }, [interviewRounds, requisitions]);

  const activeRequisitionsCount = useMemo(() => {
    return requisitions.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return ['active', 'published', 'open', 'approved'].includes(s);
    }).length;
  }, [requisitions]);

  const draftRequisitionsCount = useMemo(() => {
    return requisitions.filter((r) => (r.status || '').toLowerCase().includes('draft')).length;
  }, [requisitions]);

  const totalInReviewCount = counts?.candidates ?? 0;
  const inReviewSubtitle = counts
    ? [counts.shortlisted ? `${counts.shortlisted} Shortlisted` : '', counts.accepted ? `${counts.accepted} Accepted` : ''].filter(Boolean).join(' • ') || '0 Candidates'
    : 'Loading candidates…';
  const pendingTimesheetsCount = counts?.pendingTimesheets ?? 0;

  // Filtered requisitions list
  const filteredRequisitions = useMemo(() => {
    let list = Array.isArray(requisitions) ? requisitions : [];
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

  // Chronological unified activities feed
  const activities = useMemo(() => {
    const list = [];

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
      });
    });

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
      });
    });

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
      });
    });

    return list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [notifications, requisitions, interviewRounds]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return activities;
    return activities.filter((act) => act.category === activityFilter);
  }, [activities, activityFilter]);

  const managerName = user?.name ? user.name.split(' ')[0] : 'Hiring Manager';
  const companyName = user?.tenant_name || 'TermJobs';

  // NEXUS KPI Items mapping with ultra-clean modern styling
  const kpiItems = [
    {
      label: 'Active Requisitions',
      value: activeRequisitionsCount,
      sub: `${requisitions.length} Total • ${draftRequisitionsCount} Drafts`,
      icon: Briefcase,
      tone: 'bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B]',
      onClick: () => navigate('/dashboard/requisitions'),
    },
    {
      label: 'Candidates in Review',
      value: totalInReviewCount,
      sub: inReviewSubtitle,
      icon: Users,
      tone: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      onClick: () => navigate('/dashboard/candidates'),
    },
    {
      label: 'Timesheets Pending',
      value: pendingTimesheetsCount,
      badge: pendingTimesheetsCount > 0 ? 'Action Required' : null,
      sub: 'Awaiting your review before payroll',
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700 border border-amber-200/80',
      onClick: () => navigate('/dashboard/workforce/timesheets'),
    },
    {
      label: 'Upcoming Interviews',
      value: upcomingInterviews.length,
      sub: `${upcomingInterviews.length} rounds scheduled`,
      icon: CalendarCheck,
      tone: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
      onClick: () => navigate('/dashboard/interviews'),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300">
      {/* Pending Timesheets Urgent Alert Banner */}
      {pendingTimesheetsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-200 bg-[#FFFBEB] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 border border-amber-300">
              <AlertCircle className="size-4" />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                {pendingTimesheetsCount} pending contractor timesheet{pendingTimesheetsCount > 1 ? 's' : ''} awaiting your verification
              </h4>
              <p className="text-[11px] text-amber-800/90 font-normal">
                Verify contractor timesheets before vendor billing deadline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/workforce/timesheets')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            Review Now →
          </button>
        </motion.div>
      )}

      {/* NEXUS Page Header with Editorial Serif Typography */}
      <NexusPageHeader
        badge="TermJobs • Hiring Operations"
        title={`${companyName} Hiring Console`}
        subtitle={`Welcome back, ${managerName}. Oversee active job requisitions, candidate screening pipeline, interview loops, and contractor workforce.`}
        actions={
          <>
            <Link
              to="/dashboard/hiring-manager"
              className="h-9 px-3.5 rounded-xl bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] hover:border-[#D4D4D8] text-[#18181B] text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
            >
              <img src="/logo.png" alt="TermJobs AI" className="size-4 object-contain" />
              <span>Ask TermJobs AI</span>
            </Link>
            <Link
              to="/dashboard/requisitions/new"
              className="h-9 px-4 rounded-xl bg-[#111111] hover:bg-[#27272A] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>New Requisition</span>
            </Link>
          </>
        }
      />

      {/* Google Calendar Card Banner */}
      <GoogleCalendarConnect className="mb-6" />

      {/* NEXUS Unified Multi-Segment KPI Grid */}
      <NexusKpiGrid items={kpiItems} />

      {/* Main Content 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Recent Requisitions */}
        <div className="lg:col-span-7">
          <NexusPanel
            title="Recent Requisitions"
            subtitle="Job postings and open headcount pipeline"
            action={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search input */}
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="text"
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-28 sm:w-36 bg-[#F4F4F5]/70 hover:bg-[#F4F4F5] focus-within:bg-white border border-[#E4E4E7] focus:border-[#111111] rounded-xl pl-8 pr-2.5 py-1 text-xs text-[#111111] placeholder:text-[#888888] focus:outline-none transition-all"
                  />
                </div>

                {/* Filter pills */}
                <NexusFilterPills
                  options={['ALL', 'ACTIVE', 'DRAFT']}
                  active={reqFilter}
                  onChange={setReqFilter}
                />

                <Link
                  to="/dashboard/requisitions"
                  className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1 pl-1"
                >
                  <span>View all</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            }
          >
            {/* Table / List View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]/70 text-[10.5px] font-semibold text-[#71717A] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Title</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Created</th>
                    <th className="py-3 px-4 text-right font-semibold">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5] bg-white">
                  {loading ? (
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-3.5 px-4">
                          <div className="h-3.5 w-32 bg-[#F4F4F5] rounded mb-1" />
                          <div className="h-2.5 w-16 bg-[#F4F4F5]/60 rounded" />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-5 w-16 bg-[#F4F4F5] rounded-full" />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-20 bg-[#F4F4F5] rounded" />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="h-3 w-12 bg-[#F4F4F5] rounded ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : filteredRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#888888]">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <FileText className="size-6 text-[#A1A1AA]" />
                          <span className="text-xs font-medium">No requisitions match your criteria</span>
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/requisitions/new')}
                            className="mt-1 text-xs font-semibold text-[#111111] hover:underline cursor-pointer"
                          >
                            + Create Requisition
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (filteredRequisitions || []).slice(0, 6).map((r) => (
                      <tr
                        key={r.id || r.title}
                        onClick={() => navigate('/dashboard/requisitions')}
                        className="hover:bg-[#FAFAFA] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#111111] text-xs sm:text-[13px] truncate group-hover:text-black">
                            {r.title || 'Job Requisition'}
                          </div>
                          <div className="text-[11px] text-[#71717A] truncate">
                            {r.department || 'Engineering'} • {r.primary_location || r.location || 'Remote'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={r.status || 'Active'} />
                        </td>
                        <td className="py-3.5 px-4 text-[#71717A] font-medium text-xs">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono text-[10.5px] text-[#71717A] bg-[#F4F4F5] border border-[#E4E4E7] px-2 py-0.5 rounded-md">
                            #{r.id ? String(r.id).slice(0, 6) : 'REQ'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </NexusPanel>
        </div>

        {/* Right Column (5 cols): Upcoming Interviews & Activity Feed */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Interview Loops Panel */}
          <NexusPanel
            title="Interview Loops"
            subtitle="Scheduled rounds & technical evaluations"
            action={
              <Link
                to="/dashboard/interviews"
                className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="size-3" />
              </Link>
            }
          >
            <div className="p-3.5 space-y-2">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="p-3 rounded-xl bg-white border border-[#EBEBEB] animate-pulse space-y-1.5">
                    <div className="h-3.5 w-28 bg-[#F4F4F5] rounded" />
                    <div className="h-2.5 w-16 bg-[#F4F4F5]/60 rounded" />
                  </div>
                ))
              ) : upcomingInterviews.length === 0 ? (
                <div className="py-10 text-center text-[#888888]">
                  <CalendarCheck className="size-6 text-[#A1A1AA] mx-auto mb-1.5" />
                  <span className="text-xs font-medium">No upcoming interviews scheduled</span>
                </div>
              ) : (
                (upcomingInterviews || []).slice(0, 4).map((round, idx) => (
                  <div
                    key={round.id || idx}
                    onClick={() => navigate('/dashboard/interviews')}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#EBEBEB] hover:border-[#D4D4D8] hover:shadow-xs transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-[#111111] text-xs truncate group-hover:text-black">
                        {round.candidate_name || 'Candidate Interview'}
                      </div>
                      <div className="text-[11px] text-[#71717A] truncate">
                        {round.round_name || 'Technical Round'} • {round.scheduled_time || round.scheduled_date}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {round.status || 'Scheduled'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </NexusPanel>

          {/* Recent Activity Panel */}
          <NexusPanel
            title="Recent Activity"
            subtitle="Platform operational updates"
            action={
              <NexusFilterPills
                options={['all', 'requisitions', 'candidates']}
                active={activityFilter}
                onChange={setActivityFilter}
              />
            }
          >
            <div className="p-3.5 space-y-2">
              {filteredActivities.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#888888] font-medium">
                  No recent activity found.
                </div>
              ) : (
                (filteredActivities || []).slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => act.link && navigate(act.link)}
                    className={`p-3 rounded-xl bg-white border border-[#EBEBEB] hover:border-[#D4D4D8] hover:shadow-xs transition-all flex items-center justify-between gap-2.5 shadow-2xs ${
                      act.link ? 'cursor-pointer group' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[#111111] text-xs truncate group-hover:text-black">
                        {act.title}
                      </div>
                      <div className="text-[11px] text-[#71717A] truncate">
                        {act.description}
                      </div>
                    </div>
                    <span className="text-[10.5px] font-medium text-[#A1A1AA] shrink-0">
                      {timeAgo(act.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </NexusPanel>
        </div>
      </div>
    </div>
  );
}
