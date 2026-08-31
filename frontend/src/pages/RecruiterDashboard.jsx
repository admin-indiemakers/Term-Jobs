import { ArrowRight, ChevronDown, X, Sparkles, Briefcase, Users, CheckCheck, Calendar, UserCheck, Shield, ExternalLink, ChevronRight, Check, FileText, AlertCircle, Bell, Clock } from 'lucide-react';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, API_BASE_URL } from '../api/client';
import { Icons, StatCard, WelcomeBanner } from '../components/Dashboard';

function scoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score >= 70) return '#059669';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function ScoreBar({ score }) {
  const color = scoreColor(score);
  return (
    <div className="score-wrap">
      <div className="score-track">
        <div className="score-fill" style={{ width: `${score ?? 0}%`, background: color }}></div>
      </div>
      <span className="score-value" style={{ color }}>{score != null ? `${Math.round(score)}%` : '—'}</span>
    </div>
  );
}

function RecommendationBadge({ recommendation }) {
  const cls =
    recommendation === 'Strong Match' ? 'rec-strong' : recommendation === 'Moderate Match' ? 'rec-moderate' : 'rec-low';
  return <span className={`rec-badge ${cls}`}>{recommendation || 'Submitted'}</span>;
}

function ChipList({ label, items, tone }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="cand-detail-row">
      <span className="cand-detail-label">{label}</span>
      <div className="chips">
        {items.map((s, i) => (
          <span key={i} className={`chip ${tone}`}>{s}</span>
        ))}
      </div>
    </div>
  );
}

const role = (req) => {
  const sr = req?.structured_role || {};
  const ia = req?.intake_answers || {};
  return {
    ...sr,
    submission_deadline: sr.submission_deadline || req?.submission_deadline || ia.submission_deadline || sr.deadline || sr.ends_on || '',
    rate_card_cap: sr.rate_card_cap || (Array.isArray(sr.rate_band) ? `${sr.rate_band[0]} - ${sr.rate_band[1]}` : sr.rate_band) || sr.range_vendors_see || '',
  };
};
const skillsFor = (req) => role(req).must_have_skills || req?.intent?.tech_stack_hint || [];
const short = (value, fallback = 'Not specified') => value || fallback;

function getDeadlineInfo(deadlineStr) {
  if (!deadlineStr) return null;
  const deadlineDate = new Date(deadlineStr);
  if (isNaN(deadlineDate.getTime())) {
    return { formattedDate: deadlineStr, daysLeftText: null, isExpired: false, isUrgent: false };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadlineDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let daysLeftText = '';
  let isExpired = false;
  let isUrgent = false;

  if (diffDays < 0) {
    daysLeftText = 'Expired';
    isExpired = true;
  } else if (diffDays === 0) {
    daysLeftText = 'Due today';
    isUrgent = true;
  } else if (diffDays === 1) {
    daysLeftText = '1 day left';
    isUrgent = true;
  } else {
    daysLeftText = `${diffDays} days left`;
    if (diffDays <= 3) isUrgent = true;
  }

  const formattedDate = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { formattedDate, daysLeftText, isExpired, isUrgent, diffDays };
}

function formatBankDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0] || '—';
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' }).replace(',', '');
  } catch {
    return dateStr.split('T')[0] || '—';
  }
}

