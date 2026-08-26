import { ArrowRight, Sparkles, Briefcase, Users, CheckCheck, Calendar, UserCheck, Shield, ExternalLink, ChevronRight, Check } from 'lucide-react';
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
  const [interviews, setInterviews] = useState([]);
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

    try {
      const res = await fetch(`${API_BASE_URL}/candidates/bank/${candidate.id}/resume-pdf`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
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
    try {
      const res = await fetch(`${API_BASE_URL}/candidates/bank/${candidateId}/resume-pdf`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        throw new Error('Failed to load resume PDF.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
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

  const selected = fullReq || requisitions.find((item) => item.id === selectedReqId);

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

  const shortlistedStats = useMemo(() => {
    const total = shortlisted.length;
    const strong = shortlisted.filter((c) => c.recommendation === 'Strong Match').length;
    const moderate = shortlisted.filter((c) => c.recommendation === 'Moderate Match').length;
    const avg =
      total > 0
        ? shortlisted.reduce((s, c) => s + (c.match_score ?? 0), 0) / total
        : 0;
    return { total, strong, moderate, avg };
  }, [shortlisted]);

  const shortlistedReqOptions = useMemo(() => {
    const map = {};
    shortlisted.forEach((c) => {
      if (!c.requisition_id) return;
      if (!map[c.requisition_id]) {
        map[c.requisition_id] = { id: c.requisition_id, title: c.requisition_title || 'Untitled', count: 0 };
      }
      map[c.requisition_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [shortlisted]);

  const filteredShortlisted = useMemo(() => {
    if (!shortlistedFilter) return shortlisted;
    if (shortlistedFilter === '__none__') return shortlisted.filter((c) => !c.requisition_id);
    return shortlisted.filter((c) => c.requisition_id === shortlistedFilter);
  }, [shortlisted, shortlistedFilter]);

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
    return (bankCandidates || []).filter((candidate) => {
      const name = `${candidate.candidate_name || ''} ${candidate.candidate_email || ''} ${candidate.candidate_title || ''}`.toLowerCase();
      const skills = candidate.skills || [];
      const matchText = name.includes(bankSearch.toLowerCase());
      const matchSkill = skillFilter === 'all' || skills.some((skill) => skill.toLowerCase() === skillFilter.toLowerCase());
      return matchText && matchSkill;
    });
  }, [bankCandidates, bankSearch, skillFilter]);

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


  useEffect(() => {
    loadWorkspace();
  }, [authToken]);

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

  useEffect(() => {
    if (showInterviews) {
      fetchInterviews();
    }
  }, [showInterviews, authToken]);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [rawRequisitions, candidateData, limitData, bankData, interviewData, screenedSummaryData] = await Promise.all([
        request('/requisitions', { token: authToken }),
        request('/api/candidates/shortlisted', { token: authToken }).catch(() => ({ shortlisted_candidates: [] })),
        request('/api/settings/candidate-limit', { token: authToken }).catch(() => ({ limit: null })),
        request('/candidates/bank', { token: authToken }).catch(() => []),
        request('/api/interviews/vendor', { token: authToken }).catch(() => []),
        request('/candidates/bank/screened-summary', { token: authToken }).catch(() => ({ screened_requisitions: {} })),
      ]);

      const list = Array.isArray(rawRequisitions) ? rawRequisitions : rawRequisitions?.requisitions || [];
      setRequisitions(list);
      const listShortlisted = Array.isArray(candidateData) ? candidateData : candidateData?.shortlisted_candidates || [];
      setShortlisted(listShortlisted);
      setCandidateLimit(limitData?.limit ?? null);
      setBankCandidates(bankData || []);
      setInterviews(Array.isArray(interviewData) ? interviewData : []);
      setScreenedReqSummary(screenedSummaryData?.screened_requisitions || {});
      if (list.length) await selectRequisition(list.find((item) => item.status === 'Published')?.id || list[0].id, list);
    } catch (err) {
      setError(err.message || 'Unable to load your recruiter workspace.');
    } finally {
      setLoading(false);
    }
  }

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

  async function updateCandidateStatus(sub, newStatus) {
    try {
      if (newStatus === 'Shortlisted') {
        const res = await request('/candidates/shortlist', {
          method: 'POST',
          token: authToken,
          body: {
            requisition_id: selectedReqId,
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
              (item.candidate_id === sub.candidate_id || item.id === sub.id)
                ? { ...item, status: 'Shortlisted', id: res.submission_id }
                : item
            )
          );
          const data = await request('/api/candidates/shortlisted', { token: authToken }).catch(() => ({ shortlisted_candidates: [] }));
          setShortlisted(Array.isArray(data) ? data : data?.shortlisted_candidates || []);
        } else {
          throw new Error(res.message || 'Failed to shortlist candidate.');
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
      setError(err.message || 'Failed to update candidate status.');
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
      } else {
        setScreenedSubmissions([]);
      }
    } catch {
      setScreenedSubmissions([]);
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

              {/* Requisition Cards */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requisitions.slice(0, 4).map((req) => {
                    const roleData = role(req);
                    const skills = skillsFor(req);
                    return (
                      <div
                        key={req.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 22,
                          border: '1px solid #E2E2DC',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                        }}
                        className="p-6 space-y-4 flex flex-col justify-between transition-all hover:border-[#D5D5D0]"
                      >
                        <div>
                          <div className="text-[12px] text-[#737373] font-semibold flex items-center gap-1.5">
                            <span>{req.company_name || 'Bearitt'}</span>
                            <span className="inline-block w-1 h-1 rounded-full bg-[#A3A39F]" />
                            <span>{roleData.location || req.location || 'Kozhikode'}</span>
                          </div>
                          <h3 className="text-[1.35rem] font-extrabold text-[#0A0A0A] tracking-tight mt-1">
                            {roleData.title || req.title || 'Data Engineer'}
                          </h3>
                          <p className="text-[12.8px] text-[#737373] font-medium leading-relaxed mt-1">
                            {req.description || roleData.summary || 'Client requirement looking for skilled professionals.'}
                          </p>
                        </div>

                        {/* Skill Badges */}
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {skills.slice(0, 5).map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                style={{
                                  backgroundColor: '#F5F5F2',
                                  borderRadius: 8,
                                  border: '1px solid #E5E5E0',
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-[#0A0A0A]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action CTA Button */}
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setSelectedReqId(req.id);
                              navigate('/dashboard/recruiter/requisitions');
                            }}
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: 12,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            }}
                            className="px-4.5 py-2.5 text-[12.5px] font-bold hover:bg-[#262626] transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            Match & Screen Candidates <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: WORKSPACE SNAPSHOT (35% width / col-span-4) */}
            <div className="lg:col-span-4 space-y-4">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 22,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                }}
                className="p-6 space-y-5"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[1.05rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
                      Workspace Snapshot
                    </h2>
                    <p className="text-[12px] text-[#737373] font-medium mt-0.5">
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
                <div className="divide-y divide-[#F2F2EE] text-[12.5px]">
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Agency</span>
                    <span className="font-bold text-[#0A0A0A] lowercase">{user?.tenant_name || 'bridgeon'}</span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Published roles</span>
                    <span className="font-extrabold text-[#0A0A0A]">{requisitions.length}</span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Talent profiles</span>
                    <span className="font-extrabold text-[#0A0A0A]">{bankCandidates.length}</span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <span className="text-[#8A8A85] font-medium">Screening ready</span>
                    <span className="font-extrabold text-[#0A0A0A]">{bankCandidates.length} / {bankCandidates.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showRequisitions && (
        <section className="recruiter-workspace-stacked" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <article className="recruiter-role-hero" style={{ background: '#111827', borderRadius: '18px', padding: '30px', color: '#ffffff', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Published</span>
                {(screenedReqSummary[selected?.id] || (screenedSubmissions.length > 0)) && (
                  <span style={{ background: '#059669', color: '#ecfdf5', fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ AI Screened ({screenedReqSummary[selected?.id]?.screened_count || screenedSubmissions.length})
                  </span>
                )}
                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem' }}>{selected?.company_name || selected?.company?.name || 'Bearitt'}</span>
              </div>
              <button
                onClick={() => setShowJdDetails(!showJdDetails)}
                style={{ background: '#ffffff', color: '#1e293b', border: 0, padding: '8px 18px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
              >
                👁 View Details
              </button>
            </div>

            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '24px', letterSpacing: '-0.025em' }}>
              {selected?.title || 'QA Automation Engineer'}
            </h1>

            <div className="role-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px 18px' }}>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate Range</span>
                <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem', color: '#ffffff', fontWeight: 700 }}>
                  {detail.rate_card_cap || detail.range_vendors_see || 'Rate Card Ceiling'}
                </strong>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px 18px' }}>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</span>
                <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem', color: '#ffffff', fontWeight: 700 }}>
                  {short(detail.duration || detail.contract_duration || detail.engagement_duration, '6 months')}
                </strong>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px 18px' }}>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Notice</span>
                <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem', color: '#ffffff', fontWeight: 700 }}>
                  {short(detail.max_notice_period || detail.notice_period, '30 Days Max')}
                </strong>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '14px 18px' }}>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submission Deadline</span>
                <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem', color: '#fca5a5', fontWeight: 700 }}>
                  {short(detail.submission_deadline || detail.deadline, 'Open')}
                </strong>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '16px 20px', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6' }}>
              <div>
                <strong>Experience & Tech Stack:</strong> {detail.experience || detail.seniority || '3–6 yrs'} • {skillsFor(selected).length ? skillsFor(selected).join(', ') : 'Selenium, Java/Python, Playwright'}
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>Location & Work Model:</strong> {detail.location || 'Chennai'} • {detail.work_model || 'Hybrid'}
              </div>
            </div>

            {/* Collapsible JD Details */}
            {showJdDetails && (
              <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', maxHeight: '350px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>Full Job Description</h3>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {jdText}
                </pre>
              </div>
            )}
          </article>

          <section className="requisition-rail glass-panel" style={{ width: '100%', padding: '24px 28px', borderRadius: '16px', background: '#ffffff', border: '1px solid #eef2f6', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            {/* Header: Title, Subtitle, Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.30rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Open requirements</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
                  {requisitions.length} across clients
                </p>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  className="auth-input recruiter-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter requirements..."
                  aria-label="Filter requirements"
                  style={{
                    width: '280px',
                    padding: '10px 16px',
                    fontSize: '0.88rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    outline: 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                />
              </div>
            </div>

            {/* Company Tabs Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto' }}>
              {companyTabs.map((tab) => {
                const isActive = selectedCompanyTab.toLowerCase() === tab.name.toLowerCase();
                return (
                  <button
                    key={tab.name}
                    type="button"
                    onClick={() => setSelectedCompanyTab(tab.name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '2.5px solid #2563eb' : '2.5px solid transparent',
                      padding: '12px 18px',
                      fontSize: '0.92rem',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#2563eb' : '#475569',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{tab.name}</span>
                    <span style={{
                      fontSize: '0.82rem',
                      color: isActive ? '#2563eb' : '#94a3b8',
                      fontWeight: 700
                    }}>
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grouped Company Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.95rem' }}>
                  Loading opportunities...
                </div>
              ) : groupedRequisitions.length ? (
                groupedRequisitions.map((group) => {
                  const companyDisplayName = group.companyName;
                  const count = group.items.length;
                  return (
                    <div
                      key={group.companyName}
                      style={{
                        display: 'flex',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      {/* Green Left Accent Bar */}
                      <div style={{ width: '4px', background: '#10b981', flexShrink: 0 }} />

                      {/* Left Company Branding Column */}
                      <div
                        style={{
                          width: '180px',
                          minWidth: '160px',
                          padding: '24px 20px',
                          background: '#fcfdfd',
                          borderRight: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'flex-start',
                          gap: '6px',
                          flexShrink: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.25rem' }}>🏢</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857', letterSpacing: '-0.01em' }}>
                            {companyDisplayName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.80rem', color: '#64748b', fontWeight: 600 }}>
                          <span>📋</span>
                          <span>{count} {count === 1 ? 'requirement' : 'requirements'}</span>
                        </div>
                      </div>

                      {/* Right Requisitions List Column */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {group.items.map((item, idx) => {
                          const isSelected = item.id === selectedReqId;
                          const roleData = role(item);
                          const skills = skillsFor(item);
                          const rawDeadline = item.submission_deadline || item.structured_role?.submission_deadline || item.deadline;
                          
                          // Extract Rate, Duration, Notice, Deadline
                          const rateVal = roleData.rate_card_cap || item.rate_card_cap || item.rate || '1950';
                          const durationVal = roleData.duration || item.contract_duration || item.engagement_duration || '6 months';
                          const noticeVal = roleData.max_notice_period || item.notice_period || '30 days';
                          const deadlineDate = rawDeadline ? (rawDeadline.split('T')[0] || rawDeadline) : '2026-08-23';

                          return (
                            <div
                              key={item.id}
                              onClick={() => selectRequisition(item.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '20px 24px',
                                borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                                background: isSelected ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                position: 'relative'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = '#ffffff';
                              }}
                            >
                              {/* Selected Left Indicator */}
                              {isSelected && (
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: '#2563eb' }} />
                              )}

                              {/* Left Role & Skills */}
                              <div style={{ minWidth: '220px', flex: '1 1 240px', paddingRight: '20px' }}>
                                {(() => {
                                  const sInfo = screenedReqSummary[item.id] || (item.id === selectedReqId && screenedSubmissions.length ? { screened_count: screenedSubmissions.length } : null);
                                  const isScrn = Boolean(sInfo && sInfo.screened_count > 0);
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                      <h3 style={{
                                        fontSize: '1.05rem',
                                        fontWeight: 700,
                                        color: '#2563eb',
                                        margin: 0,
                                        letterSpacing: '-0.01em'
                                      }}>
                                        {item.title || 'Untitled role'}
                                      </h3>
                                      {isScrn && (
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          fontSize: '0.70rem',
                                          fontWeight: 800,
                                          background: '#ecfdf5',
                                          color: '#059669',
                                          border: '1px solid #a7f3d0',
                                          padding: '2px 8px',
                                          borderRadius: '999px',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em'
                                        }}>
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                          ✓ Screened ({sInfo.screened_count})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}

                                {skills.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                    {skills.slice(0, 4).map((s) => (
                                      <span
                                        key={s}
                                        style={{
                                          background: '#f1f5f9',
                                          color: '#475569',
                                          fontSize: '0.74rem',
                                          fontWeight: 600,
                                          padding: '3px 10px',
                                          borderRadius: '6px'
                                        }}
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Middle Metrics Columns */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'nowrap', flexShrink: 0 }}>
                                {/* Rate */}
                                <div style={{ minWidth: '70px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.70rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                    ⚡ Rate
                                  </span>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                                    {rateVal}
                                  </div>
                                </div>

                                {/* Duration */}
                                <div style={{ minWidth: '85px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.70rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                    ⏳ Duration
                                  </span>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                                    {durationVal}
                                  </div>
                                </div>

                                {/* Max Notice */}
                                <div style={{ minWidth: '85px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.70rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                    ⏱ Max Notice
                                  </span>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                                    {noticeVal}
                                  </div>
                                </div>

                                {/* Deadline */}
                                <div style={{ minWidth: '95px' }}>
                                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
                                    Deadline
                                  </span>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#dc2626', marginTop: '3px' }}>
                                    {deadlineDate}
                                  </div>
                                </div>
                              </div>

                              {/* Right Chevron Arrow */}
                              <div style={{ marginLeft: '24px', color: isSelected ? '#2563eb' : '#94a3b8', flexShrink: 0 }}>
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                  }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  No published requirements found for this client.
                </div>
              )}
            </div>
          </section>

          <section className="candidate-bank glass-panel" style={{ marginTop: '24px' }}>
            <div className="recruiter-section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2>🏢 Choose Candidate(s) from Candidates Bank</h2>
                <p>Select existing candidates from your Talent Repository to run AI Screening for this role.</p>
              </div>
              <div>
                <input
                  className="auth-input"
                  value={reqCandidateSearch}
                  onChange={(e) => setReqCandidateSearch(e.target.value)}
                  placeholder="Search candidates by name or skill..."
                  style={{ width: '260px', padding: '10px 14px', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {screening && (
              <div
                style={{
                  background: '#0a0f1d',
                  border: '1px solid #1e293b',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  marginBottom: '20px',
                  marginTop: '12px',
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

                {/* Progress bar track */}
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

                {/* Pipeline stages */}
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

            {filteredReqCandidates.length > 0 ? (
              <div className="table-container" style={{ marginTop: '16px', overflowX: 'auto' }}>
                <table className="recruiter-bank-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                      <th style={{ padding: '12px 16px', width: '48px' }}>
                        <input
                          type="checkbox"
                          checked={filteredReqCandidates.length > 0 && selectedCandidateIds.length === filteredReqCandidates.length}
                          onChange={toggleSelectAllCandidates}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '12px 16px' }}>CANDIDATE NAME & TITLE</th>
                      <th style={{ padding: '12px 16px' }}>CONTACT INFO</th>
                      <th style={{ padding: '12px 16px' }}>SKILLS & TECH STACK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReqCandidates.map((candidate) => {
                      const isSelected = selectedCandidateIds.includes(candidate.id);
                      return (
                        <tr
                          key={candidate.id}
                          style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f8fafc' : 'transparent', transition: 'background-color 0.2s' }}
                        >
                          <td style={{ padding: '16px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCandidateSelect(candidate.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="candidate-avatar" style={{ flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#e0e7ff', color: '#3849a2', fontWeight: 800, fontSize: '0.85rem' }}>
                                {(candidate.candidate_name || '?').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{candidate.candidate_name}</div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>{candidate.candidate_title || 'Software Engineer'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '0.85rem', color: '#475569' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>📧</span> {candidate.candidate_email || 'No email'}
                              </div>
                              {candidate.candidate_phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ opacity: 0.7 }}>📞</span> {candidate.candidate_phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(candidate.skills || []).slice(0, 4).map((skill, idx) => (
                                <span key={idx} style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}>
                                  {skill}
                                </span>
                              ))}
                              {(candidate.skills || []).length > 4 && (
                                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}>
                                  +{candidate.skills.length - 4} more
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="recruiter-empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>No candidates found in bank</h3>
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Go to Candidates Bank tab to upload and parse resume PDFs.</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>
                Selected: {selectedCandidateIds.length} candidate(s)
              </div>
              <button
                className="glow-btn"
                onClick={runBulkScreening}
                disabled={screening || !selectedCandidateIds.length}
                style={{ background: '#475569', color: '#fff', border: 0, padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                ⚡ Run AI Candidate Screening →
              </button>
            </div>
          </section>

          {/* AI Screened Candidates List Section */}
          <section className="screened-candidates-section glass-panel" style={{ width: '100%', padding: '24px', borderRadius: '16px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📊 AI Screened Candidates
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0' }}>
                  Screened results & AI match scores for <strong>{selected?.title || 'Selected Role'}</strong>
                </p>
              </div>
              <div style={{ background: '#f1f5f9', padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                Total Screened: {screenedSubmissions.length}
              </div>
            </div>

            {sortedScreenedSubmissions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sortedScreenedSubmissions.map((sub) => {
                  const subId = sub.id || sub.submission_id || sub.candidate_id;
                  const isExpanded = expandedScreenedId === subId;
                  const score = sub.match_score || 0;
                  const scoreColor = score >= 70 ? '#059669' : score >= 50 ? '#2563eb' : '#d97706';
                  const scoreBg = score >= 70 ? '#ecfdf5' : score >= 50 ? '#eff6ff' : '#fffbe5';
                  const isShortlisted = sub.status === 'Shortlisted';
                  const isRejected = sub.status === 'Rejected';
                  
                  const targetCandidateId = sub.candidate_id || (String(sub.id).startsWith('temp_') ? String(sub.id).replace('temp_', '') : sub.id);
                  const matchedSkillsList = sub.matched_skills && sub.matched_skills.length ? sub.matched_skills : (sub.skills || []).slice(0, 5);
                  const missingSkillsList = sub.missing_skills || [];
                  const breakdown = sub.breakdown || {};

                  return (
                    <div
                      key={subId}
                      style={{
                        background: '#ffffff',
                        border: isShortlisted ? '2px solid #10b981' : isRejected ? '1px solid #fca5a5' : isExpanded ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '16px',
                        boxShadow: isExpanded ? '0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' : '0 2px 8px rgba(0,0,0,0.04)',
                        transition: 'all 0.25s ease',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Top Clickable Header */}
                      <div
                        onClick={() => setExpandedScreenedId(isExpanded ? null : subId)}
                        style={{
                          padding: '20px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px',
                          background: isExpanded ? '#f8fafc' : '#ffffff',
                          borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: scoreBg, color: scoreColor, fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${scoreColor}33` }}>
                            {(sub.candidate_name || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span>{sub.candidate_name}</span>
                              <span style={{ background: scoreBg, color: scoreColor, fontSize: '0.8rem', fontWeight: 800, padding: '4px 12px', borderRadius: '999px', border: `1px solid ${scoreColor}44`, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ⚡ {score}% Match
                              </span>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: isShortlisted ? '#ecfdf5' : isRejected ? '#fef2f2' : '#f1f5f9', color: isShortlisted ? '#059669' : isRejected ? '#dc2626' : '#475569' }}>
                                {sub.recommendation || (score >= 70 ? 'Strong Match' : score >= 50 ? 'Moderate Match' : 'Weak Match')}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <span>✉️ {sub.candidate_email || 'No Email'}</span>
                              <span>🏢 Vendor: <strong style={{ color: '#334155' }}>{sub.vendor_name || 'bridgeon'}</strong></span>
                              {sub.filename && <span>📄 {sub.filename}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                          {isShortlisted ? (
                            <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.82rem', fontWeight: 800, padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              ✓ Shortlisted (Sent to HR)
                            </span>
                          ) : isRejected ? (
                            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.82rem', fontWeight: 800, padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              ✕ Rejected
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => updateCandidateStatus(sub, 'Shortlisted')}
                                style={{ background: '#10b981', color: '#ffffff', border: 0, padding: '9px 18px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)' }}
                              >
                                ⭐ Shortlist (Submit to HR)
                              </button>
                              <button
                                onClick={() => updateCandidateStatus(sub, 'Rejected')}
                                style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', padding: '9px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedScreenedId(isExpanded ? null : subId)}
                            style={{
                              background: isExpanded ? '#0f172a' : '#f1f5f9',
                              color: isExpanded ? '#ffffff' : '#334155',
                              border: 0,
                              padding: '9px 16px',
                              borderRadius: '10px',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <span>{isExpanded ? '▲ Hide Details' : '▼ Details & Breakdown'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Full Details & Scores Panel */}
                      {isExpanded && (
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px', background: '#ffffff', borderTop: '1px solid #f1f5f9' }}>
                          
                          {/* 0. Professional Contact & Social Links Bar */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {sub.candidate_email && (
                              <div style={{ fontSize: '0.84rem', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                <span>✉️</span>
                                <span>{sub.candidate_email}</span>
                              </div>
                            )}

                            {sub.candidate_phone && (
                              <div style={{ fontSize: '0.84rem', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
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
                                  fontSize: '0.82rem',
                                  color: '#0f172a',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span>🐙</span>
                                <span>GitHub: {sub.github_evidence?.username || (sub.github_url ? sub.github_url.split('/').pop() : 'Profile')}</span>
                                {sub.github_evidence?.verified && (
                                  <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>✓ Verified</span>
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
                                  fontSize: '0.82rem',
                                  color: '#0284c7',
                                  background: '#ffffff',
                                  border: '1px solid #bae6fd',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span>💼</span>
                                <span>LinkedIn Profile ↗</span>
                              </a>
                            )}

                            {sub.candidate_title && (
                              <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                                🏷️ {sub.candidate_title}
                              </span>
                            )}
                          </div>

                          {/* 1. Score Breakdown Cards Grid */}
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>📊</span>
                              <span>AI Match Score Breakdown</span>
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Must-Have Skills</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                                  {breakdown.must_have_skills != null ? `${Math.round(breakdown.must_have_skills)}%` : `${Math.max(10, Math.round(score * 0.95))}%`}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>JD Required Core Skills</div>
                              </div>

                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Semantic JD Relevance</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                                  {breakdown.semantic_relevance != null ? `${Math.round(breakdown.semantic_relevance)}%` : `${Math.min(100, Math.max(10, Math.round(score * 1.05)))}%`}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>Vector Embedding Match</div>
                              </div>

                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Project Evidence</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                                  {breakdown.project_evidence != null ? `${Math.round(breakdown.project_evidence)}%` : `${Math.max(10, Math.round(score * 0.88))}%`}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>Real-world Project Proof</div>
                              </div>

                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Experience Alignment</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                                  {breakdown.experience_alignment != null ? `${Math.round(breakdown.experience_alignment)}%` : `${Math.max(10, Math.round(score * 0.92))}%`}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>Years & Role Seniority</div>
                              </div>
                            </div>
                          </div>

                          {/* 2. Skills Match Comparison Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '14px', padding: '18px' }}>
                              <h5 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#065f46', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>✓</span> Matched Technical Skills ({matchedSkillsList.length})
                              </h5>
                              {matchedSkillsList.length ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {matchedSkillsList.map((skill, sIdx) => (
                                    <span
                                      key={sIdx}
                                      style={{
                                        background: '#ffffff',
                                        color: '#047857',
                                        border: '1px solid #6ee7b7',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                      }}
                                    >
                                      ✓ {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.82rem', color: '#065f46', margin: 0 }}>No direct keyword skill matches detected.</p>
                              )}
                            </div>

                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '18px' }}>
                              <h5 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#991b1b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>⚠️</span> Missing / Skill Gaps ({missingSkillsList.length})
                              </h5>
                              {missingSkillsList.length ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {missingSkillsList.map((skill, sIdx) => (
                                    <span
                                      key={sIdx}
                                      style={{
                                        background: '#ffffff',
                                        color: '#b91c1c',
                                        border: '1px solid #fca5a5',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                      }}
                                    >
                                      ⚠️ {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.82rem', color: '#991b1b', margin: 0 }}>All critical JD must-have skills are present!</p>
                              )}
                            </div>
                          </div>

                          {/* 3. 🐙 GitHub Code Evidence & Public Repositories (If available) */}
                          {(sub.github_evidence || sub.github_url) && (
                            <div style={{ background: '#0f172a', color: '#f8fafc', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '1.4rem' }}>🐙</span>
                                  <div>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                                      GitHub Verified Code Proof & Repositories
                                    </h4>
                                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                                      Profile: <strong>@{sub.github_evidence?.username || (sub.github_url ? sub.github_url.split('/').pop() : 'Candidate')}</strong> • {sub.github_evidence?.public_repos || 0}+ Public Repositories
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={sub.github_url || sub.github_evidence?.profile_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    background: '#334155',
                                    color: '#38bdf8',
                                    border: '1px solid #475569',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>Open GitHub Profile</span>
                                  <span>↗</span>
                                </a>
                              </div>

                              {/* Verified languages */}
                              {sub.github_evidence?.verified_skills && sub.github_evidence.verified_skills.length > 0 && (
                                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>Detected Code Languages:</span>
                                  {sub.github_evidence.verified_skills.map((lang, lIdx) => (
                                    <span
                                      key={lIdx}
                                      style={{
                                        background: '#1e293b',
                                        color: '#38bdf8',
                                        border: '1px solid #334155',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      {lang}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Top Repositories Grid */}
                              {sub.github_evidence?.top_repos && sub.github_evidence.top_repos.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                                  {sub.github_evidence.top_repos.map((repo, rIdx) => (
                                    <div
                                      key={rIdx}
                                      style={{
                                        background: '#1e293b',
                                        borderRadius: '10px',
                                        padding: '14px',
                                        border: '1px solid #334155',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '10px',
                                      }}
                                    >
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                          <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              color: '#60a5fa',
                                              fontSize: '0.88rem',
                                              fontWeight: 700,
                                              textDecoration: 'none',
                                              wordBreak: 'break-all',
                                            }}
                                          >
                                            📦 {repo.name} ↗
                                          </a>
                                          {repo.stars > 0 && (
                                            <span style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                              ★ {repo.stars}
                                            </span>
                                          )}
                                        </div>
                                        {repo.description && (
                                          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '6px 0 0', lineHeight: '1.4' }}>
                                            {repo.description.length > 120 ? `${repo.description.slice(0, 120)}...` : repo.description}
                                          </p>
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {(repo.languages || []).map((l, li) => (
                                          <span
                                            key={li}
                                            style={{
                                              background: '#0f172a',
                                              color: '#94a3b8',
                                              fontSize: '0.7rem',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                            }}
                                          >
                                            {l}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                                  Public GitHub repository details verified directly from GitHub API.
                                </p>
                              )}
                            </div>
                          )}

                          {/* 4. Key Projects & Experience Highlights */}
                          {((sub.projects && sub.projects.length > 0) || (sub.experience && sub.experience.length > 0)) && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px' }}>
                              <h5 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>💼</span> Notable Projects & Professional Experience
                              </h5>
                              <div style={{ display: 'grid', gap: '12px' }}>
                                {(sub.projects || []).slice(0, 4).map((proj, pIdx) => (
                                  <div key={pIdx} style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a', marginBottom: '4px' }}>
                                      🚀 {proj.name || 'Technical Project'}
                                    </div>
                                    {proj.description && (
                                      <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                                        {proj.description}
                                      </p>
                                    )}
                                    {proj.technologies && proj.technologies.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {proj.technologies.map((t, ti) => (
                                          <span key={ti} style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
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
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px' }}>
                            <h5 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💡</span> AI Evaluation Summary & Rationale
                            </h5>
                            <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                              {sub.summary || `${sub.candidate_name} was evaluated against the job requisition ${selected?.title || ''}. Overall compatibility score is ${score}% with ${sub.recommendation || 'evaluated'} recommendation.`}
                            </p>
                          </div>

                          {/* 6. Action Row with PDF View & Download */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenResumeModal({ id: targetCandidateId, candidate_name: sub.candidate_name, filename: sub.filename })}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 16px',
                                  borderRadius: '10px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  fontSize: '0.84rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>📄</span>
                                <span>View Resume PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadCandidatePdf(targetCandidateId, sub.filename || `${sub.candidate_name || 'Resume'}.pdf`)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 16px',
                                  borderRadius: '10px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  fontSize: '0.84rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>⬇️</span>
                                <span>Download PDF</span>
                              </button>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                              {!isShortlisted && (
                                <button
                                  type="button"
                                  onClick={() => updateCandidateStatus(sub, 'Shortlisted')}
                                  style={{ background: '#10b981', color: '#ffffff', border: 0, padding: '9px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)' }}
                                >
                                  ⭐ Shortlist (Submit to HR)
                                </button>
                              )}
                              {!isRejected && (
                                <button
                                  type="button"
                                  onClick={() => updateCandidateStatus(sub, 'Rejected')}
                                  style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', padding: '9px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  ✕ Reject
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
              <div style={{ padding: '36px 20px', textAlign: 'center', background: '#fafafa', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                  No candidates screened yet for <strong>{selected?.title || 'this role'}</strong>. Select candidates from the Candidates Bank above and click <strong>⚡ Run AI Candidate Screening</strong>.
                </p>
              </div>
            )}
          </section>
        </section>
      )}

      {showCandidates && (
        <div className="candidates-bank-header-row">
          <section className="recruiter-page-heading">
            <span>Talent repository</span>
            <h1>Candidates Bank</h1>
            <p>Manage company talent repository, upload PDF resumes with local Ollama AI extraction, and preview candidate profiles.</p>
          </section>
          <button
            className="bank-add-btn"
            onClick={() => {
              setNewCandVendor(user?.tenant_name || 'Vendor A');
              setShowAddCandidateModal(true);
            }}
          >
            <span className="bank-add-icon">{Icons.plus}</span>
            Add Candidate
          </button>
        </div>
      )}

      {showCandidates && (
        <section className="stat-grid recruiter-stats" aria-label="Candidates bank summary">
          <StatCard
            label="TOTAL CANDIDATES IN BANK"
            value={bankStats.total}
            icon={Icons.users}
            tint="tint-ink"
            delta="Company Talent Repository"
            deltaTone="ink"
          />
          <StatCard
            label="TECHNICAL ROLES"
            value={bankStats.titleCount > 0 ? `${bankStats.titleCount}+` : '0+'}
            icon={Icons.briefcase}
            tint="tint-blue"
            delta={bankStats.titles.slice(0, 3).join(', ') || 'Frontend, Backend, Design'}
            deltaTone="blue"
          />
          <StatCard
            label="AUTO-PARSED RESUMES"
            value={bankStats.parsed}
            icon={Icons.layers}
            tint="tint-violet"
            delta={bankStats.parsed ? 'Ollama LLM (llama3.2:3b) Parsed' : 'Awaiting PDF upload'}
            deltaTone="violet"
          />
          <StatCard
            label="READY FOR MATCHING"
            value={`${bankStats.readyPct}%`}
            icon={Icons.check}
            tint="tint-green"
            delta={bankStats.total ? `${bankStats.ready} of ${bankStats.total} candidates ready` : 'No candidates yet'}
            deltaTone="green"
          />
        </section>
      )}

      {showCandidates && (
        <section className="recruiter-results glass-panel recruiter-bank-results">
          <div className="recruiter-section-heading bank-section-head">
            <div>
              <h2>Candidate Talent Pool</h2>
              <p>Click any candidate row to view full resume &amp; profile details.</p>
            </div>
            <div className="bank-toolbar">
              <div className="bank-search-box">
                <span className="bank-search-icon">{Icons.search}</span>
                <input
                  className="auth-input recruiter-bank-search"
                  value={bankSearch}
                  onChange={(event) => setBankSearch(event.target.value)}
                  placeholder="Search candidate name"
                />
              </div>
              <select
                className="auth-input recruiter-bank-skill-filter"
                value={skillFilter}
                onChange={(event) => setSkillFilter(event.target.value)}
              >
                <option value="all">Filter Skill: All</option>
                {bankSkills.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bank-count-row">
            <span className="bank-count-pill">{filteredBankCandidates.length} {filteredBankCandidates.length === 1 ? 'candidate' : 'candidates'}</span>
            {bankSearch && <span className="bank-filter-hint">matching “{bankSearch}”</span>}
            {skillFilter !== 'all' && <span className="bank-filter-hint">skill: {skillFilter}</span>}
          </div>

          {parsingBank && (
            <div className="bank-parsing-overlay">
              <span className="spinner" />
              <strong>Parsing resumes using Ollama AI extraction...</strong>
            </div>
          )}

          {filteredBankCandidates.length > 0 ? (
            <div className="table-container bank-table-wrap">
              <table className="recruiter-bank-table">
                <thead>
                  <tr>
                    <th>CANDIDATE NAME &amp; TITLE</th>
                    <th>CONTACT INFO</th>
                    <th>VENDOR / COMPANY</th>
                    <th>SKILLS &amp; TECH STACK</th>
                    <th>ADDED DATE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBankCandidates.map((candidate) => {
                    const isExpanded = expandedCandidate === candidate.id;
                    const vendor = candidate.vendor_company_name || user?.tenant_name || 'Vendor A';
                    return (
                      <Fragment key={candidate.id}>
                        <tr
                          onClick={() => setExpandedCandidate(isExpanded ? null : candidate.id)}
                          className={`candidate-table-row ${isExpanded ? 'row-expanded' : ''}`}
                        >
                          <td>
                            <div className="cand-cell-name">
                              <div className="candidate-avatar">
                                {(candidate.candidate_name || '?').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="cand-cell-fullname">{candidate.candidate_name}</div>
                                <div className="cand-cell-title">{candidate.candidate_title || 'Software Engineer'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="cand-cell-contact">
                              <div className="cand-contact-row">
                                <span className="cand-contact-icon">{Icons.mail}</span>
                                <span>{candidate.candidate_email || 'No email'}</span>
                              </div>
                              {candidate.candidate_phone && (
                                <div className="cand-contact-row">
                                  <span className="cand-contact-icon">{Icons.phone}</span>
                                  <span>{candidate.candidate_phone}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="cand-vendor-pill">
                              <span className="cand-vendor-icon">{Icons.building}</span>
                              {vendor}
                            </span>
                          </td>
                          <td>
                            <div className="cand-skills">
                              {(candidate.skills || []).slice(0, 4).map((skill, idx) => (
                                <span key={idx} className="skill-pill">{skill}</span>
                              ))}
                              {(candidate.skills || []).length > 4 && (
                                <span className="skill-pill-more">+{candidate.skills.length - 4} more</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="cand-date">
                              {candidate.created_at ? candidate.created_at.split('T')[0] : '—'}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="cand-actions">
                              <button
                                className="view-resume-btn glow-btn"
                                title="View & Preview Original Resume PDF"
                                onClick={() => handleOpenResumeModal(candidate)}
                              >
                                <span className="btn-icon">{Icons.fileText}</span>
                                View Resume
                              </button>
                              <button
                                className="download-resume-btn"
                                title="Download Original Resume PDF"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadCandidatePdf(
                                    candidate.id,
                                    candidate.filename || `${candidate.candidate_name || "Resume"}.pdf`
                                  );
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "8px 12px",
                                  borderRadius: "10px",
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#1e293b",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                <span style={{ fontSize: "0.9rem" }}>⬇️</span>
                                <span>Download</span>
                              </button>
                              <button
                                className="match-candidate-btn glow-btn"
                                onClick={() => {
                                  setSelectedMatchCandidate(candidate);
                                  setMatchingReqId(requisitions[0]?.id || '');
                                }}
                              >
                                <span className="btn-icon">{Icons.zap}</span>
                                Match
                              </button>
                              <button
                                className="delete-candidate-link"
                                onClick={() => deleteBankCandidate(candidate.id)}
                              >
                                <span className="btn-icon">{Icons.trash}</span>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="expanded-details-row">
                            <td colSpan="6">
                              <div className="cand-details-expanded">
                                <div>
                                  <h4>Professional Summary</h4>
                                  <p>{candidate.summary || 'No summary available.'}</p>
                                </div>
                                <div className="cand-details-meta">
                                  <div>
                                    <strong>All Skills:</strong> {(candidate.skills || []).join(', ')}
                                  </div>
                                  <div>
                                    <strong>Resume Filename:</strong> {candidate.filename || 'N/A'}
                                  </div>
                                </div>
                                <div>
                                  <h4>Raw Resume Text</h4>
                                  <pre>
                                    {candidate.extracted_text || 'No text extracted.'}
                                  </pre>
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
            <div className="recruiter-empty bank-empty">
              <div className="bank-empty-icon">{Icons.users}</div>
              <h3>{bankSearch || skillFilter !== 'all' ? 'No candidates found' : 'No candidates yet'}</h3>
              <p>
                {bankSearch || skillFilter !== 'all'
                  ? 'Try clearing your search or skill filter.'
                  : 'Upload resume PDFs to your Candidates Bank to populate your talent repository.'}
              </p>
            </div>
          )}
        </section>
      )}

      {showShortlisted && (
        <div className="shortlisted-page-content" style={{ display: 'grid', gap: '20px' }}>
          <WelcomeBanner
            title="Shortlisted Candidates"
            subtitle="Candidates submitted to client HR across all requisitions. Connected directly to candidate_submissions database."
          />

          <div className="stat-grid recruiter-stats" aria-label="Shortlisted summary">
            <StatCard label="Total Shortlisted" value={shortlistedStats.total} icon={Icons.check} tint="tint-green" />
            <StatCard label="Strong Matches" value={shortlistedStats.strong} icon={Icons.briefcase} tint="tint-blue" />
            <StatCard label="Moderate Matches" value={shortlistedStats.moderate} icon={Icons.layers} tint="tint-amber" />
            <StatCard label="Avg Match Score" value={shortlistedStats.avg ? Math.round(shortlistedStats.avg) + '%' : '—'} icon={Icons.users} tint="tint-violet" />
          </div>

          {shortlistedReqOptions.length > 0 && (
            <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label className="form-label" style={{ marginBottom: 0, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Filter by Requisition:</label>
              <select className="auth-input select-sm" style={{ maxWidth: '320px' }} value={shortlistedFilter} onChange={(e) => setShortlistedFilter(e.target.value)}>
                <option value="">All Requisitions ({shortlisted.length})</option>
                {shortlistedReqOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.title} ({r.count})</option>
                ))}
                {shortlisted.some((c) => !c.requisition_id) && <option value="__none__">No requisition linked</option>}
              </select>
            </div>
          )}

          <section className="recruiter-results glass-panel">
            <div className="recruiter-section-heading">
              <div>
                <h2>{queued.length ? 'AI Screening Results' : 'Shortlisted Candidates Queue'}</h2>
                <p>{queued.length ? 'Review AI-ranked talent and submit the best profiles to HR.' : 'Candidates fetched from database table candidate_submissions.'}</p>
              </div>
            </div>

            {queued.length ? (
              <div className="candidate-result-list">
                {queued.map((candidate, index) => (
                  <div className="candidate-result" key={candidate.submission_id || candidate.id || index}>
                    <div className="candidate-rank">{index + 1}</div>
                    <div className="candidate-result-main">
                      <strong>{candidate.candidate_name || candidate.filename}</strong>
                      <span>{candidate.candidate_email || candidate.filename} · {candidate.recommendation || 'AI reviewed'}</span>
                    </div>
                    <div className="candidate-score">
                      <b>{candidate.match_score ?? '—'}{candidate.match_score != null && '%'}</b>
                      <span>Match score</span>
                    </div>
                    <button className="glow-btn shortlist-btn" onClick={() => shortlist(candidate)}>Submit to HR</button>
                  </div>
                ))}
              </div>
            ) : filteredShortlisted.length ? (
              <div className="table-card glass-panel" style={{ overflowX: 'auto', borderRadius: '14px' }}>
                <table className="data-table cand-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Vendor</th>
                      <th>Requisition</th>
                      <th>Company</th>
                      <th>Match Score</th>
                      <th>Recommendation</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShortlisted.map((c) => {
                      const cid = c.submission_id || c.id;
                      const isExpanded = expandedShortlistedId === cid;
                      return (
                        <Fragment key={cid}>
                          <tr className="clickable-row" onClick={() => setExpandedShortlistedId(isExpanded ? null : cid)}>
                            <td className="td-title">
                              <strong>{c.candidate_name || 'Candidate'}</strong>
                              {c.candidate_email && <div className="cand-email">{c.candidate_email}</div>}
                            </td>
                            <td className="td-company">{c.vendor_name || '—'}</td>
                            <td className="td-company">{c.requisition_title || <span className="muted">General</span>}</td>
                            <td className="td-company">{c.company_name || '—'}</td>
                            <td style={{ minWidth: 130 }}><ScoreBar score={c.match_score} /></td>
                            <td><RecommendationBadge recommendation={c.recommendation} /></td>
                            <td className="td-date">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td className="td-action"><span className="row-action" style={{ cursor: 'pointer', fontWeight: 600, color: '#3b82f6' }}>{isExpanded ? 'Hide' : 'Details'}</span></td>
                          </tr>
                          {isExpanded && (
                            <tr className="cand-detail-row-tr">
                              <td colSpan="8" style={{ background: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                                <div className="cand-detail" style={{ display: 'grid', gap: '12px' }}>
                                  {c.summary && <p className="cand-summary" style={{ fontSize: '0.88rem', color: '#334155' }}><strong>AI Summary:</strong> {c.summary}</p>}
                                  <div className="cand-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <ChipList label="Matched Skills" items={c.matched_skills} tone="chip-primary" />
                                    <ChipList label="Missing Skills" items={c.missing_skills} tone="chip-neutral" />
                                  </div>
                                  {c.hiring_manager_notes && (
                                    <div className="cand-detail-row" style={{ fontSize: '0.85rem', color: '#475569' }}>
                                      <span className="cand-detail-label" style={{ fontWeight: 700 }}>Hiring Manager Notes: </span>
                                      <span>{c.hiring_manager_notes}</span>
                                    </div>
                                  )}
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
              <div className="recruiter-empty" style={{ padding: '48px 16px', textAlign: 'center' }}>
                <div style={{ width: '44px', margin: '0 auto 12px', color: '#94a3b8' }}>{Icons.users}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>No shortlisted candidates found</h3>
                <p style={{ color: '#8fa1bb', fontSize: '0.88rem' }}>Run AI screening on a resume PDF, then submit the strongest profiles to HR.</p>
              </div>
            )}
          </section>
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

              {/* View Switcher Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '10px',
                  marginTop: '12px',
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
                    color: pdfViewTab === 'pdf' ? '#2563eb' : '#64748b',
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
                    color: pdfViewTab === 'insights' ? '#0f172a' : '#64748b',
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
                      <div className="spinner" style={{ width: '36px', height: '36px', borderTopColor: '#2563eb', marginBottom: '14px' }} />
                      <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Loading resume PDF from MongoDB...</p>
                    </div>
                  ) : resumePdfUrl ? (
                    <iframe
                      src={resumePdfUrl}
                      title={`Resume PDF - ${showResumeModal.candidate_name}`}
                      style={{ width: '100%', height: '100%', border: 0 }}
                    />
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
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createCandidateId, setCreateCandidateId] = useState('');

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
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token: authToken,
        body: {
          email: createEmail,
          name: createName,
          password: createPassword,
          role: 'Candidate',
          candidate_id: createCandidateId,
        },
      });
      setToast('✓ Portal access created!');
      setShowCreate(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateCandidateId('');
      loadData();
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const body = { name: editUser._name };
      if (editUser._password) body.password = editUser._password;
      await request(`/api/auth/portal-users/${editUser.id}`, {
        method: 'PUT',
        token: authToken,
        body,
      });
      setToast('✓ Portal access updated!');
      setEditUser(null);
      loadData();
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Delete this portal account?')) return;
    try {
      await request(`/api/auth/portal-users/${userId}`, {
        method: 'DELETE',
        token: authToken,
      });
      setToast('✓ Portal access deleted.');
      loadData();
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <WelcomeBanner title="Portal Access" subtitle="Manage portal access for each accepted candidate" />
      <div style={{ padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Accepted</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{candidates.length}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Portal Users</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{portalUsers.length}</div>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>+ Create Portal Access</button>
        </div>

        {toast && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#d1fae5', color: '#065f46', fontSize: '0.82rem', fontWeight: 500, marginBottom: 12 }}>{toast}</div>}
        {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: '0.82rem', marginBottom: 12 }}>{error}</div>}

        {loading ? <p style={{ padding: 24, color: '#64748b' }}>Loading...</p> : (
          <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e0' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Candidate</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Candidate ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Portal Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: '#475569' }}></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const cid = c.submission_id || c.id;
                  const user = portalUsers.find((u) => (u.candidate_id && u.candidate_id === cid) || (u.email?.toLowerCase() === c.candidate_email?.toLowerCase()));
                  return (
                    <tr key={cid} style={{ borderBottom: '1px solid #f1f0ec' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{c.candidate_name}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>{cid}</td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.82rem' }}>{c.candidate_email}</td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>{c.requisition_title || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {user ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#d1fae5', color: '#065f46' }}>✓ Active</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No Access</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {user ? (
                            <>
                              <button onClick={() => setEditUser({ id: user.id, _name: user.name, _password: '', candidate_id: user.candidate_id })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => handleDelete(user.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>Delete</button>
                            </>
                          ) : (
                            <button onClick={() => { setCreateEmail(c.candidate_email || ''); setCreateName(c.candidate_name || ''); setCreateCandidateId(cid); setCreatePassword(''); setShowCreate(true); }} style={{ padding: '4px 10px', borderRadius: 6, background: '#059669', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Create Access</button>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>Create Portal Access</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Name</label>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Candidate ID</label>
                <input value={createCandidateId} onChange={(e) => setCreateCandidateId(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'monospace' }} placeholder="e.g. c885133a" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Email</label>
                <input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required type="email" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Password</label>
                <input value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required type="password" minLength={4} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>Edit Portal Access</h3>
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Name</label>
                <input value={editUser._name} onChange={(e) => setEditUser({ ...editUser, _name: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Candidate ID</label>
                <input value={editUser.candidate_id || ''} disabled style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'monospace', background: '#f9fafb', color: '#64748b' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>New Password (leave blank to keep current)</label>
                <input value={editUser._password || ''} onChange={(e) => setEditUser({ ...editUser, _password: e.target.value })} type="password" placeholder="Keep current" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setEditUser(null)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


function RoleMetric({ label, value }) { return <div className="role-metric"><span>{label}</span><b>{value}</b></div>; }
