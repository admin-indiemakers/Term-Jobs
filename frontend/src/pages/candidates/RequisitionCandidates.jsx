import { InterviewReviewPanel } from '../../interview/components/InterviewReviewPanel';
import { isAiInterviewRound } from '../../interview/utils/interviewMode';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Check,
  X,
  MoreHorizontal,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Layers,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Code,
  Puzzle,
  MessageSquare,
  Users,
  Target,
  FileText,
  Clock,
  Download,
  Share2,
  Copy,
  Plus,
  Video,
} from 'lucide-react';
import { request, API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';
import SetInterviewProcessModal from '../../components/SetInterviewProcessModal';
import { mapRequisitionCandidates, attendedApplicants, candidateRounds } from '../../utils/requisitionCandidates';

// Baseline candidate dataset - only real candidates are displayed
const DEFAULT_CANDIDATES = [];

// Circular SVG gauge for scores (Light Theme Clean)
function ScoreRing({ score, size = 38, stroke = 3 }) {
  const radius = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score || 0));
  const offset = circ * (1 - pct / 100);
  const color = pct >= 80 ? '#059669' : pct >= 65 ? '#0d9488' : pct >= 50 ? '#0284c7' : '#64748b';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute font-black text-gray-900 text-[12px] tracking-tight">
        {score ?? '—'}
      </span>
    </div>
  );
}

// Large Circular SVG gauge for right preview panel (Light Theme Clean)
function LargeScoreRing({ score }) {
  const size = 96;
  const stroke = 6.5;
  const radius = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score || 0));
  const offset = circ * (1 - pct / 100);
  const color = '#059669';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-gray-900 leading-none tracking-tight">
          {score ?? '—'}
        </span>
        <span className="text-[10px] text-gray-500 font-medium mt-0.5">
          / 100
        </span>
      </div>
    </div>
  );
}