export default function RecruiterDashboard({ view = 'dashboard' }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const authToken = token || localStorage.getItem('auth_token');
  const showDashboard = view === 'dashboard';
  const showRequisitions = view === 'requisitions';
  const showCandidates = view === 'candidates';
  const showShortlisted = view === 'shortlisted';
  const showInterviews = view === 'interviews';
  const showAccepted = view === 'accepted';
  const showPortal = view === 'portal-access';

  const [requisitions, setRequisitions] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [fullReq, setFullReq] = useState(null);
  const [jdText, setJdText] = useState('');
  const [files, setFiles] = useState([]);
  const [screeningResult, setScreeningResult] = useState(null);
  const [shortlisted, setShortlisted] = useState([]);
  const [shortlistedFilter, setShortlistedFilter] = useState('');
  const [shortlistedSearch, setShortlistedSearch] = useState('');
  const [selectedShortlistedCompany, setSelectedShortlistedCompany] = useState('ALL');
  const [openRequisitionAccordions, setOpenRequisitionAccordions] = useState({});
  const [viewProfileCandidate, setViewProfileCandidate] = useState(null);
  const [shortlistedStatusFilter, setShortlistedStatusFilter] = useState('ALL');
  const [interviews, setInterviews] = useState([]);
  const [acceptedCandidates, setAcceptedCandidates] = useState([]);
  const [portalUsers, setPortalUsers] = useState([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(new Set());
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [interviewFilter, setInterviewFilter] = useState('ALL');
  const [interviewSearch, setInterviewSearch] = useState('');
  const [expandedShortlistedId, setExpandedShortlistedId] = useState(null);
  const [candidateLimit, setCandidateLimit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankTab, setBankTab] = useState('all'); // 'all' | 'recent'
  const [skillFilter, setSkillFilter] = useState('all');
  const [showBankUploader, setShowBankUploader] = useState(false);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [expandedScreenedId, setExpandedScreenedId] = useState(null);

  const [bankCandidates, setBankCandidates] = useState([]);
  const [parsingBank, setParsingBank] = useState(false);
  const [selectedMatchCandidate, setSelectedMatchCandidate] = useState(null);
  const [matchingReqId, setMatchingReqId] = useState('');
  const [matching, setMatching] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(null);
  const [resumePdfUrl, setResumePdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfViewTab, setPdfViewTab] = useState('pdf'); // 'pdf' or 'insights'

  const [showJdDetails, setShowJdDetails] = useState(false);
  const [reqCandidateSearch, setReqCandidateSearch] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [selectedCompanyTab, setSelectedCompanyTab] = useState('All');
  const [limitReachedModal, setLimitReachedModal] = useState(null);
  const [limitToast, setLimitToast] = useState(null);
  const [shortlistQuota, setShortlistQuota] = useState({ limit: 3, used: 0, is_limit_reached: false });
  const [shortlistingCandidateIds, setShortlistingCandidateIds] = useState(new Set());
  const [autoScreenFilterMode, setAutoScreenFilterMode] = useState('all'); // 'all' | 'exclude_accepted'
  const [rowFilterModes, setRowFilterModes] = useState({});
  const [autoScreenStatus, setAutoScreenStatus] = useState(null); // null | 'preparing' | 'eligible' | 'screening' | 'done'
  const [autoScreenEligibleCount, setAutoScreenEligibleCount] = useState(0);
  const [workspaceActiveTab, setWorkspaceActiveTab] = useState('requirements'); // 'requirements' | 'candidates'
  const [screenedReqSummary, setScreenedReqSummary] = useState({});

  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [addCandidateMode, setAddCandidateMode] = useState('ai'); // 'ai' or 'manual'
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkVendor, setBulkVendor] = useState('');
  const [isDraggingBank, setIsDraggingBank] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState('');
  const [screenedSubmissions, setScreenedSubmissions] = useState([]);
  const [screeningProgress, setScreeningProgress] = useState({
    total: 0,
    processed: 0,
    pct: 0,
    stage: 'Extract',
  });
  const [newCandName, setNewCandName] = useState('');
  const [newCandEmail, setNewCandEmail] = useState('');
  const [newCandPhone, setNewCandPhone] = useState('');
  const [newCandTitle, setNewCandTitle] = useState('');
  const [newCandVendor, setNewCandVendor] = useState('');
  const [newCandFile, setNewCandFile] = useState(null);

  async function handleOpenResumeModal(candidate) {
    setShowResumeModal(candidate);
    setPdfViewTab('pdf');
    setLoadingPdf(true);
    if (resumePdfUrl) {
      window.URL.revokeObjectURL(resumePdfUrl);
      setResumePdfUrl(null);
    }

    const candId = candidate.id || candidate.submission_id;
    const activeToken = token || authToken || localStorage.getItem('auth_token') || localStorage.getItem('token');

    try {
      let res = await fetch(`${API_BASE_URL}/candidates/bank/${candId}/resume-pdf`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/candidates/${candId}/resume-pdf`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      }
      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/candidates/${candId}/resume`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      }
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setResumePdfUrl(url);
      } else {
        setResumePdfUrl(null);
      }
    } catch (err) {
      console.error('Failed to load resume PDF from MongoDB:', err);
      setResumePdfUrl(null);
    } finally {
      setLoadingPdf(false);
    }
  }

  function handleCloseResumeModal() {
    if (resumePdfUrl) {
      window.URL.revokeObjectURL(resumePdfUrl);
      setResumePdfUrl(null);
    }
    setShowResumeModal(null);
  }

  async function handleDownloadCandidatePdf(candidateId, filename) {
    const activeToken = token || authToken || localStorage.getItem('auth_token') || localStorage.getItem('token');
    try {
      let res = await fetch(`${API_BASE_URL}/candidates/bank/${candidateId}/resume-pdf`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/candidates/${candidateId}/resume`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      }
      if (!res.ok) {
        throw new Error('Failed to load resume PDF.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'candidate_resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Could not load resume PDF.');
    }
  }

  async function handleAddCandidateSubmit(e) {
    if (e) e.preventDefault();
    setParsingBank(true);
    setError('');
    setBankSuccessMsg('');

    const form = new FormData();

    if (addCandidateMode === 'ai') {
      if (!bulkFiles || bulkFiles.length === 0) {
        setParsingBank(false);
        return setError('Please select or drop at least one resume PDF or DOCX file.');
      }
      for (const f of bulkFiles) {
        form.append('files', f);
      }
      form.append('vendor_company_name', (bulkVendor || user?.tenant_name || 'bridgeon').trim());
    } else {
      if (!newCandName.trim()) {
        setParsingBank(false);
        return setError('Candidate name is required.');
      }
      if (newCandName) form.append('name', newCandName.trim());
      if (newCandEmail) form.append('email', newCandEmail.trim());
      if (newCandPhone) form.append('phone', newCandPhone.trim());
      if (newCandVendor) form.append('vendor_company_name', newCandVendor.trim());
      if (newCandTitle) form.append('candidate_title', newCandTitle.trim());
      if (newCandFile) form.append('files', newCandFile);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/candidates/bank/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.detail || data.message || 'Could not save candidate.');
      }
      const updatedBank = await request('/candidates/bank', { token: authToken });
      setBankCandidates(updatedBank || []);

      setShowAddCandidateModal(false);
      setBulkFiles([]);
      setNewCandName('');
      setNewCandEmail('');
      setNewCandPhone('');
      setNewCandTitle('');
      setNewCandVendor('');
      setNewCandFile(null);
      setBankSuccessMsg(`Successfully processed and added ${data.count || bulkFiles.length || 1} candidate profile(s) with Groq AI!`);
      setTimeout(() => setBankSuccessMsg(''), 6000);
    } catch (err) {
      setError(err.message || 'Failed to process candidates.');
    } finally {
      setParsingBank(false);
    }
  }

  const selected = (fullReq && fullReq.id === selectedReqId)
    ? fullReq
    : (requisitions.find((item) => item.id === selectedReqId) || requisitions[0] || null);

  const companyTabs = useMemo(() => {
    const map = new Map();
    requisitions.forEach((r) => {
      const cName = (r.company_name || r.company?.name || r.client_name || 'Bearitt').trim();
      map.set(cName, (map.get(cName) || 0) + 1);
    });

    const tabs = [{ name: 'All', count: requisitions.length }];
    map.forEach((count, name) => {
      tabs.push({ name, count });
    });
    return tabs;
  }, [requisitions]);

  const visibleRequisitions = useMemo(() => {
    return requisitions.filter((item) => {
      const cName = (item.company_name || item.company?.name || item.client_name || 'Bearitt').trim();
      const matchesCompany = selectedCompanyTab === 'All' || cName.toLowerCase() === selectedCompanyTab.toLowerCase();
      const query = search.trim().toLowerCase();
      const skills = skillsFor(item);
      const matchesSearch = !query ||
        (item.title || '').toLowerCase().includes(query) ||
        cName.toLowerCase().includes(query) ||
        skills.some((s) => s.toLowerCase().includes(query));
      return matchesCompany && matchesSearch;
    });
  }, [requisitions, selectedCompanyTab, search]);

  const groupedRequisitions = useMemo(() => {
    const groups = [];
    const map = new Map();

    visibleRequisitions.forEach((req) => {
      const cName = (req.company_name || req.company?.name || req.client_name || 'Bearitt').trim();
      if (!map.has(cName)) {
        const group = { companyName: cName, items: [] };
        map.set(cName, group);
        groups.push(group);
      }
      map.get(cName).items.push(req);
    });

    return groups;
  }, [visibleRequisitions]);
  const queued = screeningResult?.ranked_candidates || [];
  const avgScore = shortlisted.length
    ? Math.round(shortlisted.reduce((sum, candidate) => sum + (candidate.match_score || 0), 0) / shortlisted.length)
    : null;

  const shortlistedCompaniesList = useMemo(() => {
    const map = {};
    (shortlisted || []).forEach((c) => {
      const compName = (c.company_name || 'Bearitt').trim();
      if (!map[compName]) {
        map[compName] = {
          name: compName,
          initial: compName.charAt(0).toUpperCase() || 'C',
          count: 0,
          reqIds: new Set(),
        };
      }
      map[compName].count += 1;
      if (c.requisition_id) {
        map[compName].reqIds.add(c.requisition_id);
      }
    });

    return Object.values(map).map((item) => ({
      name: item.name,
      initial: item.initial,
      count: item.count,
      reqsCount: item.reqIds.size || 1,
    }));
  }, [shortlisted]);

  const shortlistedPipelineStats = useMemo(() => {
    const total = (shortlisted || []).length;
    const comps = new Set((shortlisted || []).map((c) => (c.company_name || 'Bearitt').trim())).size;
    const reqs = new Set((shortlisted || []).map((c) => c.requisition_id || c.requisition_title || 'req')).size;
    const avg = total > 0
      ? Math.round((shortlisted || []).reduce((acc, c) => acc + (c.match_score || 0), 0) / total)
      : 0;
    return {
      total,
      companies: comps || (total ? 1 : 0),
      requisitions: reqs || (total ? 1 : 0),
      avg: avg || 0,
    };
  }, [shortlisted]);

  const shortlistedRequisitionGroups = useMemo(() => {
    const query = (shortlistedSearch || '').toLowerCase().trim();

    // 1. Filter candidates
    const filtered = (shortlisted || []).filter((c) => {
      // Company filter
      if (selectedShortlistedCompany !== 'ALL') {
        const comp = (c.company_name || 'Bearitt').toLowerCase().trim();
        if (comp !== selectedShortlistedCompany.toLowerCase().trim()) return false;
      }
      // Status filter
      if (shortlistedStatusFilter !== 'ALL') {
        if ((c.status || 'Shortlisted').toLowerCase() !== shortlistedStatusFilter.toLowerCase()) return false;
      }
      // Search filter
      if (query) {
        const match =
          (c.candidate_name || '').toLowerCase().includes(query) ||
          (c.candidate_email || '').toLowerCase().includes(query) ||
          (c.requisition_title || '').toLowerCase().includes(query) ||
          (c.company_name || '').toLowerCase().includes(query) ||
          (c.vendor_name || '').toLowerCase().includes(query) ||
          (c.matched_skills || []).some((s) => s.toLowerCase().includes(query)) ||
          (c.skills || []).some((s) => s.toLowerCase().includes(query));
        if (!match) return false;
      }
      return true;
    });

    // 2. Group by requisition
    const map = {};
    filtered.forEach((c) => {
      const reqKey = c.requisition_id || c.requisition_title || 'General Pipeline';
      if (!map[reqKey]) {
        const reqObj = requisitions.find((r) => r.id === c.requisition_id);
        const reqSkills = reqObj ? skillsFor(reqObj) : (c.matched_skills || c.skills || ['Python', 'FastAPI', 'PostgreSQL']);
        const comp = (c.company_name || reqObj?.company_name || 'Bearitt').trim();
        map[reqKey] = {
          id: reqKey,
          title: c.requisition_title || reqObj?.title || 'Senior Python Developer',
          companyName: comp,
          initial: comp.charAt(0).toUpperCase() || 'B',
          skills: reqSkills.slice(0, 4),
          candidates: [],
        };
      }
      map[reqKey].candidates.push(c);
    });

    return Object.values(map);
  }, [shortlisted, requisitions, selectedShortlistedCompany, shortlistedStatusFilter, shortlistedSearch]);

  const shortlistedTotalFilteredCount = useMemo(() => {
    return shortlistedRequisitionGroups.reduce((acc, g) => acc + g.candidates.length, 0);
  }, [shortlistedRequisitionGroups]);

  const bankSkills = useMemo(() => {
    return [...new Set((bankCandidates || []).flatMap((candidate) => candidate.skills || []))];
  }, [bankCandidates]);

  const bankStats = useMemo(() => {
    const list = bankCandidates || [];
    const parsed = list.filter((c) => (c.extracted_text || '').trim().length > 0);
    const ready = list.filter((c) => (c.candidate_email || '').trim() && (c.skills || []).length > 0);
    const titles = [...new Set(list.map((c) => (c.candidate_title || '').trim()).filter(Boolean))];
    return {
      total: list.length,
      parsed: parsed.length,
      ready: ready.length,
      readyPct: list.length ? Math.round((ready.length / list.length) * 100) : 0,
      titles,
      titleCount: titles.length,
    };
  }, [bankCandidates]);

  const filteredBankCandidates = useMemo(() => {
    let list = (bankCandidates || []).filter((candidate) => {
      const name = `${candidate.candidate_name || ''} ${candidate.candidate_email || ''} ${candidate.candidate_title || ''} ${candidate.vendor_company_name || ''}`.toLowerCase();
      const skills = candidate.skills || [];
      const matchText = !bankSearch || name.includes(bankSearch.toLowerCase()) || skills.some((skill) => skill.toLowerCase().includes(bankSearch.toLowerCase()));
      const matchSkill = skillFilter === 'all' || skills.some((skill) => skill.toLowerCase() === skillFilter.toLowerCase());
      return matchText && matchSkill;
    });
    if (bankTab === 'recent') {
      list = [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return list;
  }, [bankCandidates, bankSearch, skillFilter, bankTab]);

  const filteredReqCandidates = useMemo(() => {
    return (bankCandidates || []).filter((candidate) => {
      const name = `${candidate.candidate_name || ''} ${candidate.candidate_email || ''} ${candidate.candidate_title || ''}`.toLowerCase();
      const skills = (candidate.skills || []).map(s => s.toLowerCase());
      const searchLower = reqCandidateSearch.toLowerCase();
      return name.includes(searchLower) || skills.some(s => s.includes(searchLower));
    });
  }, [bankCandidates, reqCandidateSearch]);

  const sortedScreenedSubmissions = useMemo(() => {
    return [...screenedSubmissions].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }, [screenedSubmissions]);

  // Prioritized Live Notifications (Compact, auto-dismisses when access given or screened)
  const notifications = useMemo(() => {
    const list = [];

    // Priority 1: Unscreened Requisition Deadlines Approaching
    (requisitions || []).forEach((req) => {
      const isScreened = Boolean(screenedReqSummary[req.id]);
      if (isScreened) return; // If already screened, deadline alert disappears!

      const dStr = req.submission_deadline || req.deadline;
      if (dStr) {
        try {
          const dDate = new Date(dStr);
          const now = new Date();
          const diffDays = Math.ceil((dDate - now) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) {
            const notifId = `deadline-${req.id}`;
            if (dismissedNotifIds.has(notifId)) return;

            const isUrgent = diffDays <= 3;
            list.push({
              id: notifId,
              priority: 1,
              type: 'deadline',
              badge: diffDays < 0 ? 'Expired' : diffDays === 0 ? 'Due Today' : `${diffDays}d Left`,
              badgeColor: 'bg-[#F5F5F2] text-[#0A0A0A] border-[#E2E2DC]',
              title: req.title || 'Requisition Role',
              subtitle: `${req.company_name || 'Client'} • Deadline: ${dStr}`,
              actionLabel: 'Screen',
              actionUrl: '/dashboard/recruiter/requisitions',
              reqId: req.id,
            });
          }
        } catch {}
      }
    });

    // Priority 2: HR Accepted Candidates (Pending Portal Access)
    (acceptedCandidates || []).forEach((cand) => {
      const candEmail = (cand.candidate_email || cand.email || '').toLowerCase().trim();
      const candId = cand.id || cand.submission_id || cand.candidate_id;

      // Check if portal access has already been granted & is active
      const alreadyHasAccess = (portalUsers || []).some((u) => {
        const uEmail = (u.email || '').toLowerCase().trim();
        const uCandId = (u.candidate_id || '').trim();
        const isUserActive = u.is_active !== false;
        return isUserActive && ((candId && uCandId === candId) || (candEmail && candEmail.length > 3 && uEmail === candEmail && (!uCandId || uCandId === candId)));
      });

      if (alreadyHasAccess) return; // Disappears if portal access is already granted!

      const notifId = `accepted-${candId}`;
      if (dismissedNotifIds.has(notifId)) return;

      const candName = cand.candidate_name || cand.name || 'Candidate';
      const compName = cand.company_name || cand.vendor_name || 'Bearitt';
      const roleName = cand.requisition_title || cand.title || 'Selected Role';

      list.push({
        id: notifId,
        priority: 2,
        type: 'accepted',
        badge: 'HR Accepted',
        badgeColor: 'bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A]',
        title: candName,
        subtitle: `${compName} • ${roleName}`,
        actionLabel: 'Grant Access',
        actionUrl: '/dashboard/recruiter/portal-access',
        candId,
      });
    });

    // Priority 3: Interview Requests
    (interviews || []).forEach((inv) => {
      const notifId = `interview-${inv.id}`;
      if (dismissedNotifIds.has(notifId)) return;

      const candName = inv.candidate_name || 'Candidate';
      const compName = inv.company_name || inv.client_name || 'Client';

      list.push({
        id: notifId,
        priority: 3,
        type: 'interview',
        badge: 'Interview',
        badgeColor: 'bg-[#F5F5F2] text-[#0A0A0A] border-[#E2E2DC]',
        title: candName,
        subtitle: `${compName} • Scheduled`,
        actionLabel: 'View',
        actionUrl: '/dashboard/recruiter/interviews',
      });
    });

    return list.sort((a, b) => a.priority - b.priority);
  }, [requisitions, screenedReqSummary, acceptedCandidates, portalUsers, interviews, dismissedNotifIds]);

  const toggleCandidateSelect = (id) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllCandidates = () => {
    if (selectedCandidateIds.length === filteredReqCandidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(filteredReqCandidates.map((c) => c.id));
    }
  };


  async function loadWorkspace() {
    setLoading(true);
    const activeToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token');
    try {
      const [rawRequisitions, candidateData, limitData, bankData, interviewData, screenedSummaryData, acceptedData, portalUsersData] = await Promise.all([
        request('/requisitions', { token: activeToken }).catch(() => []),
        request('/candidates/shortlisted', { token: activeToken })
          .catch(() => request('/api/candidates/shortlisted', { token: activeToken }))
          .catch(() => []),
        request('/api/settings/candidate-limit', { token: activeToken }).catch(() => ({ limit: null })),
        request('/candidates/bank', { token: activeToken }).catch(() => []),
        request('/api/interviews/vendor', { token: activeToken }).catch(() => []),
        request('/candidates/bank/screened-summary', { token: activeToken }).catch(() => ({ screened_requisitions: {} })),
        request('/candidates?status=Accepted', { token: activeToken }).catch(() => []),
        request('/api/auth/portal-users', { token: activeToken }).catch(() => []),
      ]);

      const list = Array.isArray(rawRequisitions) ? rawRequisitions : rawRequisitions?.requisitions || [];
      setRequisitions(list);
      let listShortlisted = Array.isArray(candidateData) ? candidateData : candidateData?.shortlisted_candidates || [];
      if (!listShortlisted.length && activeToken) {
        const fallbackSubs = await request('/candidates?status=Shortlisted', { token: activeToken }).catch(() => []);
        if (Array.isArray(fallbackSubs) && fallbackSubs.length) {
          listShortlisted = fallbackSubs;
        }
      }
      setShortlisted(listShortlisted);
      setCandidateLimit(limitData?.limit ?? null);
      setBankCandidates(bankData || []);
      setInterviews(Array.isArray(interviewData) ? interviewData : []);
      const acceptedList = Array.isArray(acceptedData) ? acceptedData : (acceptedData?.candidates || []);
      setAcceptedCandidates(acceptedList);
      setPortalUsers(Array.isArray(portalUsersData) ? portalUsersData : []);
      setScreenedReqSummary(screenedSummaryData?.screened_requisitions || {});
      setLoading(false);

      if (list.length) {
        const defaultReq = list.find((item) => item.status === 'Published') || list[0];
        selectRequisition(defaultReq.id, list);
      }
    } catch (err) {
      setError(err.message || 'Unable to load your recruiter workspace.');
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [token, authToken, view]);

  const fetchInterviews = async () => {
    setLoadingInterviews(true);
    try {
      const invs = await request('/api/interviews/vendor', { token: authToken });
      setInterviews(Array.isArray(invs) ? invs : []);
    } catch (err) {
      console.error('Failed to fetch vendor interviews:', err);
    } finally {
      setLoadingInterviews(false);
    }
  };

  const handleConfirmInterview = async (invId, candName) => {
    if (!window.confirm(`Confirm candidate availability for ${candName}?`)) return;
    setConfirmingId(invId);
    try {
      await request(`/api/interviews/${invId}/vendor-confirm`, {
        method: 'POST',
        token: authToken,
        body: { action: 'confirm', vendor_notes: 'Confirmed candidate availability' },
      });
      await fetchInterviews();
    } catch (err) {
      alert(err.message || 'Failed to confirm interview slot.');
    } finally {
      setConfirmingId(null);
    }
  };

  async function uploadToBank(event) {
    const uploadedFiles = Array.from(event.target.files || []);
    if (!uploadedFiles.length) return;

    setParsingBank(true);
    setError('');

    const form = new FormData();
    uploadedFiles.forEach((file) => form.append('files', file));

    try {
      const response = await fetch(`${API_BASE_URL}/candidates/bank/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.detail || 'Could not parse resumes.');
      }
      const updatedBank = await request('/candidates/bank', { token: authToken });
      setBankCandidates(updatedBank || []);
    } catch (err) {
      setError(err.message || 'Failed to upload and parse resumes.');
    } finally {
      setParsingBank(false);
    }
  }

  async function deleteBankCandidate(candidateId) {
    if (!window.confirm('Are you sure you want to delete this candidate from the bank?')) return;
    setError('');
    try {
      const data = await request(`/candidates/bank/${candidateId}`, {
        method: 'DELETE',
        token: authToken,
      });
      if (data.status === 'success') {
        setBankCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      } else {
        throw new Error(data.message || 'Failed to delete candidate.');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete candidate.');
    }
  }

  async function handleMatchConfirm() {
    if (!selectedMatchCandidate || !matchingReqId) return;
    setMatching(true);
    setError('');
    try {
      const response = await request('/candidates/bank/match', {
        method: 'POST',
        token: authToken,
        body: {
          candidate_id: selectedMatchCandidate.id,
          requisition_id: matchingReqId,
        },
      });
      if (response.status === 'success') {
        alert('Candidate matched and screened successfully!');
        setSelectedMatchCandidate(null);
        setMatchingReqId('');
        navigate('/dashboard/recruiter/requisitions');
      } else {
        throw new Error(response.message || 'Failed to match candidate.');
      }
    } catch (err) {
      setError(err.message || 'Failed to match candidate.');
    } finally {
      setMatching(false);
    }
  }

  const fetchShortlistQuota = (reqId) => {
    if (!reqId || !authToken) return;
    request(`/candidates/shortlist-quota/${reqId}`, { token: authToken })
      .then((data) => {
        if (data?.status === 'success') {
          setShortlistQuota(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (selectedReqId) {
      fetchShortlistQuota(selectedReqId);
    }
  }, [selectedReqId, authToken]);

  async function updateCandidateStatus(sub, newStatus) {
    const targetKey = sub.candidate_id || sub.id || sub.submission_id || sub.candidate_name;
    if (shortlistingCandidateIds.has(targetKey)) {
      return; // Prevent duplicate clicks or concurrent requests
    }

    try {
      if (newStatus === 'Shortlisted') {
        // Active shortlisted + accepted candidate count check
        const activeSubCount = screenedSubmissions.filter((s) => {
          const st = (s.status || '').toLowerCase();
          return st === 'shortlisted' || st === 'accepted' || st === 'hired' || st === 'under review';
        }).length;
        const currentCap = shortlistQuota?.limit || 3;

        if (activeSubCount >= currentCap) {
          const limitMsg = `Maximum candidate shortlist limit of ${currentCap} reached for this requisition. You cannot shortlist more candidates.`;
          setLimitToast(limitMsg);
          setTimeout(() => setLimitToast(null), 2500);
          setLimitReachedModal({
            title: 'Maximum Shortlist Limit Reached',
            message: limitMsg,
            candidateName: sub.candidate_name,
            limit: currentCap,
          });
          return;
        }

        // Immediately update button to ? Shortlisted and disable double-clicks
        const originalStatus = sub.status;
        setShortlistingCandidateIds((prev) => new Set(prev).add(targetKey));
        setScreenedSubmissions((prev) =>
          prev.map((item) =>
            (item.candidate_id === sub.candidate_id || item.id === sub.id || (item.candidate_name && item.candidate_name === sub.candidate_name))
              ? { ...item, status: 'Shortlisted' }
              : item
          )
        );

        try {
          const res = await request('/candidates/shortlist', {
            method: 'POST',
            token: authToken,
            body: {
              requisition_id: selectedReqId,
              candidate_id: sub.candidate_id || sub.id,
              candidate_name: sub.candidate_name,
              candidate_email: sub.candidate_email,
              vendor_name: sub.vendor_name,
              match_score: sub.match_score,
              recommendation: sub.recommendation,
              summary: sub.summary,
              filename: sub.filename,
            },
          });
          if (res.status === 'success') {
            setScreenedSubmissions((prev) =>
              prev.map((item) =>
                (item.candidate_id === sub.candidate_id || item.id === sub.id || (item.candidate_name && item.candidate_name === sub.candidate_name))
                  ? { ...item, status: 'Shortlisted', id: res.submission_id, submission_id: res.submission_id }
                  : item
              )
            );
            const data = await request('/api/candidates/shortlisted', { token: authToken }).catch(() => ({ shortlisted_candidates: [] }));
            setShortlisted(Array.isArray(data) ? data : data?.shortlisted_candidates || []);
            if (selectedReqId) {
              fetchShortlistQuota(selectedReqId);
            }
          } else {
            throw new Error(res.message || 'Failed to shortlist candidate.');
          }
        } catch (err) {
          // Revert optimistic update on failure
          setScreenedSubmissions((prev) =>
            prev.map((item) =>
              (item.candidate_id === sub.candidate_id || item.id === sub.id || (item.candidate_name && item.candidate_name === sub.candidate_name))
                ? { ...item, status: originalStatus }
                : item
            )
          );
          throw err;
        } finally {
          setShortlistingCandidateIds((prev) => {
            const next = new Set(prev);
            next.delete(targetKey);
            return next;
          });
        }
      } else {
        const subId = sub.id || sub.submission_id;
        if (subId && !subId.startsWith('temp_')) {
          await request(`/candidates/${subId}/status`, {
            method: 'PATCH',
            token: authToken,
            body: { status: newStatus },
          });
        }
        setScreenedSubmissions((prev) =>
          prev.map((item) => ((item.candidate_id === sub.candidate_id || item.id === sub.id) ? { ...item, status: newStatus } : item))
        );
      }
    } catch (err) {
      const msg = err.message || 'Failed to update candidate status.';
      setLimitToast(msg);
      setTimeout(() => setLimitToast(null), 2500);
      if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('maximum') || msg.toLowerCase().includes('shortlist')) {
        setLimitReachedModal({
          title: 'Maximum Shortlist Limit Reached',
          message: msg,
          candidateName: sub.candidate_name,
          limit: shortlistQuota?.limit || 3,
        });
      }
      setError(msg);
    }
  }
  async function runAutoScreeningForReq(reqId) {
    if (screening) return;
    await runAutoScreening(reqId);
  }

  async function runAutoScreening(overrideReqId, overrideFilterMode) {
    console.log('[AI Screen] runAutoScreening called, overrideReqId:', overrideReqId, 'screening:', screening, 'selectedReqId:', selectedReqId);
    if (screening) { console.log('[AI Screen] Blocked: screening already in progress'); return; }
    const activeReqId = overrideReqId || selectedReqId;
    if (!activeReqId) { console.log('[AI Screen] Blocked: no activeReqId'); return setError('Please select a requisition first.'); }

    const activeFilterMode = overrideFilterMode || rowFilterModes[activeReqId] || autoScreenFilterMode || 'all';
    console.log('[AI Screen] Starting auto-screen for reqId:', activeReqId, 'filterMode:', activeFilterMode);

    // Immediate UI feedback
    setScreening(true);
    setAutoScreenStatus('preparing');
    setError('');
    setScreeningProgress({ total: 1, processed: 0, pct: 5, stage: 'Extract' });

    let currentPct = 5;
    let currentStage = 'Extract';
    let currentProcessed = 0;
    let totalCount = 1;

    const progressInterval = setInterval(() => {
      currentPct = Math.min(92, currentPct + Math.floor(Math.random() * 5) + 3);
      currentProcessed = Math.min(Math.max(1, totalCount) - 1, Math.floor((currentPct / 100) * Math.max(1, totalCount)));
      if (currentPct < 20) currentStage = 'Extract';
      else if (currentPct < 50) currentStage = 'LLM Structure';
      else if (currentPct < 75) currentStage = 'GitHub Agent';
      else if (currentPct < 90) currentStage = 'Score';
      else currentStage = 'Rank';
      setScreeningProgress({ total: totalCount, processed: currentProcessed, pct: currentPct, stage: currentStage });
    }, 800);

    try {
      // Step 1: Resolve eligible candidates from Candidate Bank (server does eligibility check)
      const eligRes = await request('/candidates/bank/auto-screen', {
        method: 'POST',
        token: authToken,
        body: {
          requisition_id: activeReqId,
          filter_mode: activeFilterMode,
        },
      });

      console.log('[AI Screen] auto-screen response:', eligRes);
      if (eligRes.status !== 'success') {
        throw new Error(eligRes.message || 'Failed to resolve eligible candidates.');
      }

      const eligibleIds = eligRes.eligible_candidate_ids || [];
      const eligibleCount = eligRes.eligible_count || 0;
      totalCount = eligibleCount || 1;
      setAutoScreenEligibleCount(eligibleCount);
      setAutoScreenStatus('eligible');

      if (eligibleIds.length === 0) {
        clearInterval(progressInterval);
        setScreening(false);
        setAutoScreenStatus('done');
        setError('No eligible candidates found in the Candidate Bank for this requisition.');
        return;
      }

      // Step 2: Run existing AI screening pipeline with eligible IDs
      setAutoScreenStatus('screening');
      const response = await request('/candidates/bank/match-bulk', {
        method: 'POST',
        token: authToken,
        body: { candidate_ids: eligibleIds, requisition_id: activeReqId },
      });

      clearInterval(progressInterval);
      if (response.status === 'success') {
        setScreeningProgress({ total: totalCount, processed: totalCount, pct: 100, stage: 'Rank' });
        if (Array.isArray(response.screened_candidates) && response.screened_candidates.length) {
          setScreenedSubmissions(response.screened_candidates);
          setScreenedReqSummary((prev) => ({
            ...prev,
            [activeReqId]: { screened_count: response.screened_candidates.length, has_cache: true },
          }));
        }
        setAutoScreenStatus('done');
      } else {
        throw new Error(response.message || 'Screening failed.');
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('[AI Screen] Error in runAutoScreening:', err);
      setAutoScreenStatus(null);
      setError(err.message || 'Auto screening failed. Please try again.');
    } finally {
      setTimeout(() => {
        setScreening(false);
      }, 600);
    }
  }

  async function runBulkScreening() {
    if (screening) return; // Prevent duplicate clicks or concurrent requests
    if (!selectedCandidateIds.length) return setError('Please select at least one candidate.');
    if (!selectedReqId) return setError('Please select a requisition.');

    const totalCount = selectedCandidateIds.length;
    setScreeningProgress({
      total: totalCount,
      processed: 0,
      pct: 5,
      stage: 'Extract',
    });
    setScreening(true);
    setError('');

    let currentPct = 5;
    let currentStage = 'Extract';
    let currentProcessed = 0;

    const progressInterval = setInterval(() => {
      currentPct = Math.min(92, currentPct + Math.floor(Math.random() * 5) + 3);
      currentProcessed = Math.min(totalCount - 1, Math.floor((currentPct / 100) * totalCount));

      if (currentPct < 20) {
        currentStage = 'Extract';
      } else if (currentPct < 50) {
        currentStage = 'LLM Structure';
      } else if (currentPct < 75) {
        currentStage = 'GitHub Agent';
      } else if (currentPct < 90) {
        currentStage = 'Score';
      } else {
        currentStage = 'Rank';
      }

      setScreeningProgress({
        total: totalCount,
        processed: currentProcessed,
        pct: currentPct,
        stage: currentStage,
      });
    }, 900);

    try {
      const response = await request('/candidates/bank/match-bulk', {
        method: 'POST',
        token: authToken,
        body: {
          candidate_ids: selectedCandidateIds,
          requisition_id: selectedReqId,
        },
      });
      clearInterval(progressInterval);
      if (response.status === 'success') {
        setScreeningProgress({
          total: totalCount,
          processed: totalCount,
          pct: 100,
          stage: 'Rank',
        });
        setSelectedCandidateIds([]);
        if (Array.isArray(response.screened_candidates) && response.screened_candidates.length) {
          setScreenedSubmissions(response.screened_candidates);
          setScreenedReqSummary((prev) => ({
            ...prev,
            [selectedReqId]: {
              screened_count: response.screened_candidates.length,
              has_cache: true,
            }
          }));
        } else {
          const subs = await request(`/candidates?requisition_id=${selectedReqId}`, { token: authToken }).catch(() => []);
          setScreenedSubmissions(subs || []);
        }
      } else {
        throw new Error(response.message || 'Failed to complete screening.');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || 'Bulk candidate screening failed.');
    } finally {
      setTimeout(() => {
        setScreening(false);
      }, 600);
    }
  }

  function formatJd(req) {
    if (req?.generated_jd_markdown) return req.generated_jd_markdown;
    const data = role(req);
    return [
      `# ${data.title || req?.title || 'Untitled role'}`,
      data.summary,
      skillsFor(req).length ? `Must-have skills: ${skillsFor(req).join(', ')}` : '',
      data.experience ? `Experience: ${data.experience}` : '',
      data.location || data.work_locations?.join(', '),
    ].filter(Boolean).join('\n\n');
  }

  async function selectRequisition(id, source = requisitions) {
    const summary = source.find((item) => item.id === id);
    setSelectedReqId(id);
    setAutoScreenStatus(null);
    setAutoScreenEligibleCount(0);
    setFullReq(summary || null);
    setJdText(formatJd(summary));
    try {
      const details = await request(`/requisitions/${id}`, { token: authToken });
      setFullReq(details);
      setJdText(formatJd(details));
    } catch {
      // The summarized published requisition remains fully usable for screening.
    }
    try {
      const [subs, cacheRes] = await Promise.all([
        request(`/candidates?requisition_id=${id}`, { token: authToken }).catch(() => []),
        request(`/candidates/bank/screening-cache/${id}`, { token: authToken }).catch(() => ({ has_cache: false, screened_candidates: [] })),
      ]);

      if (cacheRes?.has_cache && Array.isArray(cacheRes.screened_candidates) && cacheRes.screened_candidates.length) {
        const permanentMap = new Map((subs || []).map((s) => [s.candidate_name?.toLowerCase() || s.id, s]));
        const merged = cacheRes.screened_candidates.map((cand) => {
          const perm = permanentMap.get(cand.candidate_name?.toLowerCase()) || permanentMap.get(cand.id);
          if (perm && perm.status) {
            return { ...cand, status: perm.status, id: perm.id || cand.id };
          }
          return cand;
        });
        setScreenedSubmissions(merged);
      } else if (Array.isArray(subs) && subs.length) {
        setScreenedSubmissions(subs);
      } else if (!screening) {
        setScreenedSubmissions([]);
      }
    } catch {
      if (!screening) {
        setScreenedSubmissions([]);
      }
    }
  }

  async function screenCandidates(event) {
    event.preventDefault();
    if (!selectedReqId || !jdText.trim()) return setError('Select a requisition or add a job description first.');
    if (!files.length) return setError('Add at least one PDF resume to begin screening.');
    setError('');
    setScreening(true);
    const form = new FormData();
    form.append('jd', jdText);
    form.append('requisition_id', selectedReqId);
    form.append('vendor_name', user?.tenant_name || user?.name || 'Consultancy partner');
    files.forEach((file) => form.append('files', file));
    try {
      const response = await fetch(`${API_BASE_URL}/api/screen-resumes`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form,
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') throw new Error(data.detail || 'Screening could not be completed.');
      setScreeningResult(data.analysis);
      setFiles([]);
    } catch (err) {
      setError(err.message || 'Candidate screening failed.');
    } finally {
      setScreening(false);
    }
  }

  async function shortlist(candidate) {
    try {
      await request('/api/approve-candidate', {
        method: 'POST', token: authToken,
        body: { submission_id: candidate.submission_id, action: 'shortlist', vendor_name: user?.tenant_name || user?.name },
      });
      setScreeningResult((result) => ({ ...result, ranked_candidates: result.ranked_candidates.filter((item) => item.submission_id !== candidate.submission_id) }));
      const data = await request('/api/candidates/shortlisted', { token: authToken });
      setShortlisted(Array.isArray(data) ? data : data?.shortlisted_candidates || []);
    } catch (err) {
      setError(err.message || 'Unable to shortlist this candidate.');
    }
  }

  const remaining = candidateLimit == null ? null : Math.max(0, candidateLimit - shortlisted.filter((candidate) => candidate.requisition_id === selectedReqId).length);
  const detail = role(selected);


  return (
    <div className="page recruiter-page">
      {showDashboard && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <style>{`
            .bento-card-hover {
              position: relative;
              overflow: hidden;
            }
            .bento-card-hover::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              width: 100%;
              height: 2.5px;
              background-color: #0A0A0A;
              transform: scaleX(0);
              transform-origin: left center;
              transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .bento-card-hover:hover::after {
              transform: scaleX(1);
            }
            .custom-cand-scroll::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            .custom-cand-scroll::-webkit-scrollbar-track {
              background: #F5F5F2;
              border-radius: 9999px;
            }
            .custom-cand-scroll::-webkit-scrollbar-thumb {
              background: #D4D4CE;
              border-radius: 9999px;
            }
            .custom-cand-scroll::-webkit-scrollbar-thumb:hover {
              background: #0A0A0A;
            }
            .no-scrollbar::-webkit-scrollbar {
              display: none !important;
              width: 0px !important;
              height: 0px !important;
            }
            .no-scrollbar {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
            }
          `}</style>

          {/* ========================================================
              HERO WELCOME BANNER (MONOCHROME RECRUITER WORKSPACE)
             ======================================================== */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              border: '1px solid #E2E2DC',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
            }}
            className="relative p-6 sm:p-7 overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            {/* Subtle Geometric Concentric Line Art on Right */}
            <div className="absolute right-0 top-0 bottom-0 w-80 pointer-events-none opacity-40 overflow-hidden hidden sm:block">
              <svg className="w-full h-full" viewBox="0 0 320 160" fill="none">
                <circle cx="280" cy="80" r="70" stroke="#E5E5E0" strokeWidth="1" />
                <circle cx="280" cy="80" r="110" stroke="#EAEAE6" strokeWidth="1" />
                <circle cx="280" cy="80" r="150" stroke="#F0F0EC" strokeWidth="1" />
              </svg>
            </div>

            <div className="relative z-10 space-y-1.5 max-w-2xl">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#8A8A85] flex items-center gap-1.5">
                <span>TERM JOBS</span>
                <span className="inline-block w-1 h-1 rounded-full bg-[#8A8A85]" />
                <span>ACTIVE RECRUITER WORKSPACE</span>
              </div>
              <h1 className="text-[1.85rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                {(() => {
                  const hr = new Date().getHours();
                  const greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
                  const firstName = user?.name ? user.name.split(' ')[0] : 'Hashil';
                  return `${greeting}, ${firstName}.`;
                })()}
              </h1>
              <p className="text-[12.8px] text-[#737373] leading-relaxed pt-1">
                Recruiter Consultancy Portal. Manage client requisitions, match talent from your candidate bank, run AI-assisted screening, and move the strongest profiles forward.
              </p>
            </div>

            {/* Date and Status Badge on Right */}
            <div className="relative z-10 shrink-0 text-left md:text-right">
              <div className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-[11px] text-[#8A8A85] font-semibold mt-0.5">
                Workspace active
              </div>
            </div>
          </div>

          {/* ========================================================
              4 KPI METRIC CARDS (HORIZONTAL ROW WITH HOVER UNDERLINE)
             ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. ACTIVE JOB ROLES */}
            <div
              onClick={() => navigate('/dashboard/recruiter/requisitions')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
              className="p-5 space-y-2 bento-card-hover cursor-pointer transition-all hover:border-[#D5D5D0]"
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                ACTIVE JOB ROLES
              </div>
              <div className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                {requisitions.length}
              </div>
              <div className="text-[11.5px] text-[#737373] font-medium pt-1">
                Published by clients
              </div>
            </div>

            {/* 2. TALENT BANK */}
            <div
              onClick={() => navigate('/dashboard/recruiter/candidates')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
              className="p-5 space-y-2 bento-card-hover cursor-pointer transition-all hover:border-[#D5D5D0]"
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                TALENT BANK
              </div>
              <div className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                {bankCandidates.length}
              </div>
              <div className="text-[11.5px] text-[#737373] font-medium pt-1">
                Candidate profiles
              </div>
            </div>

            {/* 3. SHORTLISTED TO HR */}
            <div
              onClick={() => navigate('/dashboard/recruiter/shortlisted')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
              className="p-5 space-y-2 bento-card-hover cursor-pointer transition-all hover:border-[#D5D5D0]"
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                SHORTLISTED TO HR
              </div>
              <div className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                {shortlisted.length}
              </div>
              <div className="text-[11.5px] text-[#737373] font-medium pt-1">
                Delivered profiles
              </div>
            </div>

            {/* 4. INTERVIEW REQUESTS */}
            <div
              onClick={() => navigate('/dashboard/recruiter/interviews')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
              className="p-5 space-y-2 bento-card-hover cursor-pointer transition-all hover:border-[#D5D5D0]"
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                INTERVIEW REQUESTS
              </div>
              <div className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                {interviews.length}
              </div>
              <div className="text-[11.5px] text-[#737373] font-medium pt-1">
                Client pipeline
              </div>
            </div>
          </div>

          {/* ========================================================
              MAIN CONTENT: TWO COLUMN LAYOUT
             ======================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: ACTIVE CLIENT REQUISITIONS (65% width / col-span-8) */}
            <div className="lg:col-span-8 space-y-3.5">
              {/* Header Row */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-[1.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
                    Active Client Requisitions
                  </h2>
                  <p className="text-[12px] text-[#737373] font-medium mt-0.5">
                    Open roles published by client companies
                  </p>
                </div>

                <button
                  onClick={() => navigate('/dashboard/recruiter/requisitions')}
                  className="text-[12px] font-semibold text-[#8A8A85] hover:text-[#0A0A0A] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  View requisitions <ArrowRight size={12} />
                </button>
              </div>

              {/* Requisition Single Tab with Inbuilt Scroller (Unscreened on Top, Screened at Bottom) */}
              {requisitions.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                  }}
                  className="py-12 text-center text-[12.5px] text-[#8A8A85]"
                >
                  No active client requisitions published yet.
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                  }}
                  className="overflow-hidden"
                >
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-3 px-6 py-3.5 bg-[#FBFBFA] border-b border-[#F2F2EE] text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                    <div className="col-span-3">Company</div>
                    <div className="col-span-3">Hiring Manager</div>
                    <div className="col-span-3">Requisition</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  {/* Scrollable Line-by-Line Rows */}
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-[#F2F2EE] custom-cand-scroll">
                    {[...requisitions]
                      .sort((a, b) => {
                        const aScreened = Boolean(screenedReqSummary[a.id]);
                        const bScreened = Boolean(screenedReqSummary[b.id]);
                        if (aScreened === bScreened) return 0;
                        return aScreened ? 1 : -1; // Unscreened on top, Screened at bottom
                      })
                      .map((req) => {
                        const roleData = role(req);
                        const companyName = req.company_name || 'Bearitt';
                        const hmName = req.hiring_manager_name || req.manager_name || req.contact_name || req.created_by_name || 'Hiring Manager';
                        const reqTitle = roleData.title || req.title || 'Data Engineer';
                        const isScreened = Boolean(screenedReqSummary[req.id]);

                        return (
                          <div
                            key={req.id}
                            onClick={() => {
                              if (isScreened) {
                                setSelectedShortlistedCompany(companyName || 'ALL');
                                navigate('/dashboard/recruiter/shortlisted');
                              } else {
                                selectRequisition(req.id);
                                navigate('/dashboard/recruiter/requisitions');
                              }
                            }}
                            className="grid grid-cols-12 gap-3 items-center px-6 py-4 hover:bg-[#F9F9F8] transition-colors cursor-pointer group"
                          >
                            {/* 1. Company Name */}
                            <div className="col-span-3 min-w-0 flex items-center gap-2.5">
                              <div
                                style={{
                                  backgroundColor: '#0A0A0A',
                                  color: '#FFFFFF',
                                  borderRadius: 8,
                                  width: 30,
                                  height: 30,
                                }}
                                className="flex items-center justify-center font-black text-[11.5px] shrink-0 uppercase"
                              >
                                {companyName.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-extrabold text-[#0A0A0A] truncate group-hover:text-black">
                                  {companyName}
                                </div>
                                <div className="text-[11px] text-[#8A8A85] truncate font-medium">
                                  {req.location || roleData.location || 'Kozhikode'}
                                </div>
                              </div>
                            </div>

                            {/* 2. Hiring Manager Name */}
                            <div className="col-span-3 min-w-0">
                              <div className="text-[13px] font-bold text-[#0A0A0A] truncate">
                                {hmName}
                              </div>
                              <div className="text-[11px] text-[#8A8A85] truncate font-medium">
                                Client Lead
                              </div>
                            </div>

                            {/* 3. Requisition Title */}
                            <div className="col-span-3 min-w-0">
                              <div className="text-[13px] font-extrabold text-[#0A0A0A] truncate">
                                {reqTitle}
                              </div>
                              <div className="text-[11px] text-[#8A8A85] truncate font-medium">
                                {req.requisition_ref || (req.id ? `REQ-${req.id.slice(0, 6).toUpperCase()}` : 'REQ-ACTIVE')}
                              </div>
                            </div>

                            {/* 4. Status (Screened vs Published) - Monochrome */}
                            <div className="col-span-2 text-center">
                              {isScreened ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border bg-[#0A0A0A] text-[#FFFFFF] border-[#0A0A0A] shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-white" />
                                  Screened
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-[#F5F5F2] text-[#737373] border-[#E2E2DC]">
                                  <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-[#A1A1AA]" />
                                  Published
                                </span>
                              )}
                            </div>

                            {/* 5. Action */}
                            <div className="col-span-1 flex justify-end">
                              {isScreened ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedShortlistedCompany(companyName || 'ALL');
                                    navigate('/dashboard/recruiter/shortlisted');
                                  }}
                                  style={{
                                    backgroundColor: '#0A0A0A',
                                    color: '#FFFFFF',
                                    borderRadius: 8,
                                    width: 30,
                                    height: 30,
                                  }}
                                  className="flex items-center justify-center text-white hover:bg-[#262626] transition-colors shadow-2xs shrink-0 cursor-pointer"
                                  title="View Shortlisted Candidates"
                                >
                                  <ArrowRight size={13} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectRequisition(req.id);
                                    navigate('/dashboard/recruiter/requisitions');
                                  }}
                                  style={{
                                    backgroundColor: '#0A0A0A',
                                    color: '#FFFFFF',
                                    borderRadius: 8,
                                    width: 30,
                                    height: 30,
                                  }}
                                  className="flex items-center justify-center text-white hover:bg-[#262626] transition-colors shadow-2xs shrink-0 cursor-pointer"
                                  title="Match & Screen Candidates"
                                >
                                  <ArrowRight size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: WORKSPACE SNAPSHOT & LIVE NOTIFICATIONS (col-span-4) */}
            <div className="lg:col-span-4 space-y-4">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 22,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                }}
                className="p-5 space-y-4"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[1.05rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
                      Workspace Snapshot
                    </h2>
                    <p className="text-[11.5px] text-[#737373] font-medium mt-0.5">
                      Recruiter activity overview
                    </p>
                  </div>

                  <span
                    style={{
                      backgroundColor: '#F5F5F2',
                      borderRadius: 9999,
                      border: '1px solid #E5E5E0',
                    }}
                    className="px-2.5 py-0.5 text-[9.5px] font-extrabold text-[#0A0A0A] uppercase tracking-wider"
                  >
                    ACTIVE
                  </span>
                </div>

                {/* Key-Value Breakdown Rows */}
                <div className="divide-y divide-[#F2F2EE] text-[12px]">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Agency</span>
                    <span className="font-bold text-[#0A0A0A] lowercase">{user?.tenant_name || 'bridgeon'}</span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Published roles</span>
                    <span className="font-extrabold text-[#0A0A0A]">{requisitions.length}</span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Talent profiles</span>
                    <span className="font-extrabold text-[#0A0A0A]">{bankCandidates.length}</span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Screening ready</span>
                    <span className="font-extrabold text-[#0A0A0A]">{bankCandidates.length} / {bankCandidates.length}</span>
                  </div>
                </div>
              </div>

              {/* Live Alerts Card (Modern Monochrome Black & White UI) */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 22,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                }}
                className="p-5 space-y-3.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[13.5px] font-black text-[#0A0A0A] tracking-tight uppercase">
                      Live Alerts
                    </h3>
                    <p className="text-[11px] text-[#8A8A85] font-medium mt-0.5">
                      Pending recruiter actions & client updates
                    </p>
                  </div>

                  <span
                    style={{
                      backgroundColor: notifications.length ? '#0A0A0A' : '#F5F5F2',
                      color: notifications.length ? '#FFFFFF' : '#8A8A85',
                      borderRadius: 9999,
                    }}
                    className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    {notifications.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                    {notifications.length} {notifications.length === 1 ? 'ALERT' : 'ALERTS'}
                  </span>
                </div>

                {/* Compact Notification Items */}
                {notifications.length === 0 ? (
                  <div className="py-4 px-3 text-center bg-[#FBFBFA] rounded-xl border border-[#F2F2EE] text-[11.5px] text-[#8A8A85]">
                    No pending alerts right now.
                  </div>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-0.5 custom-cand-scroll">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (notif.reqId) selectRequisition(notif.reqId);
                          if (notif.actionUrl) navigate(notif.actionUrl);
                        }}
                        className="px-3 py-2 bg-[#FBFBFA] hover:bg-[#F5F5F2] border border-[#EAEAE6] hover:border-[#D5D5D0] rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-2.5"
                      >
                        {/* Left: Badge + Short Info */}
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 text-[9.5px] font-extrabold rounded-md border shrink-0 ${notif.badgeColor}`}
                          >
                            {notif.badge}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-extrabold text-[#0A0A0A] truncate leading-tight group-hover:text-black">
                              {notif.title}
                            </div>
                            <div className="text-[10.5px] text-[#8A8A85] truncate leading-tight mt-0.5 font-medium">
                              {notif.subtitle}
                            </div>
                          </div>
                        </div>

                        {/* Right: Action Pill & Dismiss */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: 6,
                            }}
                            className="px-2 py-1 text-[10px] font-extrabold group-hover:bg-[#262626] transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
                          >
                            {notif.actionLabel}
                            <ArrowRight size={10} />
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDismissedNotifIds((prev) => new Set([...prev, notif.id]));
                            }}
                            className="text-[#A1A1AA] hover:text-[#0A0A0A] p-0.5 rounded hover:bg-[#EAEAE6] transition-colors cursor-pointer"
                            title="Dismiss notification"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showRequisitions && (
        <section className="recruiter-workspace-stacked" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 1. RECRUITER WORKSPACE HEADER */}
          <div className="shrink-0 space-y-0.5 mb-0.5">
            <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-[#8A8A85]">
              RECRUITER WORKSPACE
            </div>
            <h1 className="text-[1.85rem] sm:text-[2.15rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
              Requisitions
            </h1>
            <p className="text-[12.5px] text-[#737373] font-medium pt-0.5">
              Pick a client role, then review candidates for that role.
            </p>
          </div>

          {/* 2. BLACK ROLE HERO BANNER */}
          <div
            style={{
              backgroundColor: '#0A0A0A',
              borderRadius: 18,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            }}
            className="shrink-0 p-3.5 sm:p-4 md:p-4.5 text-white relative overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-center">
              <div className="lg:col-span-5 flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#0A0A0A',
                        borderRadius: 9999,
                      }}
                      className="px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider inline-block shadow-2xs"
                    >
                      {selected?.status ? String(selected.status).toUpperCase() : 'PUBLISHED'}
                    </span>

                    <span
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#0A0A0A',
                        borderRadius: 9999,
                      }}
                      className="px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider inline-block shadow-2xs"
                    >
                      {selected?.company_name || selected?.company?.name || 'Bearitt'}
                    </span>
                  </div>

                  <h2 className="text-[1.5rem] sm:text-[1.75rem] font-extrabold text-white tracking-tight leading-tight mt-1 mb-0.5">
                    {selected?.title || 'UI/UX Designer'}
                  </h2>

                  <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3] font-medium mt-0.5 flex-wrap">
                    <span className="capitalize">{detail.work_model || 'Hybrid'}</span>
                    <span className="inline-block w-1 h-1 rounded-full bg-[#737373]" />
                    <span>{detail.openings || 1} {Number(detail.openings || 1) === 1 ? 'opening' : 'openings'}</span>
                  </div>
                </div>

                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowJdDetails(true)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: '#0A0A0A',
                      borderRadius: 12,
                    }}
                    className="w-full sm:w-auto px-4.5 py-1.5 text-[12px] font-extrabold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs group"
                  >
                    <span>View details</span>
                    <ArrowRight size={13} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                  }}
                  className="p-2.5 sm:p-3 flex flex-col justify-center space-y-1"
                >
                  <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#8A8A85]">
                    RATE
                  </span>
                  <span className="text-[14.5px] sm:text-[16px] font-extrabold text-white tracking-tight">
                    {detail.rate_card_cap || detail.range_vendors_see || (selected?.structured_role?.ceiling_internal ? `${selected.structured_role.ceiling_internal}L` : '1350')}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                  }}
                  className="p-2.5 sm:p-3 flex flex-col justify-center space-y-1"
                >
                  <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#8A8A85]">
                    DURATION
                  </span>
                  <span className="text-[13.5px] sm:text-[15px] font-extrabold text-white tracking-tight">
                    {detail.duration || detail.contract_duration || '6 months'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                  }}
                  className="p-2.5 sm:p-3 flex flex-col justify-center space-y-1"
                >
                  <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#8A8A85]">
                    NOTICE
                  </span>
                  <span className="text-[13.5px] sm:text-[15px] font-extrabold text-white tracking-tight">
                    {detail.max_notice_period || detail.notice_period || '30 days'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                  }}
                  className="p-2.5 sm:p-3 flex flex-col justify-center space-y-1"
                >
                  <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#8A8A85]">
                    DEADLINE
                  </span>
                  <span className="text-[13.5px] sm:text-[15px] font-extrabold text-white tracking-tight">
                    {detail.submission_deadline || detail.deadline || '2026-08-31'}
                  </span>
                </div>
              </div>
            </div>
          </div>

{/* Limit Reached Modal Popup */}
          {/* 2-Second Floating Limit Toast Notification */}
          {limitToast && (
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-6 duration-200">
              <div
                style={{
                  backgroundColor: '#0A0A0A',
                  color: '#FFFFFF',
                  borderRadius: 16,
                  border: '1px solid #262626',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
                }}
                className="px-5 py-3.5 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle size={18} strokeWidth={2.5} />
                </div>
                <div className="text-left pr-2">
                  <div className="text-[13px] font-extrabold text-[#FFFFFF] tracking-tight">
                    Maximum Shortlist Limit Reached
                  </div>
                  <div className="text-[11.5px] text-[#A1A1AA] font-medium mt-0.5 max-w-sm">
                    {limitToast}
                  </div>
                </div>
              </div>
            </div>
          )}

          {limitReachedModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 22,
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
                  maxWidth: 480,
                  width: '100%',
                }}
                className="p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertCircle size={24} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-extrabold text-[#0A0A0A] tracking-tight">
                      {limitReachedModal.title || 'Maximum Shortlist Limit Reached'}
                    </h3>
                    <p className="text-[12.5px] text-[#64748B] font-medium mt-0.5">
                      Requisition: <strong className="text-[#0A0A0A] font-bold">{selected?.title || 'Selected Role'}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLimitReachedModal(null)}
                    className="text-[#8A8A85] hover:text-[#0A0A0A] p-1 rounded-lg hover:bg-[#F5F5F2] cursor-pointer transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2 text-[13px] text-amber-950 leading-relaxed">
                  <p className="font-bold">
                    {limitReachedModal.message}
                  </p>
                  <p className="text-[12px] text-amber-900/80 font-normal">
                    The Super Admin has set a submission cap of <strong>{limitReachedModal.limit} candidates</strong> for this requisition. To shortlist <strong>{limitReachedModal.candidateName || 'this candidate'}</strong>, please remove or reject an existing shortlisted submission first.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F2F2EE]">
                  <button
                    type="button"
                    onClick={() => setLimitReachedModal(null)}
                    style={{
                      backgroundColor: '#F5F5F2',
                      color: '#4B5563',
                      borderRadius: 12,
                    }}
                    className="px-4 py-2 text-[12.5px] font-bold hover:bg-[#EAEAE6] cursor-pointer transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLimitReachedModal(null);
                      navigate('/dashboard/recruiter/shortlisted');
                    }}
                    style={{
                      backgroundColor: '#0A0A0A',
                      color: '#FFFFFF',
                      borderRadius: 12,
                    }}
                    className="px-5 py-2 text-[12.5px] font-extrabold hover:bg-[#262626] cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <span>View Shortlisted</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Details Modal */}
          {showJdDetails && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 22,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  maxWidth: 720,
                  width: '100%',
                }}
                className="p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="flex items-start justify-between border-b border-[#F2F2EE] pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-[#ECFDF5] text-[#059669] text-[10px] font-extrabold rounded-full uppercase">
                        {selected?.status || 'PUBLISHED'}
                      </span>
                      <span className="text-[12px] text-[#8A8A85] font-medium">
                        {selected?.company_name || selected?.company?.name || 'Bearitt'}
                      </span>
                    </div>
                    <h3 className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                      {selected?.title || 'Job Description'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowJdDetails(false)}
                    className="text-[#8A8A85] hover:text-[#0A0A0A] p-1.5 rounded-lg hover:bg-[#F5F5F2] cursor-pointer flex items-center justify-center transition-colors"
                    aria-label="Close"
                  >
                    <X size={18} strokeWidth={2.2} />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-cand-scroll pr-1">
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[#FBFBFA] rounded-xl border border-[#EAEAE6]">
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">RATE</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.rate_card_cap || detail.range_vendors_see || '1350'}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">DURATION</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.duration || detail.contract_duration || '6 months'}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">NOTICE PERIOD</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.max_notice_period || detail.notice_period || '30 days'}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">DEADLINE</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.submission_deadline || detail.deadline || '2026-08-31'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[#FBFBFA] rounded-xl border border-[#EAEAE6]">
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">CITY / LOCATION</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.location || selected?.location || selected?.structured_role?.location || 'Remote'}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">WORK MODEL</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A] capitalize">{detail.work_model || selected?.work_model || selected?.structured_role?.work_model || 'Hybrid'}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">EXPERIENCE</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.experience || detail.seniority || selected?.experience || selected?.structured_role?.experience || '3–6 yrs'}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[9.5px] font-extrabold uppercase text-[#8A8A85]">OPENINGS</div>
                        <div className="text-[13.5px] font-extrabold text-[#0A0A0A]">{detail.openings || 1} {Number(detail.openings || 1) === 1 ? 'position' : 'positions'}</div>
                      </div>
                    </div>
                  </div>

                  {skillsFor(selected).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                        REQUIRED SKILLS & TECH STACK
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {skillsFor(selected).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2.5 py-1 bg-[#F1F5F9] text-[#334155] rounded-lg text-[12px] font-semibold"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                      JOB DESCRIPTION & REQUIREMENTS
                    </div>
                    <div className="p-4 bg-[#F8F8F6] rounded-xl border border-[#EAEAE6] text-[12.5px] text-[#334155] leading-relaxed whitespace-pre-wrap font-sans">
                      {jdText || selected?.description || 'No detailed job description text provided.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F2F2EE]">
                  <button
                    type="button"
                    onClick={() => setShowJdDetails(false)}
                    style={{
                      borderRadius: 12,
                      backgroundColor: '#0A0A0A',
                      color: '#FFFFFF',
                    }}
                    className="px-5 py-2 text-[12.5px] font-bold hover:bg-[#262626] cursor-pointer shadow-2xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. UNIFIED WORKSPACE CARD */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              border: '1px solid #E2E2DC',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.02)',
              marginBottom: '16px',
            }}
            className="p-4 sm:p-5 space-y-4"
          >
            {/* Top Workspace Tab Switcher Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F2F2EE] pb-3.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceActiveTab('requirements')}
                  style={{
                    backgroundColor: workspaceActiveTab === 'requirements' ? '#0A0A0A' : '#F5F5F2',
                    color: workspaceActiveTab === 'requirements' ? '#FFFFFF' : '#4B5563',
                    borderRadius: 14,
                  }}
                  className="px-5 py-2.5 text-[13px] font-extrabold cursor-pointer transition-all hover:opacity-95 shadow-2xs"
                >
                  Open Requirements
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceActiveTab('candidates')}
                  style={{
                    backgroundColor: workspaceActiveTab === 'candidates' ? '#0A0A0A' : '#F5F5F2',
                    color: workspaceActiveTab === 'candidates' ? '#FFFFFF' : '#4B5563',
                    borderRadius: 14,
                  }}
                  className="px-5 py-2.5 text-[13px] font-extrabold cursor-pointer transition-all hover:opacity-95 shadow-2xs flex items-center gap-2"
                >
                  <span>Candidate Pool</span>
                  {selectedCandidateIds.length > 0 && (
                    <span
                      style={{
                        backgroundColor: workspaceActiveTab === 'candidates' ? '#FFFFFF' : '#0A0A0A',
                        color: workspaceActiveTab === 'candidates' ? '#0A0A0A' : '#FFFFFF',
                      }}
                      className="w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center"
                    >
                      {selectedCandidateIds.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="text-[12.5px] text-[#8A8A85] font-medium">
                {workspaceActiveTab === 'requirements' ? (
                  <span>Select a requirement to view candidates</span>
                ) : (
                  <span>Screen candidates for the selected requirement</span>
                )}
              </div>
            </div>


            {/* SCREENING PROGRESS BAR — visible above both tabs */}
            {screening && (
              <div
                style={{
                  background: '#0a0f1d',
                  border: '1px solid #1e293b',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  marginBottom: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#f8fafc',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {screeningProgress.pct >= 100
                      ? 'Finalising results...'
                      : `Processing candidates (${screeningProgress.pct}%)...`}
                  </span>
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#38bdf8',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {screeningProgress.processed} / {screeningProgress.total}
                  </span>
                </div>

                <div
                  style={{
                    height: '5px',
                    background: '#1e293b',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    marginBottom: '16px',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${screeningProgress.pct}%`,
                      background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease-in-out',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {['Extract', 'LLM Structure', 'GitHub Agent', 'Score', 'Rank'].map((stageName, idx, arr) => {
                    const isCurrent = screeningProgress.stage === stageName;
                    const stageOrder = ['Extract', 'LLM Structure', 'GitHub Agent', 'Score', 'Rank'];
                    const currentIdx = stageOrder.indexOf(screeningProgress.stage);
                    const isPassed = currentIdx > idx;

                    return (
                      <Fragment key={stageName}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontWeight: 600,
                            background: isCurrent
                              ? 'rgba(56, 189, 248, 0.2)'
                              : isPassed
                                ? 'rgba(37, 99, 235, 0.15)'
                                : 'rgba(30, 41, 59, 0.6)',
                            border: isCurrent
                              ? '1px solid #38bdf8'
                              : isPassed
                                ? '1px solid #2563eb'
                                : '1px solid #1e293b',
                            color: isCurrent ? '#38bdf8' : isPassed ? '#93c5fd' : '#64748b',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {stageName}
                        </span>
                        {idx < arr.length - 1 && (
                          <span style={{ color: '#334155', fontSize: '10px' }}>→</span>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 1: OPEN REQUIREMENTS */}
            {workspaceActiveTab === 'requirements' && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight">
                    Open requirements
                  </h2>
                  <span className="text-[12px] text-[#8A8A85] font-medium">
                    {visibleRequisitions.length} roles · grouped by company
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative shrink-0 w-full sm:w-56">
                    <select
                      value={selectedCompanyTab}
                      onChange={(e) => setSelectedCompanyTab(e.target.value)}
                      style={{
                        borderRadius: 12,
                        border: '1px solid #E2E2DC',
                        backgroundColor: '#FFFFFF',
                      }}
                      className="w-full appearance-none px-4 py-2 text-[13px] font-extrabold text-[#0A0A0A] cursor-pointer focus:outline-none focus:border-[#0A0A0A] transition-colors pr-9 shadow-2xs"
                    >
                      {companyTabs.map((tab) => (
                        <option key={tab.name} value={tab.name}>
                          {tab.name === 'All' ? `All companies` : `${tab.name} (${tab.count})`}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8A8A85]">
                      <ChevronDown size={15} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search role or skill..."
                      style={{
                        borderRadius: 12,
                        border: '1px solid #E2E2DC',
                        backgroundColor: '#FFFFFF',
                      }}
                      className="w-full pl-4 pr-9 py-2 text-[13px] text-[#0A0A0A] placeholder-[#8A8A85] focus:outline-none focus:border-[#0A0A0A] transition-colors shadow-2xs"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A85] hover:text-[#0A0A0A] cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: '345px',
                    overflowY: 'auto',
                  }}
                  className="space-y-3 pt-1 custom-cand-scroll pr-1.5"
                >
                  {loading ? (
                    <div className="p-8 text-center text-[#8A8A85] text-sm">
                      Loading requirements...
                    </div>
                  ) : groupedRequisitions.length === 0 ? (
                    <div className="p-8 text-center text-[#8A8A85] text-sm bg-[#FBFBFA] rounded-2xl border border-[#EAEAE6]">
                      No open requirements found matching your search.
                    </div>
                  ) : (
                    groupedRequisitions.map((group) => {
                      const compInitial = (group.companyName || 'B').charAt(0).toUpperCase();
                      return (
                        <div
                          key={group.companyName}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            border: '1px solid #E2E2DC',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                          }}
                          className="p-4 sm:p-5 flex flex-col md:flex-row gap-5 items-stretch"
                        >
                          <div className="md:w-44 shrink-0 flex md:flex-col items-center md:items-start justify-between md:justify-start gap-3 border-b md:border-b-0 md:border-r border-[#F2F2EE] pb-3 md:pb-0 md:pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] text-white font-extrabold flex items-center justify-center text-xs shadow-2xs">
                                {compInitial}
                              </div>
                              <div>
                                <div className="text-[14px] font-extrabold text-[#0A0A0A]">
                                  {group.companyName}
                                </div>
                                <div className="text-[11.5px] text-[#8A8A85] font-medium">
                                  {group.items.length} {group.items.length === 1 ? 'role' : 'roles'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 space-y-3 divide-y divide-[#F2F2EE]">
                            {group.items.map((req, reqIdx) => {
                              const isSelected = selectedReqId === req.id;
                              const sr = req.structured_role || {};
                              const skills = skillsFor(req).slice(0, 5);
                              const rateVal = sr.rate_card_cap || (Array.isArray(sr.rate_band) ? `${sr.rate_band[0]} - ${sr.rate_band[1]}` : sr.rate_band) || sr.range_vendors_see || (sr.ceiling_internal ? `${sr.ceiling_internal}L` : '2400');
                              const durationVal = short(sr.duration || sr.contract_duration || req.duration, '6 mo');
                              const workModelVal = sr.work_model || req.work_model || 'Hybrid';
                              const expVal = sr.experience || sr.seniority || req.experience || '4+ years';

                              return (
                                <div
                                  key={req.id || reqIdx}
                                  onClick={() => selectRequisition(req.id)}
                                  style={{
                                    backgroundColor: isSelected ? '#FBFBFA' : 'transparent',
                                  }}
                                  className={`pt-3 first:pt-0 pb-1 rounded-xl px-3 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group relative ${isSelected ? 'ring-1 ring-[#0A0A0A]/10' : 'hover:bg-[#F9F9F7]'
                                    }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      style={{
                                        width: 3.5,
                                        minHeight: 36,
                                        backgroundColor: isSelected ? '#0A0A0A' : 'transparent',
                                        borderRadius: 4,
                                      }}
                                      className="shrink-0 transition-colors"
                                    />

                                    <div className="space-y-1.5">
                                      <h3 className="text-[15px] font-extrabold text-[#0A0A0A] tracking-tight group-hover:text-[#0A0A0A]">
                                        {req.title || 'Machine Learning Engineer'}
                                      </h3>

                                      <div className="text-[12px] text-[#8A8A85] font-medium flex items-center gap-1.5">
                                        <span className="capitalize">{workModelVal}</span>
                                        <span>·</span>
                                        <span>{expVal}</span>
                                      </div>

                                      {skills.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                          {skills.map((s, sIdx) => (
                                            <span
                                              key={sIdx}
                                              className="px-2.5 py-0.5 bg-[#F4F4F0] text-[#4B5563] text-[11px] font-semibold rounded-md border border-[#EAEAE6]"
                                            >
                                              {s}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                                    {/* Per-row Filter selector */}
                                    <div className="relative">
                                      <select
                                        value={rowFilterModes[req.id] || 'all'}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const val = e.target.value;
                                          setRowFilterModes((prev) => ({ ...prev, [req.id]: val }));
                                          setAutoScreenFilterMode(val);
                                          setAutoScreenStatus(null);
                                        }}
                                        style={{
                                          backgroundColor: '#F5F5F2',
                                          border: '1px solid #E2E2DC',
                                          borderRadius: 9999,
                                          color: '#4B5563',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          padding: '5px 24px 5px 10px',
                                          cursor: 'pointer',
                                          appearance: 'none',
                                          whiteSpace: 'nowrap',
                                        }}
                                        className="focus:outline-none shadow-2xs"
                                      >
                                        <option value="all">All eligible</option>
                                        <option value="exclude_accepted">Excl. accepted</option>
                                      </select>
                                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: '#8A8A85', pointerEvents: 'none' }}>▼</span>
                                    </div>

                                    {/* Per-row AI Screening button — passes req.id directly, no state race */}
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const mode = rowFilterModes[req.id] || 'all';
                                          setSelectedReqId(req.id);
                                          const reqObj = requisitions.find((item) => item.id === req.id);
                                          if (reqObj) {
                                            setFullReq(reqObj);
                                            setJdText(formatJd(reqObj));
                                          }
                                          await runAutoScreening(req.id, mode);
                                        } catch (err) {
                                          console.error('[AI Screen] Error:', err);
                                          setError(err.message || 'AI screening failed.');
                                        }
                                      }}
                                      disabled={screening}
                                      style={{
                                        background: screening ? '#E2E2DC' : '#0A0A0A',
                                        color: screening ? '#8A8A85' : '#FFFFFF',
                                        borderRadius: 9999,
                                        border: 'none',
                                        padding: '5px 14px',
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        cursor: screening ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        whiteSpace: 'nowrap',
                                        boxShadow: screening ? 'none' : '0 2px 8px rgba(0,0,0,0.18)',
                                      }}
                                    >
                                      {screening && selectedReqId === req.id ? (
                                        <><span style={{ fontSize: 11 }}>⟳</span><span>Screening…</span></>
                                      ) : (
                                        <><span style={{ fontSize: 10 }}>✦</span><span>AI Screen</span></>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CANDIDATE POOL */}
            {workspaceActiveTab === 'candidates' && (
              <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                {/* Header Row: Candidate Pool Title + Search + Requirements Back Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight">
                      Candidate pool
                    </h2>
                    <p className="text-[12px] text-[#8A8A85] font-medium mt-0.5">
                      For <strong className="text-[#0A0A0A] font-semibold">{selected?.title || 'Selected role'}</strong> - select candidates to screen
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-48 sm:w-56">
                      <input
                        type="text"
                        value={reqCandidateSearch}
                        onChange={(e) => setReqCandidateSearch(e.target.value)}
                        placeholder="Search candidates..."
                        style={{
                          borderRadius: 12,
                          border: '1px solid #E2E2DC',
                          backgroundColor: '#FFFFFF',
                        }}
                        className="w-full pl-3.5 pr-8 py-2 text-[12.5px] text-[#0A0A0A] placeholder-[#8A8A85] focus:outline-none focus:border-[#0A0A0A] transition-colors shadow-2xs"
                      />
                      {reqCandidateSearch && (
                        <button
                          type="button"
                          onClick={() => setReqCandidateSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8A85] hover:text-[#0A0A0A] cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setWorkspaceActiveTab('requirements')}
                      style={{
                        borderRadius: 12,
                        border: '1px solid #E2E2DC',
                        backgroundColor: '#FFFFFF',
                      }}
                      className="px-3.5 py-2 text-[12.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                    >
                      <span>—</span>
                      <span>Requirements</span>
                    </button>
                  </div>
                </div>

                {/* Header bar aligned with candidate row columns */}
                <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.2fr_110px] items-center gap-4 px-3.5 pt-1 pb-1.5 text-[12px] text-[#8A8A85] font-medium border-b border-[#F2F2EE]">
                  {/* Col 1: Select all */}
                  <div className="min-w-0">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filteredReqCandidates.length > 0 && selectedCandidateIds.length === filteredReqCandidates.length}
                        onChange={toggleSelectAllCandidates}
                        className="w-4 h-4 rounded border-[#D4D4CE] accent-[#0A0A0A] cursor-pointer shrink-0"
                      />
                      <span className="text-[#0A0A0A] font-bold text-[12.5px]">Select all</span>
                      <span className="text-[11.5px] text-[#8A8A85]">({filteredReqCandidates.length} available)</span>
                    </label>
                  </div>

                  {/* Col 2: Company & Contact Header */}
                  <div className="hidden sm:block min-w-0">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#A3A3A3]">Company & Contact</span>
                  </div>

                  {/* Col 3: Skills Header */}
                  <div className="hidden sm:block min-w-0">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#A3A3A3]">Skills</span>
                  </div>

                  {/* Col 4: Action Header */}
                  <div className="hidden sm:flex justify-end pr-1">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#A3A3A3]">Resume</span>
                  </div>
                </div>

                {screening && (
                  <div
                    style={{
                      background: '#0a0f1d',
                      border: '1px solid #1e293b',
                      borderRadius: '16px',
                      padding: '20px 24px',
                      marginBottom: '16px',
                      marginTop: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#f8fafc',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {screeningProgress.pct >= 100
                          ? 'Finalising results...'
                          : `Processing candidates (${screeningProgress.pct}%)...`}
                      </span>
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#38bdf8',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {screeningProgress.processed} / {screeningProgress.total}
                      </span>
                    </div>

                    <div
                      style={{
                        height: '5px',
                        background: '#1e293b',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        marginBottom: '16px',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${screeningProgress.pct}%`,
                          background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
                          borderRadius: '999px',
                          transition: 'width 0.4s ease-in-out',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {['Extract', 'LLM Structure', 'GitHub Agent', 'Score', 'Rank'].map((stageName, idx, arr) => {
                        const isCurrent = screeningProgress.stage === stageName;
                        const stageOrder = ['Extract', 'LLM Structure', 'GitHub Agent', 'Score', 'Rank'];
                        const currentIdx = stageOrder.indexOf(screeningProgress.stage);
                        const isPassed = currentIdx > idx;

                        return (
                          <Fragment key={stageName}>
                            <span
                              style={{
                                fontSize: '11.5px',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontWeight: 600,
                                background: isCurrent
                                  ? 'rgba(56, 189, 248, 0.2)'
                                  : isPassed
                                    ? 'rgba(37, 99, 235, 0.15)'
                                    : 'rgba(30, 41, 59, 0.6)',
                                border: isCurrent
                                  ? '1px solid #38bdf8'
                                  : isPassed
                                    ? '1px solid #2563eb'
                                    : '1px solid #1e293b',
                                color: isCurrent ? '#38bdf8' : isPassed ? '#93c5fd' : '#64748b',
                                transition: 'all 0.3s ease',
                              }}
                            >
                              {stageName}
                            </span>
                            {idx < arr.length - 1 && (
                              <span style={{ color: '#475569', fontSize: '12px' }}>→</span>
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Candidate Rows Container with hidden scrollbar */}
                <div
                  style={{
                    maxHeight: '276px',
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                  className="space-y-0.5 no-scrollbar divide-y divide-[#F2F2EE]"
                >
                  {filteredReqCandidates.length === 0 ? (
                    <div className="p-8 text-center text-[#8A8A85] text-sm bg-[#FBFBFA] rounded-2xl border border-[#EAEAE6]">
                      No candidates found in repository.
                    </div>
                  ) : (
                    filteredReqCandidates.map((candidate) => {
                      const isSelected = selectedCandidateIds.includes(candidate.id);

                      return (
                        <div
                          key={candidate.id}
                          onClick={() => toggleCandidateSelect(candidate.id)}
                          style={{
                            backgroundColor: isSelected ? '#FBFBFA' : '#FFFFFF',
                          }}
                          className={`py-3 px-3.5 rounded-xl transition-colors cursor-pointer grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.2fr_110px] items-center gap-4 group ${isSelected ? 'bg-[#FBFBFA]' : 'hover:bg-[#F9F9F7]'
                            }`}
                        >
                          {/* Col 1: Checkbox + Name + Title */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCandidateSelect(candidate.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-[#D4D4CE] accent-[#0A0A0A] cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-extrabold text-[#0A0A0A] tracking-tight truncate group-hover:text-[#0A0A0A]">
                                {candidate.candidate_name || 'Candidate'}
                              </div>
                              <div className="text-[11.5px] text-[#8A8A85] font-medium truncate mt-0.5">
                                {candidate.candidate_title || 'Talent Profile'}
                              </div>
                            </div>
                          </div>

                          {/* Col 2: Company & Contact */}
                          <div className="hidden sm:block text-left min-w-0">
                            <div className="text-[12px] font-semibold text-[#4A4A45] truncate">
                              {candidate.vendor_company_name || 'bridgeon'}
                            </div>
                            <div className="text-[11px] text-[#8A8A85] font-medium truncate mt-0.5">
                              {candidate.candidate_email || candidate.candidate_phone || 'Verified Profile'}
                            </div>
                          </div>

                          {/* Col 3: Skill Pills */}
                          <div className="hidden sm:flex items-center gap-1.5 flex-wrap min-w-0 justify-start">
                            {(candidate.skills || []).slice(0, 3).map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                style={{
                                  backgroundColor: '#F5F5F2',
                                  color: '#4A4A45',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold tracking-tight inline-block"
                              >
                                {skill}
                              </span>
                            ))}
                            {(candidate.skills || []).length > 3 && (
                              <span className="text-[11px] text-[#8A8A85] font-semibold px-1">
                                +{(candidate.skills || []).length - 3}
                              </span>
                            )}
                            {(!candidate.skills || candidate.skills.length === 0) && (
                              <span className="text-[11px] text-[#8A8A85] italic">
                                Profile stored
                              </span>
                            )}
                          </div>

                          {/* Col 4: Action - View Original PDF */}
                          <div className="flex items-center justify-end pr-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenResumeModal(candidate);
                              }}
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E2DC',
                                borderRadius: 10,
                              }}
                              className="px-3 py-1.5 text-[11.5px] font-bold text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-[#FFFFFF] hover:border-[#0A0A0A] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs group/btn whitespace-nowrap"
                            >
                              <FileText size={13} className="text-[#8A8A85] group-hover/btn:text-white transition-colors shrink-0" />
                              <span>View PDF</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Bar: Selected Count + Run AI Screening Button */}
                <div className="flex items-center justify-between pt-3 border-t border-[#F2F2EE]">
                  <div className="text-[12.5px] text-[#8A8A85] font-semibold">
                    <strong className="text-[#0A0A0A] font-extrabold">{selectedCandidateIds.length}</strong> selected
                  </div>

                  <button
                    type="button"
                    onClick={runBulkScreening}
                    disabled={screening || selectedCandidateIds.length === 0}
                    style={{
                      backgroundColor: selectedCandidateIds.length > 0 ? '#0A0A0A' : '#E2E2DC',
                      color: selectedCandidateIds.length > 0 ? '#FFFFFF' : '#8A8A85',
                      borderRadius: 12,
                    }}
                    className={`px-5 py-2 text-[12.5px] font-extrabold transition-all flex items-center gap-1.5 shadow-2xs ${selectedCandidateIds.length > 0
                      ? 'cursor-pointer hover:bg-[#262626] opacity-100'
                      : 'cursor-not-allowed opacity-80'
                      }`}
                  >
                    <span>Run AI screening</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* AI Screened Candidates List Section */}
          <section
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              border: '1px solid #E2E2DC',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.02)',
              marginTop: '12px',
            }}
            className="p-4 sm:p-5 space-y-4"
          >
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F2F2EE] pb-3.5">
              <div>
                <h2 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight flex items-center gap-2">
                  <span>AI Screened Candidates</span>
                </h2>
                <p className="text-[12px] text-[#8A8A85] font-medium mt-0.5">
                  Screened results & AI match scores for <strong className="text-[#0A0A0A] font-semibold">{selected?.title || 'Selected Role'}</strong>
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#F5F5F2',
                  border: '1px solid #E2E2DC',
                  borderRadius: 12,
                }}
                className="px-3.5 py-1.5 text-[12px] font-extrabold text-[#0A0A0A] self-start sm:self-auto shadow-2xs"
              >
                Total Screened: {screenedSubmissions.length}
              </div>
            </div>

            {sortedScreenedSubmissions.length ? (
              <div className="space-y-3">
                {sortedScreenedSubmissions.map((sub) => {
                  const subId = sub.id || sub.submission_id || sub.candidate_id;
                  const isExpanded = expandedScreenedId === subId;
                  const score = sub.match_score || 0;
                  const statusLower = (sub.status || '').toLowerCase();
                  const isAccepted = statusLower === 'accepted' || statusLower === 'hired' || statusLower === 'completed';
                  const isShortlisted = statusLower === 'shortlisted' || statusLower === 'under review';
                  const isRejected = statusLower === 'rejected';

                  const targetCandidateId = sub.candidate_id || (String(sub.id).startsWith('temp_') ? String(sub.id).replace('temp_', '') : sub.id);
                  const matchedSkillsList = sub.matched_skills && sub.matched_skills.length ? sub.matched_skills : (sub.skills || []).slice(0, 5);
                  const missingSkillsList = sub.missing_skills || [];
                  const breakdown = sub.breakdown || {};

                  return (
                    <div
                      key={subId}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: isExpanded ? '1px solid #0A0A0A' : isAccepted ? '1px solid #059669' : isShortlisted ? '1px solid #0A0A0A' : isRejected ? '1px solid #FECACA' : '1px solid #E2E2DC',
                        borderRadius: 16,
                        boxShadow: isExpanded ? '0 4px 16px rgba(0, 0, 0, 0.06)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                      }}
                      className="transition-all overflow-hidden"
                    >
                      {/* Top Clickable Header */}
                      <div
                        onClick={() => setExpandedScreenedId(isExpanded ? null : subId)}
                        style={{
                          backgroundColor: isExpanded ? '#FBFBFA' : '#FFFFFF',
                        }}
                        className="p-4 sm:p-4.5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-[#FBFBFA]"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Monochrome Avatar */}
                          <div
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: 14,
                            }}
                            className="w-11 h-11 font-extrabold text-[13px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs"
                          >
                            {(sub.candidate_name || '?').slice(0, 2).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-[14px] font-extrabold text-[#0A0A0A] tracking-tight">
                                {sub.candidate_name}
                              </span>

                              <span
                                style={{
                                  backgroundColor: '#0A0A0A',
                                  color: '#FFFFFF',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-0.5 text-[11px] font-extrabold tracking-tight inline-flex items-center gap-1 shadow-2xs"
                              >
                                <span>⚡</span>
                                <span>{score}% Match</span>
                              </span>

                              <span
                                style={{
                                  backgroundColor: '#F5F5F2',
                                  color: '#4A4A45',
                                  borderRadius: 8,
                                  border: '1px solid #E2E2DC',
                                }}
                                className="px-2.5 py-0.5 text-[11px] font-bold"
                              >
                                {sub.recommendation || (score >= 70 ? 'Strong Match' : score >= 50 ? 'Moderate Match' : 'Weak Match')}
                              </span>
                            </div>

                            <div className="text-[12px] text-[#8A8A85] font-medium mt-1 flex items-center gap-3 flex-wrap">
                              {sub.candidate_email && (
                                <span>{sub.candidate_email}</span>
                              )}
                              <span>•</span>
                              <span>Vendor: <strong className="text-[#0A0A0A] font-semibold">{sub.vendor_name || 'bridgeon'}</strong></span>
                              {sub.filename && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[200px]">📄 {sub.filename}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div
                          className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isAccepted ? (
                            <span
                              style={{
                                backgroundColor: '#059669',
                                color: '#FFFFFF',
                                borderRadius: 12,
                              }}
                              className="px-4 py-2 text-[12px] font-bold flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>✓</span>
                              <span>Selected by HR (Onboarding)</span>
                            </span>
                          ) : isShortlisted ? (
                            <span
                              style={{
                                backgroundColor: '#0A0A0A',
                                color: '#FFFFFF',
                                borderRadius: 12,
                              }}
                              className="px-4 py-2 text-[12px] font-bold flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>✓</span>
                              <span>✓ Shortlisted</span>
                            </span>
                          ) : isRejected ? (
                            <span
                              style={{
                                backgroundColor: '#F5F5F2',
                                color: '#8A8A85',
                                border: '1px solid #E2E2DC',
                                borderRadius: 12,
                              }}
                              className="px-4 py-2 text-[12px] font-bold flex items-center gap-1.5 line-through"
                            >
                              <span>✕</span>
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => updateCandidateStatus(sub, 'Shortlisted')}
                                style={{
                                  backgroundColor: '#0A0A0A',
                                  color: '#FFFFFF',
                                  borderRadius: 12,
                                }}
                                className="px-4 py-2 text-[12px] font-extrabold hover:bg-[#262626] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <span>⭐</span>
                                <span>Shortlist (Submit to HR)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateCandidateStatus(sub, 'Rejected')}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  color: '#737373',
                                  border: '1px solid #E2E2DC',
                                  borderRadius: 12,
                                }}
                                className="px-3.5 py-2 text-[12px] font-bold hover:text-[#0A0A0A] hover:bg-[#F5F5F2] transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span>✕</span>
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedScreenedId(isExpanded ? null : subId)}
                            style={{
                              backgroundColor: isExpanded ? '#0A0A0A' : '#F5F5F2',
                              color: isExpanded ? '#FFFFFF' : '#0A0A0A',
                              border: isExpanded ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                              borderRadius: 12,
                            }}
                            className="px-3.5 py-2 text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <span>{isExpanded ? '▲ Hide Details' : '▼ Details & Breakdown'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Full Details & Scores Panel */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 space-y-4 bg-[#FFFFFF] border-t border-[#F2F2EE]">
                          {/* 0. Professional Contact & Social Links Bar */}
                          <div
                            style={{
                              backgroundColor: '#FBFBFA',
                              border: '1px solid #EAEAE6',
                              borderRadius: 14,
                            }}
                            className="p-3.5 flex flex-wrap gap-2.5 items-center"
                          >
                            {sub.candidate_email && (
                              <div className="text-[12px] text-[#4A4A45] font-semibold flex items-center gap-1.5">
                                <span>✉️</span>
                                <span>{sub.candidate_email}</span>
                              </div>
                            )}

                            {sub.candidate_phone && (
                              <div className="text-[12px] text-[#4A4A45] font-semibold flex items-center gap-1.5">
                                <span>📱</span>
                                <span>{sub.candidate_phone}</span>
                              </div>
                            )}

                            {(sub.github_url || sub.github_evidence?.profile_url) && (
                              <a
                                href={sub.github_url || sub.github_evidence?.profile_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  borderRadius: 8,
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E2DC',
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                              >
                                <span>🐙</span>
                                <span>GitHub: {sub.github_evidence?.username || (sub.github_url ? sub.github_url.split('/').pop() : 'Profile')}</span>
                                {sub.github_evidence?.verified && (
                                  <span
                                    style={{
                                      backgroundColor: '#0A0A0A',
                                      color: '#FFFFFF',
                                      borderRadius: 6,
                                    }}
                                    className="text-[10px] px-1.5 py-0.2 font-extrabold"
                                  >
                                    Verified
                                  </span>
                                )}
                                <span>↗</span>
                              </a>
                            )}

                            {sub.linkedin_url && (
                              <a
                                href={sub.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  borderRadius: 8,
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E2DC',
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                              >
                                <span>💼</span>
                                <span>LinkedIn Profile ↗</span>
                              </a>
                            )}

                            {sub.candidate_title && (
                              <span className="text-[12px] text-[#8A8A85] font-medium">
                                🏷️ {sub.candidate_title}
                              </span>
                            )}
                          </div>

                          {/* 1. Score Breakdown Cards Grid */}
                          <div>
                            <h4 className="text-[11.5px] font-extrabold text-[#0A0A0A] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                              <span>📊</span>
                              <span>AI Match Score Breakdown</span>
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div
                                style={{
                                  backgroundColor: '#FBFBFA',
                                  border: '1px solid #EAEAE6',
                                  borderRadius: 14,
                                }}
                                className="p-3.5"
                              >
                                <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">Must-Have Skills</div>
                                <div className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                                  {breakdown.must_have_skills != null ? `${Math.round(breakdown.must_have_skills)}%` : `${Math.max(10, Math.round(score * 0.95))}%`}
                                </div>
                                <div className="text-[11px] text-[#8A8A85] mt-0.5">JD Required Core Skills</div>
                              </div>

                              <div
                                style={{
                                  backgroundColor: '#FBFBFA',
                                  border: '1px solid #EAEAE6',
                                  borderRadius: 14,
                                }}
                                className="p-3.5"
                              >
                                <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">Semantic JD Relevance</div>
                                <div className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                                  {breakdown.semantic_relevance != null ? `${Math.round(breakdown.semantic_relevance)}%` : `${Math.min(100, Math.max(10, Math.round(score * 1.05)))}%`}
                                </div>
                                <div className="text-[11px] text-[#8A8A85] mt-0.5">Vector Embedding Match</div>
                              </div>

                              <div
                                style={{
                                  backgroundColor: '#FBFBFA',
                                  border: '1px solid #EAEAE6',
                                  borderRadius: 14,
                                }}
                                className="p-3.5"
                              >
                                <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">Project Evidence</div>
                                <div className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                                  {breakdown.project_evidence != null ? `${Math.round(breakdown.project_evidence)}%` : `${Math.max(10, Math.round(score * 0.88))}%`}
                                </div>
                                <div className="text-[11px] text-[#8A8A85] mt-0.5">Real-world Project Proof</div>
                              </div>

                              <div
                                style={{
                                  backgroundColor: '#FBFBFA',
                                  border: '1px solid #EAEAE6',
                                  borderRadius: 14,
                                }}
                                className="p-3.5"
                              >
                                <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">Experience Alignment</div>
                                <div className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                                  {breakdown.experience_alignment != null ? `${Math.round(breakdown.experience_alignment)}%` : `${Math.max(10, Math.round(score * 0.92))}%`}
                                </div>
                                <div className="text-[11px] text-[#8A8A85] mt-0.5">Years & Role Seniority</div>
                              </div>
                            </div>
                          </div>

                          {/* 2. Skills Match Comparison Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E2DC',
                                borderRadius: 14,
                              }}
                              className="p-4"
                            >
                              <h5 className="text-[12px] font-extrabold text-[#0A0A0A] mb-2.5 flex items-center gap-1.5">
                                <span>✓</span>
                                <span>Matched Technical Skills ({matchedSkillsList.length})</span>
                              </h5>
                              {matchedSkillsList.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {matchedSkillsList.map((skill, sIdx) => (
                                    <span
                                      key={sIdx}
                                      style={{
                                        backgroundColor: '#0A0A0A',
                                        color: '#FFFFFF',
                                        borderRadius: 8,
                                      }}
                                      className="text-[11px] font-bold px-2.5 py-1 tracking-tight"
                                    >
                                      ✓ {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[12px] text-[#8A8A85]">No direct keyword skill matches detected.</p>
                              )}
                            </div>

                            <div
                              style={{
                                backgroundColor: '#FBFBFA',
                                border: '1px solid #EAEAE6',
                                borderRadius: 14,
                              }}
                              className="p-4"
                            >
                              <h5 className="text-[12px] font-extrabold text-[#737373] mb-2.5 flex items-center gap-1.5">
                                <span>⚠️</span>
                                <span>Missing / Skill Gaps ({missingSkillsList.length})</span>
                              </h5>
                              {missingSkillsList.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {missingSkillsList.map((skill, sIdx) => (
                                    <span
                                      key={sIdx}
                                      style={{
                                        backgroundColor: '#FFFFFF',
                                        color: '#737373',
                                        border: '1px solid #E2E2DC',
                                        borderRadius: 8,
                                      }}
                                      className="text-[11px] font-semibold px-2.5 py-1"
                                    >
                                      ⚠️ {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[12px] text-[#8A8A85]">All critical JD must-have skills are present!</p>
                              )}
                            </div>
                          </div>

                          {/* 3. 🐙 GitHub Code Evidence & Public Repositories (If available) */}
                          {(sub.github_evidence || sub.github_url) && (
                            <div
                              style={{
                                backgroundColor: '#0A0A0A',
                                borderRadius: 16,
                                border: '1px solid #262626',
                              }}
                              className="p-4 sm:p-5 text-white"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[1.3rem]">🐙</span>
                                  <div>
                                    <h4 className="text-[13px] font-extrabold text-white">
                                      GitHub Verified Code Proof & Repositories
                                    </h4>
                                    <p className="text-[11px] text-[#A3A3A3] mt-0.5">
                                      Profile: <strong className="text-white font-semibold">@{sub.github_evidence?.username || (sub.github_url ? sub.github_url.split('/').pop() : 'Candidate')}</strong> • {sub.github_evidence?.public_repos || 0}+ Public Repositories
                                    </p>
                                  </div>
                                </div>

                                <a
                                  href={sub.github_url || sub.github_evidence?.profile_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    backgroundColor: '#262626',
                                    borderRadius: 10,
                                    border: '1px solid #404040',
                                  }}
                                  className="px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#333333] transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
                                >
                                  <span>Open GitHub Profile</span>
                                  <span>↗</span>
                                </a>
                              </div>

                              {/* Verified languages */}
                              {sub.github_evidence?.verified_skills && sub.github_evidence.verified_skills.length > 0 && (
                                <div className="mb-3.5 flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] text-[#A3A3A3] font-semibold">Detected Code Languages:</span>
                                  {sub.github_evidence.verified_skills.map((lang, lIdx) => (
                                    <span
                                      key={lIdx}
                                      style={{
                                        backgroundColor: '#1F1F1F',
                                        border: '1px solid #333333',
                                        borderRadius: 6,
                                      }}
                                      className="px-2 py-0.5 text-[10.5px] font-semibold text-[#E5E5E5]"
                                    >
                                      {lang}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Top Repositories Grid */}
                              {sub.github_evidence?.top_repos && sub.github_evidence.top_repos.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {sub.github_evidence.top_repos.map((repo, rIdx) => (
                                    <div
                                      key={rIdx}
                                      style={{
                                        backgroundColor: '#141414',
                                        borderRadius: 12,
                                        border: '1px solid #262626',
                                      }}
                                      className="p-3.5 flex flex-col justify-between gap-2.5"
                                    >
                                      <div>
                                        <div className="flex justify-between items-start gap-2">
                                          <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-white text-[12.5px] font-extrabold hover:underline break-all"
                                          >
                                            📦 {repo.name} ↗
                                          </a>
                                          {repo.stars > 0 && (
                                            <span className="text-[11px] text-[#FBBF24] font-bold flex items-center gap-1 shrink-0">
                                              ★ {repo.stars}
                                            </span>
                                          )}
                                        </div>
                                        {repo.description && (
                                          <p className="text-[11.5px] text-[#A3A3A3] mt-1.5 leading-relaxed line-clamp-2">
                                            {repo.description}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap gap-1.5">
                                        {(repo.languages || []).map((l, li) => (
                                          <span
                                            key={li}
                                            style={{
                                              backgroundColor: '#262626',
                                              borderRadius: 4,
                                            }}
                                            className="px-2 py-0.5 text-[10px] text-[#A3A3A3] font-medium"
                                          >
                                            {l}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11.5px] text-[#8A8A85]">
                                  Public GitHub repository details verified directly from GitHub API.
                                </p>
                              )}
                            </div>
                          )}

                          {/* 4. Key Projects & Experience Highlights */}
                          {((sub.projects && sub.projects.length > 0) || (sub.experience && sub.experience.length > 0)) && (
                            <div
                              style={{
                                backgroundColor: '#FBFBFA',
                                border: '1px solid #EAEAE6',
                                borderRadius: 14,
                              }}
                              className="p-4"
                            >
                              <h5 className="text-[12px] font-extrabold text-[#0A0A0A] mb-3 flex items-center gap-1.5">
                                <span>💼</span>
                                <span>Notable Projects & Professional Experience</span>
                              </h5>
                              <div className="space-y-2.5">
                                {(sub.projects || []).slice(0, 4).map((proj, pIdx) => (
                                  <div
                                    key={pIdx}
                                    style={{
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid #EAEAE6',
                                      borderRadius: 10,
                                    }}
                                    className="p-3"
                                  >
                                    <div className="font-bold text-[12.5px] text-[#0A0A0A] mb-1">
                                      🚀 {proj.name || 'Technical Project'}
                                    </div>
                                    {proj.description && (
                                      <p className="text-[11.5px] text-[#737373] mb-1.5 leading-relaxed">
                                        {proj.description}
                                      </p>
                                    )}
                                    {proj.technologies && proj.technologies.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {proj.technologies.map((t, ti) => (
                                          <span
                                            key={ti}
                                            style={{
                                              backgroundColor: '#F5F5F2',
                                              color: '#4A4A45',
                                              borderRadius: 6,
                                            }}
                                            className="px-2 py-0.5 text-[10.5px] font-semibold"
                                          >
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 5. AI Evaluation Summary */}
                          <div
                            style={{
                              backgroundColor: '#FBFBFA',
                              border: '1px solid #EAEAE6',
                              borderRadius: 14,
                            }}
                            className="p-4"
                          >
                            <h5 className="text-[12px] font-extrabold text-[#0A0A0A] mb-1.5 flex items-center gap-1.5">
                              <span>💡</span>
                              <span>AI Evaluation Summary & Rationale</span>
                            </h5>
                            <p className="text-[12.5px] text-[#4A4A45] leading-relaxed">
                              {sub.summary || `${sub.candidate_name} was evaluated against the job requisition ${selected?.title || ''}. Overall compatibility score is ${score}% with ${sub.recommendation || 'evaluated'} recommendation.`}
                            </p>
                          </div>

                          {/* 6. Action Row with PDF View & Download */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-[#F2F2EE]">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleOpenResumeModal({ id: targetCandidateId, candidate_name: sub.candidate_name, filename: sub.filename })}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E2DC',
                                  borderRadius: 10,
                                }}
                                className="px-3.5 py-2 text-[12px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <FileText size={13} className="text-[#8A8A85]" />
                                <span>View Resume PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadCandidatePdf(targetCandidateId, sub.filename || `${sub.candidate_name || 'Resume'}.pdf`)}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E2DC',
                                  borderRadius: 10,
                                }}
                                className="px-3.5 py-2 text-[12px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <span>⬇️</span>
                                <span>Download PDF</span>
                              </button>
                            </div>

                            <div className="flex gap-2 self-start sm:self-auto">
                              {!isShortlisted && (
                                <button
                                  type="button"
                                  onClick={() => updateCandidateStatus(sub, 'Shortlisted')}
                                  style={{
                                    backgroundColor: '#0A0A0A',
                                    color: '#FFFFFF',
                                    borderRadius: 10,
                                  }}
                                  className="px-4 py-2 text-[12px] font-extrabold hover:bg-[#262626] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <span>⭐</span>
                                  <span>Shortlist (Submit to HR)</span>
                                </button>
                              )}
                              {!isRejected && (
                                <button
                                  type="button"
                                  onClick={() => updateCandidateStatus(sub, 'Rejected')}
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#737373',
                                    border: '1px solid #E2E2DC',
                                    borderRadius: 10,
                                  }}
                                  className="px-3.5 py-2 text-[12px] font-bold hover:text-[#0A0A0A] hover:bg-[#F5F5F2] transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <span>✕</span>
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FBFBFA',
                  border: '1px solid #EAEAE6',
                  borderRadius: 16,
                }}
                className="p-8 text-center"
              >
                <p className="text-[13px] text-[#8A8A85]">
                  No candidates screened yet for <strong className="text-[#0A0A0A] font-semibold">{selected?.title || 'this role'}</strong>. Select candidates from the Candidate Pool above and click <strong className="text-[#0A0A0A]">Run AI screening →</strong>.
                </p>
              </div>
            )}
          </section>
        </section>
      )}

      {showCandidates && (
        <div className="space-y-5">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] block mb-1">
                TALENT REPOSITORY
              </span>
              <h1 className="text-[2rem] font-black text-[#0A0A0A] tracking-tight leading-none">
                Candidates Bank
              </h1>
              <p className="text-[13px] text-[#737373] mt-2 font-medium">
                Manage your talent pool and quickly review candidates available for matching.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewCandVendor(user?.tenant_name || 'Vendor A');
                setShowAddCandidateModal(true);
              }}
              style={{
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
                borderRadius: 14,
              }}
              className="px-5 py-2.5 text-[13px] font-extrabold hover:bg-[#262626] transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <span className="text-base leading-none">+</span>
              <span>Add Candidate</span>
            </button>
          </div>

          {/* 4 Bento Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5"
            >
              <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                TOTAL CANDIDATES
              </div>
              <div className="text-[2rem] font-black text-[#0A0A0A] tracking-tight mt-1 leading-tight">
                {bankStats.total}
              </div>
              <div className="text-[12px] text-[#8A8A85] font-medium mt-1">
                Talent repository
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5"
            >
              <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                TECHNICAL PROFILES
              </div>
              <div className="text-[2rem] font-black text-[#0A0A0A] tracking-tight mt-1 leading-tight">
                {bankStats.titleCount > 0 ? `${bankStats.titleCount}+` : `${bankStats.total}+`}
              </div>
              <div className="text-[12px] text-[#8A8A85] font-medium mt-1">
                Roles represented
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5"
            >
              <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                PARSED RESUMES
              </div>
              <div className="text-[2rem] font-black text-[#0A0A0A] tracking-tight mt-1 leading-tight">
                {bankStats.parsed || bankStats.total}
              </div>
              <div className="text-[12px] text-[#8A8A85] font-medium mt-1">
                Profiles ready to use
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5"
            >
              <div className="text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                READY FOR MATCHING
              </div>
              <div className="text-[2rem] font-black text-[#0A0A0A] tracking-tight mt-1 leading-tight">
                {bankStats.total ? `${bankStats.readyPct || 100}%` : '0%'}
              </div>
              <div className="text-[12px] text-[#8A8A85] font-medium mt-1">
                {bankStats.total ? `${bankStats.ready || bankStats.total} of ${bankStats.total} ready` : '0 of 0 ready'}
              </div>
            </div>
          </div>

          {/* Search and Filters Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E2DC',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            }}
            className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBankTab('all')}
                style={{
                  backgroundColor: bankTab === 'all' ? '#0A0A0A' : '#FFFFFF',
                  color: bankTab === 'all' ? '#FFFFFF' : '#4A4A45',
                  border: bankTab === 'all' ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                  borderRadius: 10,
                }}
                className="px-4 py-2 text-[12px] font-extrabold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                All candidates
              </button>
              <button
                type="button"
                onClick={() => setBankTab('recent')}
                style={{
                  backgroundColor: bankTab === 'recent' ? '#0A0A0A' : '#FFFFFF',
                  color: bankTab === 'recent' ? '#FFFFFF' : '#4A4A45',
                  border: bankTab === 'recent' ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                  borderRadius: 10,
                }}
                className="px-4 py-2 text-[12px] font-extrabold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                Recently added
              </button>
            </div>

            <div className="flex-1 max-w-2xl flex items-center gap-2">
              <div className="relative w-full">
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search by name, role, skill, or email..."
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 12,
                  }}
                  className="w-full pl-3.5 pr-4 py-2 text-[12.5px] text-[#0A0A0A] placeholder-[#8A8A85] focus:outline-none focus:border-[#0A0A0A] transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E2DC',
                  borderRadius: 10,
                }}
                className="px-3 py-2 text-[12px] font-bold text-[#0A0A0A] focus:outline-none cursor-pointer"
              >
                <option value="all">Filter</option>
                {bankSkills.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
              <span className="text-[12px] text-[#8A8A85] font-semibold whitespace-nowrap">
                {filteredBankCandidates.length} {filteredBankCandidates.length === 1 ? 'candidate' : 'candidates'}
              </span>
            </div>
          </div>

          {parsingBank && (
            <div
              style={{
                backgroundColor: '#FBFBFA',
                border: '1px solid #EAEAE6',
                borderRadius: 14,
              }}
              className="p-4 flex items-center justify-center gap-3"
            >
              <span className="spinner" />
              <strong className="text-[13px] text-[#0A0A0A]">Parsing resumes with AI extraction...</strong>
            </div>
          )}

          {/* Main Candidates Table Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E2DC',
              borderRadius: 20,
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.02)',
              overflow: 'hidden',
            }}
          >
            {filteredBankCandidates.length > 0 ? (
              <div
                style={{
                  maxHeight: 'calc(100vh - 425px)',
                  minHeight: '280px',
                  overflowY: 'auto',
                }}
                className="custom-cand-scroll overflow-x-auto"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#FFFFFF] z-10 shadow-2xs">
                    <tr className="border-b border-[#F2F2EE] bg-[#FFFFFF]">
                      <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] bg-[#FFFFFF]">
                        CANDIDATE
                      </th>
                      <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] bg-[#FFFFFF]">
                        CONTACT
                      </th>
                      <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] bg-[#FFFFFF]">
                        VENDOR
                      </th>
                      <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] bg-[#FFFFFF]">
                        SKILLS
                      </th>
                      <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] bg-[#FFFFFF]">
                        ADDED
                      </th>
                      <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] text-right bg-[#FFFFFF]">
                        {/* Actions */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F2EE]">
                    {filteredBankCandidates.map((candidate) => {
                      const isExpanded = expandedCandidate === candidate.id;
                      const vendor = candidate.vendor_company_name || user?.tenant_name || 'bridgeon';
                      const initials = (candidate.candidate_name || '?').slice(0, 2).toUpperCase();

                      return (
                        <Fragment key={candidate.id}>
                          <tr
                            onClick={() => setExpandedCandidate(isExpanded ? null : candidate.id)}
                            className="hover:bg-[#FBFBFA] transition-colors cursor-pointer"
                          >
                            {/* Candidate Col */}
                            <td className="px-6 py-4.5 align-middle">
                              <div className="flex items-center gap-3.5">
                                <div
                                  style={{
                                    backgroundColor: '#0A0A0A',
                                    color: '#FFFFFF',
                                    borderRadius: 14,
                                  }}
                                  className="w-10 h-10 font-black text-[12px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs"
                                >
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[13.5px] font-extrabold text-[#0A0A0A] tracking-tight">
                                    {candidate.candidate_name}
                                  </div>
                                  <div className="text-[11.5px] text-[#8A8A85] font-medium truncate max-w-[200px] mt-0.5">
                                    {candidate.candidate_title || 'Software Engineer'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Contact Col */}
                            <td className="px-6 py-4.5 align-middle">
                              <div className="space-y-1">
                                <div className="text-[11.5px] text-[#4A4A45] font-medium flex items-center gap-1.5 truncate max-w-[220px]">
                                  <span>✉</span>
                                  <span className="truncate">{candidate.candidate_email || 'No email'}</span>
                                </div>
                                {candidate.candidate_phone ? (
                                  <div className="text-[11.5px] text-[#4A4A45] font-medium flex items-center gap-1.5">
                                    <span>📱</span>
                                    <span>{candidate.candidate_phone}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11.5px] text-[#A3A3A3] font-medium flex items-center gap-1.5">
                                    <span>📱</span>
                                    <span>—</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Vendor Col */}
                            <td className="px-6 py-4.5 align-middle">
                              <div>
                                <div className="text-[13px] font-extrabold text-[#0A0A0A]">
                                  {vendor}
                                </div>
                                <div className="text-[11px] text-[#8A8A85] font-medium">
                                  Vendor
                                </div>
                              </div>
                            </td>

                            {/* Skills Col */}
                            <td className="px-6 py-4.5 align-middle">
                              <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                {(candidate.skills || []).slice(0, 4).map((skill, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      backgroundColor: '#F5F5F2',
                                      border: '1px solid #E2E2DC',
                                      color: '#4A4A45',
                                      borderRadius: 6,
                                    }}
                                    className="text-[10.5px] font-semibold px-2 py-0.5"
                                  >
                                    {skill}
                                  </span>
                                ))}
                                {(candidate.skills || []).length > 4 && (
                                  <span
                                    style={{
                                      backgroundColor: '#FFFFFF',
                                      border: '1px solid #E2E2DC',
                                      color: '#8A8A85',
                                      borderRadius: 6,
                                    }}
                                    className="text-[10px] font-semibold px-1.5 py-0.5"
                                  >
                                    +{(candidate.skills || []).length - 4}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Added Col */}
                            <td className="px-6 py-4.5 align-middle">
                              <span className="text-[12px] text-[#737373] font-medium whitespace-nowrap">
                                {formatBankDate(candidate.created_at)}
                              </span>
                            </td>

                            {/* Actions Col */}
                            <td className="px-6 py-4.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenResumeModal(candidate)}
                                  style={{
                                    backgroundColor: '#0A0A0A',
                                    color: '#FFFFFF',
                                    borderRadius: 10,
                                  }}
                                  className="px-3.5 py-1.5 text-[11.5px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                                >
                                  View Resume
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteBankCandidate(candidate.id)}
                                  className="text-[11.5px] font-bold text-[#8A8A85] hover:text-[#DC2626] px-2 py-1.5 transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded details row */}
                          {isExpanded && (
                            <tr className="bg-[#FBFBFA]">
                              <td colSpan="6" className="p-5 border-t border-[#F2F2EE]">
                                <div className="space-y-3">
                                  {candidate.summary && (
                                    <div>
                                      <h4 className="text-[12px] font-extrabold text-[#0A0A0A] mb-1">
                                        Professional Summary
                                      </h4>
                                      <p className="text-[12px] text-[#4A4A45] leading-relaxed">
                                        {candidate.summary}
                                      </p>
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-4 text-[12px]">
                                    <div>
                                      <strong className="text-[#0A0A0A]">All Skills:</strong>{' '}
                                      <span className="text-[#4A4A45]">{(candidate.skills || []).join(', ') || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <strong className="text-[#0A0A0A]">Resume Filename:</strong>{' '}
                                      <span className="text-[#4A4A45]">{candidate.filename || 'N/A'}</span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenResumeModal(candidate)}
                                      style={{
                                        backgroundColor: '#0A0A0A',
                                        color: '#FFFFFF',
                                        borderRadius: 8,
                                      }}
                                      className="px-3 py-1.5 text-[11.5px] font-bold cursor-pointer"
                                    >
                                      View Resume PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadCandidatePdf(
                                        candidate.id,
                                        candidate.filename || `${candidate.candidate_name || "Resume"}.pdf`
                                      )}
                                      style={{
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #E2E2DC',
                                        borderRadius: 8,
                                      }}
                                      className="px-3 py-1.5 text-[11.5px] font-bold text-[#0A0A0A] cursor-pointer"
                                    >
                                      ⬇️ Download PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedMatchCandidate(candidate);
                                        setMatchingReqId(requisitions[0]?.id || '');
                                      }}
                                      style={{
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #E2E2DC',
                                        borderRadius: 8,
                                      }}
                                      className="px-3 py-1.5 text-[11.5px] font-bold text-[#0A0A0A] cursor-pointer"
                                    >
                                      ⚡ Match to Requisition
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F2] text-[#8A8A85] flex items-center justify-center mx-auto mb-3 text-lg">
                  👥
                </div>
                <h3 className="text-[15px] font-extrabold text-[#0A0A0A] mb-1">
                  {bankSearch || skillFilter !== 'all' ? 'No candidates found' : 'No candidates yet'}
                </h3>
                <p className="text-[12.5px] text-[#8A8A85] max-w-sm mx-auto">
                  {bankSearch || skillFilter !== 'all'
                    ? 'Try clearing your search or skill filter.'
                    : 'Upload resume PDFs to your Candidates Bank to populate your talent repository.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showShortlisted && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85] block mb-1">
                TALENT PIPELINE
              </span>
              <h1 className="text-[2rem] font-black text-[#0A0A0A] tracking-tight leading-none">
                Shortlisted Candidates
              </h1>
              <p className="text-[13px] text-[#737373] mt-2 font-medium">
                Keep each company and requisition separate so the hiring pipeline stays easy to follow.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const csvRows = [
                    ['Candidate Name', 'Email', 'Company', 'Requisition', 'Match Score', 'Status', 'Vendor'].join(','),
                    ...shortlisted.map((c) =>
                      [
                        `"${c.candidate_name || ''}"`,
                        `"${c.candidate_email || ''}"`,
                        `"${c.company_name || 'Bearitt'}"`,
                        `"${c.requisition_title || ''}"`,
                        `"${Math.round(c.match_score || 0)}%"`,
                        `"${c.status || 'Shortlisted'}"`,
                        `"${c.vendor_name || 'bridgeon'}"`,
                      ].join(',')
                    ),
                  ];
                  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `shortlisted_candidates_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E2DC',
                  borderRadius: 12,
                  color: '#0A0A0A',
                }}
                className="px-4 py-2 text-[12px] font-bold hover:bg-[#F5F5F2] transition-colors cursor-pointer shadow-2xs"
              >
                Export
              </button>
            </div>
          </div>

          {/* 4 Bento Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5 flex flex-col justify-between"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                TOTAL SHORTLISTED
              </span>
              <div className="mt-3">
                <span className="text-[2.25rem] font-black text-[#0A0A0A] leading-none tracking-tight">
                  {shortlistedPipelineStats.total}
                </span>
                <p className="text-[12px] text-[#737373] font-medium mt-1">
                  Across all roles
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5 flex flex-col justify-between"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                COMPANIES
              </span>
              <div className="mt-3">
                <span className="text-[2.25rem] font-black text-[#0A0A0A] leading-none tracking-tight">
                  {shortlistedPipelineStats.companies}
                </span>
                <p className="text-[12px] text-[#737373] font-medium mt-1">
                  Separate hiring pipelines
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5 flex flex-col justify-between"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                REQUISITIONS
              </span>
              <div className="mt-3">
                <span className="text-[2.25rem] font-black text-[#0A0A0A] leading-none tracking-tight">
                  {shortlistedPipelineStats.requisitions}
                </span>
                <p className="text-[12px] text-[#737373] font-medium mt-1">
                  With shortlisted talent
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              }}
              className="p-5 flex flex-col justify-between"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
                AVERAGE MATCH
              </span>
              <div className="mt-3">
                <span className="text-[2.25rem] font-black text-[#0A0A0A] leading-none tracking-tight">
                  {shortlistedPipelineStats.avg > 0 ? `${shortlistedPipelineStats.avg}%` : '—'}
                </span>
                <p className="text-[12px] text-[#737373] font-medium mt-1">
                  Current shortlisted pool
                </p>
              </div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E2DC',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            }}
            className="p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            {/* Left Pill Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <button
                type="button"
                onClick={() => setSelectedShortlistedCompany('ALL')}
                style={{
                  backgroundColor: selectedShortlistedCompany === 'ALL' ? '#0A0A0A' : '#FFFFFF',
                  color: selectedShortlistedCompany === 'ALL' ? '#FFFFFF' : '#0A0A0A',
                  border: selectedShortlistedCompany === 'ALL' ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                  borderRadius: 10,
                }}
                className="px-3.5 py-1.5 text-[12px] font-bold transition-all shrink-0 cursor-pointer"
              >
                All
              </button>
              {shortlistedCompaniesList.map((comp) => {
                const isSelected = selectedShortlistedCompany.toLowerCase() === comp.name.toLowerCase();
                return (
                  <button
                    key={comp.name}
                    type="button"
                    onClick={() => setSelectedShortlistedCompany(comp.name)}
                    style={{
                      backgroundColor: isSelected ? '#0A0A0A' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#0A0A0A',
                      border: isSelected ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                      borderRadius: 10,
                    }}
                    className="px-3.5 py-1.5 text-[12px] font-bold transition-all shrink-0 cursor-pointer"
                  >
                    {comp.name}
                  </button>
                );
              })}
            </div>

            {/* Center Search Input */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={shortlistedSearch}
                onChange={(e) => setShortlistedSearch(e.target.value)}
                placeholder="Search candidate or requisition..."
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E2DC',
                  borderRadius: 12,
                }}
                className="w-full px-3.5 py-2 text-[12.5px] text-[#0A0A0A] placeholder-[#8A8A85] focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
            </div>

            {/* Right Status Filter Dropdown */}
            <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
              <select
                value={shortlistedStatusFilter}
                onChange={(e) => setShortlistedStatusFilter(e.target.value)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E2DC',
                  borderRadius: 10,
                }}
                className="px-3 py-2 text-[12px] font-bold text-[#0A0A0A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All statuses</option>
                <option value="Shortlisted">Shortlisted</option>
              </select>
              <span className="text-[12px] text-[#8A8A85] font-semibold whitespace-nowrap">
                {shortlistedTotalFilteredCount} shortlisted
              </span>
            </div>
          </div>

          {/* Main Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Companies Sidebar Card (4 cols) */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                height: 'calc(100vh - 410px)',
                minHeight: '440px',
                display: 'flex',
                flexDirection: 'column',
              }}
              className="lg:col-span-4 p-4 overflow-hidden"
            >
              <div className="shrink-0 mb-3">
                <h3 className="text-[15px] font-black text-[#0A0A0A]">Companies</h3>
                <p className="text-[11.5px] text-[#8A8A85]">Focus on one hiring pipeline</p>
              </div>

              <div
                style={{
                  overflowY: 'auto',
                }}
                className="flex-1 space-y-2 pr-1 custom-cand-scroll"
              >
                {/* All Companies Button */}
                <div
                  onClick={() => setSelectedShortlistedCompany('ALL')}
                  style={{
                    backgroundColor: selectedShortlistedCompany === 'ALL' ? '#0A0A0A' : '#FFFFFF',
                    color: selectedShortlistedCompany === 'ALL' ? '#FFFFFF' : '#0A0A0A',
                    border: selectedShortlistedCompany === 'ALL' ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                    borderRadius: 12,
                  }}
                  className="p-3 flex items-center justify-between cursor-pointer transition-all hover:opacity-90"
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        backgroundColor: selectedShortlistedCompany === 'ALL' ? '#FFFFFF' : '#0A0A0A',
                        color: selectedShortlistedCompany === 'ALL' ? '#0A0A0A' : '#FFFFFF',
                        borderRadius: 8,
                        width: 32,
                        height: 32,
                      }}
                      className="flex items-center justify-center text-[10px] font-black shrink-0"
                    >
                      ALL
                    </div>
                    <div>
                      <div className="text-[13px] font-bold leading-tight">All companies</div>
                      <div
                        style={{
                          color: selectedShortlistedCompany === 'ALL' ? '#A3A3A3' : '#8A8A85',
                        }}
                        className="text-[11px] mt-0.5"
                      >
                        {shortlistedPipelineStats.total} shortlisted
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: selectedShortlistedCompany === 'ALL' ? '#262626' : '#F5F5F2',
                      color: selectedShortlistedCompany === 'ALL' ? '#FFFFFF' : '#0A0A0A',
                      borderRadius: 999,
                    }}
                    className="text-[11px] font-bold px-2 py-0.5 min-w-[20px] text-center"
                  >
                    {shortlistedPipelineStats.total}
                  </span>
                </div>

                {/* Individual Companies */}
                {shortlistedCompaniesList.map((comp) => {
                  const isSelected = selectedShortlistedCompany.toLowerCase() === comp.name.toLowerCase();
                  return (
                    <div
                      key={comp.name}
                      onClick={() => setSelectedShortlistedCompany(comp.name)}
                      style={{
                        backgroundColor: isSelected ? '#0A0A0A' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : '#0A0A0A',
                        border: isSelected ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                        borderRadius: 12,
                      }}
                      className="p-3 flex items-center justify-between cursor-pointer transition-all hover:opacity-90"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            backgroundColor: isSelected ? '#FFFFFF' : '#0A0A0A',
                            color: isSelected ? '#0A0A0A' : '#FFFFFF',
                            borderRadius: 8,
                            width: 32,
                            height: 32,
                          }}
                          className="flex items-center justify-center text-[12px] font-black shrink-0"
                        >
                          {comp.initial}
                        </div>
                        <div>
                          <div className="text-[13px] font-bold leading-tight">{comp.name}</div>
                          <div
                            style={{
                              color: isSelected ? '#A3A3A3' : '#8A8A85',
                            }}
                            className="text-[11px] mt-0.5"
                          >
                            {comp.reqsCount} {comp.reqsCount === 1 ? 'requisition' : 'requisitions'}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          backgroundColor: isSelected ? '#262626' : '#F5F5F2',
                          color: isSelected ? '#FFFFFF' : '#0A0A0A',
                          borderRadius: 999,
                        }}
                        className="text-[11px] font-bold px-2 py-0.5 min-w-[20px] text-center"
                      >
                        {comp.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Requisition Accordion Cards (8 cols) */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                height: 'calc(100vh - 410px)',
                minHeight: '440px',
                display: 'flex',
                flexDirection: 'column',
              }}
              className="lg:col-span-8 p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between shrink-0 mb-3">
                <div>
                  <h3 className="text-[15px] font-black text-[#0A0A0A]">All shortlisted candidates</h3>
                  <p className="text-[11.5px] text-[#8A8A85]">Company → requisition → candidate</p>
                </div>
                <span className="text-[11.5px] text-[#8A8A85] font-semibold">
                  {shortlistedTotalFilteredCount} shown
                </span>
              </div>

              <div
                style={{
                  overflowY: 'auto',
                }}
                className="flex-1 pr-1 custom-cand-scroll space-y-3"
              >
                {shortlistedRequisitionGroups.length > 0 ? (
                  shortlistedRequisitionGroups.map((group) => {
                    const isOpen = openRequisitionAccordions[group.id] !== false; // default open
                    return (
                      <div
                        key={group.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E2DC',
                          borderRadius: 12,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Accordion Header */}
                        <div
                          onClick={() =>
                            setOpenRequisitionAccordions((prev) => ({
                              ...prev,
                              [group.id]: !isOpen,
                            }))
                          }
                          style={{
                            backgroundColor: '#F5F5F2',
                            borderBottom: isOpen ? '1px solid #E2E2DC' : 'none',
                          }}
                          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#EAEAE6] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              style={{
                                backgroundColor: '#0A0A0A',
                                color: '#FFFFFF',
                                borderRadius: 8,
                                width: 34,
                                height: 34,
                              }}
                              className="flex items-center justify-center font-black text-[13px] shrink-0"
                            >
                              {group.initial}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold uppercase text-[#8A8A85]">
                                {group.companyName}
                              </div>
                              <div className="text-[14px] font-black text-[#0A0A0A] truncate">
                                {group.title}
                              </div>
                              <div className="text-[11.5px] text-[#737373] mt-0.5 truncate">
                                <span>{group.candidates.length} shortlisted</span>
                                {group.skills.length > 0 && (
                                  <span> · {group.skills.join(' · ')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 ml-3">
                            <span className="text-[11px] font-bold text-[#8A8A85]">
                              {group.candidates.length} shortlisted
                            </span>
                            <div
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #D8D8D2',
                                borderRadius: 6,
                                width: 22,
                                height: 22,
                              }}
                              className="flex items-center justify-center text-[10px] text-[#0A0A0A] font-black"
                            >
                              {isOpen ? '∧' : '∨'}
                            </div>
                          </div>
                        </div>

                        {/* Accordion Candidate List */}
                        {isOpen && (
                          <div className="bg-[#FFFFFF] divide-y divide-[#F2F2EE]">
                            {group.candidates.map((cand) => {
                              const candName = cand.candidate_name || 'Candidate';
                              const initials = candName
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase() || 'CD';
                              const scoreVal = Math.round(cand.match_score || 0);

                              return (
                                <div
                                  key={cand.id || cand.submission_id}
                                  className="p-3.5 grid grid-cols-12 items-center gap-3 hover:bg-[#FBFBFA] transition-colors"
                                >
                                  {/* Candidate Avatar & Info (5 cols) */}
                                  <div className="col-span-12 sm:col-span-5 flex items-center gap-3 min-w-0">
                                    <div
                                      style={{
                                        backgroundColor: '#0A0A0A',
                                        color: '#FFFFFF',
                                        borderRadius: '50%',
                                        width: 36,
                                        height: 36,
                                      }}
                                      className="flex items-center justify-center font-black text-[12px] shrink-0"
                                    >
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-[13px] font-extrabold text-[#0A0A0A] truncate">
                                        {candName}
                                      </div>
                                      <div className="text-[11.5px] text-[#8A8A85] truncate">
                                        {cand.candidate_email || 'No email provided'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Vendor Info (3 cols) */}
                                  <div className="col-span-4 sm:col-span-3 text-left">
                                    <div className="text-[12px] font-bold text-[#0A0A0A] truncate">
                                      {cand.vendor_name || 'bridgeon'}
                                    </div>
                                    <div className="text-[10px] text-[#8A8A85] uppercase tracking-wider font-semibold">
                                      Vendor
                                    </div>
                                  </div>

                                  {/* Match Score (2 cols) */}
                                  <div className="col-span-4 sm:col-span-2 text-left">
                                    <span
                                      style={{
                                        backgroundColor: '#F5F5F2',
                                        border: '1px solid #E2E2DC',
                                        color: '#0A0A0A',
                                        borderRadius: 6,
                                      }}
                                      className="text-[11px] font-bold px-2 py-0.5 inline-block"
                                    >
                                      {scoreVal > 0 ? `${scoreVal}% match` : 'Reviewed'}
                                    </span>
                                    <div className="text-[10px] text-[#8A8A85] font-medium mt-0.5">
                                      {cand.recommendation || (scoreVal >= 70 ? 'Strong Match' : scoreVal >= 50 ? 'Consider' : 'Weak Match')}
                                    </div>
                                  </div>

                                  {/* View Profile Action Button (2 cols) */}
                                  <div className="col-span-4 sm:col-span-2 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setViewProfileCandidate(cand)}
                                      style={{
                                        backgroundColor: '#0A0A0A',
                                        color: '#FFFFFF',
                                        borderRadius: 8,
                                      }}
                                      className="px-3.5 py-1.5 text-[11.5px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                                    >
                                      View Profile
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#F5F5F2] text-[#8A8A85] flex items-center justify-center mx-auto mb-2 text-base">
                      ⭐
                    </div>
                    <h4 className="text-[14px] font-extrabold text-[#0A0A0A] mb-1">
                      No shortlisted candidates found
                    </h4>
                    <p className="text-[12px] text-[#8A8A85]">
                      {shortlistedSearch
                        ? 'Try clearing your search term.'
                        : 'Screen candidates from the Candidate Pool to shortlist them here.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Center Popup Modal (Image 2) */}
      {viewProfileCandidate && (
        <div
          onClick={() => setViewProfileCandidate(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              maxWidth: 460,
              width: '100%',
              padding: 24,
              border: '1px solid #E2E2DC',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
            }}
            className="space-y-4"
          >
            {/* Header with Title & Close button */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85] block mb-0.5">
                  SHORTLISTED PROFILE
                </span>
                <h2 className="text-[1.5rem] font-black text-[#0A0A0A] leading-tight">
                  {viewProfileCandidate.candidate_name || 'Candidate Profile'}
                </h2>
                <p className="text-[12px] text-[#8A8A85] mt-0.5">Quick review</p>
              </div>
              <button
                type="button"
                onClick={() => setViewProfileCandidate(null)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E2DC',
                  borderRadius: 10,
                  width: 32,
                  height: 32,
                }}
                className="flex items-center justify-center text-[12px] text-[#0A0A0A] font-bold hover:bg-[#F5F5F2] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Candidate Identity row */}
            <div className="flex items-center gap-3 pt-2 pb-3 border-b border-[#F2F2EE]">
              <div
                style={{
                  backgroundColor: '#0A0A0A',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: 44,
                  height: 44,
                }}
                className="flex items-center justify-center font-black text-[13px] shrink-0"
              >
                {(viewProfileCandidate.candidate_name || 'CD')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-black text-[#0A0A0A] truncate">
                  {viewProfileCandidate.candidate_title || viewProfileCandidate.requisition_title || 'Software Engineer'}
                </div>
                <div className="text-[12px] text-[#8A8A85] truncate">
                  {viewProfileCandidate.candidate_email || 'No email specified'}
                </div>
              </div>
            </div>

            {/* Review snapshot section (2x2 Grid) */}
            <div>
              <h4 className="text-[13px] font-black text-[#0A0A0A] mb-2.5">
                Review snapshot
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 12,
                  }}
                  className="p-3"
                >
                  <span className="text-[10px] font-extrabold uppercase text-[#8A8A85] block">
                    MATCH
                  </span>
                  <span className="text-[14px] font-black text-[#0A0A0A] mt-1 block">
                    {Math.round(viewProfileCandidate.match_score || 0)}%
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 12,
                  }}
                  className="p-3"
                >
                  <span className="text-[10px] font-extrabold uppercase text-[#8A8A85] block">
                    STATUS
                  </span>
                  <span className="text-[14px] font-black text-[#0A0A0A] mt-1 block">
                    {viewProfileCandidate.status || 'Shortlisted'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 12,
                  }}
                  className="p-3"
                >
                  <span className="text-[10px] font-extrabold uppercase text-[#8A8A85] block">
                    VENDOR
                  </span>
                  <span className="text-[14px] font-black text-[#0A0A0A] mt-1 block">
                    {viewProfileCandidate.vendor_name || 'bridgeon'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 12,
                  }}
                  className="p-3"
                >
                  <span className="text-[10px] font-extrabold uppercase text-[#8A8A85] block">
                    RESUME
                  </span>
                  <span className="text-[14px] font-black text-[#0A0A0A] mt-1 block">
                    Available
                  </span>
                </div>
              </div>
            </div>

            {/* Actions section */}
            <div className="pt-1">
              <h4 className="text-[13px] font-black text-[#0A0A0A] mb-2.5">
                Actions
              </h4>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const cand = viewProfileCandidate;
                    setViewProfileCandidate(null);
                    handleOpenResumeModal(cand);
                  }}
                  style={{
                    backgroundColor: '#0A0A0A',
                    color: '#FFFFFF',
                    borderRadius: 10,
                  }}
                  className="px-5 py-2.5 text-[12px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs"
                >
                  View Resume
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cand = viewProfileCandidate;
                    setViewProfileCandidate(null);
                    handleOpenResumeModal(cand);
                    setPdfViewTab('insights');
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    color: '#0A0A0A',
                    borderRadius: 10,
                  }}
                  className="px-5 py-2.5 text-[12px] font-extrabold hover:bg-[#F5F5F2] transition-colors cursor-pointer"
                >
                  Full details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Modal */}
      {selectedMatchCandidate && (
        <div className="modal-overlay" onClick={() => setSelectedMatchCandidate(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%', padding: '24px', background: '#fff', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>Match {selectedMatchCandidate.candidate_name}</h3>
              <button onClick={() => setSelectedMatchCandidate(null)} style={{ background: 'none', border: 0, fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>×</button>
            </div>
            <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>Select an open job position to screen <strong>{selectedMatchCandidate.candidate_name}</strong> against using AI extraction and ranking.</p>
              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Select Requisition</label>
                <select
                  className="auth-input"
                  value={matchingReqId}
                  onChange={(e) => setMatchingReqId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  {requisitions.map((req) => (
                    <option key={req.id} value={req.id}>{req.title} ({req.company_name || 'Client'})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  onClick={() => setSelectedMatchCandidate(null)}
                  disabled={matching}
                  style={{ background: '#f1f5f9', color: '#475569', border: 0, padding: '10px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  className="glow-btn"
                  onClick={handleMatchConfirm}
                  disabled={matching || !matchingReqId}
                  style={{ background: '#1e293b', color: '#fff', border: 0, padding: '10px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {matching ? 'Matching...' : 'Confirm Match'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resume Preview Modal with Embedded PDF Viewer */}
      {showResumeModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseResumeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '1100px',
              width: '95%',
              height: '92vh',
              padding: '20px 24px',
              background: '#ffffff',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '14px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {showResumeModal.candidate_name ? showResumeModal.candidate_name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {showResumeModal.candidate_name || 'Candidate Resume'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                      {showResumeModal.candidate_title || 'Software Engineer'}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 500 }}>
                      🏢 {showResumeModal.vendor_company_name || 'bridgeon'}
                    </span>
                    {showResumeModal.candidate_email && (
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                        ✉️ {showResumeModal.candidate_email}
                      </span>
                    )}
                    {showResumeModal.candidate_phone && (
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                        📞 {showResumeModal.candidate_phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Action Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {resumePdfUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => window.open(resumePdfUrl, '_blank')}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🔗</span>
                      <span>Open in New Tab</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = resumePdfUrl;
                        a.download = showResumeModal.filename || `${showResumeModal.candidate_name || 'Resume'}.pdf`;
                        a.click();
                      }}
                      style={{
                        background: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⬇️</span>
                      <span>Download</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleCloseResumeModal}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    fontSize: '1.2rem',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* View Switcher Tabs & External Action */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '10px',
                  width: 'fit-content',
                  gap: '4px',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setPdfViewTab('pdf')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '7px',
                    border: 0,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: pdfViewTab === 'pdf' ? '#ffffff' : 'transparent',
                    color: pdfViewTab === 'pdf' ? '#0A0A0A' : '#64748b',
                    boxShadow: pdfViewTab === 'pdf' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>📄</span>
                  <span>Original PDF Resume</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfViewTab('insights')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '7px',
                    border: 0,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: pdfViewTab === 'insights' ? '#ffffff' : 'transparent',
                    color: pdfViewTab === 'insights' ? '#0A0A0A' : '#64748b',
                    boxShadow: pdfViewTab === 'insights' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>✨</span>
                  <span>AI Extracted Profile &amp; Skills</span>
                </button>
              </div>

              {resumePdfUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={resumePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      background: '#0A0A0A',
                      color: '#FFFFFF',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    <span>↗</span> Open Full PDF
                  </a>
                </div>
              )}
            </div>

            {/* Viewport Content */}
            <div
              style={{
                flex: 1,
                marginTop: '12px',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {pdfViewTab === 'pdf' ? (
                loadingPdf ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <div className="spinner" style={{ width: '36px', height: '36px', borderTopColor: '#0A0A0A', marginBottom: '14px' }} />
                    <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Loading resume PDF from database...</p>
                  </div>
                ) : resumePdfUrl ? (
                  <object
                    data={resumePdfUrl}
                    type="application/pdf"
                    style={{ width: '100%', height: '100%', border: 0 }}
                  >
                    <iframe
                      src={resumePdfUrl}
                      title={`Resume PDF - ${showResumeModal.candidate_name}`}
                      style={{ width: '100%', height: '100%', border: 0 }}
                    />
                  </object>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📄</div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                      No direct PDF data stored for this profile
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '400px' }}>
                      This candidate profile might have been added manually. Check the AI Extracted Profile tab to view their skills and summary.
                    </p>
                  </div>
                )
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Role/Title</span>
                      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{showResumeModal.candidate_title || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Vendor Company</span>
                      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{showResumeModal.vendor_company_name || 'bridgeon'}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Email</span>
                      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{showResumeModal.candidate_email || 'N/A'}</strong>
                    </div>
                    {showResumeModal.candidate_phone && (
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Phone</span>
                        <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{showResumeModal.candidate_phone}</strong>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>Professional Summary</h4>
                    <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      {showResumeModal.summary || 'No summary extracted.'}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>Extracted Skills</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(showResumeModal.skills || []).map((skill, idx) => (
                        <span key={idx} style={{ background: '#edf5ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>Extracted Resume Text</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', background: '#f1f5f9', padding: '16px', borderRadius: '10px', fontSize: '0.78rem', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', color: '#334155' }}>
                      {showResumeModal.extracted_text || 'No text extracted.'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddCandidateModal && (
        <div
          className="modal-overlay"
          onClick={() => !parsingBank && setShowAddCandidateModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '620px',
              width: '92%',
              padding: '24px 28px',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Add Candidates to Talent Pool
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  Auto-extract candidate identity, contact info &amp; skills with Groq AI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !parsingBank && setShowAddCandidateModal(false)}
                disabled={parsingBank}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '1.1rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Selector */}
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: '4px',
                borderRadius: '12px',
                marginTop: '16px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setAddCandidateMode('ai')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 0,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: addCandidateMode === 'ai' ? '#ffffff' : 'transparent',
                  color: addCandidateMode === 'ai' ? '#2563eb' : '#64748b',
                  boxShadow: addCandidateMode === 'ai' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>✨ AI Auto-Extract (Bulk Resumes)</span>
                <span
                  style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                  }}
                >
                  Recommended
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAddCandidateMode('manual')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 0,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: addCandidateMode === 'manual' ? '#ffffff' : 'transparent',
                  color: addCandidateMode === 'manual' ? '#0f172a' : '#64748b',
                  boxShadow: addCandidateMode === 'manual' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                ✍️ Manual Form Entry
              </button>
            </div>

            <form onSubmit={handleAddCandidateSubmit} style={{ marginTop: '16px', display: 'grid', gap: '14px' }}>
              {addCandidateMode === 'ai' ? (
                <>
                  {/* Vendor Company Name */}
                  <div>
                    <label
                      className="form-label"
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      Vendor / Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. bridgeon"
                      value={bulkVendor}
                      onChange={(e) => setBulkVendor(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        color: '#0f172a',
                      }}
                    />
                  </div>

                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingBank(true);
                    }}
                    onDragLeave={() => setIsDraggingBank(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingBank(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const newFiles = Array.from(e.dataTransfer.files).filter(
                          (f) =>
                            f.name.toLowerCase().endsWith('.pdf') ||
                            f.name.toLowerCase().endsWith('.docx') ||
                            f.name.toLowerCase().endsWith('.doc')
                        );
                        setBulkFiles((prev) => [...prev, ...newFiles]);
                      }
                    }}
                    style={{
                      border: isDraggingBank ? '2px dashed #2563eb' : '2px dashed #cbd5e1',
                      borderRadius: '14px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      background: isDraggingBank ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => document.getElementById('bulk-resume-file-input').click()}
                  >
                    <input
                      id="bulk-resume-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const newFiles = Array.from(e.target.files);
                          setBulkFiles((prev) => [...prev, ...newFiles]);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                      Drag &amp; Drop Resumes Here, or <span style={{ color: '#2563eb' }}>Browse Files</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                      Supports PDF and DOCX files. You can select 1 to 100+ resumes at once.
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {bulkFiles.length > 0 && (
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        maxHeight: '150px',
                        overflowY: 'auto',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                          {bulkFiles.length} Resume(s) Selected for AI Extraction
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBulkFiles([]);
                          }}
                          style={{
                            background: 'transparent',
                            border: 0,
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Clear All
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {bulkFiles.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#ffffff',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <span>📄</span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '360px',
                                }}
                              >
                                {file.name}
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBulkFiles(bulkFiles.filter((_, i) => i !== idx));
                              }}
                              style={{
                                background: 'transparent',
                                border: 0,
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                padding: '2px 4px',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ingestion Info Box */}
                  <div
                    style={{
                      background: '#eff6ff',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.8rem',
                      color: '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>⚡</span>
                    <span>
                      Groq AI will automatically extract Name, Email, Phone, Job Title &amp; Skills from each resume and store them in the Candidate Bank table.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Manual Form Entry */}
                  <div>
                    <label
                      className="form-label"
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      Candidate Name *
                    </label>
                    <input
                      type="text"
                      required={addCandidateMode === 'manual'}
                      placeholder="e.g. John Doe"
                      value={newCandName}
                      onChange={(e) => setNewCandName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label
                        className="form-label"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={newCandEmail}
                        onChange={(e) => setNewCandEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="form-label"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+1 555-0199"
                        value={newCandPhone}
                        onChange={(e) => setNewCandPhone(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label
                        className="form-label"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Vendor / Company Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Staffing"
                        value={newCandVendor}
                        onChange={(e) => setNewCandVendor(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="form-label"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Job Title / Role
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Senior React Developer"
                        value={newCandTitle}
                        onChange={(e) => setNewCandTitle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="form-label"
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      Upload Resume (PDF / DOCX - Optional)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc"
                      onChange={(e) => setNewCandFile(e.target.files[0])}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                </>
              )}

              {/* Submit / Cancel Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  disabled={parsingBank}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 0,
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glow-btn"
                  disabled={parsingBank || (addCandidateMode === 'ai' ? bulkFiles.length === 0 : !newCandName.trim())}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 0,
                    padding: '10px 22px',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                  }}
                >
                  {parsingBank ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#fff' }} />
                      <span>Processing with Groq AI...</span>
                    </>
                  ) : addCandidateMode === 'ai' ? (
                    <>
                      <span>✨ Ingest {bulkFiles.length > 0 ? `${bulkFiles.length} Resume(s)` : 'Resumes'}</span>
                    </>
                  ) : (
                    'Save Candidate'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInterviews && (
        <div className="interviews-page-content" style={{ display: 'grid', gap: '20px' }}>
          <WelcomeBanner
            title="Interview Requests & Cal.com Scheduling"
            subtitle="Incoming interview proposals from client hiring managers. Confirm candidate availability and access 1-click Cal.com booking sync."
          />

          <div className="stat-grid recruiter-stats" aria-label="Interviews summary">
            <StatCard
              label="TOTAL INTERVIEW REQUESTS"
              value={interviews.length}
              icon={Icons.calendar || Icons.briefcase}
              tint="tint-blue"
            />
            <StatCard
              label="PENDING CONFIRMATION"
              value={interviews.filter((i) => i.status === 'PROPOSED_BY_COMPANY').length}
              icon={Icons.layers}
              tint="tint-amber"
            />
            <StatCard
              label="CONFIRMED INTERVIEWS"
              value={interviews.filter((i) => i.status === 'CONFIRMED_BY_VENDOR').length}
              icon={Icons.check}
              tint="tint-green"
            />
          </div>

          {/* Filter and search bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#ffffff', padding: '14px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['ALL', 'PENDING', 'CONFIRMED'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInterviewFilter(tab)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 0,
                    background: interviewFilter === tab ? '#0f172a' : '#f1f5f9',
                    color: interviewFilter === tab ? '#ffffff' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'ALL' ? 'All Requests' : tab === 'PENDING' ? 'Pending' : 'Confirmed'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search candidate, role, or company..."
              value={interviewSearch}
              onChange={(e) => setInterviewSearch(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '260px' }}
            />
          </div>

          {/* Interviews List */}
          {loadingInterviews ? (
            <p className="muted" style={{ padding: 24 }}>Loading interview requests...</p>
          ) : (
            (() => {
              let filtered = interviews;
              if (interviewFilter === 'PENDING') filtered = filtered.filter((i) => i.status === 'PROPOSED_BY_COMPANY');
              if (interviewFilter === 'CONFIRMED') filtered = filtered.filter((i) => i.status === 'CONFIRMED_BY_VENDOR');
              if (interviewSearch.trim()) {
                const q = interviewSearch.toLowerCase();
                filtered = filtered.filter(
                  (i) =>
                    (i.candidate_name && i.candidate_name.toLowerCase().includes(q)) ||
                    (i.requisition_title && i.requisition_title.toLowerCase().includes(q)) ||
                    (i.company_name && i.company_name.toLowerCase().includes(q))
                );
              }

              if (filtered.length === 0) {
                return (
                  <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '2.5rem' }}>📅</span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '10px 0 4px 0' }}>
                      No Interview Requests Found
                    </h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                      When client hiring managers shortlist candidates and propose interview slots, they will appear here.
                    </p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {filtered.map((inv) => {
                    const isConfirmed = inv.status === 'CONFIRMED_BY_VENDOR';
                    const slot = inv.confirmed_slot || (inv.proposed_slots && inv.proposed_slots[0]) || {};
                    return (
                      <div
                        key={inv.id}
                        className="glass-panel"
                        style={{
                          background: '#ffffff',
                          borderRadius: '16px',
                          border: isConfirmed ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                          padding: '22px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                {inv.candidate_name}
                              </h3>
                              <span
                                style={{
                                  background: isConfirmed ? '#ecfdf5' : '#fef3c7',
                                  color: isConfirmed ? '#059669' : '#d97706',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                {isConfirmed ? '✓ CONFIRMED' : '⏳ PENDING CONFIRMATION'}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                              Role: <strong style={{ color: '#1e293b' }}>{inv.requisition_title}</strong> • Client: <strong style={{ color: '#1e293b' }}>{inv.company_name || 'Client HR'}</strong>
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {!isConfirmed && (
                              <button
                                type="button"
                                onClick={() => handleConfirmInterview(inv.id, inv.candidate_name)}
                                disabled={confirmingId === inv.id}
                                style={{
                                  background: '#059669',
                                  color: '#ffffff',
                                  border: 0,
                                  padding: '9px 18px',
                                  borderRadius: '10px',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                                }}
                              >
                                {confirmingId === inv.id ? 'Confirming...' : '🟢 Confirm Slot with Candidate'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Meeting Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '14px', fontSize: '0.82rem', color: '#475569' }}>
                          <div>
                            <strong style={{ color: '#1e293b' }}>🎯 Round:</strong> {inv.interview_round || 'Round 1'}
                          </div>
                          <div>
                            <strong style={{ color: '#1e293b' }}>🕒 Slot:</strong> {slot.date} ({slot.start_time} - {slot.end_time} {slot.timezone || 'IST'})
                          </div>
                          <div>
                            <strong style={{ color: '#1e293b' }}>👤 Interviewer:</strong> {inv.interviewer_name || 'Hiring Team'} ({inv.interviewer_email || 'HR'})
                          </div>
                          {inv.meeting_link && (
                            <div>
                              <strong style={{ color: '#1e293b' }}>🎥 Platform:</strong>{' '}
                              <a href={inv.meeting_link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                                Join Meeting ↗
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        {inv.notes && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '12px', background: '#ffffff', border: '1px dashed #cbd5e1', padding: '8px 12px', borderRadius: '8px' }}>
                            📝 <strong>Client Notes:</strong> {inv.notes}
                          </div>
                        )}

                        {/* Action Links & 1-Click Sync Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                          {inv.calendar_links?.cal_booking_url && (
                            <a
                              href={inv.calendar_links.cal_booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: '#2563eb',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              🔗 Open Cal.com Live Booking Link ↗
                            </a>
                          )}

                          {inv.calendar_links && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b' }}>1-Click Sync:</span>
                              {inv.calendar_links.google && (
                                <a href={inv.calendar_links.google} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', textDecoration: 'none', color: '#0f172a' }}>🟢 Google</a>
                              )}
                              {inv.calendar_links.outlook && (
                                <a href={inv.calendar_links.outlook} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', textDecoration: 'none', color: '#0f172a' }}>🔵 Outlook</a>
                              )}
                              <a href={`/api/interviews/${inv.id}/invite.ics`} download style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', textDecoration: 'none', color: '#0f172a' }}>⚪ .ICS File</a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ─── Accepted Candidates View ─── */}
      {showAccepted && (
        <AcceptedCandidatesView authToken={authToken} />
      )}

      {/* ─── Portal Access View ─── */}
      {showPortal && (
        <PortalAccessView authToken={authToken} />
      )}
    </div>
  );
}


function AcceptedCandidatesView({ authToken }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    setLoading(true);
    request('/candidates?status=Accepted', { token: authToken })
      .then((data) => setCandidates(Array.isArray(data) ? data : data?.candidates || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authToken]);

  // Group candidates by company_name
  const companies = {};
  candidates.forEach((c) => {
    const comp = c.company_name || c.requisition_title || 'Unknown Company';
    if (!companies[comp]) companies[comp] = [];
    companies[comp].push(c);
  });

  const selectedCandidates = selectedCompany ? (companies[selectedCompany] || []) : [];

  return (
    <div style={{ padding: 0 }}>
      <WelcomeBanner title="Accepted Candidates" subtitle="Candidates that client hiring managers have accepted and moved to onboarding." />
      <div style={{ padding: '0 24px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Accepted</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{candidates.length}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Companies</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{Object.keys(companies).length}</div>
          </div>
        </div>

        {loading ? <p style={{ padding: 24, color: '#64748b' }}>Loading...</p> : error ? <p style={{ color: '#dc2626', padding: 24 }}>{error}</p> : candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600 }}>No accepted candidates yet</div>
          </div>
        ) : (
          <>
            {/* Back button when viewing a company */}
            {selectedCompany && (
              <button
                onClick={() => setSelectedCompany(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.82rem', fontWeight: 600, color: '#475569', cursor: 'pointer', marginBottom: 16 }}
              >
                ← Back to companies
              </button>
            )}

            {/* Company cards grid */}
            {!selectedCompany && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {Object.entries(companies).map(([companyName, cands]) => (
                  <div
                    key={companyName}
                    onClick={() => setSelectedCompany(companyName)}
                    style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(5,150,105,0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e5e0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{companyName}</div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#d1fae5', color: '#065f46' }}>
                        {cands.length} accepted
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cands.slice(0, 4).map((c) => (
                        <span key={c.submission_id || c.id} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569' }}>
                          {c.candidate_name}
                        </span>
                      ))}
                      {cands.length > 4 && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>+{cands.length - 4} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Candidate list for selected company */}
            {selectedCompany && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>{selectedCompany}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{selectedCandidates.length} accepted candidate{selectedCandidates.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e0' }}>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Candidate</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Candidate ID</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Requisition</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Match Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCandidates.map((c) => {
                        const cid = c.submission_id || c.id;
                        return (
                          <tr key={cid} style={{ borderBottom: '1px solid #f1f0ec' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.candidate_name}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b', fontFamily: 'monospace' }}>{cid}</div>
                            </td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>{cid}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>{c.requisition_ref || '—'}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{c.requisition_title || ''}</div>
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 800, color: c.match_score >= 70 ? '#059669' : c.match_score >= 40 ? '#d97706' : '#dc2626' }}>
                              {c.match_score != null ? `${Math.round(c.match_score)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}


function PortalAccessView({ authToken }) {
  const [candidates, setCandidates] = useState([]);
  const [portalUsers, setPortalUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'REVOKED' | 'PENDING'

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createCandidateId, setCreateCandidateId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      request('/candidates?status=Accepted', { token: authToken }).catch(() => []),
      request('/api/auth/portal-users', { token: authToken }).catch(() => []),
    ])
      .then(([cands, users]) => {
        setCandidates(Array.isArray(cands) ? cands : cands?.candidates || []);
        setPortalUsers(Array.isArray(users) ? users : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [authToken]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await request('/api/auth/portal-users', {
        method: 'POST',
        token: authToken,
        body: {
          email: createEmail.trim().toLowerCase(),
          name: createName.trim(),
          password: createPassword,
          candidate_id: createCandidateId.trim(),
        },
      });
      setToast('✓ Portal access created successfully');
      setShowCreate(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateCandidateId('');
      loadData();
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to create portal access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = { name: editUser._name };
      if (editUser._password) body.password = editUser._password;
      await request(`/api/auth/portal-users/${editUser.id}`, {
        method: 'PUT',
        token: authToken,
        body,
      });
      setToast('✓ Portal credentials updated successfully');
      setEditUser(null);
      loadData();
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to update credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user, activate = true) => {
    try {
      await request(`/api/auth/portal-users/${user.id}`, {
        method: 'PUT',
        token: authToken,
        body: { is_active: activate },
      });
      setToast(activate ? '✓ Portal access re-activated' : '✓ Portal access revoked');
      loadData();
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to change access state.');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to permanently delete portal access for this candidate?')) return;
    try {
      await request(`/api/auth/portal-users/${userId}`, {
        method: 'DELETE',
        token: authToken,
      });
      setToast('✓ Portal account deleted');
      loadData();
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to delete portal user.');
    }
  };

  // Strict Candidate matching to actual Database Portal User credentials
  const candidateRows = candidates.map((c) => {
    const cid = (c.submission_id || c.id || '').trim();
    const candEmail = (c.candidate_email || '').trim().toLowerCase();

    // 1. Strict primary match by candidate_id / submission_id
    let user = portalUsers.find(
      (u) => u.candidate_id && u.candidate_id.trim() === cid
    );

    // 2. Secondary fallback by email ONLY if candidate_email is valid non-empty and candidate_id matches
    if (!user && candEmail && candEmail.length > 3) {
      user = portalUsers.find(
        (u) => (u.email || '').trim().toLowerCase() === candEmail && (!u.candidate_id || u.candidate_id.trim() === cid)
      );
    }

    const isActive = !!user && user.is_active !== false;
    const isRevoked = !!user && user.is_active === false;

    return {
      ...c,
      cid,
      portalUser: user,
      hasAccess: isActive,
      isRevoked,
    };
  });

  const activeCount = candidateRows.filter((r) => r.hasAccess).length;
  const revokedCount = candidateRows.filter((r) => r.isRevoked).length;
  const pendingCount = candidateRows.filter((r) => !r.hasAccess && !r.isRevoked).length;
  const adoptionRate = candidateRows.length > 0 ? Math.round((activeCount / candidateRows.length) * 100) : 0;

  // Filtered rows
  const filteredCandidates = candidateRows.filter((c) => {
    if (filterStatus === 'ACTIVE' && !c.hasAccess) return false;
    if (filterStatus === 'REVOKED' && !c.isRevoked) return false;
    if (filterStatus === 'PENDING' && (c.hasAccess || c.isRevoked)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (c.candidate_name || '').toLowerCase();
      const email = (c.candidate_email || '').toLowerCase();
      const cid = (c.cid || '').toLowerCase();
      const role = (c.requisition_title || '').toLowerCase();
      return name.includes(q) || email.includes(q) || cid.includes(q) || role.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Modern Header Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E2DC',
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        }}
        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black tracking-widest text-[#8A8A85] uppercase">
              CANDIDATE MANAGEMENT
            </span>
            <span className="text-[#8A8A85]">›</span>
            <span className="text-[11px] font-bold text-[#0A0A0A]">
              PORTAL ACCESS & CREDENTIALS
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
            Portal Access
          </h1>
          <p className="text-[13px] text-[#8A8A85] mt-0.5">
            Provision and manage candidate login accounts for self-service portal access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCreateName('');
              setCreateEmail('');
              setCreateCandidateId('');
              setCreatePassword('');
              setShowCreate(true);
            }}
            style={{
              backgroundColor: '#0A0A0A',
              color: '#FFFFFF',
              borderRadius: 12,
            }}
            className="px-4 py-2 text-[12.5px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs flex items-center gap-2 shrink-0"
          >
            <span>+</span>
            <span>Create Portal Access</span>
          </button>
        </div>
      </div>

      {/* Bento Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E2DC',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-4"
        >
          <div className="text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
            Total Candidates
          </div>
          <div className="text-2xl font-black text-[#0A0A0A] mt-1">
            {candidates.length}
          </div>
          <div className="text-[11px] text-[#8A8A85] mt-0.5">
            Accepted talent in pipeline
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E2DC',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-4"
        >
          <div className="text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
            Active Accounts
          </div>
          <div className="text-2xl font-black text-[#0A0A0A] mt-1 flex items-center gap-2">
            <span>{activeCount}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F2] border border-[#E2E2DC] text-[#0A0A0A]">
              {portalUsers.length} total
            </span>
          </div>
          <div className="text-[11px] text-[#8A8A85] mt-0.5">
            Verified credentials active
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E2DC',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-4"
        >
          <div className="text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
            Pending Setup
          </div>
          <div className="text-2xl font-black text-[#0A0A0A] mt-1">
            {pendingCount}
          </div>
          <div className="text-[11px] text-[#8A8A85] mt-0.5">
            Awaiting credential creation
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E2DC',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-4"
        >
          <div className="text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
            Portal Adoption
          </div>
          <div className="text-2xl font-black text-[#0A0A0A] mt-1">
            {adoptionRate}%
          </div>
          <div className="text-[11px] text-[#8A8A85] mt-0.5">
            Of candidates provisioned
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            backgroundColor: '#0A0A0A',
            color: '#FFFFFF',
            borderRadius: 12,
          }}
          className="px-4 py-2.5 text-[12.5px] font-bold shadow-md flex items-center justify-between"
        >
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast('')}
            className="text-white/70 hover:text-white ml-3 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            borderRadius: 12,
          }}
          className="px-4 py-2.5 text-[12.5px] font-bold shadow-xs flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-600 hover:text-red-900 ml-3 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E2DC',
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        }}
        className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
      >
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Candidates', count: candidateRows.length },
            { id: 'ACTIVE', label: 'Active Access', count: activeCount },
            { id: 'REVOKED', label: 'Revoked', count: revokedCount },
            { id: 'PENDING', label: 'No Access', count: pendingCount },
          ].map((pill) => {
            const isSelected = filterStatus === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterStatus(pill.id)}
                style={{
                  backgroundColor: isSelected ? '#0A0A0A' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#0A0A0A',
                  border: isSelected ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                  borderRadius: 999,
                }}
                className="px-3 py-1.5 text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <span>{pill.label}</span>
                <span
                  style={{
                    backgroundColor: isSelected ? '#262626' : '#F5F5F2',
                    color: isSelected ? '#FFFFFF' : '#8A8A85',
                  }}
                  className="px-1.5 py-0.2 rounded-full text-[10px] font-black min-w-[16px] text-center"
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px] md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, email, ID..."
            style={{
              backgroundColor: '#F5F5F2',
              border: '1px solid #E2E2DC',
              borderRadius: 12,
            }}
            className="w-full pl-3.5 pr-8 py-2 text-[12.5px] font-medium text-[#0A0A0A] placeholder-[#8A8A85] outline-hidden focus:border-[#0A0A0A] focus:bg-[#FFFFFF] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8A8A85] hover:text-[#0A0A0A] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Candidate Portal Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E2DC',
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        }}
        className="overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-[13px] text-[#8A8A85] font-medium animate-pulse">
            Loading candidate portal access records...
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-3xl mb-2">👤</div>
            <div className="text-base font-black text-[#0A0A0A]">
              No Candidates Found
            </div>
            <div className="text-[13px] text-[#8A8A85] mt-1">
              {searchQuery ? 'Try adjusting your search query or filter.' : 'Accepted candidates will appear here for portal setup.'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E2DC] bg-[#FAFAFA]">
                  <th className="py-3 px-4 text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
                    Candidate
                  </th>
                  <th className="py-3 px-4 text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
                    Candidate ID
                  </th>
                  <th className="py-3 px-4 text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
                    Requisition & Role
                  </th>
                  <th className="py-3 px-4 text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85]">
                    Portal Status
                  </th>
                  <th className="py-3 px-4 text-[10.5px] font-black uppercase tracking-wider text-[#8A8A85] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E2DC]">
                {filteredCandidates.map((c) => {
                  const user = c.portalUser;
                  const candName = c.candidate_name || 'Candidate';
                  const initials = candName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={c.cid || c.id}
                      className="hover:bg-[#FDFDFD] transition-colors"
                    >
                      {/* Candidate Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: '50%',
                              width: 34,
                              height: 34,
                            }}
                            className="flex items-center justify-center font-black text-[11.5px] shrink-0"
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-black text-[#0A0A0A] truncate">
                              {candName}
                            </div>
                            <div className="text-[11.5px] text-[#8A8A85] truncate">
                              {c.candidate_email || 'No email provided'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Candidate ID */}
                      <td className="py-3.5 px-4">
                        <span
                          style={{
                            backgroundColor: '#F5F5F2',
                            border: '1px solid #E2E2DC',
                            borderRadius: 6,
                          }}
                          className="font-mono text-[11px] font-bold text-[#0A0A0A] px-2 py-0.5 inline-block"
                        >
                          {c.cid}
                        </span>
                      </td>

                      {/* Requisition */}
                      <td className="py-3.5 px-4">
                        <div className="text-[12.5px] font-bold text-[#0A0A0A]">
                          {c.requisition_title || 'Software Engineer'}
                        </div>
                        <div className="text-[11px] text-[#8A8A85]">
                          {c.company_name || 'Bearitt'}
                        </div>
                      </td>

                      {/* Portal Status */}
                      <td className="py-3.5 px-4">
                        {c.hasAccess ? (
                          <span
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: 999,
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-0.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Active</span>
                          </span>
                        ) : c.isRevoked ? (
                          <span
                            style={{
                              backgroundColor: '#F5F5F2',
                              border: '1px solid #E2E2DC',
                              color: '#8A8A85',
                              borderRadius: 999,
                            }}
                            className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 line-through"
                          >
                            Revoked
                          </span>
                        ) : (
                          <span
                            style={{
                              backgroundColor: '#F5F5F2',
                              border: '1px solid #E2E2DC',
                              color: '#8A8A85',
                              borderRadius: 999,
                            }}
                            className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5"
                          >
                            No Access
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.hasAccess ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditUser({
                                    id: user.id,
                                    _name: user.name,
                                    _password: '',
                                    candidate_id: user.candidate_id,
                                  })
                                }
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E2DC',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(user, false)}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #FCA5A5',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-bold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                              >
                                Revoke
                              </button>
                            </>
                          ) : c.isRevoked ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(user, true)}
                                style={{
                                  backgroundColor: '#0A0A0A',
                                  color: '#FFFFFF',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-extrabold hover:bg-[#262626] transition-colors cursor-pointer"
                              >
                                Re-activate
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditUser({
                                    id: user.id,
                                    _name: user.name,
                                    _password: '',
                                    candidate_id: user.candidate_id,
                                  })
                                }
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E2DC',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(user.id)}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #FCA5A5',
                                  borderRadius: 8,
                                }}
                                className="px-2.5 py-1 text-[11.5px] font-bold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCreateEmail(c.candidate_email || '');
                                setCreateName(c.candidate_name || '');
                                setCreateCandidateId(c.cid);
                                setCreatePassword('');
                                setShowCreate(true);
                              }}
                              style={{
                                backgroundColor: '#0A0A0A',
                                color: '#FFFFFF',
                                borderRadius: 8,
                              }}
                              className="px-3 py-1.2 text-[11.5px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              + Create Access
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(6px)',
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E2DC',
              borderRadius: 18,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              width: 440,
            }}
            className="p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E2DC]">
              <div>
                <h3 className="text-base font-black text-[#0A0A0A]">
                  Create Portal Access
                </h3>
                <p className="text-[12px] text-[#8A8A85]">
                  Candidate ID: <span className="font-mono font-bold text-[#0A0A0A]">{createCandidateId}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-[#8A8A85] hover:text-[#0A0A0A] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#8A8A85] mb-1">
                  Candidate Name
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  style={{
                    backgroundColor: '#F5F5F2',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="w-full px-3.5 py-2 text-[13px] font-bold text-[#0A0A0A] outline-hidden focus:bg-[#FFFFFF] focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#8A8A85] mb-1">
                  Portal Login Email
                </label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  style={{
                    backgroundColor: '#F5F5F2',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="w-full px-3.5 py-2 text-[13px] font-bold text-[#0A0A0A] outline-hidden focus:bg-[#FFFFFF] focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#8A8A85] mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="At least 4 characters"
                  style={{
                    backgroundColor: '#F5F5F2',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="w-full px-3.5 py-2 text-[13px] font-bold text-[#0A0A0A] outline-hidden focus:bg-[#FFFFFF] focus:border-[#0A0A0A]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E2DC]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="px-4 py-2 text-[12px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: '#0A0A0A',
                    color: '#FFFFFF',
                    borderRadius: 10,
                  }}
                  className="px-4 py-2 text-[12px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs disabled:opacity-60"
                >
                  {submitting ? 'Creating...' : 'Create Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(6px)',
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E2DC',
              borderRadius: 18,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              width: 440,
            }}
            className="p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E2DC]">
              <div>
                <h3 className="text-base font-black text-[#0A0A0A]">
                  Edit Candidate Credentials
                </h3>
                <p className="text-[12px] text-[#8A8A85]">
                  ID: <span className="font-mono font-bold text-[#0A0A0A]">{editUser.candidate_id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="text-[#8A8A85] hover:text-[#0A0A0A] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#8A8A85] mb-1">
                  Candidate Name
                </label>
                <input
                  type="text"
                  required
                  value={editUser._name}
                  onChange={(e) => setEditUser({ ...editUser, _name: e.target.value })}
                  style={{
                    backgroundColor: '#F5F5F2',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="w-full px-3.5 py-2 text-[13px] font-bold text-[#0A0A0A] outline-hidden focus:bg-[#FFFFFF] focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#8A8A85] mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editUser._password}
                  onChange={(e) => setEditUser({ ...editUser, _password: e.target.value })}
                  placeholder="Optional new password"
                  style={{
                    backgroundColor: '#F5F5F2',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="w-full px-3.5 py-2 text-[13px] font-bold text-[#0A0A0A] outline-hidden focus:bg-[#FFFFFF] focus:border-[#0A0A0A]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E2DC]">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 10,
                  }}
                  className="px-4 py-2 text-[12px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: '#0A0A0A',
                    color: '#FFFFFF',
                    borderRadius: 10,
                  }}
                  className="px-4 py-2 text-[12px] font-extrabold hover:bg-[#262626] transition-all cursor-pointer shadow-2xs disabled:opacity-60"
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
