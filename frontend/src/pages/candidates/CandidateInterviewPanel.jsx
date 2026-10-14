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
} from 'lucide-react';
import { Backdrop } from '../../components/landing/Backdrop';
import termjobsLogo from '../../assets/termjobs-logo.png';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function CandidateInterviewPanel() {
  const { candidateId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const reqId = searchParams.get('reqId') || '8302c0';
  const effectiveCandidateId = candidateId || searchParams.get('candidateId') || 'cand-1';

  // State
  const [selectedRoundId, setSelectedRoundId] = useState('r-2'); // Round 2 is selected in the screenshot
  const [activePanelTab, setActivePanelTab] = useState('details'); // 'details' | 'evaluation'
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Requisition details
  const [reqData, setReqData] = useState(null);

  // Candidate Data matching exact photo & properties in screenshot
  const candidate = useMemo(() => {
    return {
      id: effectiveCandidateId,
      name: 'Arjun M',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
      role: 'Python Developer',
      location: 'Bangalore, India',
      email: 'arjun.m@gmail.com',
      phone: '+91 98765 43210',
      score: 92,
      skills: 95,
      experience: '3 years',
      availability: 'Immediate',
      status: 'AI Shortlisted',
    };
  }, [effectiveCandidateId]);

  // All 5 Interview Rounds matching screenshot
  const roundsList = [
    {
      id: 'r-1',
      index: 1,
      title: 'AI Screening',
      dateSubtitle: 'Oct 4, 2026',
      status: 'Completed',
      type: 'AI',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      details: {
        title: 'AI Screening',
        timing: 'Mon, Oct 4, 2026 • 10:00 AM - 10:30 AM (30 mins)',
        statusBadge: 'Completed',
        interviewer: {
          name: 'AI Screening Agent',
          role: 'Automated Evaluation Engine',
          email: 'ai-eval@termjobs.com',
          phone: '+91 98765 43210',
          avatar:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        },
        duration: '30 minutes',
        type: 'Automated Screening',
        focus: 'Python Foundations, Algorithmic Problem Solving',
        format: 'AI Proctored Assessment',
        checklist: [
          'Candidate submitted code assessment',
          'Automated verification completed',
          'Benchmark score: 92/100',
        ],
      },
    },
    {
      id: 'r-2',
      index: 2,
      title: 'Technical Interview',
      dateSubtitle: 'Oct 6, 2026 • 09:30 AM',
      status: 'Upcoming',
      type: 'Technical',
      badgeClass: 'bg-black text-white shadow-3xs',
      details: {
        title: 'Technical Interview',
        timing: 'Tue, Oct 6, 2026 • 09:30 AM - 10:15 AM (45 mins)',
        statusBadge: 'Upcoming',
        interviewer: {
          name: 'Rahul Sharma',
          role: 'Senior Software Engineer',
          email: 'rahul.sharma@termjobs.com',
          phone: '+91 98765 43210',
          avatar:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        },
        duration: '45 minutes',
        type: 'Technical Interview',
        focus: 'Python, Django, System Design',
        format: 'Online (Term Jobs Panel)',
        checklist: [
          'Interview invitation sent',
          'Candidate notification sent',
          'Scheduled & Confirmed',
        ],
      },
    },
    {
      id: 'r-3',
      index: 3,
      title: 'HR Interview',
      dateSubtitle: 'Oct 9, 2026 • 11:00 AM',
      status: 'Not Scheduled',
      type: 'HR',
      badgeClass: 'bg-gray-100 text-gray-500',
      details: {
        title: 'HR Interview',
        timing: 'Thu, Oct 9, 2026 • 11:00 AM - 11:45 AM (45 mins)',
        statusBadge: 'Not Scheduled',
        interviewer: {
          name: 'Pooja Iyer',
          role: 'Lead HR Business Partner',
          email: 'pooja.i@termjobs.com',
          phone: '+91 98765 43211',
          avatar:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        },
        duration: '45 minutes',
        type: 'HR & Culture Interview',
        focus: 'Cultural fit, team collaboration, career goals',
        format: 'Online (Term Jobs Panel)',
        checklist: [
          'Draft slots proposed to panelist',
          'Pending panelist confirmation',
          'Candidate notification queue',
        ],
      },
    },
    {
      id: 'r-4',
      index: 4,
      title: 'Manager Interview',
      dateSubtitle: '',
      status: 'Not Scheduled',
      type: 'Manager',
      badgeClass: 'bg-gray-100 text-gray-500',
      details: {
        title: 'Manager Interview',
        timing: 'To be scheduled after HR Round',
        statusBadge: 'Not Scheduled',
        interviewer: {
          name: 'Engineering Director',
          role: 'Engineering Leadership',
          email: 'director@termjobs.com',
          phone: '+91 98765 43212',
          avatar:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        },
        duration: '45 minutes',
        type: 'Management Round',
        focus: 'Project discussion, team architecture fit',
        format: 'Online (Term Jobs Panel)',
        checklist: [
          'Pending completion of Round 3',
          'Panelist assignment in progress',
        ],
      },
    },
    {
      id: 'r-5',
      index: 5,
      title: 'Final Review',
      dateSubtitle: '',
      status: 'Not Scheduled',
      type: 'Final',
      badgeClass: 'bg-gray-100 text-gray-500',
      details: {
        title: 'Final Review',
        timing: 'To be scheduled upon completion of loop',
        statusBadge: 'Not Scheduled',
        interviewer: {
          name: 'Hiring Committee',
          role: 'Compensation & Offer Review',
          email: 'hiring@termjobs.com',
          phone: '+91 98765 43213',
          avatar:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        },
        duration: '30 minutes',
        type: 'Offer & Alignment',
        focus: 'Hiring decision and offer discussion',
        format: 'Online (Term Jobs Panel)',
        checklist: [
          'Pending completion of all technical rounds',
          'Offer readiness review',
        ],
      },
    },
  ];

  // Active round selected on right panel
  const activeRound = useMemo(() => {
    return roundsList.find((r) => r.id === selectedRoundId) || roundsList[1];
  }, [selectedRoundId]);

  // Fetch requisition details if available
  useEffect(() => {
    if (reqId) {
      request(`/requisitions/${reqId}`).then(setReqData).catch(() => null);
    }
  }, [reqId]);

  const reqTitle = reqData?.title || 'Python Developer';
  const reqCode = reqData?.ref ? reqData.ref.replace('REQ-', 'REQ #') : 'REQ #8302C0';

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
    <div className="relative min-h-screen text-gray-900 font-sans flex flex-col antialiased selection:bg-blue-500/20 selection:text-blue-900 overflow-x-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          0. LANDING PAGE AMBIENT BACKDROP (Radial Light, Blur Orbs, Grid & Grain)
          ═══════════════════════════════════════════════════════════════════ */}
      <Backdrop tone="light" fixed active />

      {/* ═══════════════════════════════════════════════════════════════════
          1. TOP NAVBAR (Transparent, TermJobs Logo, Breadcrumbs, Notifications, Avatar)
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/30 backdrop-blur-xl border-b border-black/[0.04] transition-all">
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

          {/* Right: Notification Bell & User Avatar (Search bar removed per user request) */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell with Badge '1' */}
            <button
              type="button"
              className="w-9 h-9 rounded-xl bg-white/50 hover:bg-white/80 backdrop-blur-md border border-black/[0.05] flex items-center justify-center text-gray-600 hover:text-gray-900 relative transition-all cursor-pointer shadow-3xs hover:shadow-2xs"
              title="Notifications"
            >
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9.5px] font-black rounded-full flex items-center justify-center shadow-xs">
                1
              </span>
            </button>

            {/* User Avatar Circle */}
            <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 text-white text-xs font-black flex items-center justify-center ring-2 ring-white/90 shadow-2xs">
              RA
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN WORKSPACE (With Backdrop showing through Glassmorphic Containers)
          ═══════════════════════════════════════════════════════════════════ */}
      <main className="relative z-10 flex-1 max-w-[1480px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* ── 2. CANDIDATE PROFILE HERO CARD (MODERN GLASSMORPHISM LIKE REQUISITION PAGE - NO PROFILE PIC) ── */}
        <section className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all">
          {/* Left: Name, AI Shortlisted Badge, Role, Metadata Pills */}
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {candidate.name}
              </h1>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold flex items-center gap-1.5 shadow-3xs">
                <Sparkles size={11} className="text-emerald-600" />
                <span>AI Shortlisted</span>
              </span>
            </div>

            <div className="text-sm font-semibold text-gray-600">
              {candidate.role}
            </div>

            <div className="flex items-center gap-2.5 text-xs text-gray-500 flex-wrap pt-0.5">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 backdrop-blur-sm border border-black/[0.04] shadow-3xs font-medium">
                <MapPin size={12} className="text-gray-400" />
                {candidate.location}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 backdrop-blur-sm border border-black/[0.04] shadow-3xs font-medium">
                <Mail size={12} className="text-gray-400" />
                {candidate.email}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/60 backdrop-blur-sm border border-black/[0.04] shadow-3xs font-medium">
                <Phone size={12} className="text-gray-400" />
                {candidate.phone}
              </span>
              <button
                type="button"
                onClick={() => setShowResumeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black text-white hover:bg-gray-800 text-xs font-bold transition-all shadow-3xs cursor-pointer"
              >
                <ExternalLink size={12} />
                <span>View Resume</span>
              </button>
            </div>
          </div>

          {/* Right: 4 Metrics Stat Cards (Glass capsules matching requisition page - NO BLUE) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto shrink-0">
            {/* Metric 1: Score */}
            <div className="bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl p-3 flex flex-col justify-between min-w-[110px] shadow-[0_2px_12px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.8)]">
              <span className="text-[11px] font-bold text-gray-500">Score</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-9 h-9 rounded-full border-2 border-emerald-500 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs bg-emerald-500/5">
                  {candidate.score}
                </div>
                <div className="text-[10px] text-gray-400 font-bold leading-tight">
                  <span>/100</span>
                </div>
              </div>
            </div>

            {/* Metric 2: Skills */}
            <div className="bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl p-3 flex flex-col justify-between min-w-[110px] shadow-[0_2px_12px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.8)]">
              <span className="text-[11px] font-bold text-gray-500">Skills</span>
              <div className="mt-1 space-y-1">
                <span className="text-base font-black text-gray-900 leading-none">
                  {candidate.skills}%
                </span>
                <div className="w-full h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${candidate.skills}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 3: Experience (Dark Slate/Black Progress Bar - No Blue) */}
            <div className="bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl p-3 flex flex-col justify-between min-w-[110px] shadow-[0_2px_12px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.8)]">
              <span className="text-[11px] font-bold text-gray-500">Experience</span>
              <div className="mt-1 space-y-1">
                <span className="text-base font-black text-gray-900 leading-none">
                  {candidate.experience}
                </span>
                <div className="w-full h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>
            </div>

            {/* Metric 4: Availability */}
            <div className="bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl p-3 flex flex-col justify-between min-w-[110px] shadow-[0_2px_12px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.8)]">
              <span className="text-[11px] font-bold text-gray-500">Availability</span>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs shadow-emerald-500/50" />
                <span className="text-xs font-black text-gray-900 leading-none">
                  {candidate.availability}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. MAIN WORKSPACE (2-COLUMN SPLIT: LEFT TIMELINE | RIGHT DETAILS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ═══════════════════════════════════════════════════════════════
              LEFT COLUMN (32%): INTERVIEW ROUNDS LIST (5 ROUNDS)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight px-1 flex items-center gap-2">
              <span>Interview Rounds</span>
              <span className="px-2 py-0.5 rounded-full bg-white/70 backdrop-blur-sm border border-black/[0.06] text-xs font-bold text-gray-600">
                5
              </span>
            </h2>

            {/* Vertical timeline of round cards */}
            <div className="relative pl-6 space-y-2.5 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-gray-400 before:via-gray-300 before:to-gray-200/50">
              {roundsList.map((round) => {
                const isSelected = selectedRoundId === round.id;
                const isCompleted = round.status === 'Completed';
                const isUpcoming = round.status === 'Upcoming';

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
          <div className="lg:col-span-8">
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-6 sm:p-7 shadow-[0_12px_40px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-6 transition-all">
              {/* Top Row: Title, Subtitle, Upcoming Badge & Options */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    {activeRound.details.title}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    {activeRound.details.timing}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-sm ${
                      activeRound.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : activeRound.status === 'Upcoming'
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

              {/* ── Modern Glassmorphic Tab Pills (Like Requisition Page) ── */}
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

              {/* Tab 1: Details (Default) */}
              {activePanelTab === 'details' && (
                <div className="space-y-6 pt-1">
                  {/* Two Sub-columns: Interviewer & Interview Details (Glass Containers) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    {/* Left Sub-column: Interviewer */}
                    <div className="p-4 rounded-xl bg-white/50 backdrop-blur-md border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
                      <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                        Interviewer
                      </h4>

                      <div className="flex items-center gap-3.5">
                        <img
                          src={activeRound.details.interviewer.avatar}
                          alt={activeRound.details.interviewer.name}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-white/90 shadow-2xs shrink-0"
                        />
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
                          <Phone size={13} className="text-gray-400 shrink-0" />
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

                  {/* Bottom Section: Status Checklist on Left & Enter Interview on Right */}
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

                    {/* Modern Action Button (Matching Requisition Page Black CTA) */}
                    <button
                      type="button"
                      onClick={() => {
                        const roundRoomId = `round-${effectiveCandidateId}-${selectedRoundId}`;
                        const interviewerName = user?.name || activeRound.details.interviewer.name || 'Interviewer';
                        navigate(`/interview/room/${roundRoomId}?role=interviewer&name=${encodeURIComponent(interviewerName)}&mode=meet`);
                      }}
                      className="px-6 py-3 rounded-xl bg-black hover:bg-gray-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer shrink-0"
                    >
                      <Video size={15} />
                      <span>Enter Interview</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Evaluation */}
              {activePanelTab === 'evaluation' && (
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
      </main>

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
              {`CANDIDATE: ${candidate.name}
ROLE: ${candidate.role}
LOCATION: ${candidate.location}
EMAIL: ${candidate.email}
PHONE: ${candidate.phone}

PROFESSIONAL SUMMARY:
Backend software developer with 3+ years of experience engineering high-performance Python microservices, distributed data pipelines, and responsive web systems.

TECHNICAL SKILLS:
- Languages: Python, SQL, JavaScript
- Frameworks: FastAPI, Django, Flask, React
- Infrastructure: Docker, AWS (S3, EC2), Linux, Git, CI/CD
- Databases: PostgreSQL, MongoDB, Redis`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
