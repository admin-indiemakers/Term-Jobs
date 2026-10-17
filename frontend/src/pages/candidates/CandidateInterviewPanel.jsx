import { SavedEvaluation } from '../../interview/components/SavedEvaluation';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Briefcase,
  Search,
  Bell,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Award,
  Video,
  FileText,
  User,
  Users,
  Code,
  Shield,
  Flag,
  Share2,
  Download,
  Plus,
  X,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Layers,
  BookOpen,
  ClipboardList,
  RotateCcw,
  MoreHorizontal,
  PenTool,
  LogOut,
} from 'lucide-react';
import { Backdrop } from '../../components/landing/Backdrop';
import termjobsLogo from '../../assets/termjobs-logo.png';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { mapRequisitionCandidates } from '../../utils/requisitionCandidates';
import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';
import { isAiInterviewRound } from '../../interview/utils/interviewMode';

export default function CandidateInterviewPanel() {
  const { candidateId, reqId: routeReqId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const userInitials = useMemo(() => {
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return user.name.slice(0, 2).toUpperCase();
    }
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return 'RA';
  }, [user]);

  const reqId = routeReqId || searchParams.get('reqId') || '';
  const effectiveCandidateId = candidateId || searchParams.get('candidateId') || '';

  // State
  const [selectedRoundId, setSelectedRoundId] = useState(''); // Round 2 is selected in the screenshot
  const [activePanelTab, setActivePanelTab] = useState('details'); // 'details' | 'evaluation'
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Requisition details
  const [reqData, setReqData] = useState(null);

  const [candidateData, setCandidateData] = useState(null);
  const [persistedRounds, setPersistedRounds] = useState([]);
  const [process, setProcess] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const candidate = useMemo(() => {
    const mapped = mapRequisitionCandidates(candidateData ? [candidateData] : [ { id: effectiveCandidateId } ])[0];
    return { ...mapped, role: reqData?.title || 'Requisition', skills: mapped.skillsMatchPct };
  }, [candidateData, reqData, effectiveCandidateId]);
  const roundsList = useMemo(() => {
    const stored = persistedRounds.map((r, index) => {
      const isAi = r.round_type === 'AI' || String(r.round_name || '').toLowerCase().includes('ai');
      const roundTitle = isAi ? 'AI Interview' : r.round_name;
      const interviewer = isAi
        ? {
            name: 'TermJobs AI Bot',
            role: 'AI Autonomous Interviewer',
            email: 'ai-interviews@termjobs.com',
            phone: 'TermJobs AI Voice & Video Engine',
            avatar: termjobsLogo,
            isAi: true,
          }
        : {
            name: r.interviewer_name || 'Not assigned',
            role: r.interviewer_role || 'Interviewer',
            email: r.interviewer_email || 'Not provided',
            phone: r.interviewer_phone || 'Not provided',
            avatar: r.interviewer_avatar || null,
            isAi: false,
          };

      return {
        ...r,
        index: index + 1,
        title: roundTitle,
        dateSubtitle: [r.scheduled_date, r.scheduled_time].filter(Boolean).join(' · '),
        type: isAi ? 'AI' : r.round_type,
        badgeClass:
          r.status === 'Completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
            : 'bg-black text-white shadow-3xs',
        details: {
          title: roundTitle,
          timing: `${r.scheduled_date || ''} · ${r.scheduled_time || ''} (${r.scheduled_timezone || 'Asia/Kolkata'})`,
          statusBadge: r.status,
          interviewer,
          duration: `${r.duration_minutes || 45} minutes`,
          type: isAi ? 'AI' : r.round_type,
          focus: isAi ? `Autonomous AI Technical Assessment & Screening for ${reqData?.title || 'Role'}` : (r.instructions || 'Not specified'),
          format: isAi ? 'Automated AI Interview (TermJobs)' : 'Online (TermJobs)',
          checklist: [
            `Candidate Email: ${r.email_delivery?.status || 'Confirmed'}`,
            ...(!isAi && (r.interviewer_email || r.interviewer_name) ? [`Interviewer Email: ${r.interviewer_email_delivery?.status || 'Confirmed'}`] : []),
            `Telegram: ${r.telegram_delivery?.status || 'Confirmed'}`,
            `Google Calendar: ${r.calendar_sync?.status || 'Synced'}`,
          ],
        },
      };
    });

    const planned = process
      .filter((p) => {
        const pTitle = (p.type === 'AI' || String(p.title || '').toLowerCase().includes('ai')) ? 'AI Interview' : p.title;
        return !stored.some((r) => r.title === pTitle);
      })
      .map((p, index) => {
        const isAi = p.type === 'AI' || String(p.title || '').toLowerCase().includes('ai');
        const roundTitle = isAi ? 'AI Interview' : p.title;
        const interviewer = isAi
          ? {
              name: 'TermJobs AI Bot',
              role: 'AI Autonomous Interviewer',
              email: 'ai-interviews@termjobs.com',
              phone: 'TermJobs AI Voice & Video Engine',
              avatar: termjobsLogo,
              isAi: true,
            }
          : {
              name: 'Not assigned',
              role: '',
              email: 'Not provided',
              phone: 'Not provided',
              avatar: null,
              isAi: false,
            };

        return {
          id: `planned-${p.id}`,
          planned: true,
          index: stored.length + index + 1,
          title: roundTitle,
          dateSubtitle: '',
          status: 'Not Scheduled',
          type: isAi ? 'AI' : p.type,
          badgeClass: 'bg-gray-100 text-gray-500',
          details: {
            title: roundTitle,
            timing: 'Not scheduled',
            statusBadge: 'Not Scheduled',
            interviewer,
            duration: `${p.duration || 45} minutes`,
            type: isAi ? 'AI' : p.type,
            focus: p.description || 'Not specified',
            format: isAi ? 'Automated AI Interview (TermJobs)' : 'Online (TermJobs)',
            checklist: ['Awaiting scheduling'],
          },
        };
      });

    return [...stored, ...planned];
  }, [persistedRounds, process, reqData?.title]);
  const activeRound = roundsList.find(r => r.id === selectedRoundId) || roundsList[0] || {
    id: null, planned: true, title: 'Interview details', status: 'Not Scheduled', type: 'Technical',
    details: { title: 'No interview rounds', timing: 'Schedule an interview to get started', statusBadge: 'Not Scheduled', interviewer: { name: 'Not assigned', role: '', email: 'Not provided', phone: 'Not provided' }, duration: 'Not specified', type: 'Not specified', focus: 'Not specified', format: 'Online (TermJobs)', checklist: [] },
  };
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    if (!reqId || !effectiveCandidateId) { setError('Select a requisition and candidate.'); setLoading(false); return; }
    Promise.all([
      request(`/api/requisitions/${reqId}`, { token, noCache: true }),
      request(`/api/candidates/${effectiveCandidateId}`, { token, noCache: true }),
      request(`/api/interviews/rounds?requisition_id=${encodeURIComponent(reqId)}`, { token, noCache: true }),
      request(`/api/interviews/process/template?requisition_id=${encodeURIComponent(reqId)}`, { token, noCache: true }),
    ]).then(([req, c, rounds, template]) => {
      if (cancelled) return;
      if (String(c.requisition_id) !== String(reqId)) throw new Error('Candidate does not belong to this requisition.');
      setReqData(req); setCandidateData(c); setProcess(template.rounds || []);
      setPersistedRounds(rounds.filter(r => String(r.candidate_submission_id) === String(effectiveCandidateId)));
    }).catch(err => { if (!cancelled) setError(err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reqId, effectiveCandidateId, token, refresh]);
  const reqTitle = reqData?.title || 'Requisition';
  const reqCode = reqData?.ref?.replace('REQ-', 'REQ #') || `REQ #${reqId.slice(0, 6).toUpperCase()}`;
  const requiredYears = parseFloat(reqData?.structured_role?.experience);
  const candidateYears = parseFloat(candidate.experience);
  const experienceProgress = requiredYears > 0 && Number.isFinite(candidateYears) ? Math.min(100, 100 * candidateYears / requiredYears) : 0;

  const getRoundIcon = (type) => {
    switch (type) {
      case 'AI':
        return <Shield size={16} className="text-emerald-600" />;
      case 'Technical':
        return <Code size={16} className="text-gray-900" />;
      case 'HR':
        return <Users size={16} className="text-gray-700" />;
      case 'Manager':
        return <Shield size={16} className="text-gray-700" />;
      case 'Final':
        return <Flag size={16} className="text-gray-700" />;
      default:
        return <Calendar size={16} className="text-gray-700" />;
    }
  };

  return (
    <div className="relative h-screen max-h-screen text-gray-900 font-sans flex flex-col antialiased selection:bg-blue-500/20 selection:text-blue-900 overflow-hidden">
      {/* Scoped Scrollbar Styling */}
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-cand-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-cand-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); border-radius: 9999px; }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.28); }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════
          0. LANDING PAGE AMBIENT BACKDROP (Radial Light, Blur Orbs, Grid & Grain)
          ═══════════════════════════════════════════════════════════════════ */}
      <Backdrop tone="light" fixed active />

      {/* ═══════════════════════════════════════════════════════════════════
          1. TOP NAVBAR (Transparent Background, Brand Logo, Breadcrumbs & Profile Dropdown)
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 z-40 bg-transparent transition-all">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Official TermJobs Logo, Divider, Breadcrumbs */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* TermJobs Brand Logo */}
            <Link
              to="/dashboard"
              className="flex items-center gap-2 group cursor-pointer shrink-0"
              title="TermJobs Dashboard"
            >
              <img
                src={termjobsLogo}
                alt="TermJobs"
                className="h-6 w-auto sm:h-7 object-contain transition-transform group-hover:scale-105"
              />
              <span className="text-[0.8rem] sm:text-[0.85rem] font-black tracking-[0.22em] text-gray-900 uppercase">
                TERMJOBS
              </span>
            </Link>

            <span className="text-gray-300 font-light hidden sm:inline">|</span>

            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-xs sm:text-[13px] text-gray-500 truncate">
              <Link
                to="/dashboard/requisitions"
                className="hover:text-black font-medium transition-colors"
              >
                Requisitions
              </Link>
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
              <Link
                to={`/dashboard/requisitions/${reqId}/candidates`}
                className="hover:text-black font-medium transition-colors truncate"
              >
                {reqTitle} - {reqCode}
              </Link>
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
              <Link
                to={`/dashboard/requisitions/${reqId}/candidates`}
                className="hover:text-black font-medium transition-colors"
              >
                Candidates
              </Link>
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
              <span className="font-bold text-gray-900">{candidate.name}</span>
            </nav>
          </div>

          {/* Right: User Profile Avatar with Working Sign Out Dropdown (Notification icon removed per user request) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white text-xs font-black flex items-center justify-center ring-2 ring-white/90 shadow-2xs hover:shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="User Profile Menu"
            >
              {userInitials}
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white/95 backdrop-blur-2xl border border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2.5 border-b border-black/[0.06] mb-1">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {user?.name || 'Recruiter Admin'}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {user?.email || 'admin@termjobs.com'}
                    </p>
                    {user?.role && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-black/[0.04] text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                        {user.role}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50/80 rounded-xl transition-all cursor-pointer"
                  >
                    <LogOut size={14} className="shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN WORKSPACE (With Backdrop showing through Glassmorphic Containers)
          ═══════════════════════════════════════════════════════════════════ */}
      {loading && <p className="shrink-0 px-6 py-2 text-sm text-gray-500">Loading interview data…</p>}
      {error && <p role="alert" className="shrink-0 px-6 py-2 text-sm text-red-600">{error}</p>}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1480px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col gap-3.5 overflow-hidden">
        {/* ── 2. CANDIDATE PROFILE HERO CARD (BLACK WITH LANDING PAGE RADIAL GRADIENT & CLEAN SYSTEM ARCHITECTURE) ── */}
        <section
          className="relative shrink-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/12 p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.2)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all bg-ink text-paper"
          style={{
            background: 'radial-gradient(130% 100% at 15% 15%, #252830 0%, #131417 48%, #08090b 100%)',
          }}
        >
          {/* Exact Landing Page Dark Backdrop System (Gradient, Waves, Grid, Grain, Ambient Lights) */}
          <Backdrop tone="dark" fixed={false} active={true} />

          {/* Floating Ambient Glow from Landing Page */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -left-16 h-80 w-80 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, oklch(0.6 0.004 260 / 0.3), transparent 68%)' }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)' }}
          />

          {/* Left: Candidate Identity, Role, Contact Pills & Resume CTA */}
          <div className="relative z-10 min-w-0 space-y-2.5">
            {/* Row 1: Candidate Name & Badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
                {candidate.name}
              </h1>

              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-500/10 backdrop-blur-md">
                <Sparkles size={12} className="text-emerald-400" />
                <span>AI Shortlisted</span>
              </span>

              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-white/[0.08] text-zinc-300 border border-white/10 backdrop-blur-sm">
                {candidate.role}
              </span>
            </div>

            {/* Row 2: Clean Organized Contact Badges & High-Contrast View Resume Button */}
            <div className="flex items-center gap-2 text-xs text-zinc-300 flex-wrap pt-0.5">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 backdrop-blur-md shadow-2xs font-medium transition-colors">
                <MapPin size={12} className="text-zinc-400" />
                <span>{candidate.location && candidate.location !== 'Not provided' ? candidate.location : 'Remote / Not provided'}</span>
              </span>

              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 backdrop-blur-md shadow-2xs font-medium transition-colors">
                <Mail size={12} className="text-zinc-400" />
                <span>{candidate.email}</span>
              </span>

              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 backdrop-blur-md shadow-2xs font-medium transition-colors">
                <Phone size={12} className="text-zinc-400" />
                <span>{candidate.phone}</span>
              </span>

              <button
                type="button"
                onClick={() => setShowResumeModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                <FileText size={13} className="text-zinc-950" />
                <span>View Resume</span>
                <ExternalLink size={11} className="text-zinc-500" />
              </button>
            </div>
          </div>

          {/* Right: Metrics Stat Cards in Sleek Dark Glassmorphism */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
            {/* Metric 1: Skills Match */}
            <div className="bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-w-[125px] transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                <span>Skills</span>
                <Sparkles size={11} className="text-emerald-400" />
              </div>
              <div className="mt-1.5 space-y-1">
                <span className="text-lg font-black text-white leading-none">
                  {candidate.skills ?? '—'}%
                </span>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-xs shadow-emerald-500/50"
                    style={{ width: `${candidate.skills ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 2: Experience */}
            <div className="bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-w-[125px] transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                <span>Experience</span>
                <Briefcase size={11} className="text-zinc-400" />
              </div>
              <div className="mt-1.5 space-y-1">
                <span className="text-sm font-bold text-zinc-200 leading-none truncate">
                  {candidate.experience || 'Not provided'}
                </span>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-400 rounded-full"
                    style={{ width: `${experienceProgress || 30}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 3: Availability */}
            <div className="bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between min-w-[125px] transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                <span>Availability</span>
                <Clock size={11} className="text-emerald-400" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-xs shadow-emerald-400/50"></span>
                </span>
                <span className="text-xs font-bold text-zinc-200 leading-none truncate">
                  {candidate.availability || 'Not provided'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. MAIN WORKSPACE (2-COLUMN SPLIT: LEFT TIMELINE | RIGHT DETAILS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* ═══════════════════════════════════════════════════════════════
              LEFT COLUMN (32%): INTERVIEW ROUNDS LIST (5 ROUNDS)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 h-full flex flex-col min-h-0 space-y-3">
            <h2 className="shrink-0 text-sm font-bold text-gray-900 tracking-tight px-1 flex items-center gap-2">
              <span>Interview Rounds</span>
              <span className="px-2 py-0.5 rounded-full bg-white/70 backdrop-blur-sm border border-black/[0.06] text-xs font-bold text-gray-600">
                {roundsList.length}
              </span>
            </h2>

            {/* Vertical timeline of round cards */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-cand-scroll pr-1.5 pl-6 space-y-2.5 relative before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-gray-400 before:via-gray-300 before:to-gray-200/50">
              {roundsList.map((round) => {
                const isSelected = activeRound.id === round.id;
                const isCompleted = round.status === 'Completed';
                const isUpcoming = ['Upcoming', 'Scheduled', 'Confirmed'].includes(round.status);

                return (
                  <div key={round.id} className="relative">
                    {/* Stepper Node Marker on Timeline (No Blue) */}
                    <div
                      className={`absolute -left-6 top-3.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-xs z-10 transition-transform ${
                        isCompleted
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/15'
                          : isUpcoming
                          ? 'bg-gray-900 text-white ring-4 ring-black/10'
                          : 'bg-white/80 backdrop-blur-sm border border-black/10 text-gray-500 ring-2 ring-white/80'
                      }`}
                    >
                      {round.index}
                    </div>

                    {/* Round Card (Glassmorphism & Clickable to switch active view on right) */}
                    <div
                      onClick={() => setSelectedRoundId(round.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-white/95 backdrop-blur-xl border-black shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] ring-1 ring-black/10'
                          : 'bg-white/60 backdrop-blur-md hover:bg-white/85 hover:border-white border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : isUpcoming
                              ? 'bg-gray-100 text-gray-900 border border-gray-200'
                              : 'bg-black/[0.04] text-gray-600 border border-black/[0.04]'
                          }`}
                        >
                          {getRoundIcon(round.type)}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-[13px] font-bold text-gray-900 tracking-tight truncate">
                            {round.title}
                          </h3>
                          {round.dateSubtitle ? (
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                              {round.dateSubtitle}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 backdrop-blur-sm'
                              : isUpcoming
                              ? 'bg-black text-white shadow-3xs'
                              : 'bg-black/[0.04] text-gray-500 border border-black/[0.04]'
                          }`}
                        >
                          <span>{round.status}</span>
                          {isUpcoming && <span className="text-[10px]">↗</span>}
                        </span>

                        {isCompleted && (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT COLUMN (68%): ACTIVE ROUND EXPANDED WORKSPACE (GLASS CARD)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 h-full flex flex-col min-h-0">
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-5 sm:p-6 shadow-[0_12px_40px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] h-full flex flex-col min-h-0 overflow-hidden transition-all">
              {/* ── 1. PINNED / FIXED TOP SECTION (Round Heading, Status Badge & AI Screening Score Card) ── */}
              <div className="shrink-0 space-y-3.5 pb-4 border-b border-black/[0.04]">
                {/* Top Row: Title, Subtitle, Status Badge & Options */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                      {(activeRound.type === 'AI' || isAiInterviewRound(activeRound)) ? 'AI Interview' : activeRound.details.title}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      {activeRound.details.timing}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-sm ${
                        activeRound.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                          : ['Upcoming', 'Scheduled', 'Confirmed'].includes(activeRound.status)
                          ? 'bg-black text-white border-black shadow-3xs'
                          : 'bg-black/[0.04] text-gray-500 border-black/[0.04]'
                      }`}
                    >
                      {activeRound.details.statusBadge}
                    </span>

                    <button
                      type="button"
                      className="p-1 hover:bg-black/[0.04] rounded-lg text-gray-400 hover:text-black cursor-pointer transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>

                {/* Only show tab pills for human interview rounds */}
                {!(activeRound.type === 'AI' || isAiInterviewRound(activeRound)) && (
                  <div className="flex items-center gap-1.5 p-1 bg-white/50 backdrop-blur-xl border border-white/80 rounded-xl shadow-3xs w-fit">
                    <button
                      type="button"
                      onClick={() => setActivePanelTab('details')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activePanelTab === 'details'
                          ? 'bg-black text-white shadow-xs'
                          : 'text-gray-600 hover:text-black hover:bg-white/60'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePanelTab('evaluation')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activePanelTab === 'evaluation'
                          ? 'bg-black text-white shadow-xs'
                          : 'text-gray-600 hover:text-black hover:bg-white/60'
                      }`}
                    >
                      Evaluation
                    </button>
                  </div>
                )}

                {/* AI Screening Score Card (Fixed & Pinned at Top of Active Round) */}
                {(activeRound.type === 'AI' || isAiInterviewRound(activeRound)) && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-white/90 via-emerald-50/25 to-white/70 backdrop-blur-xl border border-emerald-200/80 shadow-[0_4px_24px_rgba(16,185,129,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Circular Score Gauge */}
                      <div className="relative flex items-center justify-center shrink-0 w-14 h-14 sm:w-16 sm:h-16">
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            stroke="rgba(0,0,0,0.06)"
                            strokeWidth="5"
                            fill="transparent"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            stroke="#059669"
                            strokeWidth="5"
                            strokeDasharray={2 * Math.PI * 26}
                            strokeDashoffset={2 * Math.PI * 26 * (1 - Math.min(100, Math.max(0, candidate.score || 0)) / 100)}
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-700 ease-out"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-base sm:text-lg font-black text-gray-900 leading-none">
                            {candidate.score ?? '—'}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold">/100</span>
                        </div>
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-800">
                            AI Screening Score
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {candidate.score >= 40 ? 'Qualified' : 'Evaluated'}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight truncate">
                          Automated Technical & Screening Evaluation
                        </h4>
                        <p className="text-[11px] sm:text-xs text-gray-500 truncate">
                          Conducted autonomously by TermJobs AI Bot &bull; Technical Score: <span className="font-bold text-gray-900">{candidate.score ?? '—'}/100</span> &bull; Skills Match: <span className="font-bold text-gray-900">{candidate.skills ?? '—'}%</span>
                        </p>
                      </div>
                    </div>

                    {/* Verified Skill Highlights */}
                    {candidate.allSkills && candidate.allSkills.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap sm:justify-end max-w-sm shrink-0">
                        {candidate.allSkills.slice(0, 4).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-white/90 border border-gray-200/80 text-[11px] font-medium text-gray-700 shadow-3xs"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── 2. SCROLLABLE BOTTOM SECTION (Interviewer, Interview Details, Status, Actions) ── */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-cand-scroll pr-1.5 pt-4 space-y-5">
                {(activePanelTab === 'details' || (activeRound.type === 'AI' || isAiInterviewRound(activeRound))) && (
                  <div className="space-y-5">
                    {/* Two Sub-columns: Interviewer & Interview Details (Glass Containers) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-start">
                      {/* Left Sub-column: Interviewer */}
                      <div className="p-4 rounded-xl bg-white/50 backdrop-blur-md border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                            Interviewer
                          </h4>
                          {activeRound.details.interviewer.isAi && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              <Sparkles size={10} className="text-emerald-600" />
                              Official AI Bot
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3.5">
                          {activeRound.details.interviewer.avatar ? (
                            <div className="w-11 h-11 rounded-full p-2 bg-white ring-2 ring-white/90 shadow-2xs flex items-center justify-center shrink-0">
                              <img
                                src={activeRound.details.interviewer.avatar}
                                alt={activeRound.details.interviewer.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-black ring-2 ring-white/90 shadow-2xs shrink-0">
                              {activeRound.details.interviewer.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="text-sm font-bold text-gray-900 truncate">
                              {activeRound.details.interviewer.name}
                            </h5>
                            <p className="text-xs text-gray-500 truncate">
                              {activeRound.details.interviewer.role}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 space-y-1.5 pt-1">
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-gray-400 shrink-0" />
                            <span className="truncate">
                              {activeRound.details.interviewer.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield size={13} className="text-gray-400 shrink-0" />
                            <span>{activeRound.details.interviewer.phone}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Sub-column: Interview Details */}
                      <div className="p-4 rounded-xl bg-white/50 backdrop-blur-md border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
                        <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                          Interview Details
                        </h4>

                        <div className="text-xs text-gray-700 space-y-2">
                          <div className="flex items-center gap-2.5">
                            <Clock size={14} className="text-gray-400 shrink-0" />
                            <span>Duration: {activeRound.details.duration}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <Shield size={14} className="text-gray-400 shrink-0" />
                            <span>Type: {activeRound.details.type}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <User size={14} className="text-gray-400 shrink-0" />
                            <span className="truncate">Focus: {activeRound.details.focus}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <PenTool size={14} className="text-gray-400 shrink-0" />
                            <span>Format: {activeRound.details.format}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Status Checklist on Left & Action on Right */}
                    <div className="pt-4 border-t border-black/[0.05] flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                      {/* Status Checklist */}
                      <div className="p-4 rounded-xl bg-white/40 backdrop-blur-md border border-white/80 shadow-2xs space-y-2 min-w-[280px]">
                        <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                          Status
                        </h4>
                        <div className="text-xs text-gray-700 space-y-1.5 font-medium">
                          {activeRound.details.checklist.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-emerald-800"
                            >
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Modern Action Button: Hidden when interview is Completed per user request */}
                      {activeRound.status === 'Completed' ? (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold shadow-3xs">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>Interview Completed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          {!activeRound.planned && !isAiInterviewRound(activeRound) && (
                            <button
                              type="button"
                              onClick={() => setScheduling(true)}
                              className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                              title="Edit schedule or change interviewer"
                            >
                              <PenTool size={14} />
                              <span>Edit Schedule</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (activeRound.planned) { setScheduling(true); return; }
                              navigate(`/interview/room/${activeRound.id}?role=interviewer`);
                            }}
                            className="px-6 py-3 rounded-xl bg-black hover:bg-gray-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Video size={15} />
                            <span>{activeRound.planned ? 'Schedule Interview' : 'Enter Interview'}</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Saved Evaluation for Human Rounds only */}
                {activePanelTab === 'details' && !isAiInterviewRound(activeRound) && !activeRound.planned && (
                  <SavedEvaluation key={activeRound.id} evaluation={activeRound.evaluation} />
                )}
                {activePanelTab === 'evaluation' && !isAiInterviewRound(activeRound) && activeRound.status !== 'Completed' && (
                  <div className="space-y-4 pt-1 text-xs text-gray-600">
                    <div className="p-5 rounded-xl bg-white/50 backdrop-blur-md border border-white/80 space-y-2 shadow-2xs">
                      <h4 className="font-bold text-gray-900 text-sm">Evaluation Scorecard</h4>
                      <p className="text-gray-600">
                        Panelist scoring, technical competency rubrics, and feedback notes will be archived here once this round concludes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {scheduling && (
        <ScheduleInterviewModal
          candidate={candidate}
          requisitionId={reqId}
          requisitionTitle={reqTitle}
          requisitionCode={reqCode}
          initialSelectedRound={activeRound?.title || activeRound?.round_name || activeRound?.type || 'Technical'}
          existingRounds={persistedRounds}
          onClose={() => setScheduling(false)}
          onScheduled={() => {
            setScheduling(false);
            setRefresh((x) => x + 1);
          }}
        />
      )}
      {/* ════════ RESUME PREVIEW MODAL (Glassmorphic) ════════ */}
      {showResumeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowResumeModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-white/90 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-gray-900" />
                <h3 className="text-base font-black text-gray-900">
                  Resume &bull; {candidate.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-black/[0.05] text-gray-400 hover:text-black flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-gray-700 bg-white/60 p-4 rounded-xl border border-black/[0.04] leading-relaxed whitespace-pre-wrap">
              {candidateData?.resume_text || 'No saved resume text is available.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
