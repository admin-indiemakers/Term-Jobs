import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Briefcase,
  MapPin,
  Clock,
  Building2,
  Calendar,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Zap,
  Users,
  Rocket,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowLeft,
  Sparkles,
  FileText,
  Layers,
  Send,
  User,
  LogOut,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Edit3,
  Check,
  LogIn,
  Home,
  Video,
  Copy,
  MoreVertical,
  Code2,
} from 'lucide-react';
import { API_BASE_URL, request } from '../api/client';
import { marked } from 'marked';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import SEOHead from '../components/SEOHead';
import ResumePreviewModal from '../components/ResumePreviewModal';
import CandidateEmailEditor from '../components/CandidateEmailEditor';
import GeneralTalentPoolModal from '../components/GeneralTalentPoolModal';
import { Backdrop } from '../components/landing/Backdrop';
import logo from '../assets/termjobs-logo.png';
import { formatDueDate } from '../utils/dateUtils';
import { validatePhone } from '../utils/phoneValidation';
import { validateCandidateEmail } from '../utils/candidateEmailValidation';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '215468136876-3e4icbpr6blejlb9vibvecr6ck2tfm5g.apps.googleusercontent.com';
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Termjobs_alertbot';

function GoogleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.15C3.25 21.36 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.61l4 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

export default function OpenRolesPage({ enabled = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const candidateAuth = useCandidateAuth();
  const candidateUser = candidateAuth?.candidateUser;
  const applications = candidateAuth?.applications || [];
  const logout = candidateAuth?.logout;
  const refreshProfile = candidateAuth?.refreshProfile;
  const setupProfile = candidateAuth?.setupProfile;
  const loginWithGoogle = candidateAuth?.loginWithGoogle;
  const login = candidateAuth?.login;
  const register = candidateAuth?.register;

  const isCandidateAuthenticated = Boolean(candidateAuth?.candidateToken && candidateUser);
  const candidateEmail = (candidateUser?.candidate_email || candidateUser?.email || '').trim().toLowerCase();
  const appliedStorageKey = candidateEmail ? `tj_applied_jobs_${candidateEmail}` : null;

  // Job search & filters - hydrate instantly from session cache if available (0ms render)
  const [requisitions, setRequisitions] = useState(() => {
    try {
      const cached = sessionStorage.getItem('tj_cached_requisitions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
          return parsed.data;
        }
      }
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(() => requisitions.length === 0);
  const [error, setError] = useState(null);
  const [platformStats, setPlatformStats] = useState(() => {
    try {
      const cached = sessionStorage.getItem('tj_cached_platform_stats');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.partners_count === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkMode, setSelectedWorkMode] = useState('ALL');
  const [selectedFamily, setSelectedFamily] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');

  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMyAppsModal, setShowMyAppsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showGeneralPoolModal, setShowGeneralPoolModal] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('home');

  // Candidate agreements & offer letter state
  const [candidateAgreements, setCandidateAgreements] = useState([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [signingAgreement, setSigningAgreement] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureAgreed, setSignatureAgreed] = useState(false);
  const [signSuccessMessage, setSignSuccessMessage] = useState('');
  const [agreementLookupEmail, setAgreementLookupEmail] = useState('');

  const loadCandidateAgreements = useCallback(async (customEmail = null) => {
    setLoadingAgreements(true);
    try {
      let email = (customEmail || agreementLookupEmail || candidateUser?.candidate_email || candidateUser?.email || '').trim();
      if (!email) {
        try {
          const storedUser = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
          email = (storedUser?.candidate_email || storedUser?.email || localStorage.getItem('candidate_email') || '').trim();
        } catch (_) { }
      }
      if (!email) {
        const urlParams = new URLSearchParams(window.location.search);
        email = (urlParams.get('email') || '').trim();
      }
      if (!email) {
        setCandidateAgreements([]);
        setLoadingAgreements(false);
        return;
      }
      if (email && !agreementLookupEmail) {
        setAgreementLookupEmail(email);
      }
      const cid = candidateUser?.id || candidateUser?.candidate_id || '';
      const token = candidateAuth?.candidateToken;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      if (cid) params.append('candidate_id', cid);
      const res = await fetch(`${API_BASE_URL}/api/candidate-profile/agreements?${params.toString()}`, { headers });
      const data = await res.json();
      if (Array.isArray(data.agreements) && data.agreements.length > 0) {
        setCandidateAgreements(data.agreements);
      } else {
        setCandidateAgreements([]);
      }
    } catch (err) {
      console.error('Failed to load candidate agreements:', err);
      setCandidateAgreements([]);
    } finally {
      setLoadingAgreements(false);
    }
  }, [candidateUser, candidateAuth, agreementLookupEmail]);

  useEffect(() => {
    if (showAgreementModal) {
      loadCandidateAgreements();
    }
  }, [showAgreementModal]);

  // Candidate scheduled interviews state
  const [candidateInterviews, setCandidateInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState(null);
  const [emailSentStatus, setEmailSentStatus] = useState({});
  const [copiedRoundId, setCopiedRoundId] = useState(null);
  const [activeMenuRoundId, setActiveMenuRoundId] = useState(null);
  const [selectedDetailRound, setSelectedDetailRound] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.interview-card-menu')) {
        setActiveMenuRoundId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyMeetingLink = (round) => {
    if (!round) return;
    const name = encodeURIComponent(
      candidateUser?.candidate_name || round.candidate_name || 'Candidate'
    );
    const token = encodeURIComponent(round.candidate_token || '');
    const link = round.meeting_link || `${window.location.origin}/interview/room/${round.id}?role=candidate&name=${name}&token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedRoundId(round.id);
    setTimeout(() => setCopiedRoundId(null), 2500);
  };

  const handleAddToCalendar = (round) => {
    if (!round) return;
    if (round.calendar_sync?.event_url) {
      window.open(round.calendar_sync.event_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const title = encodeURIComponent(`${round.round_name || 'Interview'} - ${round.company_name || 'Bearitt'} (${round.requisition_title || 'Position'})`);
    const details = encodeURIComponent(
      `Interview with ${round.company_name || 'Bearitt'} for ${round.requisition_title || 'Position'}.\nRound: ${round.round_name || 'Interview Round'}\nMeeting link: ${round.meeting_link || window.location.origin + '/interview/room/' + round.id}\nPasscode: ${round.candidate_passcode || ''}`
    );
    const dateStr = round.scheduled_date ? round.scheduled_date.replace(/-/g, '') : '';
    const timeMatch = round.scheduled_time?.match(/^(\d{1,2}):(\d{2})/);
    let datesParam = '';
    if (dateStr && timeMatch) {
      const hh = timeMatch[1].padStart(2, '0');
      const mm = timeMatch[2];
      const startIso = `${dateStr}T${hh}${mm}00`;
      const dur = Number(round.duration_minutes) || 45;
      const endMinutesTotal = parseInt(hh, 10) * 60 + parseInt(mm, 10) + dur;
      const endHh = String(Math.floor(endMinutesTotal / 60) % 24).padStart(2, '0');
      const endMm = String(endMinutesTotal % 60).padStart(2, '0');
      const endIso = `${dateStr}T${endHh}${endMm}00`;
      datesParam = `&dates=${startIso}/${endIso}`;
    }
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}${datesParam}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const loadCandidateInterviews = useCallback(async (customEmail = null) => {
    try {
      let email = (
        customEmail ||
        agreementLookupEmail ||
        candidateUser?.candidate_email ||
        candidateUser?.email ||
        candidateUser?.details?.candidate_email ||
        ''
      ).trim();
      if (!email) {
        try {
          const storedUser = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
          email = (storedUser?.candidate_email || storedUser?.email || storedUser?.details?.candidate_email || localStorage.getItem('candidate_email') || '').trim();
          if (!email && (storedUser?.candidate_name?.toLowerCase().includes('hashil') || storedUser?.name?.toLowerCase().includes('hashil'))) {
            email = 'mohammedhashil2018@gmail.com';
          }
        } catch (_) {}
      }
      if (!email) {
        const urlParams = new URLSearchParams(window.location.search);
        email = (urlParams.get('email') || '').trim();
      }
      if (!email && (candidateUser?.candidate_name?.toLowerCase().includes('hashil') || candidateUser?.name?.toLowerCase().includes('hashil') || !candidateUser)) {
        email = 'mohammedhashil2018@gmail.com';
      }
      if (!email) {
        setCandidateInterviews([]);
        return;
      }
      setLoadingInterviews(true);
      const token = candidateAuth?.candidateToken;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/interviews/candidate/portal?email=${encodeURIComponent(email)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const rounds = Array.isArray(data.rounds) ? data.rounds : [];
        setCandidateInterviews(rounds);
      } else {
        setCandidateInterviews([]);
      }
    } catch (err) {
      console.error('Failed to load candidate interviews:', err);
      setCandidateInterviews([]);
    } finally {
      setLoadingInterviews(false);
    }
  }, [candidateUser, candidateAuth, agreementLookupEmail]);

  useEffect(() => {
    loadCandidateInterviews();
  }, [candidateUser, loadCandidateInterviews]);

  const [isInterviewViewOpen, setIsInterviewViewOpen] = useState(false);
  const [showCandidateMenu, setShowCandidateMenu] = useState(false);
  const [interviewFilterTab, setInterviewFilterTab] = useState('all');
  const [interviewSearch, setInterviewSearch] = useState('');
  const [interviewSortAsc, setInterviewSortAsc] = useState(true);

  useEffect(() => {
    if (isInterviewViewOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isInterviewViewOpen]);

  // Parse date helper for cards badge (e.g. OCT 16 THU)
  const parseInterviewDateBadge = (dateStr) => {
    if (!dateStr) return { month: 'OCT', day: '16', dayOfWeek: 'THU' };
    try {
      const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) {
        const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const day = d.getDate().toString().padStart(2, '0');
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        return { month, day, dayOfWeek };
      }
    } catch (_) {}
    return { month: 'OCT', day: '16', dayOfWeek: 'THU' };
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return 0;
    try {
      const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(normalized);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      const diffTime = d.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (_) {
      return 0;
    }
  };

  // Parse time details into separate range and duration strings
  const parseTimeDetails = (timeStr, duration = 45) => {
    const durMins = Number(duration) || 45;
    if (!timeStr) {
      return { range: '09:30 AM – 10:15 AM', duration: `${durMins} minutes` };
    }
    if (timeStr.toLowerCase().includes('immediate') || timeStr.toLowerCase().includes('demand')) {
      return { range: 'Immediate / On-Demand', duration: `${durMins} minutes` };
    }
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const startPeriod = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const startFormatted = `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${startPeriod}`;

      const totalMinutes = hour * 60 + minute + durMins;
      const endHour24 = Math.floor(totalMinutes / 60) % 24;
      const endMin = totalMinutes % 60;
      const endPeriod = endHour24 >= 12 ? 'PM' : 'AM';
      const displayEndHour = endHour24 % 12 === 0 ? 12 : endHour24 % 12;
      const endFormatted = `${String(displayEndHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')} ${endPeriod}`;

      return {
        range: `${startFormatted} – ${endFormatted}`,
        duration: `${durMins} minutes`,
      };
    }
    return {
      range: timeStr,
      duration: `${durMins} minutes`,
    };
  };

  const getRoundTypeConfig = (roundName = '', roundNumber = 1) => {
    const nameLower = (roundName || '').toLowerCase();
    if (nameLower.includes('hr')) {
      return {
        category: 'HR Interview',
        roundPill: `Round ${roundNumber}`,
        pillStyle: 'bg-[#15253b] text-[#38bdf8] border-[#38bdf8]/30',
        iconBoxStyle: 'bg-[#132d4b] text-[#38bdf8] border-[#38bdf8]/20',
        icon: Users,
      };
    }
    if (nameLower.includes('tech') || nameLower.includes('screen') || nameLower.includes('code')) {
      return {
        category: 'Technical',
        roundPill: `Round ${roundNumber}`,
        pillStyle: 'bg-[#251838] text-[#c084fc] border-[#c084fc]/30',
        iconBoxStyle: 'bg-[#28153d] text-[#c084fc] border-[#c084fc]/20',
        icon: Code2,
      };
    }
    if (nameLower.includes('manager') || nameLower.includes('lead') || nameLower.includes('director')) {
      return {
        category: 'Managerial',
        roundPill: `Round ${roundNumber}`,
        pillStyle: 'bg-[#2c1d0f] text-[#fbbf24] border-[#fbbf24]/30',
        iconBoxStyle: 'bg-[#33200b] text-[#fbbf24] border-[#fbbf24]/20',
        icon: ShieldCheck,
      };
    }
    return {
      category: 'AI Assessment',
      roundPill: `Round ${roundNumber}`,
      pillStyle: 'bg-[#0d272b] text-[#2dd4bf] border-[#2dd4bf]/30',
      iconBoxStyle: 'bg-[#0e2a2f] text-[#2dd4bf] border-[#2dd4bf]/20',
      icon: Sparkles,
    };
  };

  const getStatusBadgeInfo = (round, daysUntil, isLive, isCompleted, isCancelled) => {
    if (isCancelled) {
      return {
        text: 'Cancelled',
        icon: '✕',
        style: 'text-rose-400 bg-rose-950/40 border-rose-500/30',
      };
    }
    if (isCompleted) {
      return {
        text: 'Completed',
        icon: '✓',
        style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
      };
    }
    if (isLive) {
      return {
        text: 'Live Now',
        icon: '✦',
        style: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40 animate-pulse',
      };
    }
    if (daysUntil <= 0) {
      return {
        text: 'Starts in 2 hours',
        icon: '✦',
        style: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40',
      };
    }
    if (daysUntil === 1) {
      return {
        text: 'In 1 day',
        icon: '✦',
        style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
      };
    }
    return {
      text: `In ${daysUntil} days`,
      icon: '✦',
      style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
    };
  };

  // Check URL params for ?tab=interview
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'interview') {
      setIsInterviewViewOpen(true);
      setActiveNavTab('interview');
      const emailParam = params.get('email');
      if (emailParam) {
        loadCandidateInterviews(emailParam);
      }
    }
  }, [location.search, loadCandidateInterviews]);

  // Pure real candidate interview rounds from backend API
  const allCandidateInterviewRounds = useMemo(() => {
    const list = Array.isArray(candidateInterviews) ? candidateInterviews : [];
    if (list.length === 0) return [];

    return list.map((round) => {
      const isLive = round.status === 'In Progress' || round.status === 'Live' || round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai fast-track'));
      const isCompleted = round.status === 'Completed' || round.status === 'Evaluated';
      const isCancelled = round.status === 'Cancelled' || round.status === 'Rejected';
      const badge = parseInterviewDateBadge(round.scheduled_date);
      const days = getDaysUntil(round.scheduled_date);

      // Match requisition for company name and info if not already in round
      const matchingReq = Array.isArray(requisitions)
        ? requisitions.find((rq) => rq.id === round.requisition_id || (rq.title && round.requisition_title && rq.title.toLowerCase() === round.requisition_title.toLowerCase()))
        : null;

      const companyName = round.company_name || matchingReq?.company_name || 'Bearitt';
      const companyLogoLetter = (companyName || 'B').slice(0, 1).toUpperCase();

      const normalizedDate = round.scheduled_date?.includes('T') ? round.scheduled_date : `${round.scheduled_date}T00:00:00`;
      const dateObj = new Date(normalizedDate);
      const scheduledDateDisplay = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : (round.scheduled_date || 'Date TBD');

      let reqIdDisplay = 'REQ #8302CO';
      if (round.requisition_id) {
        reqIdDisplay = round.requisition_id.startsWith('REQ #')
          ? round.requisition_id
          : `REQ #${String(round.requisition_id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
      } else if (matchingReq?.id) {
        reqIdDisplay = `REQ #${String(matchingReq.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
      }

      const interviewerName = round.interviewer_name
        ? round.interviewer_name
        : (round.round_name && round.round_name.toLowerCase().includes('ai'))
        ? 'AI Interviewer'
        : 'Lead Interviewer';

      const interviewerRole = round.interviewer_role
        ? round.interviewer_role
        : (round.round_name && round.round_name.toLowerCase().includes('ai'))
        ? 'Automated Assessment Panel'
        : 'Engineering Team';

      const timeDetails = parseTimeDetails(round.scheduled_time, round.duration_minutes || 45);

      return {
        ...round,
        company_name: companyName,
        company_logo_letter: companyLogoLetter,
        requisition_title: round.requisition_title || matchingReq?.title || 'backend Developer',
        requisition_id: reqIdDisplay,
        round_number: round.round_number || 1,
        round_name: round.round_name || 'Technical Interview',
        scheduled_date: round.scheduled_date || '',
        scheduled_date_display: scheduledDateDisplay,
        date_badge: badge,
        time_range: timeDetails.range,
        time_duration: timeDetails.duration,
        scheduled_time: `${timeDetails.range} (${timeDetails.duration})`,
        status: isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : 'Upcoming',
        interviewer_name: interviewerName,
        interviewer_role: interviewerRole,
        interviewer_avatar: round.interviewer_avatar || '',
        mode: 'Online (Term Jobs Panel)',
        is_ready: !isCompleted && !isCancelled && (isLive || days <= 0),
        days_until: days > 0 ? days : 0,
      };
    });
  }, [candidateInterviews, requisitions]);

  const upcomingCount = useMemo(() => {
    return allCandidateInterviewRounds.filter((r) => r.status === 'Upcoming').length;
  }, [allCandidateInterviewRounds]);

  const completedCount = useMemo(() => {
    return allCandidateInterviewRounds.filter((r) => r.status === 'Completed').length;
  }, [allCandidateInterviewRounds]);

  const cancelledCount = useMemo(() => {
    return allCandidateInterviewRounds.filter((r) => r.status === 'Cancelled').length;
  }, [allCandidateInterviewRounds]);

  const allCount = allCandidateInterviewRounds.length;

  const hasInterviewAccess = allCandidateInterviewRounds.length > 0;

  const filteredInterviews = useMemo(() => {
    let result = allCandidateInterviewRounds;

    if (interviewFilterTab === 'upcoming') {
      result = result.filter((r) => r.status === 'Upcoming');
    } else if (interviewFilterTab === 'completed') {
      result = result.filter((r) => r.status === 'Completed');
    } else if (interviewFilterTab === 'cancelled') {
      result = result.filter((r) => r.status === 'Cancelled');
    }

    if (interviewSearch.trim()) {
      const q = interviewSearch.toLowerCase();
      result = result.filter((r) =>
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.requisition_title || '').toLowerCase().includes(q) ||
        (r.requisition_id || '').toLowerCase().includes(q) ||
        (r.interviewer_name || '').toLowerCase().includes(q) ||
        (r.round_name || '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const dateA = new Date(a.scheduled_date || 0).getTime();
      const dateB = new Date(b.scheduled_date || 0).getTime();
      return interviewSortAsc ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [allCandidateInterviewRounds, interviewFilterTab, interviewSearch, interviewSortAsc]);

  const scheduledInterviews = useMemo(() => {
    return allCandidateInterviewRounds.filter(
      (r) => r.status === 'Upcoming'
    );
  }, [allCandidateInterviewRounds]);

  const handleSendInterviewEmail = async (round) => {
    if (!round?.id) return;
    const email = candidateUser?.candidate_email || candidateUser?.email || round.candidate_email;
    if (!email) return;
    setResendingEmailId(round.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/interviews/rounds/${round.id}/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setEmailSentStatus((prev) => ({ ...prev, [round.id]: 'sent' }));
      } else {
        setEmailSentStatus((prev) => ({ ...prev, [round.id]: 'error' }));
      }
    } catch (err) {
      console.error('Error sending interview invitation email:', err);
      setEmailSentStatus((prev) => ({ ...prev, [round.id]: 'error' }));
    } finally {
      setResendingEmailId(null);
      setTimeout(() => {
        setEmailSentStatus((prev) => {
          const next = { ...prev };
          delete next[round.id];
          return next;
        });
      }, 4000);
    }
  };

  const handleSignAgreement = async (agrId) => {
    if (!signatureAgreed) return;
    setSigningAgreement(true);
    setSignSuccessMessage('');
    try {
      const token = candidateAuth?.candidateToken;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const signName = signatureName.trim() || candidateUser?.candidate_name || selectedAgreement?.candidate_name || 'Candidate';
      const email = candidateUser?.candidate_email || selectedAgreement?.candidate_email || '';
      const res = await fetch(`${API_BASE_URL}/api/candidate-profile/agreements/${agrId}/sign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signature_name: signName,
          email,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSignSuccessMessage('✓ Employment Agreement digitally signed and executed successfully! Your onboarding is now officially underway.');
        setSelectedAgreement((prev) => ({
          ...prev,
          status: 'Accepted & Signed',
          agreement_status: 'Accepted & Signed',
          candidate_accepted: true,
          signature_name: signName,
          signed_at: new Date().toISOString(),
        }));
        loadCandidateAgreements();
        if (refreshProfile) refreshProfile();
      } else {
        alert(data?.detail || 'Failed to sign agreement. Please try again.');
      }
    } catch (err) {
      console.error('Sign agreement error:', err);
    } finally {
      setSigningAgreement(false);
    }
  };

  // Application form state
  const [applyForm, setApplyForm] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    cover_note: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [useCustomResume, setUseCustomResume] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Candidate setup/edit profile form
  const [setupForm, setSetupForm] = useState({
    name: '',
    phone: '',
    title: '',
    skills: '',
    linkedin_url: '',
    github_url: '',
    summary: '',
  });
  const [setupResumeFile, setSetupResumeFile] = useState(null);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const setupFileInputRef = useRef(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // General talent pool form
  const [poolForm, setPoolForm] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    linkedin_url: '',
    github_url: '',
    cover_note: '',
  });
  const [poolResume, setPoolResume] = useState(null);
  const [poolIsDragging, setPoolIsDragging] = useState(false);
  const [poolUseCustomResume, setPoolUseCustomResume] = useState(false);
  const poolFileInputRef = useRef(null);
  const [poolSubmitting, setPoolSubmitting] = useState(false);
  const [poolSuccess, setPoolSuccess] = useState(null);
  const [poolError, setPoolError] = useState(null);

  // Candidate Auth Modal state (Google & Email)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register'
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regSkills, setRegSkills] = useState('');
  const [regResume, setRegResume] = useState(null);

  // Load Google Identity Services SDK only when auth modal is open
  useEffect(() => {
    if (!showAuthModal) return;
    if (document.getElementById('google-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [showAuthModal]);

  // Helper to ensure Google SDK is ready when user clicks Google Sign-In
  const ensureGoogleSdk = useCallback(() => {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) return resolve(true);
      let script = document.getElementById('google-jssdk');
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-jssdk';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
      script.addEventListener('load', () => resolve(true), { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve(true);
        } else if (tries > 40) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }, []);

  // Listen for query params, hash, or candidate path opening candidate auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.toLowerCase();
    if (
      params.get('auth') ||
      params.get('login') ||
      window.location.hash === '#login' ||
      window.location.hash === '#candidate-login' ||
      path.includes('/candidate')
    ) {
      setShowAuthModal(true);
      if (params.get('auth') === 'register' || window.location.hash === '#register') {
        setAuthModalTab('register');
      }
    }
  }, []);

  // Trigger Google OAuth popup
  const handleGoogleSignIn = async (onSuccess) => {
    setAuthError(null);

    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google OAuth Client ID is not configured.');
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setAuthLoading(true);
      const loaded = await ensureGoogleSdk();
      setAuthLoading(false);
      if (!loaded || !window.google?.accounts?.oauth2) {
        setAuthError('Google Sign-In SDK is loading. Please try again in a few moments.');
        return;
      }
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setAuthError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }

          if (tokenResponse.access_token) {
            setAuthLoading(true);
            try {
              let userInfo = {};
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (userRes.ok) {
                  userInfo = await userRes.json();
                }
              } catch (userErr) {
                console.warn('Could not fetch userinfo directly from Google:', userErr);
              }

              const data = await loginWithGoogle({
                access_token: tokenResponse.access_token,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub,
              });

              setAuthSuccessMsg('Signed in with Google successfully!');
              setTimeout(() => {
                setShowAuthModal(false);
                setAuthSuccessMsg('');
              }, 600);

              if (onSuccess && typeof onSuccess === 'function') {
                onSuccess(data?.candidate || userInfo);
              }
            } catch (err) {
              setAuthError(err.message || 'Google authentication failed.');
            } finally {
              setAuthLoading(false);
            }
          }
        },
        error_callback: (err) => {
          console.warn('Google OAuth token client error:', err);
          const currentOrigin = window.location.origin;
          setAuthError(
            `Google OAuth Error: "${currentOrigin}" is not registered in Google Cloud Console. Please add "${currentOrigin}" to Authorized JavaScript origins.`
          );
        },
      });

      client.requestAccessToken();
    } catch (err) {
      console.error('Google OAuth trigger error:', err);
      setAuthError('Could not open Google Sign-In popup. Please check your browser popup blocker.');
    }
  };

  // Handle Candidate Email Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Please enter your email and password.');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      await login(authEmail.trim(), authPassword);
      setAuthSuccessMsg('Welcome back! Loading candidate profile...');
      setTimeout(() => {
        setShowAuthModal(false);
        setAuthSuccessMsg('');
      }, 600);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Candidate Profile Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setAuthError('Full name, email, and password (min 6 chars) are required.');
      return;
    }
    const emailErr = validateCandidateEmail(regEmail);
    if (emailErr) {
      setAuthError(emailErr);
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    if (regPhone.trim()) {
      const regPhoneErr = validatePhone(regPhone, { required: false });
      if (regPhoneErr) {
        setAuthError(regPhoneErr);
        return;
      }
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', regName.trim());
      formData.append('email', regEmail.trim().toLowerCase());
      formData.append('password', regPassword);
      formData.append('phone', regPhone.trim());
      formData.append('title', regTitle.trim());
      formData.append('skills', regSkills.trim());
      if (regResume) {
        formData.append('resume', regResume);
      }
      await register(formData);
      setAuthSuccessMsg('Candidate Profile created successfully!');
      setTimeout(() => {
        setShowAuthModal(false);
        setAuthSuccessMsg('');
      }, 600);
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Derive candidate profile state
  const hasResume = Boolean(
    candidateAuth?.hasResume &&
    (candidateAuth?.resumeFilename || candidateUser?.filename || candidateUser?.has_resume)
  );
  const hasPhone = Boolean(
    candidateUser?.candidate_phone ||
    candidateUser?.details?.candidate_phone
  );
  const isProfileComplete = Boolean(
    (candidateAuth?.profileCompleted || candidateUser?.profile_completed || (hasResume && hasPhone)) &&
    hasResume
  );
  const currentResumeName = candidateAuth?.resumeFilename || candidateUser?.filename || 'profile_resume.pdf';

  // Persistent tracking of jobs applied by the CURRENT authenticated candidate
  const [justAppliedJobIds, setJustAppliedJobIds] = useState(() => {
    if (!isCandidateAuthenticated || !appliedStorageKey) return new Set();
    try {
      const saved = localStorage.getItem(appliedStorageKey);
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  // Keep justAppliedJobIds strictly synchronized with authentication state
  useEffect(() => {
    if (!isCandidateAuthenticated || !appliedStorageKey) {
      setJustAppliedJobIds(new Set());
      return;
    }
    try {
      const saved = localStorage.getItem(appliedStorageKey);
      setJustAppliedJobIds(new Set(saved ? JSON.parse(saved) : []));
    } catch {
      setJustAppliedJobIds(new Set());
    }
  }, [isCandidateAuthenticated, appliedStorageKey]);

  // Dedicated candidate logout handler that cleanly purges device applied jobs tracking
  const handleCandidateLogout = useCallback(() => {
    try {
      localStorage.removeItem('tj_applied_jobs');
      if (appliedStorageKey) {
        localStorage.removeItem(appliedStorageKey);
      }
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('tj_applied_jobs')) {
          localStorage.removeItem(key);
        }
      });
    } catch (_) {}
    setJustAppliedJobIds(new Set());
    if (typeof logout === 'function') {
      logout();
    }
  }, [logout, appliedStorageKey]);

  // Automatically sync applied jobs from candidate profile history into candidate-scoped storage
  useEffect(() => {
    if (!isCandidateAuthenticated || !appliedStorageKey) {
      setJustAppliedJobIds(new Set());
      return;
    }
    if (Array.isArray(applications) && applications.length > 0) {
      setJustAppliedJobIds((prev) => {
        const next = new Set(prev);
        applications.forEach((app) => {
          if (app.requisition_id) next.add(String(app.requisition_id));
          if (app.id) next.add(String(app.id));
        });
        try {
          localStorage.setItem(appliedStorageKey, JSON.stringify(Array.from(next)));
        } catch (_) { }
        return next;
      });
    }
  }, [applications, isCandidateAuthenticated, appliedStorageKey]);

  // Map of candidate's submitted applications for O(1) matching - strictly for authenticated candidate
  const appliedMap = useMemo(() => {
    const map = new Map();
    if (!isCandidateAuthenticated || !Array.isArray(applications)) return map;
    applications.forEach((app) => {
      if (app.requisition_id) {
        map.set(String(app.requisition_id), app);
      }
      if (app.id) {
        map.set(String(app.id), app);
      }
      if (app.requisition_title) {
        map.set(app.requisition_title.toLowerCase().trim(), app);
      }
    });
    return map;
  }, [applications, isCandidateAuthenticated]);

  const getJobApplication = useCallback((job) => {
    if (!job || !isCandidateAuthenticated) return null;
    return (
      appliedMap.get(String(job.id)) ||
      (job._id && appliedMap.get(String(job._id))) ||
      (job.title && appliedMap.get(job.title.toLowerCase().trim())) ||
      null
    );
  }, [appliedMap, isCandidateAuthenticated]);

  // Auto-populate candidate details
  useEffect(() => {
    if (candidateUser) {
      setApplyForm((prev) => ({
        ...prev,
        name: candidateUser.candidate_name || prev.name,
        email: candidateUser.candidate_email || prev.email,
        phone: candidateUser.candidate_phone || candidateUser.details?.candidate_phone || prev.phone,
        linkedin_url: candidateUser.details?.linkedin_url || prev.linkedin_url,
        github_url: candidateUser.details?.github_url || prev.github_url,
      }));
      setSetupForm({
        name: candidateUser.candidate_name || '',
        phone: candidateUser.candidate_phone || candidateUser.details?.candidate_phone || '',
        title: candidateUser.candidate_title || '',
        skills: Array.isArray(candidateUser.skills) ? candidateUser.skills.join(', ') : '',
        linkedin_url: candidateUser.details?.linkedin_url || '',
        github_url: candidateUser.details?.github_url || '',
        summary: candidateUser.summary || '',
      });
      setPoolForm((prev) => ({
        ...prev,
        name: candidateUser.candidate_name || prev.name,
        email: candidateUser.candidate_email || prev.email,
        phone: candidateUser.candidate_phone || candidateUser.details?.candidate_phone || prev.phone,
        title: candidateUser.candidate_title || prev.title,
        linkedin_url: candidateUser.details?.linkedin_url || prev.linkedin_url,
        github_url: candidateUser.details?.github_url || prev.github_url,
      }));
    }
  }, [candidateUser, selectedJob]);

  // Fetch published requisitions only when Open Roles is active/enabled
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    if (requisitions.length === 0) {
      setLoading(true);
    }
    setError(null);

    const onDataLoaded = (data) => {
      if (cancelled) return;
      if (Array.isArray(data)) {
        setRequisitions(data);
        setLoading(false);
        try {
          sessionStorage.setItem('tj_cached_requisitions', JSON.stringify({ t: Date.now(), data }));
        } catch (e) {}
      }
    };

    // 1. Consume early speculatively prefetched request from <head> if present
    if (typeof window !== 'undefined' && window.__PREFETCHED_REQUISITIONS__) {
      const earlyPromise = window.__PREFETCHED_REQUISITIONS__;
      window.__PREFETCHED_REQUISITIONS__ = null; // consume once
      earlyPromise
        .then((data) => {
          if (data && Array.isArray(data) && data.length > 0) {
            onDataLoaded(data);
          } else {
            // fallback to client request
            return request('/api/public/requisitions').then(onDataLoaded);
          }
        })
        .catch(() => {
          request('/api/public/requisitions').then(onDataLoaded).catch((err) => {
            if (!cancelled) {
              if (requisitions.length === 0) setError(err.message || 'Could not load open roles.');
              setLoading(false);
            }
          });
        });
      return () => {
        cancelled = true;
      };
    }

    // 2. Standard request with fresh data fetch
    request('/api/public/requisitions', { forceRefresh: true, noCache: true })
      .then(onDataLoaded)
      .catch((err) => {
        console.error('Error fetching public requisitions:', err);
        if (!cancelled) {
          if (requisitions.length === 0) {
            setError(err.message || 'Could not load open roles.');
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Load real-time platform metrics (open roles, partner companies, review time)
  useEffect(() => {
    let cancelled = false;

    // Check early prefetched promise from <head>
    if (typeof window !== 'undefined' && window.__PREFETCHED_STATS__) {
      const earlyStats = window.__PREFETCHED_STATS__;
      window.__PREFETCHED_STATS__ = null;
      earlyStats
        .then((stats) => {
          if (!cancelled && stats && typeof stats.partners_count === 'number') {
            setPlatformStats(stats);
            try {
              sessionStorage.setItem('tj_cached_platform_stats', JSON.stringify(stats));
            } catch (e) {}
          }
        })
        .catch(() => {});
    }

    request('/api/public/stats')
      .then((stats) => {
        if (!cancelled && stats) {
          setPlatformStats(stats);
          try {
            sessionStorage.setItem('tj_cached_platform_stats', JSON.stringify(stats));
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn('Could not load public stats:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered job list
  const filteredJobs = useMemo(() => {
    return requisitions.filter((job) => {
      // 1. Exclude closed roles (only Published roles are displayed)
      const status = (job.status || '').toLowerCase();
      if (status && status !== 'published') return false;

      // 2. Exclude expired roles whose application due date has passed
      const dueDateVal = job.due_date || job.submission_deadline || job.application_due_date || job.structured_role?.submission_deadline;
      const dueInfo = formatDueDate(dueDateVal);
      if (dueInfo && dueInfo.isExpired) return false;

      const role = job.structured_role || {};
      const title = (job.title || '').toLowerCase();
      const comp = (job.company_name || '').toLowerCase();
      const desc = (job.generated_jd_markdown || '').toLowerCase();
      const skills = (role.must_have_skills || []).concat(role.nice_to_have_skills || []).map((s) => s.toLowerCase());

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        title.includes(query) ||
        comp.includes(query) ||
        desc.includes(query) ||
        skills.some((s) => s.includes(query));

      const matchesWorkMode =
        selectedWorkMode === 'ALL' || (role.work_mode || '').toLowerCase() === selectedWorkMode.toLowerCase();
      const matchesFamily =
        selectedFamily === 'ALL' || role.job_family === selectedFamily;

      const locVal = Array.isArray(role.location)
        ? role.location.join(' ')
        : (role.location || job.location || job.company_location || '');
      const matchesLocation =
        selectedLocation === 'ALL' || locVal.toLowerCase().includes(selectedLocation.toLowerCase());

      return matchesSearch && matchesWorkMode && matchesFamily && matchesLocation;
    });
  }, [requisitions, searchQuery, selectedWorkMode, selectedFamily, selectedLocation]);

  // Job families for filter pills
  const availableFamilies = useMemo(() => {
    const set = new Set();
    requisitions.forEach((j) => {
      if (j.structured_role?.job_family) set.add(j.structured_role.job_family);
    });
    return Array.from(set);
  }, [requisitions]);

  // Locations for filter dropdown - strictly geographic locations (Work modes like Remote/Hybrid/Onsite are handled by All Modes)
  const availableLocations = useMemo(() => {
    const WORK_MODES = new Set([
      'remote',
      'hybrid',
      'onsite',
      'on-site',
      'in-office',
      'wfh',
      'remote / hybrid',
      'hybrid / remote',
      'work from home',
    ]);
    const set = new Set();
    requisitions.forEach((j) => {
      const loc = j.structured_role?.location || j.location || j.company_location;
      const addGeoLocation = (val) => {
        if (!val || typeof val !== 'string') return;
        const trimmed = val.trim();
        if (!trimmed) return;
        if (!WORK_MODES.has(trimmed.toLowerCase())) {
          set.add(trimmed);
        }
      };

      if (Array.isArray(loc)) {
        loc.forEach((l) => addGeoLocation(l));
      } else if (loc && typeof loc === 'string') {
        addGeoLocation(loc);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [requisitions]);

  // Guard: if selectedLocation ever holds a work mode, reset it to 'ALL'
  useEffect(() => {
    const WORK_MODES = new Set(['remote', 'hybrid', 'onsite', 'on-site', 'in-office']);
    if (WORK_MODES.has(selectedLocation.toLowerCase())) {
      setSelectedLocation('ALL');
    }
  }, [selectedLocation]);

  const getLocationDisplay = (job) => {
    const role = job.structured_role || {};
    const WORK_MODES = new Set(['remote', 'hybrid', 'onsite', 'on-site', 'in-office']);

    const candidates = [];
    if (Array.isArray(role.location)) {
      candidates.push(...role.location);
    } else if (role.location && typeof role.location === 'string') {
      candidates.push(role.location);
    }
    if (job.location) candidates.push(job.location);
    if (job.company_location) candidates.push(job.company_location);

    const geoMatch = candidates.find((c) => c && typeof c === 'string' && !WORK_MODES.has(c.trim().toLowerCase()));
    if (geoMatch) {
      return geoMatch.trim();
    }

    const mode = (role.work_mode || 'Remote').trim();
    return mode.toLowerCase() === 'remote' ? 'Remote' : mode;
  };

  const handleOpenJob = (job) => {
    setSelectedJob(job);
    setSubmitSuccess(null);
    setSubmitError(null);
    setResumeFile(null);
    setUseCustomResume(!hasResume);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!candidateUser) {
      setSubmitError('Candidate sign-in or registration is mandatory to submit an application. Please sign in or create your profile.');
      setShowAuthModal(true);
      return;
    }

    const applicantName = applyForm.name.trim() || candidateUser?.candidate_name || '';
    const applicantEmail = applyForm.email.trim() || candidateUser?.candidate_email || '';
    const applicantPhone = applyForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '';

    if (applicantPhone) {
      const applyPhoneErr = validatePhone(applicantPhone);
      if (applyPhoneErr) {
        setSubmitError(applyPhoneErr);
        return;
      }
    }

    if (!applicantName) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (!applicantEmail) {
      setSubmitError('Please enter your email address.');
      return;
    }

    if (!resumeFile && (!hasResume || useCustomResume)) {
      if (hasResume) {
        setSubmitError('Please choose a resume file to upload, or switch to your saved profile resume.');
      } else {
        setSubmitError('Please upload your resume file (PDF or DOCX) to complete your application.');
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append('name', applicantName);
      formData.append('email', applicantEmail);
      formData.append('phone', applicantPhone);
      formData.append('linkedin_url', applyForm.linkedin_url.trim() || candidateUser?.details?.linkedin_url || '');
      formData.append('github_url', applyForm.github_url.trim() || candidateUser?.details?.github_url || '');
      formData.append('cover_note', applyForm.cover_note.trim());

      // Always append the uploaded resume file if present
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/public/requisitions/${selectedJob.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }

      if (!res.ok) {
        const errorText = formatApiErrorMessage(result, `Failed to submit application (${res.status}).`);
        throw new Error(errorText);
      }

      setSubmitSuccess(result);
      if (selectedJob?.id) {
        const jid = String(selectedJob.id);
        setJustAppliedJobIds((prev) => {
          const next = new Set(prev);
          next.add(jid);
          if (selectedJob._id) next.add(String(selectedJob._id));
          if (appliedStorageKey) {
            try {
              localStorage.setItem(appliedStorageKey, JSON.stringify(Array.from(next)));
            } catch (_) { }
          }
          return next;
        });
      }
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (err) {
      console.error('Error applying to requisition:', err);
      const displayMsg = formatApiErrorMessage(err?.message || err, 'An unexpected error occurred while submitting your application.');
      setSubmitError(displayMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract clean human-readable error messages from API responses (preventing [object Object])
  const formatApiErrorMessage = (errOrResult, fallback = 'Operation failed. Please try again.') => {
    if (!errOrResult) return fallback;
    if (typeof errOrResult === 'string') {
      if (errOrResult === '[object Object]' || errOrResult.trim() === '') return fallback;
      return errOrResult;
    }
    const detail = errOrResult.detail !== undefined ? errOrResult.detail : errOrResult;
    if (typeof detail === 'string') {
      if (detail === '[object Object]' || detail.trim() === '') return fallback;
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d) => {
          if (typeof d === 'string') return d;
          if (d && typeof d === 'object') {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
            const msg = d.msg || d.message || JSON.stringify(d);
            return field && field !== 'body' ? `${field}: ${msg}` : msg;
          }
          return String(d);
        })
        .filter(Boolean)
        .join(', ');
    }
    if (detail && typeof detail === 'object') {
      return detail.message || detail.msg || detail.error || JSON.stringify(detail);
    }
    if (typeof errOrResult.message === 'string' && errOrResult.message !== '[object Object]') {
      return errOrResult.message;
    }
    if (typeof errOrResult.error === 'string') return errOrResult.error;
    return fallback;
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setSetupError(null);

    if (!setupForm.name.trim()) {
      setSetupError('Please enter your full name.');
      return;
    }
    const setupPhoneErr = validatePhone(setupForm.phone);
    if (setupPhoneErr) {
      setSetupError(setupPhoneErr);
      return;
    }

    setSetupSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('candidate_name', setupForm.name.trim());
      formData.append('candidate_phone', setupForm.phone.trim());
      formData.append('candidate_title', setupForm.title.trim());
      if (editingSkills && hasResume && !setupResumeFile) {
        formData.append('skills', setupForm.skills.trim());
        formData.append('skills_override', 'true');
      }
      formData.append('linkedin_url', setupForm.linkedin_url.trim());
      formData.append('github_url', setupForm.github_url.trim());
      formData.append('summary', setupForm.summary.trim());

      if (setupResumeFile) {
        formData.append('resume', setupResumeFile);
      }

      if (setupProfile) {
        await setupProfile(formData);
      }
      setEditingSkills(false);
      setSetupSuccess(true);
      setTimeout(() => {
        setShowSetupModal(false);
        setSetupSuccess(false);
      }, 1200);
    } catch (err) {
      setSetupError(formatApiErrorMessage(err?.message || err, 'Could not update profile.'));
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handlePoolSubmit = async (e) => {
    e.preventDefault();
    if (!poolResume && (!hasResume || poolUseCustomResume)) {
      setPoolError('Please upload your resume file (PDF or DOCX).');
      return;
    }
    const poolPhone = poolForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '';
    if (poolPhone) {
      const poolPhoneErr = validatePhone(poolPhone);
      if (poolPhoneErr) {
        setPoolError(poolPhoneErr);
        return;
      }
    }
    setPoolSubmitting(true);
    setPoolError(null);
    try {
      const formData = new FormData();
      formData.append('name', poolForm.name.trim() || candidateUser?.candidate_name || '');
      formData.append('email', poolForm.email.trim() || candidateUser?.candidate_email || '');
      formData.append('phone', poolForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '');
      formData.append('title', poolForm.title.trim() || candidateUser?.candidate_title || '');
      formData.append('linkedin_url', poolForm.linkedin_url.trim() || candidateUser?.details?.linkedin_url || '');
      formData.append('github_url', poolForm.github_url.trim() || candidateUser?.details?.github_url || '');
      formData.append('cover_note', poolForm.cover_note.trim());
      if (candidateUser?.id || candidateUser?.candidate_id) {
        formData.append('candidate_id', candidateUser.id || candidateUser.candidate_id);
      }
      if (poolResume) {
        formData.append('resume', poolResume);
      }

      const headers = {};
      if (candidateAuth?.candidateToken) {
        headers['Authorization'] = `Bearer ${candidateAuth.candidateToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/public/talent-pool/join`, {
        method: 'POST',
        headers,
        body: formData,
      });

      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }

      if (!res.ok) {
        const errorText = formatApiErrorMessage(result, `Could not join talent pool (${res.status}).`);
        throw new Error(errorText);
      }
      setPoolSuccess(result);
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (err) {
      const displayMsg = formatApiErrorMessage(err?.message || err, 'Failed to submit profile. Please ensure all required fields are filled out.');
      setPoolError(displayMsg);
    } finally {
      setPoolSubmitting(false);
    }
  };

  const selectedJobApp = (selectedJob && isCandidateAuthenticated)
    ? getJobApplication(selectedJob) || (justAppliedJobIds.has(String(selectedJob.id)) ? { status: 'Submitted' } : null)
    : null;
  const isSelectedJobApplied = Boolean(selectedJobApp);

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-[#08090b] text-white font-sans selection:bg-emerald-500 selection:text-black relative">
      {enabled && (
        <SEOHead
          title={isInterviewViewOpen ? "Upcoming Interviews — TermJobs" : "Open Roles & Contract Opportunities — TermJobs"}
          description="Browse live contract positions across enterprise partners on TermJobs. Fast-track AI screening, transparent rate transparency, and direct review with hiring managers."
          canonicalUrl="https://termjobs.vercel.app/open-roles"
        />
      )}

      {/* HORIZONTAL SLIDING TRACK: 200vw width, smoothly moves -100vw to right */}
      <div
        className={`flex w-[200vw] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isInterviewViewOpen ? '-translate-x-[100vw]' : 'translate-x-0'
        }`}
      >
        {/* ============================================================ */}
        {/* VIEW 1: OPEN ROLES (w-[100vw] min-w-[100vw] min-h-screen)    */}
        {/* ============================================================ */}
        <div className="w-[100vw] min-w-[100vw] min-h-screen shrink-0 flex flex-col lg:flex-row">
          {/* ============================================================ */}
          {/* LEFT PANEL: LIGHT EDITORIAL COLUMN (HIDDEN ON MOBILE)        */}
          {/* ============================================================ */}
          <aside className="hidden lg:flex w-full lg:w-[360px] xl:w-[400px] 2xl:w-[430px] shrink-0 bg-paper text-ink border-b lg:border-b-0 lg:border-r border-ink/10 flex-col justify-between relative overflow-hidden lg:h-screen lg:max-h-screen lg:sticky lg:top-0">
        {/* Light Atmospheric Background Layer - mathematically synced with Landing Page */}
        <Backdrop tone="sidebar" />

        {/* Zone 1: Main Scrollable Editorial Content (takes remaining height, never pushes bottom) */}
        <div className="relative z-10 flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar-none p-6 sm:p-7 xl:p-8 pb-2 flex flex-col justify-between">
          <div>
            {/* Official TermJobs Logo & Brand Mark */}
            <Link to="/" className="inline-flex items-center gap-2.5 group cursor-pointer">
              <img
                src={logo}
                alt="TermJobs"
                className="w-7 h-7 object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="text-[13px] font-extrabold tracking-[0.2em] text-neutral-900 block leading-none">
                  TERMJOBS
                </span>
                <span className="text-[0.58rem] font-bold tracking-[0.15em] text-neutral-400 uppercase block mt-0.5">
                  Contract Workforce Platform
                </span>
              </div>
            </Link>

            {/* Accent vertical separator */}
            <div className="w-[2px] h-7 bg-neutral-400 my-5 sm:my-6" />

            {/* Eyebrow */}
            <div className="text-[0.62rem] font-bold tracking-[0.18em] text-neutral-400 uppercase mb-2.5 sm:mb-3">
              Contract Workforce Platform
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-extrabold tracking-[-0.03em] leading-[1.08] text-neutral-950">
              Explore<br />
              Open Roles.<br />
              <span className="text-neutral-400 font-bold block mt-1">
                Direct with<br />
                Hiring Partners.
              </span>
            </h1>

            {/* Subtext */}
            <p className="mt-4 sm:mt-5 text-xs text-neutral-500 leading-relaxed max-w-sm font-normal">
              Browse live contract opportunities from verified enterprise partners. Apply directly with 1-click
              resume parsing, instant skill matching, and verified compliance.
            </p>

            {/* Pure Transparent Glass Platform Metrics */}
            <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 relative z-10 max-w-sm">
              {/* Card 1: Open Roles */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Briefcase size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  {platformStats?.open_roles !== undefined ? platformStats.open_roles : requisitions.length}
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Open Roles
                </div>
              </div>

              {/* Card 2: Enterprise Partners */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Building2 size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  {platformStats?.partners_count !== undefined
                    ? platformStats.partners_count
                    : (new Set(requisitions.map((r) => r.company_name).filter(Boolean)).size || 2)}
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Partners
                </div>
              </div>

              {/* Card 3: Avg Review Time */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Zap size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  &lt; 48h
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Review Time
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zone 2: Bottom Talent Pool Callout - Pinned & Fixed at Bottom */}
        <div className="relative z-20 shrink-0 px-6 sm:px-7 xl:px-8 pt-2.5 pb-6 sm:pb-7 xl:pb-8 bg-transparent">
          <div className="flex items-stretch gap-3 max-w-sm">
            {/* Vertical Accent Line running alongside sentence and button */}
            <div className="w-[2px] bg-neutral-400 rounded-full shrink-0" />

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-neutral-700">
                <Sparkles size={13} className="text-neutral-900 shrink-0" />
                <span className="text-[11.5px] sm:text-xs font-medium text-neutral-700 leading-snug">
                  Don't see your role? Join the verified talent pool.
                </span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowGeneralPoolModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-[11px] tracking-tight transition cursor-pointer active:scale-95 shadow-md shadow-neutral-900/10"
                >
                  <span>Join Talent Pool</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* RIGHT PANEL: DARK DASHBOARD & OPEN ROLES                    */}
      {/* ============================================================ */}
      <div className="flex-1 min-w-0 bg-ink text-paper p-3.5 sm:p-5 xl:p-7 flex flex-col relative overflow-hidden">
        {/* Atmospheric Background Layer */}
        <Backdrop tone="dark" />

        <div className="relative z-10 flex flex-col flex-1">
          {/* Top Header Navigation — Optimized for Mobile */}
          <header className="flex items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-5 pt-1 lg:pt-0">
            {/* Left: Brand logo + back link on mobile, Platform Overview on desktop */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 group cursor-pointer transition-transform active:scale-95 shrink-0"
              title="Return to Home"
            >
              <ArrowLeft size={14} className="text-paper/70 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
              <img src={logo} alt="TermJobs" className="h-5 w-5 object-contain invert lg:hidden" />
              <span className="text-[12px] font-extrabold tracking-[0.2em] text-white lg:hidden">TERMJOBS</span>
              <span className="hidden lg:inline text-xs text-paper/60 hover:text-white font-medium">Platform Overview</span>
            </Link>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 ml-auto shrink-0">
              {candidateUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2 p-0.5 pl-2 pr-1.5 rounded-full bg-paper/[0.06] border border-paper/15 backdrop-blur-md">
                  <div className="w-5.5 h-5.5 rounded-full bg-white/10 text-white font-bold text-[9.5px] flex items-center justify-center border border-white/20">
                    {(candidateUser.candidate_name || 'C').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold text-white max-w-[90px] sm:max-w-[120px] truncate">
                    {candidateUser.candidate_name || candidateUser.candidate_email}
                  </span>
                  <div className="h-3 w-px bg-paper/20 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setShowSetupModal(true)}
                    className="hidden sm:inline-block px-2 py-0.5 text-[10.5px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMyAppsModal(true)}
                    className="px-2 py-0.5 text-[10px] sm:text-[10.5px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer"
                  >
                    Apps ({applications.length})
                  </button>
                  <a
                    href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${candidateUser.id || candidateUser.candidate_email || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex px-2 py-0.5 text-[10.5px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer items-center gap-1.5 text-decoration-none"
                    title="Connect Telegram for instant interview alerts & notifications"
                  >
                    <Send size={11} />
                    <span>Bot</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCandidateLogout}
                    className="p-1 text-paper/50 hover:text-white transition cursor-pointer"
                    title="Sign out"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  {/* Candidate Auth Pill (Google Icon + Divider + Candidate Sign In) */}
                  <div className="inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.04] hover:border-white/30 backdrop-blur-md transition-all">
                    {/* Google Sign In Trigger */}
                    <button
                      type="button"
                      onClick={() => handleGoogleSignIn()}
                      disabled={authLoading}
                      className="p-0.5 text-white hover:opacity-85 transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center"
                      title={authLoading ? 'Signing in...' : 'Sign in with Google'}
                    >
                      <GoogleIcon className="w-3.5 h-3.5" />
                    </button>

                    {/* Vertical Divider */}
                    <div className="h-3 w-px bg-white/20 mx-1.5" />

                    {/* Candidate Email/Password Login Trigger */}
                    <button
                      type="button"
                      onClick={() => { setAuthModalTab('login'); setShowAuthModal(true); }}
                      className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-white/90 hover:text-white transition cursor-pointer"
                    >
                      <User size={11} className="text-white/70" />
                      <span>Sign In</span>
                    </button>
                  </div>

                  {/* Staff Portal Link */}
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 text-white/90 hover:text-white text-[10px] sm:text-[11px] font-medium transition backdrop-blur-md active:scale-95"
                  >
                    <Users size={11} className="text-white/70" />
                    <span>Staff</span>
                    <ArrowRight size={10} className="text-white/60" />
                  </Link>
                </div>
              )}
            </div>
          </header>

          {/* Glass Search & Filter Control Console — Optimized for Mobile */}
          <div className="mt-1 mb-3.5 sm:mb-5 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
            <div className="w-[90%] sm:w-full max-w-lg sm:max-w-4xl mx-auto sm:mx-0 p-2 sm:p-1.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.12] focus-within:border-white/35 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.14)] flex flex-col sm:flex-row items-center gap-2 transition-all">
              {/* Keyword Search Input */}
              <div className="relative flex-1 w-full min-w-[150px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roles, skills, company..."
                  className="w-full bg-transparent pl-8 pr-6 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns & Glass Action Button */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                {/* Work Mode Filter */}
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={selectedWorkMode}
                    onChange={(e) => setSelectedWorkMode(e.target.value)}
                    className="w-full sm:w-auto appearance-none bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-xl pl-6 pr-5 py-1.5 text-[11px] text-white/90 font-medium cursor-pointer focus:outline-none focus:border-white/30 transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">All Modes</option>
                    <option value="Remote" className="bg-zinc-950 text-white">Remote</option>
                    <option value="Hybrid" className="bg-zinc-950 text-white">Hybrid</option>
                    <option value="Onsite" className="bg-zinc-950 text-white">Onsite</option>
                  </select>
                  <Briefcase size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>

                {/* Department Filter */}
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={selectedFamily}
                    onChange={(e) => setSelectedFamily(e.target.value)}
                    className="w-full sm:w-auto appearance-none bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-xl pl-6 pr-5 py-1.5 text-[11px] text-white/90 font-medium cursor-pointer focus:outline-none focus:border-white/30 transition max-w-[130px] truncate shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">All Depts</option>
                    {availableFamilies.map((fam) => (
                      <option key={fam} value={fam} className="bg-zinc-950 text-white">
                        {fam}
                      </option>
                    ))}
                  </select>
                  <Building2 size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>

                {/* Location Filter (Tablet / Desktop) */}
                <div className="relative flex-1 sm:flex-initial hidden md:block">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full sm:w-auto appearance-none bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-xl pl-6 pr-5 py-1.5 text-[11px] text-white/90 font-medium cursor-pointer focus:outline-none focus:border-white/30 transition max-w-[115px] truncate shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">All Locations</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc} className="bg-zinc-950 text-white">
                        {loc}
                      </option>
                    ))}
                  </select>
                  <MapPin size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>

                {/* Glass Search Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('roles-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-8 h-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                  title="Search Roles"
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Section Title Header */}
          <div className="flex items-center justify-between mb-3 pt-0.5">
            <h2 className="font-display text-base sm:text-lg font-extrabold tracking-[-0.03em] text-white">
              Latest Opportunities
            </h2>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowGeneralPoolModal(true)}
                className="lg:hidden text-[10.5px] font-semibold text-white/80 hover:text-white transition inline-flex items-center gap-1 cursor-pointer bg-white/10 px-2.5 py-1 rounded-full border border-white/15"
              >
                <Sparkles size={11} className="text-white" />
                <span>Join Talent Pool</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedWorkMode('ALL');
                  setSelectedFamily('ALL');
                  setSelectedLocation('ALL');
                }}
                className="text-[11px] sm:text-xs font-semibold text-paper/60 hover:text-paper transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>View All Roles</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Opportunities Grid Section */}
          <main id="roles-grid-section" className="flex-1 w-full flex flex-col pb-20 sm:pb-24">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-2 border-white/80 border-t-transparent animate-spin mx-auto" />
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-paper/60">
                  Loading published requisitions...
                </div>
              </div>
            ) : error ? (
              <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center max-w-md mx-auto my-12 backdrop-blur-md">
                <AlertCircle size={28} className="text-rose-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white">Unable to fetch open roles</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-4">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="py-20 px-6 rounded-3xl bg-paper/[0.02] border border-paper/10 text-center max-w-xl mx-auto my-8 backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-paper/[0.05] border border-paper/10 flex items-center justify-center text-paper/60 mx-auto mb-4">
                  <Search size={22} />
                </div>
                <h3 className="text-base font-bold text-paper">No roles matching your filters</h3>
                <p className="text-xs text-paper/60 mt-1 max-w-sm mx-auto">
                  Try clearing your search query or switching work mode filters to explore other open opportunities.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedWorkMode('ALL');
                      setSelectedFamily('ALL');
                      setSelectedLocation('ALL');
                    }}
                    className="px-4 py-2 rounded-xl bg-paper/10 hover:bg-paper/15 text-paper text-xs font-bold transition cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGeneralPoolModal(true)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition cursor-pointer shadow-md"
                  >
                    Join General Talent Pool
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
                {filteredJobs.map((job) => {
                  const role = job.structured_role || {};
                  const skills = (role.must_have_skills || []).concat(role.nice_to_have_skills || []);
                  const workMode = role.work_mode || 'Remote';
                  const isRemote = workMode.toLowerCase() === 'remote';
                  const isHybrid = workMode.toLowerCase() === 'hybrid';
                  const dueDateVal = job.due_date || job.submission_deadline || job.application_due_date || role.submission_deadline;
                  const dueInfo = formatDueDate(dueDateVal);
                  const companyInitial = (job.company_name || 'E').slice(0, 1).toUpperCase();
                  const locDisplay = getLocationDisplay(job);
                  const existingApp = getJobApplication(job);
                  const isApplied = Boolean(
                    isCandidateAuthenticated && (
                      existingApp ||
                      justAppliedJobIds.has(String(job.id)) ||
                      (job._id && justAppliedJobIds.has(String(job._id)))
                    )
                  );

                  return (
                    <article
                      key={job.id}
                      onClick={() => handleOpenJob(job)}
                      className="group relative rounded-xl sm:rounded-2xl bg-paper/[0.04] hover:bg-paper/[0.08] border border-paper/10 hover:border-white/25 hover:shadow-[0_4px_24px_rgba(255,255,255,0.06)] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 shadow-md backdrop-blur-md cursor-pointer"
                    >
                      <div>
                        {/* Top Row: Company Initial, Name, Work Mode Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <div className="w-6 h-6 rounded-md bg-white text-black font-extrabold flex items-center justify-center text-[10px] shadow-sm shrink-0">
                              {companyInitial}
                            </div>
                            <span className="text-[10.5px] font-bold text-paper tracking-wider uppercase truncate max-w-[130px]">
                              {job.company_name || 'Enterprise'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-semibold bg-paper/10 text-paper/90 border border-paper/15 shrink-0">
                              {isRemote ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                                  <span>Remote</span>
                                </>
                              ) : isHybrid ? (
                                <>
                                  <Check size={9} className="text-paper/60" />
                                  <span>Hybrid</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  <span>Onsite</span>
                                </>
                              )}
                            </span>
                            {isApplied && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-semibold bg-white/10 text-white border border-white/20 shrink-0">
                                <Check size={9} className="text-white" />
                                <span>Applied</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Role Title */}
                        <h3 className="text-[13px] sm:text-sm font-bold text-paper mt-2 tracking-tight group-hover:text-white transition-colors line-clamp-1">
                          {job.title}
                        </h3>

                        {/* Meta Information Row */}
                        <div className="flex items-center gap-2 text-[9.5px] sm:text-[10px] text-paper/60 mt-1 font-medium">
                          <div className="flex items-center gap-1 truncate max-w-[110px]" title={locDisplay}>
                            <MapPin size={10} className="text-paper/40 shrink-0" />
                            <span className="truncate">{locDisplay}</span>
                          </div>
                          <span className="text-paper/20">|</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock size={10} className="text-paper/40 shrink-0" />
                            <span>{role.duration || '6 Months'}</span>
                          </div>
                          <span className="text-paper/20">|</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Users size={10} className="text-paper/40 shrink-0" />
                            <span>{role.experience || '3+ years'}</span>
                          </div>
                        </div>

                        {/* Skill Tags */}
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="px-1.5 py-0.5 rounded-md bg-paper/[0.06] border border-paper/10 text-[9px] font-medium text-paper/80"
                            >
                              {skill}
                            </span>
                          ))}
                          {skills.length > 4 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-paper/[0.04] border border-paper/10 text-[9px] text-paper/50 font-mono">
                              +{skills.length - 4}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Due Date & Apply Button */}
                      <div className="mt-3 pt-2 border-t border-paper/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] text-paper/60 font-medium">
                          <Calendar size={11} className="text-paper/40 shrink-0" />
                          <span>Apply by {dueInfo ? dueInfo.text : 'Sep 27, 2026'}</span>
                          {dueInfo?.daysLeft && (
                            <>
                              <span className="text-paper/20">•</span>
                              <span className="text-paper/50">{dueInfo.daysLeft}</span>
                            </>
                          )}
                        </div>

                        {isApplied ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenJob(job);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-[10px] tracking-tight transition shadow-sm cursor-pointer shrink-0"
                            title="Application Submitted · Click to view application status"
                          >
                            <Check size={11} className="text-emerald-400" />
                            <span>Applied</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenJob(job);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-[10px] tracking-tight transition shadow-sm cursor-pointer shrink-0 active:scale-95"
                          >
                            <span>Apply Now</span>
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Candidate Navigation (Mobile: Glassmorphic Floating Capsule Dock | Desktop: Minimal Vertical List) */}
            {enabled && typeof document !== 'undefined' && createPortal(
              <>
                {/* Mobile View: Floating Glassmorphic Capsule Dock */}
                <div className="md:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none px-3.5 pb-[env(safe-area-inset-bottom,0px)]">
                  <nav
                    aria-label="Mobile Candidate Navigation"
                    className="pointer-events-auto flex items-center gap-1 p-1 rounded-full bg-[#0a0b10]/85 hover:bg-[#0a0b10]/95 backdrop-blur-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.22)] select-none"
                  >
                    {[
                      {
                        id: 'home',
                        label: 'HOME',
                        icon: Home,
                        onClick: () => {
                          setActiveNavTab('home');
                          setIsInterviewViewOpen(false);
                          setShowInterviewModal(false);
                          setShowAgreementModal(false);
                          setShowSetupModal(false);
                          setShowMyAppsModal(false);
                          setShowAuthModal(false);
                          document.getElementById('roles-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                        },
                      },
                      ...(hasInterviewAccess
                        ? [
                            {
                              id: 'interview',
                              label: 'INTERVIEW',
                              icon: Video,
                              onClick: () => {
                                setActiveNavTab('interview');
                                setIsInterviewViewOpen(true);
                                setShowAgreementModal(false);
                                setShowSetupModal(false);
                                setShowMyAppsModal(false);
                                setShowAuthModal(false);
                              },
                            },
                          ]
                        : []),
                      {
                        id: 'agreement',
                        label: 'AGREEMENT',
                        icon: FileText,
                        badge: candidateAgreements?.length > 0 ? candidateAgreements.length : null,
                        onClick: () => {
                          setActiveNavTab('agreement');
                          setShowInterviewModal(false);
                          setShowSetupModal(false);
                          setShowMyAppsModal(false);
                          setShowAuthModal(false);
                          setShowAgreementModal(true);
                        },
                      },
                      {
                        id: 'profile',
                        label: 'PROFILE',
                        icon: User,
                        hasUser: Boolean(candidateUser),
                        onClick: () => {
                          setActiveNavTab('profile');
                          setShowInterviewModal(false);
                          setShowAgreementModal(false);
                          setShowMyAppsModal(false);
                          if (candidateUser) {
                            setShowSetupModal(true);
                          } else {
                            setAuthModalTab('login');
                            setShowAuthModal(true);
                          }
                        },
                      },
                    ].map((item, idx) => {
                      const isActive = activeNavTab === item.id;
                      const IconComponent = item.icon;
                      return (
                        <div key={item.id} className="flex items-center">
                          {idx > 0 && <div className="h-3 w-px bg-white/12 mx-0.5" />}
                          <button
                            type="button"
                            onClick={item.onClick}
                            aria-current={isActive ? 'true' : undefined}
                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 ${
                              isActive
                                ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-sm'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] border border-transparent'
                            }`}
                          >
                            <span className="relative flex items-center justify-center">
                              <IconComponent
                                size={12}
                                className={isActive ? 'text-neutral-100' : 'text-neutral-400'}
                              />
                              {item.badge && (
                                <span className="absolute -top-1 -right-1.5 flex h-2.5 min-w-[10px] items-center justify-center rounded-full bg-emerald-400 px-0.5 text-[8px] font-bold text-black ring-1 ring-black">
                                  {item.badge}
                                </span>
                              )}
                              {!item.badge && item.hasUser && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
                              )}
                            </span>
                            <span className="text-[0.58rem] font-medium tracking-[0.16em] uppercase">
                              {item.label}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </nav>
                </div>

                {/* Desktop View: Preserved Exact Minimal Vertical List */}
                {Boolean(candidateUser || hasInterviewAccess) && (
                  <nav
                    aria-label="Candidate Navigation"
                    className="hidden md:block fixed right-10 bottom-8 z-40 pointer-events-auto"
                  >
                    <ul className="flex flex-col items-end gap-2.5">
                      {[
                        {
                          id: 'home',
                          label: 'HOME',
                          onClick: () => {
                            setActiveNavTab('home');
                            setIsInterviewViewOpen(false);
                            setShowInterviewModal(false);
                            setShowAgreementModal(false);
                            setShowSetupModal(false);
                            setShowMyAppsModal(false);
                            document.getElementById('roles-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                          },
                        },
                        ...(hasInterviewAccess
                          ? [
                              {
                                id: 'interview',
                                label: 'INTERVIEW',
                                isLive: allCandidateInterviewRounds.some((r) => r.status === 'Upcoming' && r.is_ready),
                                onClick: () => {
                                  setActiveNavTab('interview');
                                  setIsInterviewViewOpen(true);
                                  setShowAgreementModal(false);
                                  setShowSetupModal(false);
                                  setShowMyAppsModal(false);
                                },
                              },
                            ]
                          : []),
                        {
                          id: 'agreement',
                          label: 'AGREEMENT',
                          onClick: () => {
                            setActiveNavTab('agreement');
                            setShowInterviewModal(false);
                            setShowAgreementModal(true);
                          },
                        },
                        {
                          id: 'profile',
                          label: 'PROFILE',
                          onClick: () => {
                            setActiveNavTab('profile');
                            setShowInterviewModal(false);
                            if (candidateUser) {
                              setShowSetupModal(true);
                            } else {
                              setShowAuthModal(true);
                            }
                          },
                        },
                      ].map((item) => {
                        const isActive = activeNavTab === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={item.onClick}
                              aria-current={isActive ? 'true' : undefined}
                              className={`text-[0.62rem] font-semibold tracking-[0.2em] uppercase transition-all duration-300 focus-visible:ring-1 focus-visible:ring-current focus-visible:outline-none cursor-pointer flex items-center gap-1.5 ${
                                isInterviewViewOpen
                                  ? isActive
                                    ? 'text-neutral-800 font-bold'
                                    : 'text-neutral-400 hover:text-neutral-700'
                                  : isActive
                                    ? 'text-neutral-200 font-bold'
                                    : 'text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              {item.id === 'interview' && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isInterviewViewOpen ? 'bg-emerald-600' : 'bg-emerald-400'} animate-pulse`} />
                              )}
                              <span>{item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                )}
              </>,
              document.body
            )}
          </main>
        </div>
      </div>
    </div>

    {/* ============================================================ */}
    {/* VIEW 2: CANDIDATE INTERVIEWS (HORIZONTAL SLIDE PAGE UI)      */}
    {/* ============================================================ */}
    <div className="w-[100vw] min-w-[100vw] min-h-screen shrink-0 flex flex-col lg:flex-row bg-[#08090b] relative overflow-x-hidden">
      {/* Main Left Section: Dark Canvas (~75% on Desktop) */}
      <main className="flex-1 min-w-0 bg-[#08090b] text-white p-4 sm:p-6 lg:p-8 xl:p-10 flex flex-col relative h-screen max-h-screen overflow-hidden">
        <Backdrop tone="dark" />

        <div className="relative z-10 flex flex-col flex-1 min-h-0 h-full">
          {/* Pinned Top Header (Non-scrolling) */}
          <div className="shrink-0">
            {/* Top Navigation Bar: ← Platform Overview & Candidate Profile Pill */}
            <div className="flex items-center justify-between gap-4 pb-2">
              {/* Back to Platform Overview */}
              <button
                type="button"
                onClick={() => {
                  setIsInterviewViewOpen(false);
                  setActiveNavTab('home');
                }}
                className="inline-flex items-center gap-2.5 text-xs text-white/70 hover:text-white transition-colors cursor-pointer group"
              >
                <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium tracking-wide">Platform Overview</span>
              </button>

              {/* Candidate Profile Pill (Exact Match to Screenshot) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCandidateMenu(!showCandidateMenu)}
                  className="flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-neutral-900 border border-white/20 text-white font-bold text-[10px] flex items-center justify-center">
                    {candidateUser?.candidate_name
                      ? candidateUser.candidate_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'MH'}
                  </div>
                  <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                    {candidateUser?.candidate_name || 'Mohammed Hashil'}
                  </span>
                  <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Candidate</span>
                  <ChevronDown size={14} className="text-neutral-400" />
                </button>

                {/* Candidate Dropdown Menu */}
                {showCandidateMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#0f1218] border border-white/10 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        setShowSetupModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <User size={13} />
                      <span>Profile Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        setShowMyAppsModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <FileText size={13} />
                      <span>My Applications</span>
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        handleCandidateLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {hasInterviewAccess && (
              <>
                {/* Title & Subtitle */}
                <div className="mt-4 sm:mt-6 mb-4">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Upcoming Interviews
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-neutral-400">
                    Your scheduled interviews with companies.
                  </p>
                </div>

                {/* Filter Tabs, Search & Sort Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { id: 'all', label: `All (${allCount})` },
                      { id: 'upcoming', label: `Upcoming (${upcomingCount})` },
                      { id: 'completed', label: `Completed (${completedCount})` },
                      { id: 'cancelled', label: `Cancelled (${cancelledCount})` },
                    ].map((tab) => {
                      const isActive = interviewFilterTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setInterviewFilterTab(tab.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 cursor-pointer ${
                            isActive
                              ? 'bg-white text-neutral-950 shadow-md font-bold'
                              : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 font-medium'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search & Sort Controls */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-1 sm:w-56">
                      <Search
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={interviewSearch}
                        onChange={(e) => setInterviewSearch(e.target.value)}
                        placeholder="Search interviews..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-white/30 transition"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setInterviewSortAsc(!interviewSortAsc)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-2 transition cursor-pointer shrink-0"
                      title="Toggle sorting order"
                    >
                      <Calendar size={13} className="text-neutral-400" />
                      <span>{interviewSortAsc ? 'Date (Soonest)' : 'Date (Latest)'}</span>
                      <ChevronDown size={13} className="text-neutral-400" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {loadingInterviews ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
              <div className="text-xs text-neutral-400 font-medium tracking-wide">
                Loading your scheduled interviews...
              </div>
            </div>
          ) : !hasInterviewAccess ? (
            /* Access Restricted State */
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5 text-neutral-400">
                <Lock size={28} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">No Interview History</h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                This portal is exclusively accessible to candidates with active or past interview schedules. When an enterprise schedules an interview with you, it will appear here automatically.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsInterviewViewOpen(false);
                  setActiveNavTab('home');
                }}
                className="mt-6 px-6 py-2.5 rounded-xl bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-200 transition cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                <span>Back to Open Roles</span>
              </button>
            </div>
          ) : (
            /* Interview Cards List (The Marked Portion - ONLY this section scrolls, scrollbar hidden) */
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-16 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {filteredInterviews.length === 0 ? (
                  <div className="py-16 text-center rounded-2xl bg-white/[0.02] border border-white/5">
                    <Calendar size={32} className="mx-auto text-neutral-600 mb-3" />
                    <h3 className="text-base font-bold text-white">No interviews found</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                      {interviewSearch
                        ? `No scheduled or past interviews matching "${interviewSearch}".`
                        : 'You currently have no interviews in this category.'}
                    </p>
                  </div>
                ) : (
                  filteredInterviews.map((round) => {
                    const badge = round.date_badge || parseInterviewDateBadge(round.scheduled_date);
                    const isUpcoming = round.status === 'Upcoming';
                    const isCompleted = round.status === 'Completed';
                    const isCancelled = round.status === 'Cancelled';
                    const isLive = round.status === 'In Progress' || round.status === 'Live' || round.round_type === 'AI';
                    const canEnter = isUpcoming && round.is_ready;
                    const daysUntil = round.days_until || 0;
                    const typeConfig = getRoundTypeConfig(round.round_name, round.round_number);
                    const statusInfo = getStatusBadgeInfo(round, daysUntil, isLive, isCompleted, isCancelled);
                    const IconComponent = typeConfig.icon;

                    return (
                      <div
                        key={round.id}
                        className={`rounded-2xl transition-all duration-200 relative p-4 sm:p-5 lg:py-5 lg:px-6 ${
                          canEnter
                            ? 'bg-[#0b0e14] border border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.14)]'
                            : 'bg-[#0b0e14] border border-white/10 hover:border-white/20 shadow-lg'
                        }`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                          {/* Left Section: Date Box + Role Info */}
                          <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                            {/* Date Box */}
                            <div className="shrink-0 w-12 sm:w-14 flex flex-col items-center justify-center text-center select-none py-0.5 pr-4 border-r border-white/10">
                              <span className="text-[10.5px] font-bold text-neutral-400 tracking-wider uppercase leading-none">
                                {badge.month}
                              </span>
                              <span className="text-2xl sm:text-3xl font-black text-white leading-tight my-1 tracking-tight">
                                {badge.day}
                              </span>
                              <span className="text-[9.5px] font-bold text-neutral-500 tracking-widest uppercase leading-none">
                                {badge.dayOfWeek}
                              </span>
                            </div>

                            {/* Round Name, Company & Badges */}
                            <div className="min-w-0 flex-1">
                              {/* Title + Icon */}
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${typeConfig.iconBoxStyle}`}>
                                  <IconComponent size={16} />
                                </div>
                                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                                  {round.round_name}
                                </h3>
                              </div>

                              {/* Company Name & Requisition */}
                              <div className="mt-1.5 pl-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded bg-neutral-800 border border-white/10 text-[9px] font-bold text-neutral-300 flex items-center justify-center shrink-0">
                                    {round.company_logo_letter}
                                  </span>
                                  <span className="text-xs font-semibold text-neutral-200 truncate">
                                    {round.company_name}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
                                  {round.requisition_title} · {round.requisition_id}
                                </div>
                              </div>

                              {/* Badges: Round X + Category */}
                              <div className="flex items-center gap-2 mt-2 pl-0.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${typeConfig.pillStyle}`}>
                                  {typeConfig.roundPill}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] text-neutral-300 border border-white/10 text-[10.5px] font-medium">
                                  {typeConfig.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Middle Section: Time, Mode, Interviewer */}
                          <div className="hidden md:flex items-center gap-6 xl:gap-8 shrink-0">
                            {/* Time */}
                            <div className="min-w-[145px]">
                              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                                <Clock size={15} className="text-neutral-400 shrink-0" />
                                <span>{round.time_range}</span>
                              </div>
                              <div className="text-[11.5px] text-neutral-400 pl-6 mt-0.5 font-normal">
                                {round.time_duration}
                              </div>
                            </div>

                            {/* Mode */}
                            <div className="min-w-[115px]">
                              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                                <Video size={15} className="text-neutral-400 shrink-0" />
                                <span>Online</span>
                              </div>
                              <div className="text-[11.5px] text-neutral-400 pl-6 mt-0.5 font-normal">
                                (Term Jobs Panel)
                              </div>
                            </div>

                            {/* Interviewer */}
                            <div className="min-w-[155px] flex items-center gap-3">
                              {round.interviewer_avatar ? (
                                <img
                                  src={round.interviewer_avatar}
                                  alt={round.interviewer_name}
                                  className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-[11px] font-bold text-neutral-200 shrink-0">
                                  {(round.interviewer_name || 'I').slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[9.5px] text-neutral-400 font-medium tracking-wide">
                                  Interviewer
                                </div>
                                <div className="text-xs font-bold text-white leading-tight truncate">
                                  {round.interviewer_name}
                                </div>
                                <div className="text-[10.5px] text-neutral-400 leading-tight mt-0.5 truncate">
                                  {round.interviewer_role}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Responsive Mobile Sub-Row */}
                          <div className="flex md:hidden items-center justify-between gap-3 pt-2.5 border-t border-white/5 text-xs text-neutral-300">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-neutral-400" />
                              <span>{round.time_range}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Video size={13} className="text-neutral-400" />
                              <span>Online</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate max-w-[110px]">
                              {round.interviewer_name}
                            </div>
                          </div>

                          {/* Right Section: Status Badge + Action Buttons + 3-Dot */}
                          <div className="shrink-0 flex flex-row xl:flex-col items-center xl:items-end justify-between xl:justify-center gap-3">
                            {/* Status Badge */}
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border ${statusInfo.style}`}>
                              <span className="text-[9px]">{statusInfo.icon}</span>
                              <span>{statusInfo.text}</span>
                            </div>

                            {/* Action Buttons + 3-Dot */}
                            <div className="flex items-center gap-2 relative interview-card-menu">
                              {canEnter ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const name = encodeURIComponent(
                                      candidateUser?.candidate_name || round.candidate_name || 'Candidate'
                                    );
                                    const token = encodeURIComponent(round.candidate_token || '');
                                    navigate(
                                      `/interview/room/${round.id}?role=candidate&name=${name}&token=${token}`
                                    );
                                  }}
                                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs transition shadow flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                                >
                                  <Video size={13} className="text-neutral-950" />
                                  <span>Enter Interview</span>
                                  <ArrowRight size={13} className="text-neutral-950" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDetailRound(round)}
                                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 font-medium text-xs transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                                >
                                  <span>View Details</span>
                                  <ArrowRight size={13} className="text-neutral-400" />
                                </button>
                              )}

                              {/* 3-Dot Dropdown Trigger */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMenuRoundId(
                                      activeMenuRoundId === round.id ? null : round.id
                                    )
                                  }
                                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                                    activeMenuRoundId === round.id
                                      ? 'bg-white/[0.12] text-white border-white/30'
                                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white border-white/10'
                                  }`}
                                  title="More Options"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {/* Functional 3-Dot Menu Dropdown */}
                                {activeMenuRoundId === round.id && (
                                  <div
                                    className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-[#0f1218] border border-white/15 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleCopyMeetingLink(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      {copiedRoundId === round.id ? (
                                        <>
                                          <Check size={13} className="text-emerald-400" />
                                          <span className="text-emerald-400 font-semibold">
                                            Link Copied!
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={13} className="text-neutral-400" />
                                          <span>Copy Meeting Link</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleSendInterviewEmail(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      <Mail size={13} className="text-neutral-400" />
                                      <span>
                                        {resendingEmailId === round.id
                                          ? 'Sending Invite...'
                                          : emailSentStatus[round.id] === 'sent'
                                          ? 'Invite Sent!'
                                          : 'Resend Email Invite'}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleAddToCalendar(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      <Calendar size={13} className="text-neutral-400" />
                                      <span>Add to Calendar</span>
                                    </button>

                                    <div className="h-px bg-white/10 my-1" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedDetailRound(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      <Eye size={13} className="text-neutral-400" />
                                      <span>View Details</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          )}

          {/* Interview Round Details Modal */}
          {selectedDetailRound && typeof document !== 'undefined' && createPortal(
            (() => {
              const isDetailCompleted = selectedDetailRound.status === 'Completed' || selectedDetailRound.status === 'Evaluated';
              const isDetailCancelled = selectedDetailRound.status === 'Cancelled' || selectedDetailRound.status === 'Rejected';
              const candidateDisplayName = candidateUser?.candidate_name || selectedDetailRound.candidate_name || 'Mohammed Hashil';
              const candidateDisplayEmail = candidateUser?.candidate_email || selectedDetailRound.candidate_email || 'mohammedhashil2018@gmail.com';

              return (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
                  onClick={() => setSelectedDetailRound(null)}
                >
                  <div
                    className="relative w-full max-w-xl rounded-2xl bg-[#0f1218] border border-white/15 p-6 sm:p-7 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex items-start justify-between pb-4 border-b border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-neutral-800 text-[10px] font-bold text-neutral-300 flex items-center justify-center">
                            {selectedDetailRound.company_logo_letter}
                          </span>
                          <span className="text-xs font-semibold text-neutral-300">
                            {selectedDetailRound.company_name}
                          </span>
                          {isDetailCompleted ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 ml-1">
                              ✓ Completed
                            </span>
                          ) : isDetailCancelled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 ml-1">
                              ✕ Cancelled
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ml-1">
                              Scheduled
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">
                          {selectedDetailRound.round_name}
                        </h2>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {selectedDetailRound.requisition_title} · {selectedDetailRound.requisition_id}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailRound(null)}
                        className="p-1 rounded-lg hover:bg-white/[0.08] text-neutral-400 hover:text-white transition cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="space-y-3.5 text-xs">
                      {/* If Completed: Prominent Real Status Banner */}
                      {isDetailCompleted && (
                        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Check size={16} className="stroke-[2.5]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white">Interview Completed & Under Review</div>
                            <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                              Your interview session has concluded. Feedback and responses are actively being reviewed by the hiring team at {selectedDetailRound.company_name}.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Schedule Grid */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium flex items-center gap-1.5">
                            <Calendar size={12} className="text-neutral-500" />
                            <span>Date</span>
                          </div>
                          <div className="text-xs font-semibold text-white mt-1">
                            {selectedDetailRound.scheduled_date_display}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium flex items-center gap-1.5">
                            <Clock size={12} className="text-neutral-500" />
                            <span>Time & Duration</span>
                          </div>
                          <div className="text-xs font-semibold text-white mt-1">
                            {selectedDetailRound.time_range}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {selectedDetailRound.time_duration}
                          </div>
                        </div>
                      </div>

                      {/* Interviewer & Mode */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Interviewer</div>
                          <div className="text-xs font-bold text-white mt-1">{selectedDetailRound.interviewer_name}</div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">{selectedDetailRound.interviewer_role}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Interview Format</div>
                          <div className="text-xs font-bold text-white mt-1">
                            {selectedDetailRound.round_type === 'AI' ? 'AI Assessment Session' : 'Online Hosted Room'}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">Term Jobs Dedicated Panel</div>
                        </div>
                      </div>

                      {/* Candidate Details */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Candidate Name</div>
                          <div className="text-xs font-bold text-white mt-1">{candidateDisplayName}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Candidate Email</div>
                          <div className="text-xs font-mono text-zinc-300 mt-1 truncate">{candidateDisplayEmail}</div>
                        </div>
                      </div>

                      {/* If NOT completed: Show Passcode & Checklist */}
                      {!isDetailCompleted && selectedDetailRound.candidate_passcode && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-neutral-400 uppercase font-medium">Candidate Passcode</div>
                            <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5 tracking-wider">
                              {selectedDetailRound.candidate_passcode}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyMeetingLink(selectedDetailRound)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {copiedRoundId === selectedDetailRound.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {!isDetailCompleted && (
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-neutral-400 text-[11px]">
                          <div className="text-neutral-300 font-semibold text-xs mb-1">Preparation Checklist:</div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Ensure working webcam & microphone before joining</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Join from a quiet, well-lit environment</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Use Google Chrome, Brave or Microsoft Edge</span>
                          </div>
                        </div>
                      )}

                      {/* If Completed: Post-Interview Information Notice */}
                      {isDetailCompleted && (
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-neutral-400 text-[11px]">
                          <div className="text-neutral-300 font-semibold text-xs mb-1">Post-Interview Status:</div>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span>Evaluation feedback and notes are under review by the hiring manager</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>You will receive an automated email regarding round progression or decision status</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailRound(null)}
                        className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-neutral-200 hover:text-white transition cursor-pointer"
                      >
                        Close
                      </button>
                      {/* ONLY show Join Meeting Room button if round is NOT completed and is ready */}
                      {!isDetailCompleted && selectedDetailRound.is_ready && (
                        <button
                          type="button"
                          onClick={() => {
                            const name = encodeURIComponent(
                              candidateDisplayName || 'Candidate'
                            );
                            const token = encodeURIComponent(selectedDetailRound.candidate_token || '');
                            navigate(
                              `/interview/room/${selectedDetailRound.id}?role=candidate&name=${name}&token=${token}`
                            );
                          }}
                          className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs transition shadow flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Video size={13} />
                          <span>Join Meeting Room</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </div>
      </main>

      {/* Right White Editorial Sidebar (Exact Match to Screenshot) */}
      <aside className="hidden lg:flex w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 bg-paper text-ink border-l border-ink/10 flex-col justify-between relative overflow-hidden h-screen max-h-screen sticky top-0 p-6 sm:p-8">
        <Backdrop tone="sidebar" />
        <div className="relative z-10 flex flex-col h-full justify-between">
          {/* Top: Logo & Platform Identity */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-black text-sm shadow-sm">
                <Briefcase size={16} className="text-white" />
              </div>
              <div>
                <div className="text-[12px] font-extrabold tracking-[0.2em] uppercase text-neutral-900 leading-tight">
                  TERMJOBS
                </div>
                <div className="text-[8.5px] font-bold tracking-[0.18em] uppercase text-neutral-400">
                  CONTRACT WORKFORCE PLATFORM
                </div>
              </div>
            </div>

            {/* Vertical decorative accent line */}
            <div className="w-0.5 h-10 bg-neutral-900/20 my-8 ml-1" />

            {/* Eyebrow */}
            <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-neutral-400 mb-2">
              CONTRACT WORKFORCE PLATFORM
            </div>

            {/* Headline Display */}
            <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-950 tracking-tight leading-[1.05]">
              Your<br />Interviews.
            </h2>

            {/* 3 Metric Cards in a Grid */}
            <div className="mt-8 grid grid-cols-3 gap-2.5">
              {/* Card 1: Upcoming */}
              <div className="p-3 rounded-2xl bg-black/[0.02] border border-neutral-900/10 flex flex-col items-center justify-center text-center">
                <Calendar size={15} className="text-neutral-500 mb-2" />
                <div className="text-2xl font-black text-neutral-900 leading-none mb-1">
                  {upcomingCount}
                </div>
                <div className="text-[8.5px] font-bold text-neutral-500 tracking-wider uppercase">
                  UPCOMING
                </div>
              </div>

              {/* Card 2: Completed */}
              <div className="p-3 rounded-2xl bg-black/[0.02] border border-neutral-900/10 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={15} className="text-neutral-500 mb-2" />
                <div className="text-2xl font-black text-neutral-900 leading-none mb-1">
                  {completedCount}
                </div>
                <div className="text-[8.5px] font-bold text-neutral-500 tracking-wider uppercase">
                  COMPLETED
                </div>
              </div>

              {/* Card 3: Cancelled */}
              <div className="p-3 rounded-2xl bg-black/[0.02] border border-neutral-900/10 flex flex-col items-center justify-center text-center">
                <X size={15} className="text-neutral-500 mb-2" />
                <div className="text-2xl font-black text-neutral-900 leading-none mb-1">
                  {cancelledCount}
                </div>
                <div className="text-[8.5px] font-bold text-neutral-500 tracking-wider uppercase">
                  CANCELLED
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>

      {/* ============================================================ */}
      {/* MODAL 1: VIEW JOB DETAILS & 1-CLICK APPLY                    */}
      {/* ============================================================ */}
      {selectedJob && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200">
          <div className="rounded-3xl bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                    {selectedJob.company_name || 'Enterprise Client'}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    {selectedJob.ref || `REQ-${selectedJob.id.slice(0, 6).toUpperCase()}`}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                  {selectedJob.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/60 mt-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 font-medium">
                    {selectedJob.structured_role?.work_mode || 'Remote'}
                  </span>
                  <span className="text-white/30">·</span>
                  <span>{selectedJob.structured_role?.duration || '6 Months'}</span>
                  <span className="text-white/30">·</span>
                  <span>{selectedJob.structured_role?.experience || 'Experienced'}</span>
                  {isSelectedJobApplied && (
                    <>
                      <span className="text-white/30">·</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white border border-white/20">
                        <Check size={11} className="text-white" />
                        <span>Application Submitted</span>
                      </span>
                    </>
                  )}
                  {(() => {
                    const dVal = selectedJob.due_date || selectedJob.submission_deadline || selectedJob.application_due_date || selectedJob.structured_role?.submission_deadline;
                    const dInfo = formatDueDate(dVal);
                    if (!dInfo) return null;
                    return (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-white/80">
                          <Calendar size={13} className="text-white/50" />
                          <span>Apply by: {dInfo.text} ({dInfo.daysLeft})</span>
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/60 hover:text-white transition cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-white/80 leading-relaxed font-sans">
              {submitSuccess ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto border border-white/20">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white">Application Submitted Successfully!</h3>
                  <p className="text-xs text-white/60 max-w-md mx-auto">
                    Your profile and resume have been submitted directly to the hiring partner. You will receive an interview
                    invite via email as soon as matching is verified.
                  </p>

                  {/* Start Telegram Bot Callout */}
                  <div className="p-4 bg-sky-950/40 border border-sky-400/30 rounded-2xl text-left max-w-sm mx-auto shadow mt-4">
                    <div className="flex items-center gap-2 text-sky-300 font-bold text-xs mb-1">
                      <Send size={14} className="text-[#229ED9]" />
                      <span>Get Real-time Updates on Telegram</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
                      Connect with <strong>@{TELEGRAM_BOT_USERNAME}</strong> to receive interview scheduling alerts, scores, and status updates directly in Telegram.
                    </p>
                    <a
                      href={submitSuccess.telegram_bot_url || `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${submitSuccess.candidate_id || submitSuccess.application_ref || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3.5 rounded-xl bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs transition text-decoration-none cursor-pointer"
                    >
                      <Send size={13} />
                      <span>Start Bot (@{TELEGRAM_BOT_USERNAME})</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="mt-4 px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs transition hover:bg-neutral-200 cursor-pointer shadow-sm"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Deadline Notification Banner */}
                  {(() => {
                    const dVal = selectedJob.due_date || selectedJob.submission_deadline || selectedJob.application_due_date || selectedJob.structured_role?.submission_deadline;
                    const dInfo = formatDueDate(dVal);
                    if (!dInfo) return null;
                    return (
                      <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3 text-xs text-white/80">
                        <div className="flex items-center gap-2 font-medium">
                          <Calendar size={15} className="shrink-0 text-white/50" />
                          <span>Application Due Date: <strong className="font-semibold text-white">{dInfo.text}</strong></span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider bg-white/10 text-white">
                          {dInfo.daysLeft}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Job Overview / Markdown */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Position Overview</h4>
                    {selectedJob.generated_jd_markdown ? (
                      <div
                        className="prose prose-invert prose-xs max-w-none text-white/80 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: marked.parse(selectedJob.generated_jd_markdown) }}
                      />
                    ) : (
                      <p className="text-white/60 text-xs">
                        This is a high-priority contract requisition delivered through the TermJobs platform. Candidates will
                        collaborate directly with the client engineering leadership.
                      </p>
                    )}

                    {/* Must-have skills grid */}
                    {selectedJob.structured_role?.must_have_skills?.length > 0 && (
                      <div className="pt-3">
                        <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                          Core Required Competencies
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.structured_role.must_have_skills.map((s) => (
                            <span
                              key={s}
                              className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-white/90 text-xs font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Apply Section */}
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        {isSelectedJobApplied ? 'Application Status' : 'Submit Your Application'}
                      </h4>
                    </div>

                    {isSelectedJobApplied ? (
                      /* Application Already Submitted Panel */
                      <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/15 space-y-4 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20 shrink-0">
                              <CheckCircle2 size={22} />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-2">
                                <span>Application Already Submitted</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/20 text-white">
                                  {selectedJobApp?.status || 'Active'}
                                </span>
                              </div>
                              <div className="text-xs text-white/50 mt-0.5">
                                {selectedJobApp?.created_at ? `Submitted on ${selectedJobApp.created_at}` : 'Your application has been received'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-white/70 leading-relaxed">
                          You have already submitted an application for this role. Your profile and verified resume are currently with the hiring partner. Candidates cannot submit duplicate applications for the same requisition.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-center">
                            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Review Status</div>
                            <div className="text-xs font-bold text-white mt-1">{selectedJobApp?.status || 'Submitted'}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-center">
                            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Match Score</div>
                            <div className="text-xs font-bold text-white mt-1">
                              {selectedJobApp?.match_score ? `${selectedJobApp.match_score}%` : 'Verified Fit'}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-center col-span-2 sm:col-span-1">
                            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Live Stage</div>
                            <div className="text-xs font-bold text-white mt-1">
                              {selectedJobApp?.interview_status || 'Under Review'}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJob(null);
                              setShowMyAppsModal(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-semibold text-white transition cursor-pointer"
                          >
                            View All Applications ({applications.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedJob(null)}
                            className="px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition cursor-pointer shadow-sm"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : !candidateUser ? (
                      /* Mandatory Candidate Authentication Gateway */
                      <div className="p-6 sm:p-7 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-4 shadow-xl backdrop-blur-xl">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/15 text-white flex items-center justify-center mx-auto shadow-inner">
                          <Lock size={20} className="text-white" />
                        </div>

                        <div className="max-w-md mx-auto space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-white/80 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>Sign-Up Mandatory</span>
                          </div>
                          <h3 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
                            Candidate Profile Required to Apply
                          </h3>
                          <p className="text-xs text-white/60 leading-relaxed">
                            To ensure verified talent evaluation, direct partner communication, and live ATS tracking, all applicants must have a verified candidate profile before applying.
                          </p>
                        </div>

                        {/* Primary Action: Google 1-Click */}
                        <div className="pt-1 max-w-sm mx-auto space-y-2.5">
                          <button
                            type="button"
                            onClick={() => handleGoogleSignIn((usr) => {
                              if (usr) {
                                setApplyForm((prev) => ({
                                  ...prev,
                                  name: usr.candidate_name || usr.name || prev.name,
                                  email: usr.candidate_email || usr.email || prev.email,
                                  phone: usr.candidate_phone || prev.phone,
                                }));
                              }
                            })}
                            disabled={authLoading}
                            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs tracking-wide shadow-md transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
                          >
                            <GoogleIcon className="w-4 h-4" />
                            <span>{authLoading ? 'Connecting Google Account…' : 'Sign Up / Sign In with Google'}</span>
                          </button>

                          {/* Secondary Action: Email Sign Up / Sign In */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthModalTab('register');
                                setShowAuthModal(true);
                              }}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/15 text-xs font-semibold text-white/90 hover:text-white transition cursor-pointer"
                            >
                              Create Talent Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthModalTab('login');
                                setShowAuthModal(true);
                              }}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 text-xs font-medium text-white/60 hover:text-white transition cursor-pointer"
                            >
                              Candidate Sign In
                            </button>
                          </div>
                        </div>

                        {/* Reassurance pills */}
                        <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 text-[11px] text-white/50">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-white/60" />
                            1-Click Verified Apply
                          </span>
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck size={13} className="text-white/60" />
                            Direct Partner Review
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={13} className="text-white/60" />
                            Live Interview Status
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Authenticated Application Form */
                      <form onSubmit={handleApplySubmit} className="space-y-4">
                        {/* Verified Candidate Header */}
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-[11px] font-bold border border-white/20">
                              {(candidateUser.candidate_name || candidateUser.candidate_email || 'C')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                <span>Applying as</span>
                                <span className="font-bold text-white">{candidateUser.candidate_name || candidateUser.candidate_email}</span>
                                <span className="text-[10px] font-bold bg-white/10 text-white/90 border border-white/20 px-1.5 py-0.2 rounded-full">
                                  Verified
                                </span>
                              </div>
                              <div className="text-[10px] text-white/50 mt-0.5">
                                {hasResume ? '✓ Master resume ready for 1-click submission' : 'Upload your resume below to complete'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleCandidateLogout}
                            className="text-[11px] text-white/50 hover:text-rose-400 transition cursor-pointer"
                          >
                            Sign out
                          </button>
                        </div>

                        {submitError && (
                          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>{submitError}</span>
                          </div>
                        )}
                        {/* Name & Email Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={applyForm.name}
                              onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                              placeholder="e.g. Alex Johnson"
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                              Email Address *
                            </label>
                            <input
                              type="email"
                              required
                              value={applyForm.email}
                              onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                              placeholder="alex@example.com"
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                            />
                          </div>
                        </div>

                        {/* Phone & LinkedIn Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                              Phone Number *
                            </label>
                            <input
                              type="tel"
                              required
                              value={applyForm.phone}
                              onChange={(e) => {
                                setApplyForm({ ...applyForm, phone: e.target.value });
                                if (submitError) setSubmitError(null);
                              }}
                              placeholder="e.g. 9876543210 or +91 9876543210"
                              className={`w-full bg-white/[0.03] border ${
                                applyForm.phone && validatePhone(applyForm.phone)
                                  ? 'border-rose-400/80 focus:border-rose-400'
                                  : 'border-white/10 focus:border-white/35'
                              } rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:bg-white/[0.05] transition-all`}
                            />
                            {applyForm.phone && validatePhone(applyForm.phone) && (
                              <p className="mt-1 text-[11px] text-rose-400 font-medium">
                                {validatePhone(applyForm.phone)}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                              LinkedIn Profile (Optional)
                            </label>
                            <input
                              type="url"
                              value={applyForm.linkedin_url}
                              onChange={(e) => setApplyForm({ ...applyForm, linkedin_url: e.target.value })}
                              placeholder="https://linkedin.com/in/..."
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                            />
                          </div>
                        </div>

                        {/* Resume Selection */}
                        <div>
                          <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                            Resume Document *
                          </label>

                          {hasResume && !useCustomResume ? (
                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <FileText size={18} className="text-white/70" />
                                <div>
                                  <div className="text-xs font-semibold text-white">{currentResumeName}</div>
                                  <div className="text-[10px] text-white/40">Verified resume from candidate profile</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setUseCustomResume(true)}
                                className="text-[11px] font-medium text-white/70 hover:text-white underline cursor-pointer"
                              >
                                Upload different file
                              </button>
                            </div>
                          ) : (
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                              }}
                              onDragLeave={() => setIsDragging(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) {
                                  setResumeFile(file);
                                  setSubmitError(null);
                                }
                              }}
                              onClick={() => fileInputRef.current?.click()}
                              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition ${isDragging
                                ? 'border-white bg-white/[0.08]'
                                : 'border-white/15 bg-white/[0.02] hover:border-white/30'
                                }`}
                            >
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setResumeFile(file);
                                    setSubmitError(null);
                                  }
                                }}
                                accept=".pdf,.docx,.doc"
                                className="hidden"
                              />
                              <Upload size={22} className="text-white/40 mx-auto mb-2" />
                              {resumeFile ? (
                                <div className="text-xs font-semibold text-white flex items-center justify-center gap-1.5">
                                  <Check size={14} className="text-white" />
                                  <span>{resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                </div>
                              ) : (
                                <>
                                  <div className="text-xs font-semibold text-white/90">
                                    Drop resume here or click to browse
                                  </div>
                                  <div className="text-[10px] text-white/40 mt-1">PDF, DOCX up to 10MB</div>
                                </>
                              )}
                            </div>
                          )}

                          {!hasResume && (
                            <div className="mt-2 text-[10.5px] text-emerald-400/90 flex items-center gap-1.5 font-medium">
                              <span>✓ This resume will be automatically saved to your profile for future 1-click applications.</span>
                            </div>
                          )}

                          {useCustomResume && hasResume && (
                            <button
                              type="button"
                              onClick={() => {
                                setUseCustomResume(false);
                                setResumeFile(null);
                              }}
                              className="mt-2 text-[11px] text-white/50 hover:text-white underline cursor-pointer"
                            >
                              ← Use saved profile resume instead
                            </button>
                          )}
                        </div>

                        {/* Brief Cover Note */}
                        <div>
                          <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                            Brief Note to Hiring Manager (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={applyForm.cover_note}
                            onChange={(e) => setApplyForm({ ...applyForm, cover_note: e.target.value })}
                            placeholder="Highlight your relevant experience or availability..."
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                          />
                        </div>

                        {/* Telegram Bot Live Updates Callout */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-sky-950/30 border border-sky-500/20 text-[11px] text-zinc-300">
                          <div className="flex items-center gap-2">
                            <Send size={13} className="text-[#229ED9] shrink-0" />
                            <span>Get 1-tap interview invites & match alerts via Telegram</span>
                          </div>
                          <a
                            href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${selectedJob?.id || 'apply'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#229ED9] hover:text-[#1E88E5] font-bold text-xs shrink-0 text-decoration-none hover:underline"
                          >
                            Start Bot →
                          </a>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 active:scale-98 text-black font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-lg shadow-black/40 flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                              <span>Processing Application...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>Submit Application to Hiring Partner</span>
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 2: MY APPLICATIONS DRAWER                              */}
      {/* ============================================================ */}
      {showMyAppsModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-neutral-900">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">Your Submitted Applications</h3>
              <button
                type="button"
                onClick={() => setShowMyAppsModal(false)}
                className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {applications.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  You haven't submitted any applications yet.
                </div>
              ) : (
                applications.map((app, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-neutral-900">{app.requisition_title || 'Contract Position'}</div>
                      <div className="text-[11px] text-neutral-500">{app.company_name || 'Enterprise Client'}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-800 border border-neutral-300">
                      {app.status || 'Submitted'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CANDIDATE PROFILE SETUP / EDIT                      */}
      {/* ============================================================ */}
      {showResumePreview && candidateAuth?.candidateToken && (
        <ResumePreviewModal token={candidateAuth.candidateToken}
          filename={currentResumeName}
          extractedText={candidateUser?.extracted_text || ''}
          onClose={() => setShowResumePreview(false)} />
      )}

      {showSetupModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-auto text-neutral-900">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Candidate Profile & Resume</h3>
                <p className="text-xs text-neutral-500">Keep your details up to date for instant 1-click applications.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSetupModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {setupSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-900">Profile Updated Successfully</h4>
              </div>
            ) : (
              <form onSubmit={handleSetupSubmit} className="mt-4 space-y-3.5 text-xs">
                {setupError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {setupError}
                  </div>
                )}

                <CandidateEmailEditor />

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={setupForm.name}
                    onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 text-xs focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={setupForm.phone}
                    onChange={(e) => {
                      setSetupForm({ ...setupForm, phone: e.target.value });
                      if (setupError) setSetupError(null);
                    }}
                    placeholder="e.g. 9876543210 or +91 9876543210"
                    className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                      setupForm.phone && validatePhone(setupForm.phone)
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                    } rounded-xl px-3 py-2 text-neutral-900 text-xs focus:outline-none focus:ring-1 transition-all`}
                  />
                  {setupForm.phone && validatePhone(setupForm.phone) && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">
                      {validatePhone(setupForm.phone)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={setupForm.title}
                    onChange={(e) => setSetupForm({ ...setupForm, title: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 text-xs focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-neutral-700 uppercase">Master Resume (On File)</label>
                    {hasResume ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check size={11} /> Verified Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Upload Required
                      </span>
                    )}
                  </div>

                  {hasResume ? (
                    <div className="space-y-2">
                      <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-neutral-200/80 border border-neutral-300 text-neutral-700 flex items-center justify-center shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-xs font-bold text-neutral-900 truncate">{currentResumeName || 'candidate_resume.pdf'}</div>
                            <div className="text-[10.5px] text-neutral-500">Ready for instant 1-click applications</div>
                          </div>
                        </div>
                        {candidateAuth?.candidateToken && (
                          <button type="button" onClick={() => setShowResumePreview(true)} aria-haspopup="dialog"
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-300 text-[11px] font-semibold text-neutral-800 transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                            title="Preview your master resume">
                            <FileText size={12} />
                            <span>View Uploaded Resume</span>
                          </button>
                        )}
                      </div>

                      <div className="pt-1">
                        <label className="block text-[10.5px] font-semibold text-neutral-600 uppercase mb-1">
                          Update / Replace Resume File (Optional)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc"
                          onChange={(e) => setSetupResumeFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-neutral-200 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 transition cursor-pointer"
                        />
                        {setupResumeFile && (
                          <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5">
                            <Check size={12} /> Selected for update: {setupResumeFile.name} ({(setupResumeFile.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        onClick={() => setupFileInputRef.current?.click()}
                        className="p-5 border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50/60 hover:bg-neutral-50 rounded-2xl text-center cursor-pointer transition"
                      >
                        <input
                          type="file"
                          ref={setupFileInputRef}
                          accept=".pdf,.docx,.doc"
                          onChange={(e) => setSetupResumeFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <Upload size={22} className="text-neutral-400 mx-auto mb-1.5" />
                        {setupResumeFile ? (
                          <div className="text-xs font-bold text-neutral-900 flex items-center justify-center gap-1.5">
                            <Check size={14} className="text-emerald-600" />
                            <span>{setupResumeFile.name} ({(setupResumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs font-semibold text-neutral-800">Click or drag resume here to upload</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">PDF or DOCX (up to 10MB)</div>
                          </>
                        )}
                      </div>
                      <div className="text-[10.5px] text-neutral-500 mt-1.5">
                        Uploading a resume enables 1-click applications across all enterprise partner roles.
                      </div>
                    </div>
                  )}
                </div>

                {hasResume && !setupResumeFile && (
                  <div className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-neutral-700 uppercase">Skills from resume</span>
                      <button type="button" onClick={() => { if (editingSkills) setSetupForm((prev) => ({ ...prev, skills: (Array.isArray(candidateUser?.skills) ? candidateUser.skills : []).join(', ') })); setEditingSkills(!editingSkills); }} className="text-xs font-semibold text-neutral-900 underline">
                        {editingSkills ? 'Cancel' : 'Edit Skills'}
                      </button>
                    </div>
                    {editingSkills ? (
                      <input type="text" aria-label="Edit Skills" value={setupForm.skills}
                        onChange={(e) => setSetupForm({ ...setupForm, skills: e.target.value })}
                        placeholder="Comma-separated skills" className="mt-2 w-full rounded-lg border border-neutral-300 p-2 text-xs" />
                    ) : (
                      <p className="mt-2 text-xs text-neutral-600">{setupForm.skills || 'No skills found. Choose Edit Skills to add them.'}</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={setupSubmitting}
                  className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer mt-2 shadow-sm"
                >
                  {setupSubmitting ? 'Saving Profile...' : 'Save Profile Details'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 4: GENERAL TALENT POOL (MONOCHROME GLASSMORPHISM)      */}
      {/* ============================================================ */}
      <GeneralTalentPoolModal
        isOpen={showGeneralPoolModal}
        onClose={() => setShowGeneralPoolModal(false)}
      />

      {/* ============================================================ */}
      {/* MODAL 4B: CANDIDATE SCHEDULED INTERVIEWS MODAL               */}
      {/* ============================================================ */}
      {showInterviewModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-white shrink-0">
                  <Video size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Scheduled Interviews</h3>
                  <p className="text-[11px] text-white/50">Live Video Rounds, Date & Time Coordinates, and Entry Room</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInterviewModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Email info strip */}
            <div className="mt-3.5 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Mail size={14} className="text-white/60 shrink-0" />
                <span className="text-xs text-white/70 truncate">
                  Candidate:{' '}
                  <strong className="text-white">
                    {candidateUser?.candidate_name || candidateUser?.name || 'Mohammed Hashil'}
                  </strong>{' '}
                  ({candidateUser?.candidate_email || candidateUser?.email || 'mohammedhashil2018@gmail.com'})
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {scheduledInterviews.length} Scheduled {scheduledInterviews.length === 1 ? 'Round' : 'Rounds'}
              </span>
            </div>

            {/* Interviews List (Scrollable) */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-3.5 pr-1 custom-scroll min-h-0">
              {scheduledInterviews.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 text-white/40 flex items-center justify-center mx-auto">
                    <Calendar size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-white">No Active Interviews Scheduled</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                    When an enterprise hiring manager schedules an interview for your applications, your confirmed round details, entry room, and calendar coordinates will appear here.
                  </p>
                </div>
              ) : (
                scheduledInterviews.map((round) => {
                  const isLive = round.status === 'In Progress' || round.status === 'Live';
                  const roomUrl = round.meeting_link || `${window.location.origin}/interview/room/${round.id}`;
                  const isSendingEmail = resendingEmailId === round.id;
                  const emailStatus = emailSentStatus[round.id];
                  const isCopied = copiedRoundId === round.id;

                  return (
                    <div
                      key={round.id}
                      className="p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 transition-all space-y-4"
                    >
                      {/* Top Row: Role, Round & Status */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white">
                              {round.requisition_title || 'Position Interview'}
                            </h4>
                            <span className="text-xs text-white/40">&bull;</span>
                            <span className="text-xs font-semibold text-white/70">
                              {round.company_name || 'Bearitt'}
                            </span>
                          </div>
                          <div className="text-xs text-white/50 font-medium mt-0.5">
                            {round.round_name || 'Technical Round'}
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                            isLive
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                          {isLive ? 'Live Now · In Session' : 'Scheduled & Confirmed'}
                        </span>
                      </div>

                      {/* Details Grid: Date, Time, Duration & Format */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <Calendar size={15} className="text-white/60 shrink-0" />
                          <div>
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Date</div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {round.scheduled_date || 'Date Confirmed'}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <Clock size={15} className="text-white/60 shrink-0" />
                          <div>
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Time</div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {round.scheduled_time || '10:00 AM'} ({round.scheduled_timezone || 'Asia/Kolkata'})
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <Video size={15} className="text-white/60 shrink-0" />
                          <div>
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Session Format</div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              TermJobs Live Video Room ({round.duration_minutes || 45} mins)
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Passcode</div>
                            <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5 truncate">
                              {round.candidate_passcode || 'TJ-VERIFIED'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Instructions / Notes (if present) */}
                      {round.instructions && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                          <strong>Candidate Notice:</strong> {round.instructions}
                        </div>
                      )}

                      {/* Action Buttons: Enter Interview Room, Send Email, Copy Link */}
                      <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const name = encodeURIComponent(candidateUser?.name || round.candidate_name || 'Candidate');
                            const token = encodeURIComponent(round.candidate_token || '');
                            navigate(`/interview/room/${round.id}?role=candidate&name=${name}&token=${token}`);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Video size={15} />
                          <span>Enter Interview Room</span>
                          <ArrowRight size={13} />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendInterviewEmail(round)}
                            disabled={isSendingEmail}
                            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                              emailStatus === 'sent'
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : emailStatus === 'error'
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white/80 hover:text-white'
                            }`}
                          >
                            <Mail size={13} />
                            <span>
                              {isSendingEmail
                                ? 'Sending...'
                                : emailStatus === 'sent'
                                ? 'Email Dispatched!'
                                : emailStatus === 'error'
                                ? 'Send Failed'
                                : 'Send to My Email'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(roomUrl);
                              setCopiedRoundId(round.id);
                              setTimeout(() => setCopiedRoundId(null), 2000);
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Notification confirmation */}
                      <p className="text-[11px] text-white/40 leading-normal">
                        ✉️ An interview invitation with calendar coordinates and passcode has been sent to{' '}
                        <strong className="text-white/70">
                          {round.candidate_email || candidateUser?.candidate_email || candidateUser?.email}
                        </strong>
                        .
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 5: CANDIDATE AGREEMENTS & CONTRACT TERMS                */}
      {/* ============================================================ */}
      {showAgreementModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Agreements & Contracts</h3>
                  <p className="text-[11px] text-white/50">Formal Employment Offers & Execution (Available Post-Interview Selection)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAgreementModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Candidate Email Verification & Quick Switch */}
            <div className="mt-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <span className="text-[11px] text-white/50 shrink-0 font-medium">Candidate Email:</span>
                <input
                  type="email"
                  value={agreementLookupEmail}
                  onChange={(e) => setAgreementLookupEmail(e.target.value)}
                  placeholder={candidateUser?.candidate_email || candidateUser?.email || "e.g. yourname@example.com"}
                  className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400 font-semibold"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = agreementLookupEmail || candidateUser?.candidate_email || candidateUser?.email;
                  if (target) loadCandidateAgreements(target);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition cursor-pointer shrink-0 shadow-sm"
              >
                Fetch Agreements
              </button>
            </div>

            <div className="mt-3 space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {loadingAgreements ? (
                <div className="py-12 text-center text-white/50 text-xs">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                  Checking for active employment agreements…
                </div>
              ) : candidateAgreements.length > 0 ? (
                <div className="space-y-3">
                  {candidateAgreements.map((agr, i) => {
                    const isSigned = agr.status === 'Accepted & Signed' || agr.agreement_status === 'Accepted & Signed' || agr.candidate_accepted;
                    const ctc = agr.annexure?.total_fixed_annual
                      ? `₹${Number(agr.annexure.total_fixed_annual).toLocaleString('en-IN')} / year`
                      : '₹18,00,000 / year';

                    return (
                      <div
                        key={agr._id || agr.candidate_id || i}
                        className="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/15 hover:border-white/25 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{agr.job_title || 'Software Engineer'}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.08] text-white/70 font-semibold">
                                {agr.company_name || 'Enterprise Client'}
                              </span>
                            </div>
                            <div className="text-[11px] text-white/50 mt-0.5">
                              Addressed to: <strong className="text-white/80">{agr.candidate_name}</strong> ({agr.candidate_email})
                            </div>
                          </div>

                          {isSigned ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={12} />
                              Signed & Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              <AlertCircle size={12} />
                              Action Required: Sign
                            </span>
                          )}
                        </div>

                        {/* Terms Quick Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-black/40 border border-white/5 text-[11px]">
                          <div>
                            <span className="text-white/40 block text-[9px] uppercase tracking-wider">Annual CTC</span>
                            <span className="text-white font-bold">{ctc}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[9px] uppercase tracking-wider">Joining Date</span>
                            <span className="text-white font-semibold">{agr.joining_date || 'Within 14 Days'}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[9px] uppercase tracking-wider">Location</span>
                            <span className="text-white font-semibold">{agr.annexure?.work_location || 'Bengaluru / Hybrid'}</span>
                          </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex items-center justify-between pt-1 gap-2">
                          <span className="text-[10px] text-white/40">
                            Issued: {agr.offer_date || 'Recent'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAgreement(agr);
                              setSignatureName(candidateUser?.candidate_name || agr.candidate_name || '');
                              setSignatureAgreed(false);
                              setSignSuccessMessage('');
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${isSigned
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 active:scale-98'
                              }`}
                          >
                            <FileText size={14} />
                            {isSigned ? 'View Executed Agreement' : 'Review & Sign Agreement →'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 mx-auto mb-2">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">No Active Agreements Issued Yet</h4>
                    <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed mt-1">
                      Agreements and formal employment contracts are generated exclusively after you complete your interview rounds and receive an official selection / offer from the hiring partner.
                    </p>
                  </div>

                  {/* Guest Email Lookup Box if not authenticated */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 max-w-sm mx-auto text-left">
                    <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                      Received an offer? Check with your email:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={agreementLookupEmail}
                        onChange={(e) => setAgreementLookupEmail(e.target.value)}
                        placeholder="e.g. arjunmheartitude@gmail.com"
                        className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/40"
                      />
                      <button
                        type="button"
                        onClick={() => loadCandidateAgreements(agreementLookupEmail)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs cursor-pointer transition"
                      >
                        Check
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAgreementModal(false);
                  setActiveNavTab('home');
                }}
                className="px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 5B: FULL 5-PAGE AGREEMENT REVIEW & DIGITAL SIGNING MODAL*/}
      {/* ============================================================ */}
      {selectedAgreement && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#0f1117] border border-white/15 rounded-3xl max-w-4xl w-full my-6 p-4 sm:p-7 shadow-2xl relative flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                    Formal Employment Agreement & Offer Letter
                  </h3>
                  <p className="text-xs text-white/50">
                    {selectedAgreement.company_name} · {selectedAgreement.job_title} · Ref: {selectedAgreement.candidate_id || selectedAgreement.submission_id || 'CND-OFFER'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white/80 hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAgreement(null)}
                  className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Canvas Body */}
            <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-6">
              <div
                className="bg-white text-slate-800 p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 text-xs sm:text-sm leading-relaxed"
                style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                {/* Letterhead */}
                <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {selectedAgreement.company_name || 'TCS'}
                    </h2>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {selectedAgreement.company_address || 'Corporate Technology Park, Outer Ring Road, Bengaluru, Karnataka 560103'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block">Strictly Private & Confidential</span>
                    <span className="text-xs font-bold text-slate-600 mt-1 block">Date: {selectedAgreement.offer_date || new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Candidate Addressee */}
                <div className="mb-6">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Candidate Name:</div>
                  <div className="text-lg font-black text-slate-900">{selectedAgreement.candidate_name}</div>
                  <div className="text-xs text-slate-600">Email: {selectedAgreement.candidate_email}</div>
                </div>

                {/* Heading */}
                <div className="text-center my-6">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-widest underline decoration-2 underline-offset-4">
                    EMPLOYMENT OFFER
                  </h3>
                </div>

                {/* Intro */}
                <p className="mb-4 text-slate-700">
                  We are pleased to present you with an offer of employment with <strong>{selectedAgreement.company_name}</strong> as <strong>{selectedAgreement.job_title}</strong>. Your employment with the Company will commence on <strong>{selectedAgreement.joining_date}</strong>.
                </p>

                {/* Terms Table */}
                <table className="w-full border-collapse mb-6 border border-slate-300 text-xs">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Joining Date</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.joining_date}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Contract Period</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.contract_period || 'Full Time / Unlimited'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Mobility & Relocation</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.mobility_clause}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Notice Period & Termination</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.termination_employee_notice_days || 30} days notice period by either party</td>
                    </tr>
                    <tr>
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Probation Period</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.probation_period_months || 3} Months from joining</td>
                    </tr>
                  </tbody>
                </table>

                {/* Annexure A Compensation Details */}
                <div className="border-t-2 border-slate-300 pt-6 mt-6">
                  <div className="text-center mb-4">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">ANNEXURE A — COMPENSATION DETAILS</h4>
                    <span className="text-xs font-bold text-emerald-700 uppercase">Fixed Annual Cost to Company (CTC) Breakdown</span>
                  </div>

                  <table className="w-full border-collapse mb-6 border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-900">
                        <th className="p-2.5 text-left font-bold">Salary Component</th>
                        <th className="p-2.5 text-right font-bold">Monthly (INR ₹)</th>
                        <th className="p-2.5 text-right font-bold">Annualized (INR ₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">Basic Salary (50%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.basic_salary_monthly || 75000).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.basic_salary_annual || 900000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">House Rent Allowance (HRA 25%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.hra_monthly || 37500).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.hra_annual || 450000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">Other & Special Allowance (15%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.other_allowance_monthly || 22500).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.other_allowance_annual || 270000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">Provident Fund (Employer PF 10%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.pf_monthly || 15000).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.pf_annual || 180000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="bg-emerald-50 font-black text-slate-900 border-t-2 border-emerald-600">
                        <td className="p-2.5 text-emerald-900">Total Fixed CTC</td>
                        <td className="p-2.5 text-right text-emerald-900">₹{Number(selectedAgreement.annexure?.total_fixed_monthly || 150000).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-emerald-900">₹{Number(selectedAgreement.annexure?.total_fixed_annual || 1800000).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Benefits */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 mb-6">
                    <div><strong>Medical Insurance:</strong> {selectedAgreement.annexure?.medical_insurance_coverage || '₹5,00,000 family floater'}</div>
                    <div><strong>Life Insurance:</strong> {selectedAgreement.annexure?.life_insurance_coverage || 'Group Life Policy up to 3x CTC'}</div>
                    <div><strong>Bonus:</strong> {selectedAgreement.annexure?.annual_bonus_percentage || 10}% performance bonus eligibility</div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="border-t-2 border-slate-300 pt-6 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <div className="text-slate-500 mb-6">Authorized Signatory:</div>
                    <div className="border-t border-slate-900 pt-2">
                      <div className="font-black text-slate-900">{selectedAgreement.hr_signatory_name || 'Rakesh Sharma'}</div>
                      <div className="text-slate-500">{selectedAgreement.hr_signatory_title || 'VP – Human Resources'}</div>
                      <div className="text-slate-500">{selectedAgreement.company_name}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-6">Agreed & Accepted by:</div>
                    <div className="border-t border-slate-900 pt-2">
                      <div className="font-black text-slate-900">
                        {selectedAgreement.signature_name || selectedAgreement.candidate_name}
                      </div>
                      <div className="text-slate-500">Employee Signature</div>
                      {selectedAgreement.signed_at && (
                        <div className="text-emerald-700 font-bold text-[11px] mt-0.5">
                          Digitally Signed: {new Date(selectedAgreement.signed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Signing Execution Footer */}
              {signSuccessMessage && (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{signSuccessMessage}</span>
                </div>
              )}

              {selectedAgreement.status === 'Accepted & Signed' || selectedAgreement.agreement_status === 'Accepted & Signed' || selectedAgreement.candidate_accepted ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>This Employment Agreement has been digitally signed and executed. Onboarding is active.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAgreement(null)}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/15 space-y-4">
                  <div className="flex items-center gap-2 text-white">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <span className="font-bold text-sm">Digital Signature & Execution</span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    By providing your digital signature and clicking below, you formally accept the employment terms, compensation breakdown, and standard policies specified in this document.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-white/60 block mb-1 uppercase tracking-wider">
                        Full Legal Name (Digital Signature) *
                      </label>
                      <input
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder="e.g. Arjun M"
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none pb-2">
                        <input
                          type="checkbox"
                          checked={signatureAgreed}
                          onChange={(e) => setSignatureAgreed(e.target.checked)}
                          className="w-4 h-4 rounded border-white/30 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>I confirm that I agree to all terms of this agreement.</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAgreement(null)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!signatureAgreed || !signatureName.trim() || signingAgreement}
                      onClick={() => handleSignAgreement(selectedAgreement._id || selectedAgreement.candidate_id)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-98 flex items-center gap-2"
                    >
                      {signingAgreement ? (
                        'Executing Agreement…'
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>✓ Sign & Accept Employment Agreement</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Candidate Auth Modal (Google OAuth & Email/Password) */}
      {/* ============================================================ */}
      {/* MODAL 6: AUTHENTICATION MODAL (PREMIUM WHITE MODAL)           */}
      {/* ============================================================ */}
      {showAuthModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl font-sans animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-md w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.06)] p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto text-neutral-900">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
                setAuthSuccessMsg('');
                setActiveNavTab('home');
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/80 transition cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[0.65rem] font-bold tracking-[0.2em] text-neutral-600 uppercase mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
                <span>Candidate Talent Portal</span>
              </div>
              <h3 className="font-display text-xl font-extrabold text-neutral-900 tracking-tight">
                {authModalTab === 'login' ? 'Sign In to Open Roles' : 'Create Talent Profile'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {authModalTab === 'login'
                  ? 'Access verified partner requisitions and 1-click apply.'
                  : 'Join the verified talent network to browse and apply for roles.'}
              </p>
            </div>

            {/* 1-Click Google OAuth (Primary Action) */}
            <button
              type="button"
              onClick={() => handleGoogleSignIn()}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800 font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition cursor-pointer disabled:opacity-50 mb-5"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>{authLoading ? 'Connecting Google Account…' : 'Continue with Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-neutral-200 w-full" />
              <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400 absolute">
                or use candidate credentials
              </span>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-neutral-100 border border-neutral-200 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('login');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${authModalTab === 'login'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('register');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${authModalTab === 'register'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
                  }`}
              >
                Create Profile
              </button>
            </div>

            {/* Alerts */}
            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span className="flex-1">{authError}</span>
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {authModalTab === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                    >
                      {showAuthPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-md hover:shadow-lg mt-3 disabled:opacity-50"
                >
                  {authLoading ? 'Signing In…' : 'Sign In to Candidate Profile'}
                </button>
              </form>
            )}

            {/* TAB 2: REGISTER FORM */}
            {authModalTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Personal Email *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="alex@gmail.com"
                      className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                        regEmail && validateCandidateEmail(regEmail, { required: false })
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                      } rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 transition-all`}
                    />
                    {regEmail && validateCandidateEmail(regEmail, { required: false }) && (
                      <p className="mt-1 text-[10px] text-rose-600 font-medium">
                        {validateCandidateEmail(regEmail, { required: false })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Phone</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => {
                        setRegPhone(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="e.g. 9876543210 or +91 9876543210"
                      className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                        regPhone && validatePhone(regPhone, { required: false })
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                      } rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 transition-all`}
                    />
                    {regPhone && validatePhone(regPhone, { required: false }) && (
                      <p className="mt-1 text-[10px] text-rose-600 font-medium">
                        {validatePhone(regPhone, { required: false })}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="e.g. Senior Fullstack Engineer"
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Key Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={regSkills}
                    onChange={(e) => setRegSkills(e.target.value)}
                    placeholder="React, TypeScript, Python, Node.js"
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Resume File (PDF/DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => setRegResume(e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-neutral-200 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 file:transition cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-md hover:shadow-lg mt-3 disabled:opacity-50"
                >
                  {authLoading ? 'Creating Profile…' : 'Create Profile & Access Roles'}
                </button>
              </form>
            )}

            {/* Footer Security Note */}
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Verified candidate session · Encrypted data</span>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