export default function RequisitionCandidates() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [req, setReq] = useState(null);
  const [apiCandidates, setApiCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected candidate for pop-up preview panel (null until a candidate is clicked)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [activePreviewTab, setActivePreviewTab] = useState('overview'); // 'overview' | 'ai_analysis' | 'resume' | 'history' | 'notes'

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all'); // 'all' | '90' | '80' | '70' | 'under70'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'AI Shortlisted' | 'In Review' | 'Not Shortlisted'
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null); // 'score' | 'status' | 'experience' | null

  // Modals & Actions
  const [schedulingCandidate, setSchedulingCandidate] = useState(null);
  const [showSetInterviewModal, setShowSetInterviewModal] = useState(false);
  const [, setActingStatusId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [refresh, setRefresh] = useState(0);
  // Notes state
  const [newNoteText, setNewNoteText] = useState('');

  // Fetch requisition and candidates from API
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      request(`/requisitions/${id}`, { token, noCache: true }),
      request(`/candidates?include_details=true&refresh=true&requisition_id=${encodeURIComponent(id)}`, { token, noCache: true }),
      request(`/api/interviews/rounds?requisition_id=${encodeURIComponent(id)}`, { token, noCache: true }),
    ])
      .then(([reqData, candData, intRes]) => {
        if (reqData) setReq(reqData);
        const list = Array.isArray(candData) ? candData : candData?.candidates || [];
        setApiCandidates(list);
        setInterviews(Array.isArray(intRes) ? intRes : intRes?.interviews || []);
      })
      .catch((err) => {
        setError(err.message || 'Unable to load requisition candidates.');
      })
      .finally(() => setLoading(false));
  }, [id, token, refresh]);

  // Derived requisition information
  const reqTitle = req?.title || req?.structured_role?.title || 'Requisition';
  const reqCode = req?.ref ? req.ref.replace('REQ-', 'REQ #') : (id ? `REQ #${id.slice(0, 6).toUpperCase()}` : 'REQ #8302C0');
  const reqDept = req?.department || req?.structured_role?.department || req?.structured_role?.job_family || 'Not specified';
  const reqLocation = (() => {
    const loc = req?.primary_location || req?.location || req?.structured_role?.location || req?.structured_role?.work_locations?.[0] || 'Not specified';
    const wp = req?.workplace_type || req?.work_mode || req?.structured_role?.work_mode || 'Not specified';
    return `${loc} (${wp})`;
  })();

  // Process Real API candidates exclusively
  const allCandidates = useMemo(() => {
    const rawList = apiCandidates && apiCandidates.length > 0
      ? (attendedApplicants(apiCandidates, interviews).length > 0
          ? attendedApplicants(apiCandidates, interviews)
          : apiCandidates)
      : [];

    const mappedApi = mapRequisitionCandidates(rawList, interviews);

    // Dynamically mark candidates who have scheduled interviews as 'In Interview'
    return mappedApi.map((c) => {
      const cid = String(c.id || c.submission_id || '');
      const sid = String(c.submission_id || '');
      const isSched =
        interviews &&
        interviews.some(
          (inv) =>
            ['Scheduled', 'Confirmed', 'In Progress'].includes(inv.status) &&
            (String(inv.candidate_submission_id || inv.candidate_id || '') === cid ||
              (sid && String(inv.candidate_submission_id || inv.candidate_id || '') === sid))
        );

      if (isSched && !['Accepted', 'Hired', 'Offered', 'Rejected'].includes(c.status)) {
        return { ...c, status: 'In Interview', isScheduled: true };
      }
      return c;
    });
  }, [apiCandidates, interviews]);

  // Selected candidate (null if preview panel closed)
  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateId) return null;
    return allCandidates.find((c) => c.id === selectedCandidateId) || null;
  }, [allCandidates, selectedCandidateId]);

  // Helper to determine whether an interview is already scheduled for candidate
  const isCandidateInInterview = useCallback((c) => {
    if (!c) return false;
    const cid = String(c.id || c.submission_id || '');
    const sid = String(c.submission_id || '');
    if (c.isScheduled) return true;
    const statusLower = String(c.status || '').toLowerCase().trim();
    if (statusLower === 'in interview' || statusLower.includes('interview')) return true;
    return Boolean(
      interviews &&
      interviews.some(
        (inv) =>
          ['Scheduled', 'Confirmed', 'In Progress', 'Completed'].includes(inv.status) &&
          (String(inv.candidate_submission_id || inv.candidate_id || '') === cid ||
            (sid && String(inv.candidate_submission_id || inv.candidate_id || '') === sid))
      )
    );
  }, [interviews]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesLocation = c.location.toLowerCase().includes(q);
        const matchesSkills = (c.allSkills || c.skills).some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesLocation && !matchesSkills) return false;
      }
      if (scoreFilter !== 'all' && c.score === null) return false;
      if (experienceFilter !== 'all') {
        const years = parseFloat(c.experience);
        if (!Number.isFinite(years)) return false;
        if (experienceFilter === '1' && (years < 1 || years >= 3)) return false;
        if (experienceFilter === '3' && (years < 3 || years >= 5)) return false;
        if (experienceFilter === '5' && years < 5) return false;
      }
      if (locationFilter !== 'all' && c.location !== locationFilter) return false;
      if (scoreFilter === '90' && c.score < 90) return false;
      if (scoreFilter === '80' && (c.score < 80 || c.score >= 90)) return false;
      if (scoreFilter === '70' && (c.score < 70 || c.score >= 80)) return false;
      if (scoreFilter === 'under70' && c.score >= 70) return false;

      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      return true;
    });
  }, [allCandidates, searchQuery, scoreFilter, statusFilter, experienceFilter, locationFilter]);

  // Aggregate metrics
  const totalCount = allCandidates.length;
  const aiShortlistedCount = allCandidates.filter((c) => c.status === 'AI Shortlisted' || c.status === 'Shortlisted').length;
  const inInterviewCount = allCandidates.filter((c) => c.status === 'In Interview' || c.isScheduled || c.status === 'Interview Scheduled').length;
  const offeredCount = allCandidates.filter((c) => ['Offered', 'Accepted', 'Hired'].includes(c.status)).length;

  // Status Action handler
  const handleUpdateStatus = async (candidate, newStatus) => {
    const submissionId = candidate.submission_id || candidate.id;
    setActingStatusId(candidate.id);
    setActiveMenuId(null);



    if (candidate.isRealApi) {
      try {
        await request(`/candidates/${submissionId}/status`, {
          method: 'PATCH',
          token,
          body: { status: newStatus === 'Not Shortlisted' ? 'Rejected' : newStatus },
        });
      } catch (err) {
        setError(err.message || 'Status update failed.');
      }
    }
    setRefresh(value => value + 1);
    setActingStatusId(null);
  };

  // View Resume Handler
  const handleViewResume = async (cand) => {
    setActiveMenuId(null);
    if (cand.isRealApi) {
      try {
        const res = await fetch(`${API_BASE_URL}/candidates/${cand.id}/resume`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          return;
        }
      } catch (err) {
        console.warn('Resume fetch error:', err);
      }
    }
    setSelectedCandidateId(cand.id);
    setActivePreviewTab('resume');
  };

  const handleAddNote = async e => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedCandidate) return;
    try {
      await request(`/api/candidates/${selectedCandidate.id}/notes`, { method: 'POST', token, body: { text: newNoteText.trim() } });
      setNewNoteText(''); setRefresh(x => x + 1);
    } catch (err) { setError(err.message || 'Unable to save note.'); }
  };

  return (
    <div
      className="w-full min-w-0 h-full max-h-full flex-1 flex flex-col justify-between gap-4 text-left overflow-y-auto lg:overflow-hidden pb-2 lg:pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading candidates…</p>}
      {/* ── TOP HEADER AREA (Spacious & Uncompact) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3.5 sm:pt-5 lg:pt-6 shrink-0">
        <div className="pl-1 sm:pl-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-gray-400 tracking-wider uppercase mb-2">
            <Link to="/dashboard/requisitions" className="hover:text-black transition-colors">
              Requisitions
            </Link>
            <span>•</span>
            <span className="text-gray-600 font-mono font-bold">{reqCode}</span>
          </div>

          <div className="flex items-center gap-3.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-gray-900 tracking-tight leading-tight">
              {reqTitle}
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-3xs">
              {req?.status || '—'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-2 flex items-center gap-2.5 flex-wrap">
            <span className="font-mono font-bold text-gray-700">{reqCode}</span>
            <span className="text-gray-300">•</span>
            <span>{reqDept}</span>
            <span className="text-gray-300">•</span>
            <span>{reqLocation}</span>
            <span className="text-gray-300">•</span>
            <span className="font-semibold text-gray-900">{totalCount} {totalCount === 1 ? 'Candidate Applied' : 'Candidates Applied'}</span>
          </p>
        </div>

        {/* Top Right Actions: Back to Requisitions + Invite Candidate CTA */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <Link
            to="/dashboard/requisitions"
            className="px-4 py-2.5 rounded-xl bg-white/70 hover:bg-white border border-black/[0.08] text-gray-700 hover:text-black text-xs font-bold transition-all shadow-3xs flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Requisitions</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowSetInterviewModal(true)}
            className="px-4.5 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Calendar size={14} />
            <span>Set Interview Process</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA: Left Table Card + Right Metric Stat Cards (or Candidate Detail Preview) ── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 sm:gap-3.5 items-stretch overflow-visible lg:overflow-hidden pt-1.5">
        {/* LEFT: CANDIDATES GLASSMORPHIC TABLE CARD (order-2 on mobile, order-1 on desktop) */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 h-full min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col overflow-hidden">
          {/* Table Top Controls Row: Search Input + Filter Dropdowns */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04] shrink-0">
            {/* Search Box */}
            <div className="relative w-full sm:w-72 md:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates by name, skills, location..."
                className="w-full pl-9 pr-9 py-1.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Pills with Custom Light Dropdowns */}
            <div className="flex items-center gap-2 overflow-x-visible no-scrollbar text-xs flex-wrap sm:flex-nowrap">
              {/* AI Score Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === 'score' ? null : 'score')}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer font-semibold shadow-3xs whitespace-nowrap ${
                    scoreFilter !== 'all' || openFilterDropdown === 'score'
                      ? 'bg-black text-white border-black'
                      : 'bg-white/70 hover:bg-white border-white/90 text-gray-700'
                  }`}
                >
                  <span>{scoreFilter === '90' ? '90%+ Match' : scoreFilter === '80' ? '80% – 89%' : scoreFilter === '70' ? '70% – 79%' : scoreFilter === 'under70' ? 'Below 70%' : 'Match Score'}</span>
                  <ChevronDown size={12} className={scoreFilter !== 'all' || openFilterDropdown === 'score' ? 'text-white' : 'text-gray-400'} />
                </button>

                {openFilterDropdown === 'score' && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[
                      { label: 'Match Score', val: 'all' },
                      { label: '90%+ Match', val: '90' },
                      { label: '80% – 89%', val: '80' },
                      { label: '70% – 79%', val: '70' },
                      { label: 'Below 70%', val: 'under70' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => {
                          setScoreFilter(item.val);
                          setOpenFilterDropdown(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          scoreFilter === item.val
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{item.label}</span>
                        {scoreFilter === item.val && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === 'status' ? null : 'status')}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer font-semibold shadow-3xs whitespace-nowrap ${
                    statusFilter !== 'all' || openFilterDropdown === 'status'
                      ? 'bg-black text-white border-black'
                      : 'bg-white/70 hover:bg-white border-white/90 text-gray-700'
                  }`}
                >
                  <span>{statusFilter !== 'all' ? statusFilter : 'Status'}</span>
                  <ChevronDown size={12} className={statusFilter !== 'all' || openFilterDropdown === 'status' ? 'text-white' : 'text-gray-400'} />
                </button>

                {openFilterDropdown === 'status' && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[
                      { label: 'All Statuses', val: 'all' },
                      { label: 'AI Shortlisted', val: 'AI Shortlisted' },
                      { label: 'Accepted', val: 'Accepted' },
                      { label: 'In Interview', val: 'In Interview' },
                      { label: 'Not Shortlisted', val: 'Not Shortlisted' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => {
                          setStatusFilter(item.val);
                          setOpenFilterDropdown(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          statusFilter === item.val
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{item.label}</span>
                        {statusFilter === item.val && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Experience Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === 'experience' ? null : 'experience')}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer font-semibold shadow-3xs whitespace-nowrap ${
                    experienceFilter !== 'all' || openFilterDropdown === 'experience'
                      ? 'bg-black text-white border-black'
                      : 'bg-white/70 hover:bg-white border-white/90 text-gray-700'
                  }`}
                >
                  <span>{experienceFilter === '1' ? '1 – 2 yrs' : experienceFilter === '3' ? '3 – 4 yrs' : experienceFilter === '5' ? '5+ yrs' : 'Experience'}</span>
                  <ChevronDown size={12} className={experienceFilter !== 'all' || openFilterDropdown === 'experience' ? 'text-white' : 'text-gray-400'} />
                </button>

                {openFilterDropdown === 'experience' && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-40 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[
                      { label: 'All Experience', val: 'all' },
                      { label: '1 – 2 yrs', val: '1' },
                      { label: '3 – 4 yrs', val: '3' },
                      { label: '5+ yrs', val: '5' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => {
                          setExperienceFilter(item.val);
                          setOpenFilterDropdown(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                          experienceFilter === item.val
                            ? 'bg-black text-white font-bold'
                            : 'text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        <span>{item.label}</span>
                        {experienceFilter === item.val && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button type="button" onClick={() => setOpenFilterDropdown(openFilterDropdown === 'location' ? null : 'location')} className="px-3 py-1.5 rounded-xl bg-white/70 border border-white/80 text-gray-600 font-semibold shadow-3xs flex items-center gap-1.5">
                  <span>{locationFilter === 'all' ? 'Location' : locationFilter}</span><ChevronDown size={12} />
                </button>
                {openFilterDropdown === 'location' && <div className="absolute right-0 top-full mt-1.5 w-44 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-lg p-1 z-50">
                  {['all', ...new Set(allCandidates.map(c => c.location))].map(location => <button key={location} className="w-full rounded-xl px-2.5 py-1.5 text-left text-xs hover:bg-gray-50" onClick={() => { setLocationFilter(location); setOpenFilterDropdown(null); }}>{location === 'all' ? 'All locations' : location}</button>)}
                </div>}
              </div>
            </div>
          </div>

          {/* Table Container (Unified 100% width container, strictly zero horizontal scrolling) */}
          <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="w-full flex flex-col flex-1 min-h-0">
              {/* Table Header Bar (Fixed with Search Bar, Candidate details never scroll beneath it) */}
              <div className="shrink-0 border-b border-black/[0.04] py-2.5 w-full hidden md:block">
                <div className="grid grid-cols-[minmax(0,1.2fr)_55px_minmax(0,1.8fr)_75px_85px_95px_65px] gap-2 items-center text-gray-400 font-medium text-[10.5px] uppercase tracking-wider">
                  <div className="pl-4 pr-2">Candidate</div>
                  <div className="px-1 text-center">Match Score</div>
                  <div className="px-2">Skills Match</div>
                  <div className="px-1">Experience</div>
                  <div className="px-1">Availability</div>
                  <div className="px-1">Status</div>
                  <div className="pr-5 pl-1 text-right">Actions</div>
                </div>
              </div>

              {/* Table Scrollable Body (Only candidate rows scroll here, clipping cleanly below heading, no scrollbars visible) */}
              <div className="overflow-y-auto no-scrollbar flex-1 min-h-0 divide-y divide-black/[0.03] w-full">
                {filteredCandidates.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 text-gray-300 mb-2 stroke-[1.5]" />
                    <div className="text-sm font-semibold text-gray-800">No candidates found</div>
                    <div className="text-xs text-gray-400 mt-1 max-w-xs">
                      {searchQuery ? 'No candidates match your current search or filters.' : 'No candidates have applied to this requisition yet.'}
                    </div>
                  </div>
                ) : (
                  filteredCandidates.map((cand) => {
                  const isSelected = selectedCandidateId === cand.id;

                  return (
                    <React.Fragment key={cand.id}>
                      {/* Mobile Candidate Card */}
                      <div
                        onClick={() => setSelectedCandidateId(cand.id)}
                        className={`block md:hidden p-3.5 my-2 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white/95 shadow-sm border-black/20 ring-1 ring-black/10'
                            : 'bg-white/60 hover:bg-white/80 border-white/80 shadow-3xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 text-sm truncate">{cand.name}</h4>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  cand.status === 'In Interview'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : cand.status === 'AI Shortlisted'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : cand.status === 'In Review'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    cand.status === 'In Interview'
                                      ? 'bg-purple-500'
                                      : cand.status === 'AI Shortlisted'
                                      ? 'bg-emerald-500'
                                      : cand.status === 'In Review'
                                      ? 'bg-purple-500'
                                      : 'bg-gray-400'
                                  }`}
                                />
                                {cand.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                              <span>{cand.location}</span>
                              <span>•</span>
                              <span>{cand.experience}</span>
                              <span>•</span>
                              <span>{cand.availability}</span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center">
                            <ScoreRing score={cand.score} />
                          </div>
                        </div>

                        {cand.skills && cand.skills.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                            {cand.skills.slice(0, 4).map((skill, sIdx) => {
                              const isPlus = skill.startsWith('+');
                              return (
                                <span
                                  key={sIdx}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                                    isPlus
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                                  }`}
                                >
                                  {skill}
                                </span>
                              );
                            })}
                            {cand.skills.length > 4 && (
                              <span className="text-[10px] text-gray-400 font-semibold">
                                +{cand.skills.length - 4} more
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-black/[0.04]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isCandidateInInterview(cand) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/requisitions/${id}/candidates/${cand.id}/interview?reqId=${encodeURIComponent(id)}`);
                                }}
                                className="px-2.5 py-1 rounded-xl text-xs font-bold text-white bg-black hover:bg-gray-800 flex items-center gap-1.5 shadow-3xs cursor-pointer"
                              >
                                <Video size={12} />
                                <span>Interview Panel</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSchedulingCandidate(cand);
                                }}
                                className="px-2.5 py-1 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 flex items-center gap-1.5 shadow-3xs cursor-pointer"
                              >
                                <Calendar size={12} />
                                <span>Schedule</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewResume(cand);
                              }}
                              className="px-2.5 py-1 rounded-xl text-xs font-medium text-gray-700 bg-white/80 hover:bg-white border border-gray-200/80 flex items-center gap-1.5 shadow-3xs cursor-pointer"
                            >
                              <FileText size={12} />
                              <span>Resume</span>
                            </button>
                          </div>
                          <span className="text-[11px] font-semibold text-gray-500 hover:text-black">
                            Details →
                          </span>
                        </div>
                      </div>

                      {/* Desktop Candidate Grid Row */}
                      <div
                        className={`hidden md:grid grid-cols-[minmax(0,1.2fr)_55px_minmax(0,1.8fr)_75px_85px_95px_65px] gap-2 items-center py-3.5 transition-colors cursor-pointer relative group ${
                          isSelected
                            ? 'bg-white/85 shadow-3xs ring-1 ring-black/[0.08]'
                            : 'hover:bg-white/50'
                        }`}
                        onClick={() => setSelectedCandidateId(cand.id)}
                      >
                      {/* Candidate Name & Location (No profile photos) */}
                      <div className="pl-4 pr-2 min-w-0">
                        <div className="font-bold text-gray-900 text-xs truncate group-hover:underline">
                          {cand.name}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          {cand.location}
                        </div>
                      </div>

                    {/* AI Score (Circular SVG ring) */}
                    <div className="px-1 text-center flex justify-center">
                      <ScoreRing score={cand.score} />
                    </div>

                    {/* Skills Match */}
                    <div className="px-2 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cand.skills.map((skill, sIdx) => {
                          const isPlus = skill.startsWith('+');
                          return (
                            <span
                              key={sIdx}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                                isPlus
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                              }`}
                            >
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Experience */}
                    <div className="px-1 font-semibold text-gray-700 text-xs">
                      {cand.experience}
                    </div>

                    {/* Availability */}
                    <div className="px-1 font-semibold text-gray-700 text-xs">
                      {cand.availability}
                    </div>

                    {/* Status */}
                    <div className="px-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          cand.status === 'In Interview'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : cand.status === 'AI Shortlisted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : cand.status === 'In Review'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            cand.status === 'In Interview'
                              ? 'bg-purple-500'
                              : cand.status === 'AI Shortlisted'
                              ? 'bg-emerald-500'
                              : cand.status === 'In Review'
                              ? 'bg-purple-500'
                              : 'bg-gray-400'
                          }`}
                        />
                        <span>{cand.status}</span>
                      </span>
                    </div>

                    {/* Actions Menu */}
                    <div className="pr-4 pl-1 text-right relative flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === cand.id ? null : cand.id);
                        }}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer inline-flex"
                      >
                        <MoreHorizontal size={15} />
                      </button>

                      {/* Action Dropdown Menu */}
                      {activeMenuId === cand.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-3 top-10 w-48 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 text-left space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                        >

                            {isCandidateInInterview(cand) ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(`/requisitions/${id}/candidates/${cand.id}/interview?reqId=${encodeURIComponent(id)}`);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                                >
                                  <Video size={13} className="text-black shrink-0" />
                                  <span>Go to Interview Panel</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSchedulingCandidate(cand);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                                >
                                  <Calendar size={13} className="text-gray-500 shrink-0" />
                                  <span>Reschedule Interview</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSchedulingCandidate(cand);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-800 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                              >
                                <Calendar size={13} className="text-emerald-600 shrink-0" />
                                <span>Schedule Interview</span>
                              </button>
                            )}

                          <button
                            type="button"
                            onClick={() => handleViewResume(cand)}
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-800 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                          >
                            <FileText size={13} className="text-sky-600" />
                            <span>View Resume</span>
                          </button>
                          <div className="h-px bg-black/[0.04] my-1" />
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(cand, 'Accepted')}
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Check size={13} />
                            <span>Select Candidate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(cand, 'Not Shortlisted')}
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                          >
                            <X size={13} />
                            <span>Reject Candidate</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            }))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Candidate Detail Preview Panel OR Vertical Metric Stat Cards ── */}
      {selectedCandidate ? (
        <div className="order-1 lg:order-2 w-full lg:w-[450px] xl:w-[480px] h-full max-h-full min-h-0 shrink-0 bg-white/80 backdrop-blur-2xl border border-white/80 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl animate-in fade-in slide-in-from-right-4 duration-200">
          {/* Preview Panel Header */}
          <div className="p-4 sm:p-5 border-b border-black/[0.06] bg-white/60">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-gray-900 tracking-tight leading-tight">
                    {selectedCandidate.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>{selectedCandidate.status}</span>
                  </span>
                </div>

                <div className="text-xs text-gray-500 space-y-0.5 mt-1 font-medium">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    <span>{selectedCandidate.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail size={12} className="text-gray-400 shrink-0" />
                    <span className="font-mono text-[11px] text-gray-700">{selectedCandidate.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} className="text-gray-400 shrink-0" />
                    <span className="font-mono text-[11px] text-gray-700">{selectedCandidate.phone}</span>
                  </div>
                </div>
              </div>

                {/* Panel Top Right Controls: Close Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateId(null)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer"
                    title="Close preview"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Sub-tabs inside Preview Panel */}
              <div className="flex items-center gap-4 mt-4 border-b border-black/[0.06] text-xs font-bold overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('overview')}
                  className={`pb-2 transition-colors cursor-pointer whitespace-nowrap relative ${
                    activePreviewTab === 'overview'
                      ? 'text-black border-b-2 border-black font-extrabold'
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('ai_analysis')}
                  className={`pb-2 transition-colors cursor-pointer whitespace-nowrap relative ${
                    activePreviewTab === 'ai_analysis'
                      ? 'text-black border-b-2 border-black font-extrabold'
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  AI Analysis
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('resume')}
                  className={`pb-2 transition-colors cursor-pointer whitespace-nowrap relative ${
                    activePreviewTab === 'resume'
                      ? 'text-black border-b-2 border-black font-extrabold'
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('history')}
                  className={`pb-2 transition-colors cursor-pointer whitespace-nowrap relative ${
                    activePreviewTab === 'history'
                      ? 'text-black border-b-2 border-black font-extrabold'
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  Interview History
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('notes')}
                  className={`pb-2 transition-colors cursor-pointer whitespace-nowrap relative ${
                    activePreviewTab === 'notes'
                      ? 'text-black border-b-2 border-black font-extrabold'
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  Notes
                </button>
              </div>
            </div>

            {/* Preview Panel Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 no-scrollbar">
              {/* TAB 1: OVERVIEW */}
              {activePreviewTab === 'overview' && (
                <>
                  {/* 1. AI Overall Score Card */}
                  <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 flex items-center gap-4 shadow-3xs">
                    <LargeScoreRing score={selectedCandidate.score} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-sm mb-1">
                        <CheckCircle2 size={16} />
                        <span>{selectedCandidate.matchRating}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-normal">
                        {selectedCandidate.matchSummary}
                      </p>
                    </div>
                  </div>

                  {/* 2. Score Breakdown Card */}
                  <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 space-y-3 shadow-3xs">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                      Score Breakdown
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {/* Technical Skills */}
                      <div>
                        <div className="flex items-center justify-between text-gray-500 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Code size={13} className="text-gray-400" />
                            <span>Technical Skills</span>
                          </span>
                          <span className="font-mono text-gray-800 font-bold">{selectedCandidate.scoreBreakdown?.technical ?? '—'}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${selectedCandidate.scoreBreakdown?.technical ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Experience */}
                      <div>
                        <div className="flex items-center justify-between text-gray-500 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Briefcase size={13} className="text-gray-400" />
                            <span>Experience</span>
                          </span>
                          <span className="font-mono text-gray-800 font-bold">{selectedCandidate.scoreBreakdown?.experience ?? '—'}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${selectedCandidate.scoreBreakdown?.experience ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Problem Solving */}
                      <div>
                        <div className="flex items-center justify-between text-gray-500 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Puzzle size={13} className="text-gray-400" />
                            <span>Problem Solving</span>
                          </span>
                          <span className="font-mono text-gray-800 font-bold">{selectedCandidate.scoreBreakdown?.problemSolving ?? '—'}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${selectedCandidate.scoreBreakdown?.problemSolving ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Communication */}
                      <div>
                        <div className="flex items-center justify-between text-gray-500 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-gray-400" />
                            <span>Communication</span>
                          </span>
                          <span className="font-mono text-gray-800 font-bold">{selectedCandidate.scoreBreakdown?.communication ?? '—'}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${selectedCandidate.scoreBreakdown?.communication ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Cultural Fit */}
                      <div>
                        <div className="flex items-center justify-between text-gray-500 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Users size={13} className="text-gray-400" />
                            <span>Cultural Fit</span>
                          </span>
                          <span className="font-mono text-gray-800 font-bold">{selectedCandidate.scoreBreakdown?.culturalFit ?? '—'}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${selectedCandidate.scoreBreakdown?.culturalFit ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Role Alignment */}
                      <div>
                        <div className="flex items-center justify-between text-gray-500 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Target size={13} className="text-gray-400" />
                            <span>Role Alignment</span>
                          </span>
                          <span className="font-mono text-gray-800 font-bold">{selectedCandidate.scoreBreakdown?.roleAlignment ?? '—'}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${selectedCandidate.scoreBreakdown?.roleAlignment ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Key Strengths (AI Analysis) */}
                  <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 space-y-2.5 shadow-3xs">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                      Key Strengths (AI Analysis)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedCandidate.strengths?.map((strength, sIdx) => (
                        <div
                          key={sIdx}
                          className="px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold flex items-center gap-2"
                        >
                          <span className="text-emerald-600 font-bold">+</span>
                          <span className="leading-snug">{strength}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Potential Concerns */}
                  <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 space-y-2.5 shadow-3xs">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                      Potential Concerns
                    </h3>
                    <div className="space-y-2">
                      {selectedCandidate.concerns?.map((concern, cIdx) => (
                        <div
                          key={cIdx}
                          className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-medium flex items-center gap-2"
                        >
                          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                          <span className="leading-snug">{concern}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: AI ANALYSIS */}
              {activePreviewTab === 'ai_analysis' && (
                <div className="space-y-3.5 text-xs">
                  {(() => {
                    const completed = candidateRounds(selectedCandidate, interviews)
                      .filter(round => round.status === 'Completed' && isAiInterviewRound(round))
                      .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0];
                    return completed
                      ? <InterviewReviewPanel key={completed.id} round={completed} candidateName={selectedCandidate.name} />
                      : <p className="p-4 text-gray-600">No completed AI assessment is available for this candidate.</p>;
                  })()}
                </div>
              )}

              {/* TAB 3: RESUME */}
              {activePreviewTab === 'resume' && (
                <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 space-y-3 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={14} className="text-sky-600" />
                      <span>Submitted Resume</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleViewResume(selectedCandidate)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Download size={12} />
                      <span>Download PDF</span>
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl font-mono text-[11px] text-gray-700 leading-relaxed max-h-60 overflow-y-auto">
                    {selectedCandidate.resume_text || 'No resume text is available. Use View Profile to open the saved resume.'}
                  </div>
                </div>
              )}

              {/* TAB 4: INTERVIEW HISTORY */}
              {activePreviewTab === 'history' && (
                <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 space-y-3 shadow-3xs">
                  <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-purple-600" />
                    <span>Interview Loop</span>
                  </h3>
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">Saved Resume Assessment</div>
                        <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Saved match score: {selectedCandidate.score ?? '—'}/100</div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{selectedCandidate.created_at ? new Date(selectedCandidate.created_at).toLocaleDateString('en-IN') : ''}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">{interviews.find(r => String(r.candidate_submission_id) === String(selectedCandidate.id))?.round_name || 'Interview scheduling'}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {interviews.find(r => String(r.candidate_submission_id) === String(selectedCandidate.id))?.status || 'Not scheduled'}
                        </div>
                      </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isCandidateInInterview(selectedCandidate)) {
                              navigate(`/requisitions/${id}/candidates/${selectedCandidate.id}/interview?reqId=${encodeURIComponent(id)}`);
                            } else {
                              setSchedulingCandidate(selectedCandidate);
                            }
                          }}
                          className="px-2.5 py-1 rounded-xl bg-black hover:bg-gray-800 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-3xs"
                        >
                          {isCandidateInInterview(selectedCandidate) ? 'Go to Interview Panel' : 'Schedule'}
                        </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: NOTES */}
              {activePreviewTab === 'notes' && (
                <div className="bg-white/80 border border-black/[0.06] rounded-2xl p-4 space-y-3 shadow-3xs">
                  <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                    Internal Team Notes
                  </h3>
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap text-xs text-gray-700">{selectedCandidate.hiring_manager_notes || 'No saved notes for this candidate.'}</p>
                  </div>

                  <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-black/[0.06]">
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add evaluation note or feedback..."
                      className="w-full p-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-black resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!newNoteText.trim()}
                        className="px-3 py-1 rounded-xl bg-black text-white font-bold text-xs disabled:opacity-40 cursor-pointer shadow-3xs"
                      >
                        Save Note
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Bottom Action Buttons Bar */}
            <div className="p-3 sm:p-4 border-t border-black/[0.06] bg-white/70 flex items-center gap-2.5 shrink-0">
              {/* Schedule interview rounds or Go to Interview Panel if already in interview */}
              {isCandidateInInterview(selectedCandidate) ? (
                <button
                  type="button"
                  onClick={() => navigate(`/requisitions/${id}/candidates/${selectedCandidate.id}/interview?reqId=${encodeURIComponent(id)}`)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer group active:scale-95"
                >
                  <Video size={14} className="text-white group-hover:scale-110 transition-transform" />
                  <span>Go to Interview Panel</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSchedulingCandidate(selectedCandidate)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Calendar size={14} />
                  <span>Schedule Interview</span>
                </button>
              )}

              {/* View Full Profile */}
              <button
                type="button"
                onClick={() => handleViewResume(selectedCandidate)}
                className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
              >
                <User size={14} />
                <span className="hidden sm:inline">View Profile</span>
              </button>

              {/* More Actions Dropdown */}
              <button
                type="button"
                onClick={() => setActiveMenuId(activeMenuId === 'preview-more' ? null : 'preview-more')}
                className="w-9 h-9 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-gray-700 flex items-center justify-center transition-all cursor-pointer shadow-3xs relative"
              >
                <MoreHorizontal size={15} />

                {activeMenuId === 'preview-more' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 bottom-11 w-48 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-1 z-30 text-left space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                  >
                    {isCandidateInInterview(selectedCandidate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSchedulingCandidate(selectedCandidate);
                          setActiveMenuId(null);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-800 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                      >
                        <Calendar size={13} className="text-gray-500" />
                        <span>Reschedule Interview</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedCandidate, 'Accepted')}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Check size={13} />
                      <span>Select Candidate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedCandidate, 'Not Shortlisted')}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    >
                      <X size={13} />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="order-1 lg:order-2 w-full lg:w-44 xl:w-48 shrink-0 flex flex-row lg:flex-col gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 snap-x">
            {/* Stat Card 1: Total Candidates */}
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setScoreFilter('all');
              }}
              title="Show all candidates"
              className={`snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] active:scale-95 ${
                statusFilter === 'all'
                  ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                  : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            >
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Users size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <div>
                <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                  {totalCount}
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                  Total Candidates
                </div>
              </div>
            </button>

            {/* Stat Card 2: AI Shortlisted */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'AI Shortlisted' ? 'all' : 'AI Shortlisted')}
              title="Filter by AI Shortlisted"
              className={`snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] active:scale-95 ${
                statusFilter === 'AI Shortlisted'
                  ? 'bg-emerald-50/90 border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-sm'
                  : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            >
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
                <Sparkles size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <div>
                <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-emerald-700 tracking-tight leading-none">
                  {aiShortlistedCount}
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                  AI Shortlisted
                </div>
              </div>
            </button>

            {/* Stat Card 3: In Interview */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'In Interview' ? 'all' : 'In Interview')}
              title="Filter by In Interview"
              className={`snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] active:scale-95 ${
                statusFilter === 'In Interview'
                  ? 'bg-purple-50/90 border-purple-500/50 ring-1 ring-purple-500/20 shadow-sm'
                  : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            >
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-2xs shrink-0">
                <User size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <div>
                <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-purple-700 tracking-tight leading-none">
                  {inInterviewCount}
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                  In Interview
                </div>
              </div>
            </button>

            {/* Card 4: Offered */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Accepted' ? 'all' : 'Accepted')}
              title="Filter by Offered / Accepted"
              className={`snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[102px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] active:scale-95 ${
                statusFilter === 'Accepted'
                  ? 'bg-amber-50/90 border-amber-500/50 ring-1 ring-amber-500/20 shadow-sm'
                  : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            >
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                <Briefcase size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <div>
                <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-amber-700 tracking-tight leading-none">
                  {offeredCount}
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                  Offered
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── SCHEDULE INTERVIEW MODAL ── */}
      {schedulingCandidate && (
        <ScheduleInterviewModal
          candidate={{
            ...schedulingCandidate,
            id: schedulingCandidate.submission_id || schedulingCandidate.id,
            name: schedulingCandidate.name,
            email: schedulingCandidate.email,
            role: reqTitle,
            location: schedulingCandidate.location,
            score: schedulingCandidate.score,
            experience: schedulingCandidate.experience,
            availability: schedulingCandidate.availability,
            avatar: schedulingCandidate.avatar,
          }}
          requisitionId={id}
        requisitionTitle={reqTitle}
          requisitionCode={reqCode}
          onClose={() => setSchedulingCandidate(null)}
          onScheduled={() => {
            setRefresh(value => value + 1);
          }}
        />
      )}

      {/* ── SET INTERVIEW PROCESS MODAL ── */}
      <SetInterviewProcessModal
        isOpen={showSetInterviewModal}
        onClose={() => setShowSetInterviewModal(false)}
        requisitionId={id}
        requisitionTitle={reqTitle}
        requisitionCode={reqCode}
      />
    </div>
  );
}
