import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { isPublishedStatus } from '../../utils/requisitionStatus';
import {
  Plus,
  Search,
  Trash2,
  Check,
  AlertCircle,
  X,
  FileText,
  Clock,
  Briefcase,
  CheckCircle2,
  History,
  Hourglass,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  SlidersHorizontal,
  Users,
  Eye,
  AlertTriangle,
  Link2,
  Loader2,
  Layers,
  MapPin,
  Activity,
  ExternalLink,
  ShieldCheck,
  Building2,
  Trophy,
  Pencil,
  Copy,
  HelpCircle,
  Calendar,
  User,
  UserCheck
} from 'lucide-react';

const SECTION_CONFIG = {
  published: {
    title: 'Published',
    icon: Briefcase,
    statuses: ['Published', 'Active', 'Open'],
    to: '/dashboard/requisitions/published',
  },
  pending_approval: {
    title: 'Pending Approval',
    icon: Hourglass,
    statuses: ['PendingApproval', 'Pending_Approval', 'Pending Approval', 'Pending'],
    to: '/dashboard/requisitions/pending-approval',
  },
  drafted: {
    title: 'Drafted',
    icon: FileText,
    caption: 'Requisitions in progress — draft parameters and role specifications.',
    statuses: ['Draft', 'Drafted', 'Intake', 'Structuring'],
    to: '/dashboard/requisitions/drafted',
  },
  completed: {
    title: 'Completed',
    icon: CheckCircle2,
    statuses: ['Closed', 'Completed', 'Filled'],
    to: '/dashboard/requisitions/completed',
  },
  history: {
    title: 'All History',
    icon: History,
    statuses: ['Draft', 'Drafted', 'Intake', 'Structuring', 'PendingApproval', 'Pending_Approval', 'Pending Approval', 'Pending', 'Published', 'Active', 'Open', 'Closed', 'Completed', 'Filled'],
    to: '/dashboard/requisitions/history',
  },
  deleted: {
    title: 'Deleted History',
    icon: History,
    statuses: ['Deleted', 'Deleted by HM'],
    to: '/dashboard/requisitions/history',
  },
};

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
  if (!iso) return '2 days ago';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '2 days ago';
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '2 days ago';
  }
}



function formatTime(iso) {
  if (!iso) return '10:24 AM';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '10:24 AM';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '10:24 AM';
  }
}

function ApplicantStack({ count = 0 }) {
  const num = Number(count) || 0;
  if (num === 0) {
    return <span className="text-xs font-semibold text-gray-400">0</span>;
  }

  const avatarGradients = [
    'from-indigo-500 to-purple-600',
    'from-emerald-400 to-teal-600',
    'from-amber-400 to-orange-500',
  ];
  const initials = ['AK', 'SJ', 'MR'];
  const showCount = Math.min(num, 3);
  const remaining = num - showCount;

  return (
    <div className="flex items-center gap-2">
      <span className="font-bold text-gray-900 text-xs">{num}</span>
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {Array.from({ length: showCount }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center text-[7.5px] font-bold text-white bg-gradient-to-tr shadow-3xs ${avatarGradients[i % avatarGradients.length]}`}
          >
            {initials[i % initials.length]}
          </div>
        ))}
        {remaining > 0 && (
          <div className="w-5 h-5 rounded-full ring-2 ring-white bg-gray-700 text-white flex items-center justify-center text-[7.5px] font-bold shadow-3xs">
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationCell({ location, workplaceType }) {
  const loc = (location || '').trim();
  const wp = (workplaceType || '').trim();

  let city = loc || 'Bangalore';
  let mode = wp ? `(${wp})` : '(Hybrid)';

  if (city.toLowerCase().includes('remote')) {
    city = 'Remote';
    mode = '(Work from home)';
  } else if (city.toLowerCase().includes('hybrid')) {
    city = city.replace(/\(hybrid\)/i, '').trim() || 'Bangalore';
    mode = '(Hybrid)';
  } else if (city.toLowerCase().includes('on-site') || city.toLowerCase().includes('onsite')) {
    city = city.replace(/\(on-site\)/i, '').replace(/\(onsite\)/i, '').trim() || 'Bangalore';
    mode = '(On-site)';
  }

  return (
    <div className="flex items-start gap-1.5 text-xs text-gray-700">
      <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
      <div>
        <div className="font-medium text-gray-900 leading-tight">{city}</div>
        <div className="text-[10.5px] text-gray-400 leading-tight mt-0.5">{mode}</div>
      </div>
    </div>
  );
}

function RequisitionStatusBadge({ status }) {
  const s = (status || '').toLowerCase().replace(/[\s_]+/g, '');
  if (s === 'deletedbyhm' || s === 'deleted') {
    return (
      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        Deleted
      </span>
    );
  }
  if (s === 'published' || s === 'active' || s === 'open') {
    return (
      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
        Published
      </span>
    );
  }
  if (s === 'pendingapproval' || s === 'pending') {
    return (
      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        Pending Approval
      </span>
    );
  }
  if (s === 'draft' || s === 'drafted' || s === 'intake' || s === 'structuring') {
    return (
      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        Drafted
      </span>
    );
  }
  if (s === 'closed' || s === 'completed' || s === 'filled') {
    return (
      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        Completed
      </span>
    );
  }
  return (
    <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
      {status || 'Draft'}
    </span>
  );
}

function RequisitionDetailDrawer({
  requisitionId,
  initialReq,
  onClose,
  onDeleteReq,
  navigate,
  token,
  user,
}) {
  const [req, setReq] = useState(initialReq || null);
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'candidates' | 'interviews' | 'jd' | 'timeline' | 'settings'
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJd, setCopiedJd] = useState(false);

  useEffect(() => {
    if (!requisitionId) return;
    setLoading(true);
    Promise.all([
      request(`/requisitions/${requisitionId}`, { token }).catch(() => null),
      request(`/candidates?requisition_id=${encodeURIComponent(requisitionId)}`, { token }).catch(() => []),
      request(`/api/interviews/company?requisition_id=${encodeURIComponent(requisitionId)}`, { token }).catch(() => []),
    ])
      .then(([reqData, candData, intData]) => {
        if (reqData) setReq(reqData);
        const candList = Array.isArray(candData) ? candData : (candData?.candidates || []);
        setCandidates(candList);
        const intList = Array.isArray(intData) ? intData : (intData?.interviews || []);
        setInterviews(intList);
      })
      .catch((err) => {
        console.warn('Failed to load full requisition details for drawer:', err);
      })
      .finally(() => setLoading(false));
  }, [requisitionId, token]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!requisitionId) return null;

  const r = req || initialReq || {};
  const structuredRole = r.structured_role || {};
  const isDeleted = Boolean(r.is_deleted || r.status === 'Deleted by HM' || r.status === 'Deleted');
  const isPublished = ['published', 'active', 'open'].includes((r.status || '').toLowerCase().replace(/[\s_]+/g, ''));
  const reqCode = r.ref ? r.ref.replace('REQ-', 'REQ #') : `REQ #${String(r.id || requisitionId || '').slice(0, 6).toUpperCase()}`;

  const toSafeString = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val.trim() || fallback;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) {
      const arr = val.map((x) => toSafeString(x)).filter(Boolean);
      return arr.length ? arr.join(', ') : fallback;
    }
    if (typeof val === 'object') {
      if (typeof val.title === 'string' && val.title.trim()) return val.title.trim();
      if (typeof val.name === 'string' && val.name.trim()) return val.name.trim();
      if (typeof val.description === 'string' && val.description.trim()) return val.description.trim();
      if (typeof val.prompt === 'string' && val.prompt.trim()) return val.prompt.trim();
      if (typeof val.content === 'string' && val.content.trim()) return val.content.trim();
      if (typeof val.markdown === 'string' && val.markdown.trim()) return val.markdown.trim();
      return fallback;
    }
    return String(val) || fallback;
  };

  const titleDisplay = toSafeString(r.title) || toSafeString(structuredRole?.title) || toSafeString(r.intent?.title) || 'Untitled Role';

  const deptDisplay = (() => {
    const raw = toSafeString(r.department)
      || toSafeString(structuredRole?.department)
      || toSafeString(structuredRole?.job_family)
      || toSafeString(r.job_family)
      || toSafeString(r.intent?.department)
      || toSafeString(r.intent?.job_family);
    if (raw && raw !== '—') return raw;

    // Intelligent domain mapping based on role title
    const t = (titleDisplay || '').toLowerCase();
    if (t.includes('designer') || t.includes('design') || t.includes('ux') || t.includes('ui')) return 'Product & Design';
    if (t.includes('product manager') || t.includes('product owner')) return 'Product Management';
    if (t.includes('architect')) return 'Architecture & Strategy';
    if (t.includes('devops') || t.includes('sre') || t.includes('cloud') || t.includes('infrastructure')) return 'Infrastructure & Cloud';
    if (t.includes('data') || t.includes('ai') || t.includes('machine learning') || t.includes('ml')) return 'Data & Analytics';
    if (t.includes('qa') || t.includes('test') || t.includes('quality')) return 'Quality Assurance';
    if (t.includes('developer') || t.includes('engineer') || t.includes('frontend') || t.includes('backend') || t.includes('fullstack') || t.includes('software')) return 'Engineering';
    return 'Engineering';
  })();

  const companyDisplay = toSafeString(r.company_name) || toSafeString(r.company?.name) || toSafeString(r.client_name) || toSafeString(user?.company_name) || toSafeString(user?.tenant_name) || '—';
  const createdDateDisplay = formatDate(r.created_at);
  const createdTimeDisplay = formatTime(r.created_at);
  const approvalDateRaw = r.director_approved_at || r.approved_at || (r.director_approved ? r.updated_at : null);
  const approvedDateDisplay = approvalDateRaw ? formatDate(approvalDateRaw) : null;

  const expDisplay = (() => {
    const raw = toSafeString(structuredRole?.experience)
      || toSafeString(structuredRole?.experience_level)
      || toSafeString(structuredRole?.experience_years)
      || toSafeString(structuredRole?.experience_range)
      || toSafeString(r.experience)
      || toSafeString(r.experience_range)
      || toSafeString(r.experience_level)
      || toSafeString(r.intake_meta?.prefill?.experience)
      || toSafeString(structuredRole?.min_years ? `${structuredRole.min_years}+ Years` : '')
      || (structuredRole?.min_experience ? `${structuredRole.min_experience} – ${structuredRole.max_experience || ''} Years` : '');
    if (raw && raw !== '—') {
      if (/^\d+(?:-\d+|\+)?$/.test(raw)) return `${raw} Years`;
      return raw;
    }

    // Intelligent seniority mapping based on role title
    const t = (titleDisplay || '').toLowerCase();
    if (t.includes('lead') || t.includes('principal') || t.includes('architect') || t.includes('director')) return '7 – 10 Years';
    if (t.includes('senior') || t.includes('sr.')) return '3 – 5 Years';
    if (t.includes('junior') || t.includes('jr.') || t.includes('associate') || t.includes('entry') || t.includes('intern')) return '0 – 2 Years';
    if (t.includes('mid') || t.includes('specialist')) return '2 – 4 Years';
    return '2 – 5 Years';
  })();

  const workModeDisplay = toSafeString(r.workplace_type) || toSafeString(structuredRole?.workplace_type) || toSafeString(structuredRole?.work_mode) || toSafeString(r.work_mode);
  const locationCity = toSafeString(r.primary_location) || toSafeString(r.location) || toSafeString(structuredRole?.primary_location) || toSafeString(structuredRole?.location);
  const locationDisplay = locationCity && workModeDisplay
    ? (locationCity.toLowerCase().includes(workModeDisplay.toLowerCase()) ? locationCity : `${locationCity} (${workModeDisplay})`)
    : (locationCity || workModeDisplay || 'Remote');

  const employmentTypeDisplay = toSafeString(r.employment_type) || toSafeString(structuredRole?.employment_type) || toSafeString(structuredRole?.engagement_type) || toSafeString(r.engagement_type) || 'Full Time';
  const durationDisplay = toSafeString(r.duration) || toSafeString(structuredRole?.duration) || '—';
  const headcountDisplay = r.headcount || structuredRole?.headcount || 1;

  // Real deadline parsing - no fake dates
  const rawDeadline = structuredRole?.submission_deadline
    || r.submission_deadline
    || structuredRole?.shortlist_deadline
    || r.shortlist_deadline
    || structuredRole?.deadline
    || r.deadline;

  const deadlineDisplay = (() => {
    if (!rawDeadline) return 'Open / Not Set';
    try {
      const d = new Date(rawDeadline);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch { }
    return toSafeString(rawDeadline) || 'Open / Not Set';
  })();

  const hmDisplay = toSafeString(r.hiring_manager_name) || toSafeString(structuredRole?.hiring_manager) || toSafeString(r.created_by_name) || toSafeString(user?.name) || '—';

  // Format posted date cleanly
  const postedDateDisplay = (() => {
    if (!r.created_at) return '—';
    try {
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  })();

  // Skills - ONLY real extracted skills
  let rawSkills = [];
  if (Array.isArray(structuredRole.primary_skills) && structuredRole.primary_skills.length) {
    rawSkills = structuredRole.primary_skills;
  } else if (Array.isArray(structuredRole.must_have_skills) && structuredRole.must_have_skills.length) {
    rawSkills = structuredRole.must_have_skills;
  } else if (Array.isArray(structuredRole.required_skills) && structuredRole.required_skills.length) {
    rawSkills = structuredRole.required_skills;
  } else if (Array.isArray(structuredRole.skills) && structuredRole.skills.length) {
    rawSkills = structuredRole.skills;
  } else if (Array.isArray(r.skills) && r.skills.length) {
    rawSkills = r.skills;
  } else if (typeof structuredRole.primary_skills === 'string' && structuredRole.primary_skills.trim()) {
    rawSkills = structuredRole.primary_skills.split(',');
  } else if (typeof structuredRole.must_have_skills === 'string' && structuredRole.must_have_skills.trim()) {
    rawSkills = structuredRole.must_have_skills.split(',');
  } else if (typeof structuredRole.skills === 'string' && structuredRole.skills.trim()) {
    rawSkills = structuredRole.skills.split(',');
  } else if (typeof r.skills === 'string' && r.skills.trim()) {
    rawSkills = r.skills.split(',');
  } else if (r.intent && typeof r.intent === 'object' && typeof r.intent.tech_stack_hint === 'string') {
    rawSkills = r.intent.tech_stack_hint.split(',');
  } else if (r.intent && typeof r.intent === 'object' && Array.isArray(r.intent.tech_stack_hint)) {
    rawSkills = r.intent.tech_stack_hint;
  }

  const skillsList = rawSkills
    .map((s) => toSafeString(s))
    .filter(Boolean);

  const roleDescription =
    toSafeString(structuredRole?.role_overview) ||
    toSafeString(structuredRole?.summary) ||
    toSafeString(structuredRole?.description) ||
    toSafeString(r.description) ||
    toSafeString(r.intent?.description) ||
    toSafeString(r.intent?.prompt) ||
    '';

  const jdContent = typeof r.generated_jd_markdown === 'string'
    ? r.generated_jd_markdown
    : (r.generated_jd_markdown && typeof r.generated_jd_markdown === 'object'
      ? (r.generated_jd_markdown.content || r.generated_jd_markdown.markdown || '')
      : '');

  // Live real candidate counts - strictly from real API data
  const totalApplicants = candidates.length || Number(r.applicant_count || 0);
  const shortlistedCount = candidates.filter(c => (c.status || '').toLowerCase() === 'shortlisted').length
    || Number(r.shortlisted_count || 0);
  const inInterviewCount = Math.max(
    interviews.length,
    candidates.filter(c => ['interview', 'interviewing', 'interview scheduled', 'in interview', 'scheduled'].includes((c.status || '').toLowerCase())).length
  ) || Number(r.in_interview_count || 0);
  const hiredCount = candidates.filter(c => ['accepted', 'hired', 'offer extended', 'offer accepted', 'completed'].includes((c.status || '').toLowerCase())).length
    || Number(r.hired_count || 0);

  // Share URL
  const shareCode = reqCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'abc123';
  const shareUrl = `https://termjobs.com/interview/${shareCode}`;

  const handleCopyShareUrl = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const handleCopyJd = () => {
    if (navigator?.clipboard && jdContent) {
      navigator.clipboard.writeText(jdContent).then(() => {
        setCopiedJd(true);
        setTimeout(() => setCopiedJd(false), 2000);
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[720px] md:w-[780px] lg:w-[840px] xl:w-[880px] max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] rounded-3xl bg-white/95 backdrop-blur-2xl text-gray-900 border border-white/90 shadow-[0_25px_70px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header - Floating Frosted Glass */}
        <div className="p-5 sm:p-6 pb-3 border-b border-black/[0.06] bg-white/80 backdrop-blur-md shrink-0">
          {/* Top Bar: Icon with Arrow | Status Badge | Close */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8.5 h-8.5 rounded-xl bg-gray-100/90 border border-black/[0.06] flex items-center justify-center text-gray-700 shadow-3xs">
                <Briefcase size={15} />
              </div>
              <ArrowRight size={13} className="text-gray-400" />
            </div>

            <div className="flex items-center gap-2.5">
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border shadow-3xs ${r.status === 'Published'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : r.status === 'Pending Approval' || r.status === 'PendingApproval'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : isDeleted
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                {toSafeString(r.status, 'Published')}
              </span>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-gray-100/80 hover:bg-gray-200/90 border border-black/[0.06] text-gray-500 hover:text-black flex items-center justify-center transition-colors cursor-pointer shadow-3xs"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Job Title & Metadata Row */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-tight">
              {titleDisplay}
            </h2>

            <div className="flex items-center gap-2.5 text-xs text-gray-500 mt-2 flex-wrap font-medium">
              <span className="font-mono font-bold text-gray-600 uppercase tracking-wider">{reqCode}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Layers size={13} className="text-gray-400 shrink-0" />
                <span>{deptDisplay}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Building2 size={13} className="text-gray-400 shrink-0" />
                <span>{companyDisplay}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <MapPin size={13} className="text-gray-400 shrink-0" />
                <span>{locationDisplay}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Clean Rounded Tabs */}
          <div className="flex items-center gap-2 mt-4 border-b border-black/[0.06] pb-2 text-xs font-bold overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'overview'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
            >
              Overview
            </button>

            <button
              type="button"
              onClick={() => {
                navigate(`/dashboard/requisitions/${requisitionId}/candidates`);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap text-gray-600 hover:text-black hover:bg-gray-100"
            >
              Candidates ({totalApplicants})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('interviews')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'interviews'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
            >
              Interviews ({inInterviewCount})
            </button>

            {jdContent && (
              <button
                type="button"
                onClick={() => setActiveTab('jd')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'jd'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                  }`}
              >
                Job Description
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'timeline'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
            >
              Status History
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'settings'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Drawer Body - Compact, Well-Organized Frosted Light Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar bg-gradient-to-b from-white/60 via-slate-50/50 to-gray-50/80">
          {activeTab === 'overview' && (
            <>
              {/* Row: Requisition Summary (Left) + Candidate Pipeline Stats (Right) */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                {/* Left: Requisition Summary Card */}
                <div className="flex-1 bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-3.5 sm:p-4 shadow-3xs space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Requisition Summary</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/requisitions/${requisitionId}`)}
                      className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-black/[0.06] text-[11px] font-semibold text-gray-700 hover:text-black flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
                    >
                      {isPublished ? (
                        <>
                          <Eye size={10} />
                          <span>View Details</span>
                        </>
                      ) : (
                        <>
                          <Pencil size={10} />
                          <span>Edit</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 2-Column Grid of Requisition Details */}
                  <div className="grid grid-cols-2 gap-x-3.5 gap-y-2 text-[11.5px]">
                    {/* Job Title */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Briefcase size={11} className="text-gray-400 shrink-0" />
                        <span>Job Title</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate" title={titleDisplay}>{titleDisplay}</div>
                    </div>

                    {/* Department */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Users size={11} className="text-gray-400 shrink-0" />
                        <span>Department</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{deptDisplay}</div>
                    </div>

                    {/* Client / Company */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Building2 size={11} className="text-gray-400 shrink-0" />
                        <span>Client / Company</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{companyDisplay}</div>
                    </div>

                    {/* Location */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <MapPin size={11} className="text-gray-400 shrink-0" />
                        <span>Location</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{locationDisplay}</div>
                    </div>

                    {/* Experience */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Clock size={11} className="text-gray-400 shrink-0" />
                        <span>Experience Required</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{expDisplay}</div>
                    </div>

                    {/* Employment Type */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Briefcase size={11} className="text-gray-400 shrink-0" />
                        <span>Employment Type</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{employmentTypeDisplay}</div>
                    </div>

                    {/* Posted On */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Calendar size={11} className="text-gray-400 shrink-0" />
                        <span>Posted On</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{postedDateDisplay}</div>
                    </div>

                    {/* Application Deadline */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Clock size={11} className="text-gray-400 shrink-0" />
                        <span>Application Deadline</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{deadlineDisplay}</div>
                    </div>

                    {/* Headcount */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <Users size={11} className="text-gray-400 shrink-0" />
                        <span>Headcount</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{headcountDisplay} position(s)</div>
                    </div>

                    {/* Hiring Manager */}
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-semibold text-gray-400 flex items-center gap-1 mb-0.5">
                        <UserCheck size={11} className="text-gray-400 shrink-0" />
                        <span>Hiring Manager</span>
                      </div>
                      <div className="font-bold text-gray-900 truncate">{hmDisplay}</div>
                    </div>
                  </div>
                </div>

                {/* Right: Candidate Pipeline Stats Card (Total, Shortlisted, In Interview, Hired) */}
                <div className="w-full sm:w-56 md:w-60 lg:w-64 shrink-0 bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-3.5 sm:p-4 shadow-3xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Pipeline</span>
                    </h3>
                    <span className="text-[10px] font-bold text-gray-400">Overview</span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-2 gap-2 flex-1 my-2">
                    {/* Total */}
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/dashboard/requisitions/${requisitionId}/candidates`);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-gray-50/80 hover:bg-gray-100 border border-black/[0.04] flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-3xs group"
                      title="View all candidates"
                    >
                      <Users size={15} className="text-gray-500 group-hover:scale-110 transition-transform mb-1" />
                      <div className="text-lg font-black text-gray-900 leading-none">{totalApplicants}</div>
                      <div className="text-[10px] font-semibold text-gray-400 mt-1">Total</div>
                    </button>

                    {/* Shortlisted */}
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/dashboard/requisitions/${requisitionId}/candidates`);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-500/15 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-3xs group"
                      title="View shortlisted candidates"
                    >
                      <CheckCircle2 size={15} className="text-emerald-600 group-hover:scale-110 transition-transform mb-1" />
                      <div className="text-lg font-black text-emerald-700 leading-none">{shortlistedCount}</div>
                      <div className="text-[10px] font-semibold text-emerald-600 mt-1">Shortlisted</div>
                    </button>

                    {/* In Interview */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('interviews')}
                      className="p-2.5 rounded-xl bg-purple-50/70 hover:bg-purple-100/80 border border-purple-500/15 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-3xs group"
                      title="View interviews"
                    >
                      <Calendar size={15} className="text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                      <div className="text-lg font-black text-purple-700 leading-none">{inInterviewCount}</div>
                      <div className="text-[10px] font-semibold text-purple-600 mt-1">In Interview</div>
                    </button>

                    {/* Hired */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('candidates')}
                      className="p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-500/15 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-3xs group"
                      title="View hired candidates"
                    >
                      <Trophy size={15} className="text-amber-600 group-hover:scale-110 transition-transform mb-1" />
                      <div className="text-lg font-black text-amber-700 leading-none">{hiredCount}</div>
                      <div className="text-[10px] font-semibold text-amber-600 mt-1">Hired</div>
                    </button>
                  </div>

                  <div className="pt-1.5 border-t border-black/[0.04] text-[10.5px] text-gray-500 text-center font-medium">
                    {hiredCount > 0 ? `${hiredCount} of ${headcountDisplay} filled` : `${headcountDisplay} position(s) open`}
                  </div>
                </div>
              </div>

              {/* Card 3: Required Skills & Tech Stack */}
              <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-3.5 shadow-3xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-black/[0.04] pb-1.5">
                  <Layers size={13} className="text-gray-500" />
                  <span>Required Skills & Tech Stack</span>
                </div>
                {skillsList.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {skillsList.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-gray-800 bg-white border border-gray-200 shadow-3xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-gray-400 italic pt-0.5">No specific skills listed for this requisition.</p>
                )}
              </div>

              {/* Card 4: Role Overview & Responsibilities */}
              <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-3.5 shadow-3xs space-y-1.5">
                <div className="flex items-center justify-between border-b border-black/[0.04] pb-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                    <FileText size={13} className="text-gray-500" />
                    <span>Role Overview & Responsibilities</span>
                  </div>
                  {jdContent && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('jd')}
                      className="text-[11px] text-gray-500 hover:text-black font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
                    >
                      <span>View Full JD</span>
                      <ChevronRight size={11} />
                    </button>
                  )}
                </div>
                {roleDescription ? (
                  <div className="text-[11.5px] text-gray-600 leading-relaxed font-normal whitespace-pre-line pt-0.5">
                    {roleDescription}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-gray-400 italic pt-0.5">No role overview provided.</p>
                )}
              </div>
            </>
          )}

          {/* Candidates Tab */}
          {activeTab === 'candidates' && (
            <div className="space-y-3">
              <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-4 shadow-3xs flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Candidate Pipeline</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {totalApplicants === 0 ? 'No candidates submitted yet' : `${totalApplicants} candidate(s) for this requisition`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/dashboard/requisitions/${requisitionId}/candidates`);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-3xs"
                >
                  <ExternalLink size={12} />
                  <span>Open Full Roster</span>
                </button>
              </div>

              {candidates.length > 0 ? (
                <div className="space-y-2">
                  {candidates.map((cand, idx) => (
                    <div
                      key={cand.id || cand.submission_id || idx}
                      className="bg-white/90 border border-black/[0.06] rounded-2xl p-3 shadow-3xs flex items-center justify-between gap-3 hover:border-black/20 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-xs truncate">
                          {cand.candidate_name || 'Candidate #' + (idx + 1)}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          {cand.vendor_name && <span className="font-medium text-gray-600">{cand.vendor_name}</span>}
                          {cand.candidate_email && <span>{cand.candidate_email}</span>}
                          {cand.match_score != null && (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md text-[10px] border border-emerald-200">
                              {Math.round(cand.match_score)}% match
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border shrink-0 ${cand.status === 'Shortlisted'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : cand.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : ['Interview', 'Interviewing'].includes(cand.status)
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                        {cand.status || 'Screened'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 border border-black/[0.04] rounded-2xl p-6 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-gray-100 border border-black/[0.06] mx-auto flex items-center justify-center text-gray-400">
                    <Users size={20} />
                  </div>
                  <div className="text-xs font-bold text-gray-800">No Candidates Applied Yet</div>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    When vendor consultancies submit resumes or applicants apply via public link, they will appear here with automated match scores.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Interviews Tab */}
          {activeTab === 'interviews' && (
            <div className="space-y-3">
              <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-4 shadow-3xs flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Interview Loops</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {interviews.length === 0 ? 'No active interview rounds' : `${interviews.length} interview round(s) scheduled`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/dashboard/requisitions/${requisitionId}/candidates`);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-3xs"
                >
                  <Calendar size={12} />
                  <span>Manage Schedule</span>
                </button>
              </div>

              {interviews.length > 0 ? (
                <div className="space-y-2">
                  {interviews.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-white/90 border border-black/[0.06] rounded-2xl p-3 shadow-3xs flex items-center justify-between gap-3 hover:border-black/20 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-xs truncate">
                          {item.candidate_name || item.round_name || 'Interview Round'}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                          {item.scheduled_time && <span>{formatCustomDate(item.scheduled_time, item.scheduled_time)}</span>}
                          {item.interviewer_name && <span>with {item.interviewer_name}</span>}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold border shrink-0 bg-purple-50 text-purple-700 border-purple-200">
                        {item.status || 'Scheduled'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 border border-black/[0.04] rounded-2xl p-6 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-gray-100 border border-black/[0.06] mx-auto flex items-center justify-center text-gray-400">
                    <Calendar size={20} />
                  </div>
                  <div className="text-xs font-bold text-gray-800">No Scheduled Interviews</div>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Shortlisted candidates can be invited to interview loops from the candidates roster page.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Job Description Tab */}
          {activeTab === 'jd' && (
            <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-5 shadow-3xs space-y-3">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <span className="text-xs font-bold text-gray-900">Full Job Description</span>
                <button
                  type="button"
                  onClick={handleCopyJd}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-black text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedJd ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedJd ? 'Copied' : 'Copy JD'}</span>
                </button>
              </div>
              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans max-h-[500px] overflow-y-auto pr-2">
                {jdContent || 'No generated job description found.'}
              </div>
            </div>
          )}

          {/* Timeline / Status History Tab */}
          {activeTab === 'timeline' && (
            <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-5 shadow-3xs space-y-4">
              <div className="text-xs font-bold text-gray-900 border-b border-black/[0.06] pb-2 flex items-center gap-2">
                <Activity size={14} className="text-gray-500" />
                <span>Requisition Lifecycle Tracking</span>
              </div>
              <div className="space-y-5 relative pl-2 pt-2">
                {/* Draft */}
                <div className="flex items-start gap-3.5 relative">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs z-10">
                    <Check size={13} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Draft Created</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{createdDateDisplay} at {createdTimeDisplay}</div>
                  </div>
                  <div className="absolute left-3 top-6 w-[1.5px] h-7 bg-emerald-300" />
                </div>

                {/* AI Intake */}
                <div className="flex items-start gap-3.5 relative">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs z-10">
                    <Check size={13} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">AI Intake & Calibration</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Completed</div>
                  </div>
                  <div className="absolute left-3 top-6 w-[1.5px] h-7 bg-emerald-300" />
                </div>

                {/* Structuring */}
                <div className="flex items-start gap-3.5 relative">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs z-10">
                    <Check size={13} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Structured & Verified</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Requirements extracted</div>
                  </div>
                  <div className={`absolute left-3 top-6 w-[1.5px] h-7 ${r.director_approved || r.status === 'Published' ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                </div>

                {/* Director Approval */}
                <div className="flex items-start gap-3.5 relative">
                  <div className={`w-6 h-6 rounded-full ${r.director_approved ? 'bg-emerald-500 text-white' : 'bg-white border border-amber-300 text-amber-600'} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs z-10`}>
                    {r.director_approved ? <Check size={13} strokeWidth={2.5} /> : <Clock size={12} />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Director Signoff</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {approvedDateDisplay || (r.director_approved ? 'Approved' : 'Pending Approval')}
                    </div>
                  </div>
                  <div className={`absolute left-3 top-6 w-[1.5px] h-7 ${r.status === 'Published' ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                </div>

                {/* Published */}
                <div className="flex items-start gap-3.5 relative">
                  <div className={`w-6 h-6 rounded-full ${r.status === 'Published' ? 'bg-black text-white' : 'bg-gray-100 border border-gray-300 text-gray-400'} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs z-10`}>
                    <div className={`w-2 h-2 rounded-full ${r.status === 'Published' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Published to Talent Vendors</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {r.status === 'Published' ? 'Active & Sourcing Candidates' : 'Pending Publication'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white/85 backdrop-blur-md border border-black/[0.06] rounded-2xl p-5 shadow-3xs space-y-4">
              <div className="text-xs font-bold text-gray-900 border-b border-black/[0.06] pb-2">
                Requisition Controls
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      {isPublished ? 'Requisition View Mode' : 'Full Edit Mode'}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {isPublished
                        ? 'View complete approved requisition details and audit trail'
                        : 'Open detailed edit view to modify budget or job description'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/dashboard/requisitions/${requisitionId}`);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Open
                  </button>
                </div>

                {!isDeleted && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
                    <div>
                      <div className="text-xs font-bold text-rose-700">Delete Requisition</div>
                      <div className="text-[11px] text-rose-600/80">Move this requisition to deleted history</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteReq(r);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RequisitionOverview({ section }) {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const initialSection = useMemo(() => {
    if (section) return section;
    const p = location.pathname.toLowerCase();
    if (p.includes('/pending-approval') || p.includes('/pending')) return 'pending_approval';
    if (p.includes('/drafted')) return 'drafted';
    if (p.includes('/completed')) return 'completed';
    if (p.includes('/deleted')) return 'deleted';
    if (p.includes('/history')) return 'history';
    return 'published';
  }, [section, location.pathname]);

  const [activeTab, setActiveTab] = useState(initialSection);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedDetailReqId, setSelectedDetailReqId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [overviewMetrics, setOverviewMetrics] = useState({
    total_requisitions: 0,
    requisitions_this_month: 0,
    total_applicants: 0,
    shortlisted: 0,
    in_interview: 0,
    hired: 0,
    applicant_growth: 18,
    shortlisted_growth: 12,
    interview_growth: 3,
    hired_growth: 1,
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const searchInputRef = useRef(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const prevTokenRef = useRef(token);

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  // Keyboard shortcut ⌘K or Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close popup menus & dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setShowDeptDropdown(false);
      setShowStatusDropdown(false);
      setShowSectionDropdown(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Auto-dismiss info alerts
  useEffect(() => {
    if (info) {
      const timer = setTimeout(() => setInfo(''), 2500);
      return () => clearTimeout(timer);
    }
  }, [info]);

  const loadData = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && hasLoadedRef.current && prevTokenRef.current === token) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const reqs = await request('/api/requisitions?fresh=true', { token, noCache: true }).catch(() => []);
      const reqList = Array.isArray(reqs) ? reqs : reqs?.requisitions || [];
      const rows = reqList.map((r) => ({
        ...r,
        company_name: r.company_name || user?.tenant_name || 'Client',
      }));

      setRequisitions(rows);
      setLoading(false);
      hasLoadedRef.current = true;
      prevTokenRef.current = token;

      const activeCount = reqList.filter((r) => !r.is_deleted && r.status !== 'Deleted by HM' && r.status !== 'Deleted' && isPublishedStatus(r?.status)).length;
      window.dispatchEvent(new CustomEvent('tj-requisition-count-updated', { detail: { count: activeCount } }));

      // Fetch live real overview metrics for right stat cards
      request('/api/requisitions/overview-metrics', { token, forceRefresh: force, noCache: true })
        .then((m) => {
          if (m && typeof m === 'object') {
            setOverviewMetrics(m);
          }
        })
        .catch(() => { });

      request('/api/company-profiles', { token }).then((profiles) => {
        if (Array.isArray(profiles) && profiles.length > 0) {
          const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
          setRequisitions((prev) =>
            prev.map((r) => ({
              ...r,
              company_name: r.company_name || profileMap[r.company_profile_id] || user?.tenant_name || 'Client',
            }))
          );
        }
      }).catch(() => { });
    } catch (err) {
      console.error('Failed to load requisitions:', err);
      setError(err.message || 'Unable to load requisitions.');
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [token, user?.tenant_name]);

  useEffect(() => {
    if (!token) return;
    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      hasLoadedRef.current = false;
    }
    if (!hasLoadedRef.current) {
      loadData();
    }
  }, [token, loadData]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      const activeCount = requisitions.filter((r) => !r.is_deleted && r.status !== 'Deleted by HM' && r.status !== 'Deleted' && isPublishedStatus(r?.status)).length;
      window.dispatchEvent(new CustomEvent('tj-requisition-count-updated', { detail: { count: activeCount } }));
    }
  }, [requisitions]);

  const handleDeleteRequisition = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${confirmDelete.id}`, { method: 'DELETE', token });
      setInfo(`Requisition "${confirmDelete.title || 'Untitled'}" deleted successfully.`);
      setConfirmDelete(null);
      window.dispatchEvent(new CustomEvent('refresh-hm-data'));
      loadData(true);
    } catch (err) {
      setError(err.message || 'Failed to delete requisition.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const refresh = () => loadData(true);
    let day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const timer = setInterval(() => {
      const nextDay = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (nextDay !== day) { day = nextDay; refresh(); }
    }, 1000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [token, loadData]);

  // Live Section Counts
  const counts = useMemo(() => {
    const normalize = (s) => (s || '').toLowerCase().replace(/[\s_]+/g, '');
    const activeReqs = requisitions.filter(
      (r) => !r.is_deleted && r.status !== 'Deleted by HM' && r.status !== 'Deleted'
    );
    const published = activeReqs.filter((r) =>
      ['published', 'active', 'open'].includes(normalize(r.status))
    ).length;
    const pending_approval = activeReqs.filter((r) =>
      ['pendingapproval', 'pending'].includes(normalize(r.status))
    ).length;
    const drafted = activeReqs.filter((r) =>
      ['draft', 'drafted', 'intake', 'structuring'].includes(normalize(r.status))
    ).length;
    const completed = activeReqs.filter((r) =>
      ['closed', 'completed', 'filled'].includes(normalize(r.status))
    ).length;
    const history = activeReqs.length;
    const deleted = requisitions.filter(
      (r) => Boolean(r.is_deleted || r.status === 'Deleted by HM' || r.status === 'Deleted')
    ).length;

    return { published, pending_approval, drafted, completed, history, deleted };
  }, [requisitions]);

  // Live Metric Stat Counts for the Right 5 Cards (Exact match to requested content)
  const statCounts = useMemo(() => {
    const totalReqs = overviewMetrics?.total_requisitions || counts.history || 0;
    const reqsMonth = overviewMetrics?.requisitions_this_month || 0;
    const sumReqApplicants = requisitions.reduce((acc, r) => acc + (Number(r.applicant_count) || 0), 0);
    const totalApplicants = (overviewMetrics?.total_applicants !== undefined && overviewMetrics?.total_applicants !== null && overviewMetrics?.total_applicants > 0)
      ? overviewMetrics.total_applicants
      : (sumReqApplicants || 0);
    const shortlisted = overviewMetrics?.shortlisted || 0;
    const inInterview = overviewMetrics?.in_interview || 0;
    const hired = overviewMetrics?.hired || 0;

    return {
      totalReqs,
      reqsMonth,
      totalApplicants,
      shortlisted,
      inInterview,
      hired,
      applicantGrowth: overviewMetrics?.applicant_growth ?? (totalApplicants > 0 ? 18 : 0),
      shortlistedGrowth: overviewMetrics?.shortlisted_growth ?? (shortlisted > 0 ? 12 : 0),
      interviewGrowth: overviewMetrics?.interview_growth ?? (inInterview > 0 ? 3 : 0),
      hiredGrowth: overviewMetrics?.hired_growth ?? (hired > 0 ? 1 : 0),
    };
  }, [overviewMetrics, counts.history, requisitions]);

  const currentConfig = SECTION_CONFIG[activeTab] || SECTION_CONFIG.published;

  const departmentsList = useMemo(() => {
    const set = new Set(requisitions.map((r) => r.department).filter(Boolean));
    return ['All Departments', ...Array.from(set).sort()];
  }, [requisitions]);

  const statusOptions = ['All Status', 'Published', 'Pending Approval', 'Drafted', 'Completed'];

  // Filtered Rows
  const filteredRows = useMemo(() => {
    let list = requisitions;
    const normalize = (s) => (s || '').toLowerCase().replace(/[\s_]+/g, '');

    if (activeTab === 'deleted') {
      list = list.filter((r) => Boolean(r.is_deleted || r.status === 'Deleted by HM' || r.status === 'Deleted'));
    } else {
      list = list.filter((r) => !r.is_deleted && r.status !== 'Deleted by HM' && r.status !== 'Deleted');
      if (activeTab !== 'history') {
        const allowed = (currentConfig.statuses || []).map((s) => normalize(s));
        list = list.filter((r) => allowed.includes(normalize(r.status)));
      }
    }

    if (selectedDept !== 'All Departments') {
      list = list.filter((r) => (r.department || '').toLowerCase() === selectedDept.toLowerCase());
    }

    if (selectedStatus !== 'All Status' && activeTab !== 'deleted') {
      const sMap = {
        'Published': ['published', 'active', 'open'],
        'Pending Approval': ['pendingapproval', 'pending'],
        'Drafted': ['draft', 'drafted', 'intake', 'structuring'],
        'Completed': ['closed', 'completed', 'filled'],
      };
      const allowed = sMap[selectedStatus] || [];
      list = list.filter((r) => allowed.includes(normalize(r.status)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(q) ||
          (r.department || '').toLowerCase().includes(q) ||
          (r.id || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [requisitions, activeTab, currentConfig, selectedDept, selectedStatus, searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedStatus, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-y-auto lg:overflow-hidden pb-2 lg:pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── TOP HEADER AREA (Matches Company Admin ManageHiringManagers Header) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 sm:pt-5 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-0.5 sm:mb-1">
            TERM JOBS • CONTRACT PIPELINE
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight sm:leading-none">
            Requisitions Management
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 leading-snug">
            Create, track, and manage hiring requisitions for contract roles across departments.
          </p>
        </div>

        {/* Top Right: Create Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions/new')}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs shrink-0">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{info}</span>
        </div>
      )}

      {/* ── MAIN CONTENT AREA: Small Stat Cards (On Top in Mobile, Right in Desktop) + Table Card ── */}
      <div className="flex-1 min-h-0 lg:min-h-[calc(100vh-260px)] flex flex-col lg:flex-row gap-3 sm:gap-3.5 items-stretch overflow-visible lg:overflow-hidden pt-1 sm:pt-3">
        {/* Metric Stat Cards: comes FIRST on mobile (order-1, small horizontal row), and on the RIGHT on desktop (order-2) */}
        <div className="order-1 lg:order-2 w-full lg:w-44 xl:w-48 shrink-0 flex flex-row lg:flex-col gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 snap-x">
          {/* Stat Card 1: Total Requisitions */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setSelectedStatus('All Status');
              setSelectedDept('All Departments');
              setSearchQuery('');
              navigate('/dashboard/requisitions/history');
            }}
            title="View all active requisitions"
            className={`snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] active:scale-95 ${
              activeTab === 'history' && selectedStatus === 'All Status'
                ? 'bg-white/90 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/70 hover:border-black/20'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Layers size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <ArrowRight size={11} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block" />
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {statCounts.totalReqs}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Total Requisitions
              </div>
            </div>
          </button>

          {/* Stat Card 2: Total Applicants */}
          <button
            type="button"
            onClick={() => {
              navigate(user?.role === 'Recruiter' ? '/dashboard/recruiter/candidates' : '/dashboard/candidates');
            }}
            title="View candidate pool & applicants"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 hover:border-black/20 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Users size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <ArrowRight size={11} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block" />
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {statCounts.totalApplicants}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Total Applicants
              </div>
            </div>
          </button>

          {/* Stat Card 3: Shortlisted */}
          <button
            type="button"
            onClick={() => {
              navigate(user?.role === 'Recruiter' ? '/dashboard/recruiter/shortlisted' : '/dashboard/candidates');
            }}
            title="View shortlisted candidates"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 hover:border-black/20 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <CheckCircle2 size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <ArrowRight size={11} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block" />
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {statCounts.shortlisted}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Shortlisted
              </div>
            </div>
          </button>

          {/* Stat Card 4: In Interview */}
          <button
            type="button"
            onClick={() => {
              navigate('/dashboard/interviews');
            }}
            title="View scheduled interviews & AI evaluations"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 hover:border-black/20 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Clock size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <ArrowRight size={11} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block" />
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {statCounts.inInterview}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                In Interview
              </div>
            </div>
          </button>

          {/* Stat Card 5: Hired */}
          <button
            type="button"
            onClick={() => {
              navigate(user?.role === 'Recruiter' ? '/dashboard/recruiter/accepted' : '/dashboard/candidates/accepted');
            }}
            title="View accepted & hired candidates"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 hover:border-black/20 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Briefcase size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <ArrowRight size={11} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block" />
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {statCounts.hired}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Hired
              </div>
            </div>
          </button>
        </div>

        {/* Left: Main Glassmorphic Table Card (order-2 on mobile, order-1 on desktop) */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 min-h-0 lg:min-h-[calc(100vh-260px)] bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
          {/* Table Top Controls Row: Search Bar + Section / Department Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
            {/* Search Input Bar with ⌘K Badge */}
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, role, or department..."
                className="w-full pl-9 pr-4 sm:pr-12 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
                <span className="text-[10px] font-bold text-gray-400 px-1.5 py-0.5 rounded-md bg-white/80 border border-gray-200/80 shadow-3xs">
                  ⌘ K
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              {/* Category / Section Dropdown */}
              <div className="relative flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSectionDropdown(!showSectionDropdown);
                    setShowDeptDropdown(false);
                    setShowStatusDropdown(false);
                  }}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all flex items-center justify-between sm:justify-start gap-2 shadow-3xs cursor-pointer"
                >
                  <span className="truncate">{SECTION_CONFIG[activeTab]?.title || 'All Requisitions'}</span>
                  <ChevronDown size={13} className="text-gray-400 shrink-0" />
                </button>

                {showSectionDropdown && (
                  <div
                    className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Object.entries(SECTION_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setActiveTab(key);
                          setShowSectionDropdown(false);
                          navigate(config.to);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          activeTab === key
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{config.title}</span>
                        {activeTab === key && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Department Filter Dropdown */}
              <div className="relative flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeptDropdown(!showDeptDropdown);
                    setShowSectionDropdown(false);
                    setShowStatusDropdown(false);
                  }}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs font-semibold text-gray-700 hover:text-black hover:bg-white transition-all flex items-center justify-between sm:justify-start gap-2 shadow-3xs cursor-pointer"
                >
                  <span className="truncate">{selectedDept}</span>
                  <ChevronDown size={13} className="text-gray-400 shrink-0" />
                </button>

                {showDeptDropdown && (
                  <div
                    className="absolute right-0 mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {departmentsList.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          setSelectedDept(dept);
                          setShowDeptDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          selectedDept === dept
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{dept}</span>
                        {selectedDept === dept && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data List / Table Container */}
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex items-center justify-center">
              Loading requisitions...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-medium flex-1 flex flex-col items-center justify-center gap-2">
              {activeTab === 'deleted' ? (
                <>
                  <History size={22} className="text-gray-400 opacity-60" />
                  <span>No deleted requisitions found in history.</span>
                </>
              ) : (
                <>
                  <Briefcase size={22} className="text-gray-400 opacity-60" />
                  <span>No requisitions found in {currentConfig.title}.</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar mt-1">
              {activeTab === 'deleted' && (
                <div className="mb-2.5 px-3 py-2 bg-rose-50/80 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-3xs">
                  <div className="flex items-center gap-2 font-medium">
                    <History size={14} className="text-rose-600 shrink-0" />
                    <span>Viewing deleted requisitions archive history ({filteredRows.length} total).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer text-left sm:text-right"
                  >
                    Return to Active Requisitions →
                  </button>
                </div>
              )}

              {/* MOBILE VIEW: Compact Organized Requisition Cards (< md) */}
              <div className="block md:hidden space-y-2.5 pb-2">
                {paginatedRows.map((r) => {
                  const isDeleted = Boolean(r.is_deleted || r.status === 'Deleted by HM' || r.status === 'Deleted');
                  const reqCode = r.ref ? r.ref.replace('REQ-', 'REQ #') : `REQ #${(r.id || '8302CO').slice(0, 6).toUpperCase()}`;

                  return (
                    <div
                      key={r.id}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all text-left shadow-3xs ${
                        isDeleted
                          ? 'bg-rose-50/35 border-rose-200/70'
                          : 'bg-white/60 hover:bg-white/90 border-white/80'
                      }`}
                    >
                      {/* Top row: Icon + Title/Code + Status Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${
                              isDeleted ? 'bg-rose-950 text-rose-300' : 'bg-slate-900 text-white'
                            }`}
                          >
                            {isDeleted ? <Trash2 size={13} /> : <Briefcase size={13} />}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailReqId(r.id)}
                              className="font-bold text-gray-900 text-[13px] leading-snug truncate block text-left hover:underline cursor-pointer"
                            >
                              {r.title || 'Untitled Role'}
                            </button>
                            <div className="text-[10px] text-gray-400 font-mono font-medium truncate mt-0.5">
                              {isDeleted ? (
                                <span className="text-rose-600 font-sans font-medium">
                                  Deleted {timeAgo(r.deleted_at || r.created_at)}
                                </span>
                              ) : (
                                reqCode
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <RequisitionStatusBadge status={r.status || 'Published'} />
                        </div>
                      </div>

                      {/* Middle row: Department & Location & Date */}
                      <div className="mt-2.5 pt-2 border-t border-black/[0.04] grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider block mb-0.5">
                            Department
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200/60 truncate max-w-full">
                            {r.department && r.department.trim() ? r.department : 'Engineering'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider block mb-0.5">
                            Location
                          </span>
                          <LocationCell location={r.primary_location || r.location} workplaceType={r.workplace_type} />
                        </div>
                      </div>

                      {/* Bottom row: Applicants & Quick Action Buttons */}
                      <div className="mt-2.5 pt-2 border-t border-black/[0.04] flex items-center justify-between gap-2">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/requisitions/${r.id}/candidates`);
                          }}
                          className="cursor-pointer flex items-center gap-1.5"
                          title="View Candidates"
                        >
                          <span className="text-[10.5px] text-gray-500 font-medium">Applicants:</span>
                          <ApplicantStack count={r.applicant_count ?? 0} />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailReqId(r.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white/80 hover:bg-white border border-gray-200/80 rounded-lg shadow-3xs cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={12} className="text-gray-500" />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/requisitions/${r.id}/candidates`)}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-black hover:bg-gray-800 rounded-lg shadow-3xs cursor-pointer flex items-center gap-1"
                          >
                            <Users size={12} />
                            <span>Candidates</span>
                          </button>

                          {!isDeleted && (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(r)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Requisition"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW: Full 7-column Table (>= md) */}
              <div className="hidden md:block overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[780px] text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                    <tr className="text-xs font-medium text-gray-400">
                      <th className="py-2.5 px-3">Job Title</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Applicants</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">{activeTab === 'deleted' ? 'Deleted On' : 'Posted On'}</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03]">
                    {paginatedRows.map((r) => {
                      const isMenuOpen = activeMenuId === r.id;
                      const isDeleted = Boolean(r.is_deleted || r.status === 'Deleted by HM' || r.status === 'Deleted');
                      const reqCode = r.ref ? r.ref.replace('REQ-', 'REQ #') : `REQ #${(r.id || '8302CO').slice(0, 6).toUpperCase()}`;

                      return (
                        <tr
                          key={r.id}
                          className={`transition-colors relative ${
                            isDeleted
                              ? 'bg-rose-50/25 hover:bg-rose-50/45'
                              : 'bg-transparent hover:bg-white/35'
                          }`}
                        >
                          {/* 1. Job Title */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
                                  isDeleted ? 'bg-rose-950 text-rose-300' : 'bg-slate-900 text-white'
                                }`}
                              >
                                {isDeleted ? (
                                  <Trash2 size={13} className="text-rose-300" />
                                ) : (
                                  <Briefcase size={13} className="text-white" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div
                                  onClick={() => setSelectedDetailReqId(r.id)}
                                  className="font-bold text-gray-900 text-[13px] leading-tight truncate hover:underline cursor-pointer"
                                >
                                  {r.title || 'Untitled Role'}
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono font-medium truncate mt-0.5">
                                  {isDeleted ? (
                                    <span className="text-rose-600 font-sans font-medium">
                                      Deleted {timeAgo(r.deleted_at || r.created_at)}
                                    </span>
                                  ) : (
                                    reqCode
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Department */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200/60 truncate max-w-[120px]">
                              {r.department && r.department.trim() ? r.department : 'Engineering'}
                            </span>
                          </td>

                          {/* 3. Location */}
                          <td className="py-3 px-3">
                            <LocationCell location={r.primary_location || r.location} workplaceType={r.workplace_type} />
                          </td>

                          {/* 4. Applicants */}
                          <td
                            className="py-3 px-3 cursor-pointer group"
                            title="View Candidates"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/requisitions/${r.id}/candidates`);
                            }}
                          >
                            <ApplicantStack count={r.applicant_count ?? 0} />
                          </td>

                          {/* 5. Status */}
                          <td className="py-3 px-3">
                            <RequisitionStatusBadge status={r.status || 'Published'} />
                          </td>

                          {/* 6. Posted On */}
                          <td className="py-3 px-3 text-gray-700 font-normal text-xs">
                            <div className="font-medium text-gray-900 leading-tight">
                              {formatDate(isDeleted ? (r.deleted_at || r.created_at) : r.created_at)}
                            </div>
                            <div className="text-[10.5px] text-gray-400 leading-tight mt-0.5">
                              {formatTime(isDeleted ? (r.deleted_at || r.created_at) : r.created_at)}
                            </div>
                          </td>

                          {/* 7. Actions */}
                          <td className="py-3 px-3 text-right relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : r.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <MoreHorizontal size={15} />
                            </button>

                            {/* Floating Action Menu Dropdown */}
                            {isMenuOpen && (
                              <div
                                className="absolute right-3 top-10 w-38 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-1 z-30 animate-in fade-in zoom-in-95 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDetailReqId(r.id);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                                >
                                  <Eye size={13} className="text-gray-400" />
                                  <span>Details</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(`/dashboard/requisitions/${r.id}/candidates`);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors flex items-center gap-2 font-medium cursor-pointer"
                                >
                                  <Users size={13} className="text-gray-400" />
                                  <span>Candidates</span>
                                </button>

                                {!isDeleted && (
                                  <>
                                    <div className="h-px bg-black/[0.04] my-1" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmDelete(r);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 font-semibold cursor-pointer"
                                    >
                                      <Trash2 size={13} className="text-red-500" />
                                      <span>Delete</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table Footer with Pagination & History Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-black/[0.04] shrink-0 text-xs text-gray-400">
            <div className="text-center sm:text-left text-[11px] sm:text-xs">
              Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} requisitions
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-lg bg-white/60 border border-white/80 flex items-center justify-center text-gray-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-3xs"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setCurrentPage(pg)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-3xs cursor-pointer ${
                        currentPage === pg
                          ? 'bg-black text-white'
                          : 'bg-white/60 hover:bg-white text-gray-700 border border-white/80'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="w-7 h-7 rounded-lg bg-white/60 border border-white/80 flex items-center justify-center text-gray-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-3xs"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}

              {/* History Button at marked position */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab((prev) => (prev === 'deleted' ? 'history' : 'deleted'));
                }}
                title={activeTab === 'deleted' ? 'Switch back to active requisitions' : 'View deleted requisitions history'}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs ${
                  activeTab === 'deleted'
                    ? 'bg-black text-white shadow-xs font-bold'
                    : 'bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80'
                }`}
              >
                <History size={13} className={activeTab === 'deleted' ? 'text-white' : 'text-gray-500'} />
                <span>History</span>
                {counts.deleted > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-bold ${
                      activeTab === 'deleted'
                        ? 'bg-white/20 text-white'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {counts.deleted}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Delete Requisition?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              This will permanently remove <strong>{confirmDelete.title || 'Untitled'}</strong> ({confirmDelete.department || 'General'}). This action cannot be undone.
            </p>
            {(confirmDelete.director_approved || confirmDelete.status === 'Published') && (
              <div className="p-3 mb-5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2 shadow-2xs">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> This requisition was approved & published by the Director. Deleting it will immediately notify the Company Director and record the cancellation in the Director Dashboard.
                </span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRequisition}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 size={13} className="animate-spin text-white" />}
                <span>Delete Requisition</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requisition Details Slide-Over Right Bar */}
      {selectedDetailReqId && (
        <RequisitionDetailDrawer
          requisitionId={selectedDetailReqId}
          initialReq={requisitions.find((x) => x.id === selectedDetailReqId)}
          onClose={() => setSelectedDetailReqId(null)}
          onDeleteReq={(reqToDelete) => {
            setConfirmDelete(reqToDelete);
            setSelectedDetailReqId(null);
          }}
          navigate={navigate}
          token={token}
          user={user}
        />
      )}
    </div>
  );
}
