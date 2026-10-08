import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import termjobsLogo from '../assets/termjobs-logo.png';
import {
  Search,
  Bell,
  Sparkles,
  ArrowRight,
  Users,
  Calendar,
  AlertTriangle,
  FileText,
  Clock,
  ChevronRight,
  MoreHorizontal,
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
  Briefcase,
  ShieldAlert,
  RotateCcw,
  ExternalLink,
  Bot,
  MessageSquare,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  Info,
  Send,
  Check,
  CheckCircle2,
  Plus,
  LayoutGrid,
  DollarSign,
  MapPin,
  ShieldCheck,
  Layers,
  X,
  BarChart2,
  Pencil,
  Building2,
  Globe,
  CalendarCheck,
  Upload,
  Shield,
  UserCheck,
  Settings,
  History,
  Menu,
  AlertCircle,
  User,
  Lock,
  LogOut,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import { interviewApi } from '../interview/services/interviewApi';
import HiringPipelineResponseCard, { parseHiringPipelineData } from '../components/HiringPipelineResponseCard';
import TeamChatDrawer from '../components/TeamChatDrawer';

marked.setOptions({
  breaks: true,
  gfm: true,
});

/* Helper to convert space-aligned pseudo-tables into standard GitHub Markdown tables (matching AiChat.jsx) */
const formatMarkdownContent = (text) => {
  if (!text) return '';
  const lines = String(text).split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (
      trimmed &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('•') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('>')
    ) {
      const parts = trimmed.split(/\s{2,}|\t+/).filter(Boolean);
      if (parts.length >= 3) {
        const tableRows = [parts];
        let j = i + 1;
        while (j < lines.length) {
          const nextTrim = lines[j].trim();
          if (
            !nextTrim ||
            nextTrim.startsWith('#') ||
            nextTrim.startsWith('-') ||
            nextTrim.startsWith('•') ||
            nextTrim.startsWith('*') ||
            nextTrim.startsWith('|')
          ) {
            break;
          }
          const nextParts = nextTrim.split(/\s{2,}|\t+/).filter(Boolean);
          if (nextParts.length >= 2) {
            tableRows.push(nextParts);
            j++;
          } else {
            break;
          }
        }

        if (tableRows.length >= 2) {
          const maxCols = Math.max(...tableRows.map((r) => r.length));
          const headerRow = [...tableRows[0]];
          while (headerRow.length < maxCols) headerRow.push('');
          result.push('');
          result.push('| ' + headerRow.join(' | ') + ' |');
          result.push('| ' + Array(maxCols).fill(':---').join(' | ') + ' |');
          for (let r = 1; r < tableRows.length; r++) {
            const row = [...tableRows[r]];
            while (row.length < maxCols) row.push('');
            result.push('| ' + row.join(' | ') + ' |');
          }
          result.push('');
          i = j;
          continue;
        }
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
};

const REQUISITION_TABS = [
  { id: 'role', label: 'Role', icon: Briefcase },
  { id: 'engagement', label: 'Engagement', icon: Clock },
  { id: 'commercials', label: 'Budget', icon: DollarSign },
  { id: 'work_setup', label: 'Work Setup', icon: MapPin },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'process', label: 'Process', icon: Calendar },
];

const ENGAGEMENT_TYPES = ['Contract', 'Contract-to-Hire', 'Full-time'];
const WORK_MODES = ['Remote', 'Hybrid', 'Onsite'];
const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'];
const RATE_BASIS_OPTIONS = ['Hourly rate', 'Monthly retainer', 'Annual package'];
const PRIORITY_OPTIONS = ['High', 'Normal', 'Low'];

const PREDEFINED_ROLES = [
  {
    id: 'python_dev',
    title: 'Python Developer',
    department: 'Core Product Engineering',
    job_family: 'Backend Engineering',
    seniority: 'Mid',
    experience_band: '3-5 yrs',
    headcount: 1,
    vendor_candidate_limit: 3,
    must_have_skills: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker'],
    nice_to_have_skills: ['AWS', 'Kafka', 'Celery', 'Django'],
    certifications: ['AWS Certified Developer'],
    engagement_type: 'Contract',
    duration: '6 Months',
    rate_basis: 'Annual package',
    ceiling_internal: '₹12,00,000 - ₹15,00,000',
    vendor_floor: '1200000',
    vendor_cap: '1500000',
    budget_cap_currency: 'INR',
    work_mode: 'Hybrid',
    primary_location: 'Bangalore / Hybrid',
    timezone: 'IST (UTC+5:30)',
    shift_hours: '9:30 AM - 6:30 PM IST',
    equipment_provided: 'Company-provided',
    bgv_required: 'Yes',
    drug_test_required: 'No',
    nda_required: 'Yes',
    ip_assignment_required: 'Yes',
    contract_template: 'Consultancy agreement',
    interview_rounds: '3 Rounds (L1 Screening, L2 Architecture/Coding, HM Review)',
    priority: 'High',
    job_description: 'We are seeking a motivated Python Developer with 3+ years of hands-on experience to join our Engineering team. You will design, develop, and maintain scalable backend services, REST APIs, and data pipelines using FastAPI and PostgreSQL.',
  },
  {
    id: 'devsecops_eng',
    title: 'DevSecOps Engineer',
    department: 'Security & Infrastructure',
    job_family: 'Platform Engineering',
    seniority: 'Senior',
    experience_band: '5-8 yrs',
    headcount: 1,
    vendor_candidate_limit: 2,
    must_have_skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Docker', 'Vault'],
    nice_to_have_skills: ['Python', 'Linux', 'Ansible', 'Prometheus'],
    certifications: ['AWS Certified Security', 'CKA'],
    engagement_type: 'Contract',
    duration: '6 Months',
    rate_basis: 'Hourly rate',
    ceiling_internal: '₹1,800 - ₹2,500 / hr',
    vendor_floor: '1800',
    vendor_cap: '2200',
    budget_cap_currency: 'INR',
    work_mode: 'Hybrid',
    primary_location: 'Kochi / Bengaluru',
    timezone: 'IST (UTC+5:30)',
    shift_hours: '9:30 AM - 6:30 PM IST',
    equipment_provided: 'Company-provided',
    bgv_required: 'Yes',
    drug_test_required: 'No',
    nda_required: 'Yes',
    ip_assignment_required: 'Yes',
    contract_template: 'Consultancy agreement',
    interview_rounds: '3 Rounds (L1 Tech, L2 Architecture, HM Culture Fit)',
    priority: 'High',
    job_description: 'We are seeking an experienced DevSecOps Engineer to lead cloud infrastructure security, automate CI/CD security scanning, manage Kubernetes security policies, and enforce compliance across AWS environments.',
  },
  {
    id: 'frontend_react',
    title: 'Frontend Engineer (React / Next.js)',
    department: 'Web Applications',
    job_family: 'Frontend Engineering',
    seniority: 'Mid',
    experience_band: '3-5 yrs',
    headcount: 1,
    vendor_candidate_limit: 2,
    must_have_skills: ['React', 'TypeScript', 'Next.js', 'TailwindCSS', 'Redux Toolkit'],
    nice_to_have_skills: ['Webpack', 'Jest', 'Cypress', 'GraphQL'],
    certifications: ['Meta Frontend Developer Certificate'],
    engagement_type: 'Contract',
    duration: '6 Months',
    rate_basis: 'Hourly rate',
    ceiling_internal: '₹1,400 - ₹1,800 / hr',
    vendor_floor: '1400',
    vendor_cap: '1800',
    budget_cap_currency: 'INR',
    work_mode: 'Remote',
    primary_location: 'Remote (India)',
    timezone: 'IST (UTC+5:30)',
    shift_hours: '10:00 AM - 7:00 PM IST',
    equipment_provided: 'Company-provided',
    bgv_required: 'Yes',
    drug_test_required: 'No',
    nda_required: 'Yes',
    ip_assignment_required: 'Yes',
    contract_template: 'Consultancy agreement',
    interview_rounds: '2 Rounds (Live React Machine Coding, HM Discussion)',
    priority: 'Normal',
    job_description: 'High-performing Frontend Engineer needed to build responsive, accessible, pixel-perfect web interfaces using React, Next.js, and TypeScript with state management and micro-frontend architecture.',
  },
  {
    id: 'data_engineer',
    title: 'Data Engineer',
    department: 'Data & Analytics',
    job_family: 'Data Engineering',
    seniority: 'Senior',
    experience_band: '4-7 yrs',
    headcount: 1,
    vendor_candidate_limit: 2,
    must_have_skills: ['PySpark', 'Databricks', 'Apache Airflow', 'Snowflake', 'SQL', 'Python'],
    nice_to_have_skills: ['dbt', 'AWS Glue', 'Kafka', 'Delta Lake'],
    certifications: ['Databricks Certified Data Engineer'],
    engagement_type: 'Contract',
    duration: '12 Months',
    rate_basis: 'Hourly rate',
    ceiling_internal: '₹1,700 - ₹2,400 / hr',
    vendor_floor: '1700',
    vendor_cap: '2100',
    budget_cap_currency: 'INR',
    work_mode: 'Remote',
    primary_location: 'Remote',
    timezone: 'IST (UTC+5:30)',
    shift_hours: '9:30 AM - 6:30 PM IST',
    equipment_provided: 'Company-provided',
    bgv_required: 'Yes',
    drug_test_required: 'No',
    nda_required: 'Yes',
    ip_assignment_required: 'Yes',
    contract_template: 'Consultancy agreement',
    interview_rounds: '3 Rounds (SQL & Data Modeling, ETL Pipeline Coding, HM Fit)',
    priority: 'High',
    job_description: 'We are hiring a Senior Data Engineer to architect scalable ETL pipelines, design data models in Snowflake, and manage batch & streaming data workflows on Databricks.',
  },
  {
    id: 'qa_automation',
    title: 'QA Automation Engineer',
    department: 'Quality Engineering',
    job_family: 'Software Testing',
    seniority: 'Mid',
    experience_band: '3-5 yrs',
    headcount: 1,
    vendor_candidate_limit: 2,
    must_have_skills: ['Playwright', 'Selenium', 'TypeScript', 'Python', 'CI/CD'],
    nice_to_have_skills: ['Cypress', 'Appium', 'JMeter'],
    certifications: ['ISTQB Certified Tester'],
    engagement_type: 'Contract',
    duration: '6 Months',
    rate_basis: 'Hourly rate',
    ceiling_internal: '₹1,200 - ₹1,600 / hr',
    vendor_floor: '1200',
    vendor_cap: '1600',
    budget_cap_currency: 'INR',
    work_mode: 'Hybrid',
    primary_location: 'Kochi / Remote',
    timezone: 'IST (UTC+5:30)',
    shift_hours: '9:30 AM - 6:30 PM IST',
    equipment_provided: 'Company-provided',
    bgv_required: 'Yes',
    drug_test_required: 'No',
    nda_required: 'Yes',
    ip_assignment_required: 'Yes',
    contract_template: 'Consultancy agreement',
    interview_rounds: '2 Rounds (Test Automation Live Coding, HM Discussion)',
    priority: 'Normal',
    job_description: 'Seeking a QA Automation Engineer to design, implement, and maintain comprehensive automated test suites for web applications and microservices using Playwright and TypeScript.',
  },
];

export default function HiringManagerDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const searchInputRef = useRef(null);
  const promptInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Real AI Chat States
  const [messages, setMessages] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Inline Card & Modal States (Image 2 Match)
  const [editingDraftData, setEditingDraftData] = useState(null);
  const [selectedCandidateProfile, setSelectedCandidateProfile] = useState(null);

  // Dynamic Right Panel / AI Connected Output View State
  const [activePanel, setActivePanel] = useState({
    type: 'overview', // 'overview' | 'candidates' | 'draft_requisition' | 'requisitions' | 'onboarding_issues'
    title: 'Dashboard Overview',
    data: null,
  });

  // Live Backend Data States
  const [requisitions, setRequisitions] = useState([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [acceptedCandidates, setAcceptedCandidates] = useState([]);
  const [openIssues, setOpenIssues] = useState([]);
  const [wfStats, setWfStats] = useState(null);
  const [interviewSummary, setInterviewSummary] = useState([]);
  const [interviewRounds, setInterviewRounds] = useState([]);

  // Comprehensive Requisition Workbench States (Synced with AI & Templates)
  const [draftSubTab, setDraftSubTab] = useState('role');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [draftSubmitSuccess, setDraftSubmitSuccess] = useState(false);

  const [draftForm, setDraftForm] = useState({
    title: 'Python Developer',
    department: 'Core Product Engineering',
    job_family: 'Backend Engineering',
    seniority: 'Mid',
    experience_band: '3-5 yrs',
    headcount: 1,
    vendor_candidate_limit: 3,
    must_have_skills: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker'],
    nice_to_have_skills: ['AWS', 'Kafka', 'Celery', 'Django'],
    certifications: ['AWS Certified Developer'],
    engagement_type: 'Contract',
    duration: '6 Months',
    start_date: new Date().toISOString().slice(0, 10),
    ends_on: '',
    extension_likely: 'Yes',
    rate_basis: 'Annual package',
    ceiling_internal: '₹12,00,000 - ₹15,00,000',
    vendor_floor: '1200000',
    vendor_cap: '1500000',
    budget_cap_currency: 'INR',
    work_mode: 'Hybrid',
    primary_location: 'Bangalore / Hybrid',
    timezone: 'IST (UTC+5:30)',
    shift_hours: '9:30 AM - 6:30 PM IST',
    equipment_provided: 'Company-provided',
    bgv_required: 'Yes',
    drug_test_required: 'No',
    nda_required: 'Yes',
    ip_assignment_required: 'Yes',
    contract_template: 'Consultancy agreement',
    target_start_date: '',
    submission_deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    interview_rounds: '3 Rounds (L1 Screening, L2 Architecture/Coding, HM Review)',
    priority: 'High',
    job_description: 'We are seeking a motivated Python Developer with 3+ years of hands-on experience to join our Engineering team. You will design, develop, and maintain scalable backend services, REST APIs, and data pipelines using FastAPI and PostgreSQL.',
  });

  // Bot Integration states
  const [botStatus, setBotStatus] = useState(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [pingingBot, setPingingBot] = useState(false);
  const [showCliqModal, setShowCliqModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '' });
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMessage, setPwdMessage] = useState({ type: '', text: '' });
  const [linkingTeams, setLinkingTeams] = useState(false);
  const [copiedCliqBotName, setCopiedCliqBotName] = useState(false);
  const [copiedCliqUrl, setCopiedCliqUrl] = useState(false);
  const [botFeedback, setBotFeedback] = useState({ type: '', text: '' });

  const loadBotStatus = useCallback(async () => {
    try {
      const res = await request('/api/integrations/user-bot-status', { token });
      if (res) setBotStatus(res);
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  }, [token]);

  const handleConnectTelegram = async () => {
    setLinkingTelegram(true);
    setBotFeedback({ type: '', text: '' });
    try {
      const res = await request('/api/integrations/telegram/generate-link', {
        method: 'POST',
        token,
      });
      if (res?.direct_link) {
        window.open(res.direct_link, '_blank');
        setBotFeedback({
          type: 'info',
          text: `Opened Telegram! Tap START in @${res.bot_username || 'bot'} to complete connection.`
        });
        let pollCount = 0;
        const interval = setInterval(async () => {
          pollCount += 1;
          try {
            const statusRes = await request('/api/integrations/user-bot-status', { token });
            if (statusRes?.telegram?.is_linked) {
              setBotStatus(statusRes);
              setBotFeedback({
                type: 'success',
                text: `🎉 Successfully connected to Telegram as @${statusRes.telegram.username || 'User'}!`
              });
              clearInterval(interval);
              setLinkingTelegram(false);
            }
          } catch {
            // ignore polling errors
          }
          if (pollCount > 30) {
            clearInterval(interval);
            setLinkingTelegram(false);
          }
        }, 3000);
      }
    } catch (err) {
      setBotFeedback({ type: 'error', text: err.message || 'Failed to generate connection link' });
      setLinkingTelegram(false);
    }
  };

  const handleTestPing = async () => {
    setPingingBot(true);
    setBotFeedback({ type: '', text: '' });
    try {
      const res = await request('/api/integrations/telegram/test-ping', {
        method: 'POST',
        token,
        body: { message: "👋 Hello from TermJobs Dashboard! Your AI Assistant is online and operational." }
      });
      if (res.success) {
        setBotFeedback({ type: 'success', text: '✅ Instant test notification delivered to your Telegram!' });
      } else {
        setBotFeedback({ type: 'error', text: res.error || 'Failed to dispatch Telegram ping' });
      }
    } catch (err) {
      setBotFeedback({ type: 'error', text: err.message || 'Failed to send test notification' });
    } finally {
      setPingingBot(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Telegram account from TermJobs?')) return;
    try {
      await request('/api/integrations/telegram/unlink', { method: 'POST', token });
      setBotFeedback({ type: 'info', text: 'Telegram account unlinked.' });
      await loadBotStatus();
    } catch (err) {
      setBotFeedback({ type: 'error', text: err.message || 'Failed to unlink account' });
    }
  };

  const handleConnectTeams = async () => {
    setLinkingTeams(true);
    setBotFeedback({ type: '', text: '' });
    try {
      const res = await request('/api/integrations/teams/generate-link', {
        method: 'POST',
        token,
      });
      if (res?.direct_link) {
        window.open(res.direct_link, '_blank');
        setBotFeedback({
          type: 'info',
          text: 'Opening Microsoft Teams! Tap Send to link your account.'
        });
        let pollCount = 0;
        const interval = setInterval(async () => {
          pollCount += 1;
          try {
            const statusRes = await request('/api/integrations/user-bot-status', { token });
            if (statusRes?.ms_teams?.is_linked) {
              setBotStatus(statusRes);
              setBotFeedback({
                type: 'success',
                text: '🎉 Successfully connected to Microsoft Teams!'
              });
              clearInterval(interval);
              setLinkingTeams(false);
            }
          } catch {
            // ignore
          }
          if (pollCount > 30) {
            clearInterval(interval);
            setLinkingTeams(false);
          }
        }, 3000);
      }
    } catch (err) {
      setBotFeedback({ type: 'error', text: err?.message || 'Failed to generate Microsoft Teams link.' });
      setLinkingTeams(false);
    }
  };

  const handleUnlinkTeams = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Microsoft Teams account?')) return;
    try {
      await request('/api/integrations/teams/unlink', { method: 'POST', token });
      setBotFeedback({ type: 'info', text: 'Microsoft Teams account unlinked.' });
      await loadBotStatus();
    } catch (err) {
      setBotFeedback({ type: 'error', text: err?.message || 'Failed to unlink Teams account' });
    }
  };

  // Periodic polling for team chat unread messages
  useEffect(() => {
    if (!token) return;
    const fetchUnread = () => {
      request('/api/team-chat/unread-count', { token, noCache: true, forceRefresh: true })
        .then((res) => {
          if (res && typeof res.unread_count === 'number') {
            setUnreadChatCount(res.unread_count);
          }
        })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const handleChangePassword = async (e) => {
    e?.preventDefault();
    if (!pwdForm.current_password || !pwdForm.new_password) return;
    setChangingPwd(true);
    setPwdMessage({ type: '', text: '' });
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        token,
        body: pwdForm,
      });
      setPwdMessage({ type: 'success', text: 'Password changed successfully.' });
      setPwdForm({ current_password: '', new_password: '' });
    } catch (err) {
      setPwdMessage({ type: 'error', text: err?.message || 'Failed to change password.' });
    } finally {
      setChangingPwd(false);
    }
  };

  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const prevTokenRef = useRef(token);

  // Ctrl+K shortcut listener (Focuses AI Chat Input)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        promptInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadDashboardData = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && hasLoadedRef.current && prevTokenRef.current === token) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const [reqsData, shortlistedData, allCandidatesData, acceptedData, issuesData, wfData, interviewSummaryData, roundsData, tplsData] = await Promise.all([
        request('/api/requisitions', { token }).catch(() => []),
        request('/api/candidates/shortlisted', { token }).catch(() => []),
        request('/api/candidates', { token }).catch(() => []),
        request('/api/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/workforce/stats', { token }).catch(() => null),
        interviewApi.getSummary(token).catch(() => []),
        interviewApi.listRounds({}, token).catch(() => []),
        request('/api/templates', { token }).catch(() => request('/templates', { token })).catch(() => []),
      ]);

      const reqList = Array.isArray(reqsData) ? reqsData : reqsData?.requisitions || [];
      setRequisitions(reqList);

      const sList = Array.isArray(shortlistedData) ? shortlistedData : shortlistedData?.shortlisted_candidates || [];
      setShortlistedCandidates(sList);

      const cAllList = Array.isArray(allCandidatesData) ? allCandidatesData : (allCandidatesData?.candidates || []);
      setAllCandidates(cAllList);

      const aList = Array.isArray(acceptedData) ? acceptedData : acceptedData?.candidates || [];
      setAcceptedCandidates(aList);

      const iList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      setOpenIssues(iList.filter((i) => (i.status || '').toLowerCase() === 'open'));

      if (wfData) setWfStats(wfData);
      setInterviewSummary(Array.isArray(interviewSummaryData) ? interviewSummaryData : []);
      setInterviewRounds(Array.isArray(roundsData) ? roundsData : []);
      setTemplates(Array.isArray(tplsData) ? tplsData : (tplsData?.templates || []));
      hasLoadedRef.current = true;
      prevTokenRef.current = token;
    } catch (err) {
      console.error('Failed to load hiring manager dashboard data:', err);
      setError(err.message || 'Unable to load live dashboard statistics.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      hasLoadedRef.current = false;
    }
    if (!hasLoadedRef.current) {
      loadDashboardData();
      loadBotStatus();
    }
  }, [token, loadDashboardData, loadBotStatus]);

  // Filtered Requisitions
  const liveRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s === 'published' || s === 'open' || s === 'active';
    });
  }, [requisitions]);

  // Real Upcoming Interviews mapped from backend interview rounds & summary
  const upcomingInterviews = useMemo(() => {
    if (interviewRounds.length > 0) {
      return interviewRounds.map((r) => {
        const name = r.candidate_name || 'Candidate';
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'C';

        let timeStr = 'Scheduled';
        if (r.scheduled_time) {
          timeStr = r.scheduled_time;
        } else if (r.scheduled_date) {
          try {
            const d = new Date(r.scheduled_date);
            if (!isNaN(d.getTime())) {
              timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          } catch {
            timeStr = 'Upcoming';
          }
        }

        return {
          id: r.id || r.round_id,
          name,
          initials,
          role: r.requisition_title || 'Position',
          round: r.interview_round || r.round_name || 'Technical Round 1',
          time: timeStr,
          status: r.status || 'SCHEDULED',
          candidate_id: r.candidate_submission_id,
          requisition_id: r.requisition_id,
        };
      });
    }

    const fromSummary = [];
    interviewSummary.forEach((cand) => {
      (cand.rounds || []).forEach((r, idx) => {
        const name = cand.candidate_name || r.candidate_name || 'Candidate';
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'C';

        fromSummary.push({
          id: r.id || r.round_id || `${cand.candidate_id || cand.candidate_email}-${idx}`,
          name,
          initials,
          role: cand.requisition_title || r.requisition_title || 'Position',
          round: r.round_name || r.interview_round || 'AI Technical Interview',
          time: r.scheduled_time || 'Scheduled',
          status: r.status || 'SCHEDULED',
          candidate_id: cand.candidate_id || cand.candidate_submission_id,
          requisition_id: cand.requisition_id,
        });
      });
    });

    return fromSummary;
  }, [interviewRounds, interviewSummary]);

  // Exact real data counts
  const liveRolesCount = liveRequisitions.length;
  const shortlistedCount = shortlistedCandidates.length;
  const interviewsTodayCount = upcomingInterviews.length;
  const openIssuesCount = openIssues.length;

  // Handle switching tabs on the right side and posting small conversational guidance into the chat box
  const handleSwitchTab = useCallback(
    (tabType, title, data = null, customAiMessage = null) => {
      setActivePanel({
        type: tabType,
        title: title || (tabType === 'overview' ? 'Dashboard Overview' : tabType.replace(/_/g, ' ')),
        data,
      });

      let conversationText = customAiMessage;
      if (!conversationText) {
        if (tabType === 'draft_requisition') {
          conversationText =
            "I've opened the requisition drafter on your right. Tell me the job title, target seniority, or tech stack, and I will generate the complete job description, required skills, and salary benchmarks for you.";
        } else if (tabType === 'candidates') {
          const count = Array.isArray(data) ? data.length : shortlistedCandidates.length;
          conversationText = `I've opened your candidate shortlist on the right (${count} candidate${count === 1 ? '' : 's'}). You can ask me to evaluate qualifications, compare profiles, or schedule an interview round.`;
        } else if (tabType === 'requisitions') {
          const count = liveRequisitions.length;
          conversationText = `Displaying your active job requisitions on the right (${count} active). Would you like to check candidate volume, review approvals, or draft a new role?`;
        } else if (tabType === 'onboarding_issues') {
          const count = openIssues.length;
          conversationText = `I've pulled up the onboarding compliance items on your right (${count} open issue${count === 1 ? '' : 's'}). I can draft automated reminders for missing documents or ID proofs.`;
        } else if (tabType === 'overview') {
          conversationText = 'Switched to your dashboard overview showing live upcoming interviews and active pipeline stats.';
        }
      }

      if (conversationText) {
        const aiNote = {
          id: `ai-ctx-${Date.now()}`,
          sender: 'ai',
          text: conversationText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiNote]);
      }
    },
    [shortlistedCandidates.length, liveRequisitions.length, openIssues.length]
  );

  // Instant 100% Autofill Handler for Draft Requisition
  const handleTemplateSelect = useCallback((templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const preRole = PREDEFINED_ROLES.find(
      (r) => String(r.id) === String(templateId) || r.title.toLowerCase() === String(templateId).toLowerCase()
    );
    if (preRole) {
      setDraftForm((prev) => ({
        ...prev,
        ...preRole,
        must_have_skills: [...preRole.must_have_skills],
        nice_to_have_skills: [...(preRole.nice_to_have_skills || [])],
        certifications: [...(preRole.certifications || [])],
      }));
      setDraftSubmitSuccess(false);

      const note = {
        id: `ai-note-${Date.now()}`,
        sender: 'ai',
        text: `⚡ 100% Autofilled all 34 parameters for **${preRole.title}** (${preRole.seniority}, ${preRole.experience_band}) across Role, Engagement, Budget, Work Setup & Compliance.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, note]);
      return;
    }

    const tpl = templates.find((t) => String(t.id) === String(templateId));
    if (tpl) {
      const sr = tpl.structured_role || tpl.parsed_template || {};
      const title = sr.title || sr.role_title || tpl.name || tpl.title || '';
      const dept = sr.department || sr.job_family || tpl.department || 'Engineering';
      setDraftForm((prev) => ({
        ...prev,
        title,
        department: dept,
        must_have_skills: sr.must_have_skills || prev.must_have_skills,
        job_description: tpl.job_description || tpl.description || prev.job_description,
      }));
      setDraftSubmitSuccess(false);

      const note = {
        id: `ai-note-${Date.now()}`,
        sender: 'ai',
        text: `⚡ Autofilled parameters from approved company template **${title}**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, note]);
    }
  }, [templates]);

  // Submit Draft Requisition to Backend API
  const handleSaveDraftRequisition = useCallback(async (status = 'PendingApproval') => {
    if (!draftForm.title.trim()) {
      alert('Please specify a Job Title before submitting.');
      setDraftSubTab('role');
      return;
    }
    setIsSubmittingDraft(true);
    try {
      let profileId = draftForm.company_profile_id;
      if (!profileId) {
        try {
          const profList = await request("/company-profiles", { token });
          if (Array.isArray(profList) && profList.length > 0) {
            profileId = profList[0].id;
          }
        } catch (e) {}
      }

      const payload = {
        company_profile_id: profileId,
        title: draftForm.title.trim(),
        description: draftForm.job_description || `${draftForm.title.trim()} requirement`,
        tech_stack_hint: draftForm.must_have_skills || [],
        intake_mode: 'guided',
        status,
        prefill: {
          ...draftForm,
          title: draftForm.title.trim(),
          department: draftForm.department || 'Engineering',
        },
      };

      await request('/requisitions', {
        method: 'POST',
        body: payload,
        token,
      });

      setDraftSubmitSuccess(true);
      await loadDashboardData(true);

      const aiConfirm = {
        id: `ai-req-done-${Date.now()}`,
        sender: 'ai',
        text: `🎉 **${draftForm.title}** has been successfully created and submitted for Director Approval! The requisition is now recorded in your pipeline.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiConfirm]);

      setTimeout(() => {
        handleSwitchTab('overview', 'Dashboard Overview');
      }, 1600);
    } catch (err) {
      console.error('Failed to submit requisition:', err);
      alert(err.message || 'Failed to submit requisition.');
    } finally {
      setIsSubmittingDraft(false);
    }
  }, [draftForm, token, loadDashboardData, handleSwitchTab]);

  // Computed End Date helper for Requisition Preview
  const computedEndDate = useMemo(() => {
    if (draftForm.ends_on) return draftForm.ends_on;
    const dur = draftForm.duration || draftForm.estimated_duration_months || '6 Months';
    const sDate = draftForm.start_date || draftForm.target_start_date;
    const m = String(dur).match(/(\d+)\s*(day|week|month|year)s?/i);
    if (!m) return dur;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const base = sDate ? new Date(sDate) : new Date();
    const d = new Date(base);
    if (unit === 'day') d.setDate(d.getDate() + n);
    else if (unit === 'week') d.setDate(d.getDate() + n * 7);
    else if (unit === 'month') d.setMonth(d.getMonth() + n);
    else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  }, [
    draftForm.ends_on,
    draftForm.duration,
    draftForm.estimated_duration_months,
    draftForm.start_date,
    draftForm.target_start_date,
  ]);

  // Inline Requisition Action Handlers (Director Approval Enforced)
  const handleSubmitForApprovalFromCard = useCallback(
    async (draft, messageId) => {
      try {
        let profileId = draft.company_profile_id;
        if (!profileId) {
          try {
            const profList = await request("/company-profiles", { token });
            if (Array.isArray(profList) && profList.length > 0) {
              profileId = profList[0].id;
            }
          } catch (e) {}
        }

        const payload = {
          company_profile_id: profileId,
          title: draft.title,
          description: draft.summary || `${draft.title} requirement`,
          tech_stack_hint: draft.skills || [],
          intake_mode: 'chat_inline',
          status: 'Pending Approval',
          openings: draft.openings || 1,
          prefill: {
            title: draft.title,
            department: draft.department || 'Engineering',
            primary_location: draft.location || 'Bangalore, India (Hybrid)',
            engagement_type: draft.employment_type || 'Contract',
            experience_band: draft.experience || '3+ years',
            work_mode: draft.hiring_model || 'Hybrid',
            must_have_skills: draft.skills || [],
          },
        };

        const res = await request('/requisitions', {
          method: 'POST',
          body: payload,
          token,
        });

        const newReqId = res?.id || res?.requisition_id;

        // If requisition already existed, also ensure status is updated to Pending Approval
        if (draft.id && !draft.id.startsWith('draft-')) {
          try {
            await request(`/requisitions/${draft.id}/submit-for-approval`, {
              method: 'POST',
              token,
            });
          } catch (e) {}
        }

        // Mark as submitted for Director approval on card
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  requisitionDraft: {
                    ...m.requisitionDraft,
                    id: newReqId || m.requisitionDraft.id,
                    isSubmittedForApproval: true,
                    status: 'Pending Approval',
                  },
                }
              : m
          )
        );

        const confirmMsg = {
          id: `ai-approval-${Date.now()}`,
          sender: 'ai',
          text: `🚀 **${draft.title}** requisition has been successfully sent to the Director for approval!\n\nDirector sign-off is mandatory before the role can be published to vendors. The Director has been notified to review and sign off.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, confirmMsg]);
        await loadDashboardData(true);
      } catch (err) {
        console.error('Failed to submit requisition for approval:', err);
        alert(err.message || 'Failed to submit requisition for approval.');
      }
    },
    [token, loadDashboardData]
  );

  const handleOpenEditModal = useCallback((draft, messageId) => {
    setEditingDraftData({
      ...draft,
      messageId,
      skills: Array.isArray(draft.skills) ? draft.skills : draft.skills ? [draft.skills] : [],
    });
  }, []);

  const handleSaveEditedDraft = useCallback((updatedDraft) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === updatedDraft.messageId
          ? {
              ...m,
              requisitionDraft: {
                ...m.requisitionDraft,
                ...updatedDraft,
              },
            }
          : m
      )
    );
    setEditingDraftData(null);

    const updateNote = {
      id: `ai-update-${Date.now()}`,
      sender: 'ai',
      text: `Updated parameters for **${updatedDraft.title}**. You can review the revised draft card above or publish whenever you're ready.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, updateNote]);
  }, []);

  const handleAddRequirements = useCallback(
    (draft, messageId) => {
      handleOpenEditModal(draft, messageId);
    },
    [handleOpenEditModal]
  );

  const handleGenerateJD = useCallback(
    async (draft, messageId) => {
      setIsAiTyping(true);
      try {
        const res = await request('/api/hiring-manager/agent/generate-jd', {
          method: 'POST',
          token,
          body: {
            title: draft.title,
            department: draft.department,
            experience: draft.experience,
            skills: draft.skills,
            location: draft.location,
            employment_type: draft.employment_type,
          },
        });

        const enhancedSummary =
          res?.job_description ||
          `We are seeking an experienced ${draft.title} to join our ${draft.department} team. In this role, you will design, implement, and maintain secure, scalable systems, CI/CD pipelines, and collaborate with cross-functional engineering teams.`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  requisitionDraft: {
                    ...m.requisitionDraft,
                    summary: enhancedSummary,
                  },
                }
              : m
          )
        );

        const jdNote = {
          id: `ai-jd-${Date.now()}`,
          sender: 'ai',
          text: `✨ Generated an enhanced enterprise Job Description for **${draft.title}**. The Role Summary in the card above has been updated.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, jdNote]);
      } catch (err) {
        console.error('Generate JD error:', err);
      } finally {
        setIsAiTyping(false);
      }
    },
    [token]
  );

  // Greeting
  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = user?.name || 'r';
  const userInitial = (user?.name || 'R').trim().charAt(0).toUpperCase();

  // Auto-scroll inside chat container only (prevents the browser window from scrolling down)
  useEffect(() => {
    if (messages.length > 1 || isAiTyping) {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
  }, [messages, isAiTyping]);

  // Reset conversation to initial state
  const handleResetChat = useCallback(() => {
    setMessages([]);
    setActivePanel({
      type: 'overview',
      title: 'Dashboard Overview',
      data: null,
    });
  }, []);

  const displayCandidates = useMemo(() => {
    if (Array.isArray(activePanel.data) && activePanel.data.length > 0) {
      return activePanel.data;
    }
    if (shortlistedCandidates.length > 0) {
      return shortlistedCandidates;
    }
    if (allCandidates.length > 0) {
      return allCandidates;
    }
    return [];
  }, [activePanel.data, shortlistedCandidates, allCandidates]);

  // Dynamically compute real recent activities from real candidates, interviews, requisitions, and open issues
  const recentActivities = useMemo(() => {
    const list = [];
    if (shortlistedCandidates.length > 0) {
      const topCand = shortlistedCandidates[0];
      const matchPct = topCand.match_score || (topCand.ai_match_score ? `${Math.round(topCand.ai_match_score * (topCand.ai_match_score > 1 ? 1 : 100))}% AI match` : 'High match');
      list.push({
        id: `act-cand-${topCand.id || 1}`,
        title: `${topCand.name || topCand.candidate_name || 'Candidate'} is ready for your review`,
        subtitle: `${topCand.role || topCand.requisition_title || topCand.applied_role || 'Candidate'} • ${matchPct}`,
        time: 'Pending review',
        icon: Users,
        type: 'candidates',
        tabTitle: 'Candidates to Review',
        data: shortlistedCandidates,
      });
    }

    if (upcomingInterviews.length > 0) {
      const topInterview = upcomingInterviews[0];
      list.push({
        id: `act-interview-${topInterview.id || 1}`,
        title: `Interview scheduled with ${topInterview.candidate_name}`,
        subtitle: `${topInterview.role} • ${topInterview.round_name}`,
        time: topInterview.time || 'Today',
        icon: Calendar,
        type: 'overview',
        tabTitle: 'Upcoming Interviews',
        data: null,
      });
    }

    if (liveRequisitions.length > 0) {
      const topReq = liveRequisitions[0];
      list.push({
        id: `act-req-${topReq.id || 1}`,
        title: `Requisition: ${topReq.title || 'Role'} is active`,
        subtitle: `${topReq.department || 'Engineering'} • ${topReq.openings || 1} opening${(topReq.openings || 1) === 1 ? '' : 's'}`,
        time: `${topReq.status || 'Published'}`,
        icon: FileText,
        type: 'requisitions',
        tabTitle: 'Active Job Requisitions',
        data: liveRequisitions,
      });
    }

    if (openIssues.length > 0) {
      const topIssue = openIssues[0];
      list.push({
        id: `act-issue-${topIssue.id || 1}`,
        title: topIssue.title || 'Onboarding document pending',
        subtitle: `${topIssue.candidate_name || topIssue.contractor_name || 'Contractor'} • ${topIssue.issue_type || 'Compliance check'}`,
        time: topIssue.priority || 'Attention needed',
        icon: AlertTriangle,
        isAlert: true,
        type: 'onboarding_issues',
        tabTitle: 'Onboarding & Verification Issues',
        data: openIssues,
      });
    }

    return list;
  }, [shortlistedCandidates, upcomingInterviews, liveRequisitions, openIssues]);

  // Voice speech-to-text toggle
  const handleToggleVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setPromptInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      console.error('Speech recognition error:', e);
      setIsListening(false);
    }
  }, [isListening]);

  const getInitials = (name) => {
    if (!name) return 'C';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  };

  const formatCandidateCard = useCallback((c, index = 0) => {
    const name = c.candidate_name || c.name || `Candidate ${index + 1}`;
    const role = c.requisition_title || c.role || c.job_title || 'Software Engineer';
    const rawSkills = c.skills || c.matched_skills || [];
    const skillsList = Array.isArray(rawSkills)
      ? rawSkills
      : typeof rawSkills === 'string'
      ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    let matchStr = '85% Match';
    if (c.match_score !== undefined && c.match_score !== null) {
      const num = parseFloat(c.match_score);
      if (!isNaN(num)) {
        matchStr = `${Math.round(num)}% Match`;
      } else if (typeof c.match_score === 'string' && c.match_score.includes('%')) {
        matchStr = c.match_score;
      }
    } else {
      matchStr = `${Math.max(70, 94 - index * 4)}% Match`;
    }

    return {
      id: c.candidate_id || c.id || `cand-${index}`,
      name,
      initials: getInitials(name),
      match_score: matchStr,
      role,
      experience: c.experience || c.experience_years ? `${c.experience || c.experience_years} yrs` : '3+ yrs',
      location: c.location || 'Bangalore, India',
      skills: skillsList.length > 0 ? skillsList.slice(0, 3) : ['Python', 'Docker', 'Git'],
      all_skills: skillsList,
      email: c.email || c.candidate_email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.com`,
      rate: c.rate || c.hourly_rate || '₹1,800/hr',
      bio: c.summary || c.bio || c.notes || `${name} is an active candidate in your pool with verified experience in ${skillsList.slice(0, 4).join(', ') || 'modern software engineering'}.`,
      status: c.status || 'Active',
    };
  }, []);

  const formatRequisitionDetail = useCallback((req) => {
    if (!req) return null;
    const struct = req.structured_role || {};
    const rawSkills = struct.skills || req.skills || ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker'];
    const skillsList = Array.isArray(rawSkills)
      ? rawSkills
      : typeof rawSkills === 'string'
      ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker'];

    return {
      id: req.id,
      title: req.title || struct.title || 'Python Developer',
      status: req.status || 'Published',
      department: struct.department || req.department || 'Engineering',
      location: struct.location || req.location || 'Bangalore, India (Hybrid)',
      experience: struct.experience_level || req.experience_level || 'Senior (4-7 yrs)',
      employment_type: struct.employment_type || req.employment_type || 'Full-Time',
      hiring_model: struct.hiring_model || (struct.location?.toLowerCase().includes('remote') ? 'Remote' : 'Hybrid'),
      openings: struct.openings || struct.headcount || req.openings || 1,
      target_start_date: struct.target_start_date || req.target_start_date || 'Flexible',
      skills: skillsList,
      summary: struct.job_description || req.generated_jd_markdown || req.summary || `We are seeking an experienced ${req.title} to join our Engineering team and build scalable services.`,
      salary_range: struct.salary_range || req.salary_range || '₹12,00,000 - ₹18,00,000 per annum',
    };
  }, []);

  // Real AI Agent Chat Trigger
  const handleSendPrompt = async (promptText) => {
    const text = (promptText || promptInput).trim();
    if (!text || isAiTyping) return;

    setPromptInput('');

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAiTyping(true);

    const textLower = text.toLowerCase();

    // 1. Natural greeting detection (No robotic fallback)
    const isGreeting = /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|yo|hi\s+there|hello\s+there)[\s!.]*$/i.test(text.trim());
    if (isGreeting) {
      setTimeout(() => {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Hello! 👋 How can I assist you today with your hiring needs? Whether you'd like to draft a new job requisition, review candidates in your candidate pool, or schedule interviews, just let me know!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsAiTyping(false);
      }, 300);
      return;
    }

    // 2. Open / View Specific Requisition intent (Directly opens and navigates to the requisition)
    const isOpenReq =
      (textLower.startsWith('open') || textLower.startsWith('view') || textLower.startsWith('show details') || textLower.startsWith('inspect')) &&
      !textLower.includes('candidate') &&
      !textLower.includes('pool') &&
      !textLower.includes('timesheet') &&
      !textLower.includes('expense') &&
      !textLower.includes('issue');

    if (isOpenReq) {
      setTimeout(async () => {
        let pool = requisitions;
        if (!pool || pool.length === 0) {
          try {
            const fresh = await request('/api/requisitions', { token }).catch(() => []);
            pool = Array.isArray(fresh) ? fresh : (fresh?.requisitions || []);
            setRequisitions(pool);
          } catch (e) {
            console.error('Fetch requisitions error:', e);
          }
        }

        const cleanSearch = textLower
          .replace(/^(open|view|show|inspect)\s+/i, '')
          .replace(/\b(the|requisition|requsisition|requsisiton|requsition|req|role|position|details|of|page|all|list|s)\b/gi, '')
          .trim();

        // Check if generic "open requisitions" / "open requisition list"
        const isGenericRequisitionsList =
          !cleanSearch ||
          textLower === 'open requisitions' ||
          textLower === 'open requisition' ||
          textLower === 'open all requisitions' ||
          textLower === 'open requisition list' ||
          textLower === 'view requisitions';

        if (isGenericRequisitionsList) {
          const aiMsg = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `Opening your **Job Requisitions** directory...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsAiTyping(false);
          setTimeout(() => navigate('/dashboard/requisitions'), 200);
          return;
        }

        const matched =
          pool.find((r) => {
            const rTitle = (r.title || '').toLowerCase();
            return (cleanSearch && rTitle.includes(cleanSearch)) || (cleanSearch && cleanSearch.includes(rTitle));
          }) ||
          pool.find((r) => {
            const rTitle = (r.title || '').toLowerCase();
            if (textLower.includes('python') && rTitle.includes('python')) return true;
            if (textLower.includes('qa') && rTitle.includes('qa')) return true;
            if (textLower.includes('devsecops') && rTitle.includes('devsecops')) return true;
            if (textLower.includes('devops') && rTitle.includes('devops')) return true;
            if (textLower.includes('backend') && rTitle.includes('backend')) return true;
            if (textLower.includes('frontend') && rTitle.includes('frontend')) return true;
            return false;
          }) ||
          pool[0];

        if (matched && matched.id) {
          const aiMsg = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `Opening the **${matched.title}** requisition...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsAiTyping(false);
          setTimeout(() => navigate(`/dashboard/requisitions/${matched.id}`), 250);
          return;
        } else {
          const aiMsg = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `Could not find an active requisition matching "${cleanSearch}". Would you like me to draft a new requisition for this role?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsAiTyping(false);
          return;
        }
      }, 200);
      return;
    }

    try {
      const response = await request('/api/hiring-manager/agent/chat', {
        method: 'POST',
        token,
        timeout: 30000,
        body: {
          prompt: text,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          user_name: userName,
          user_role: user?.role || 'Hiring Manager',
          current_user: user ? {
            id: user.id,
            name: user.name,
            role: user.role,
            tenant_id: user.tenant_id,
            tenant_name: user.tenant_name,
          } : null,
        },
      }).catch((err) => {
        console.warn('AI Agent chat API request warning:', err);
        return null;
      });

      let replyContent = response?.reply || response?.message || '';
      const executedActions = response?.executed_actions || [];

      // 0. Direct Open Requisition action from backend
      const openReqAction = executedActions.find((a) => a.tool === 'open_hiring_requisition');
      if (openReqAction && openReqAction.result && openReqAction.result.id) {
        const target = openReqAction.result;
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Opening the **${target.title || 'Job'}** requisition...`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsAiTyping(false);
        setTimeout(() => navigate(`/dashboard/requisitions/${target.id}`), 250);
        return;
      }

      // 1. Candidate cards from backend tools
      let candCards = null;
      const candidateAction = executedActions.find(
        (a) =>
          a.tool === 'list_shortlisted_candidates' ||
          a.tool === 'compare_shortlisted_candidates' ||
          a.tool === 'screen_candidates_summary'
      );
      if (candidateAction && candidateAction.result) {
        const rawList = Array.isArray(candidateAction.result)
          ? candidateAction.result
          : Array.isArray(candidateAction.result.candidates)
          ? candidateAction.result.candidates
          : Array.isArray(candidateAction.result.screened_candidates)
          ? candidateAction.result.screened_candidates
          : [];
        if (rawList.length > 0) {
          candCards = rawList.slice(0, 5).map((c, idx) => formatCandidateCard(c, idx));
        }
      }

      // If user requested candidates explicitly and backend didn't return cards, fallback to active candidate pool
      const isCandQuery =
        textLower.includes('candidate') ||
        textLower.includes('candiates') ||
        textLower.includes('suggest 5') ||
        textLower.includes('shortlist') ||
        textLower.includes('pool') ||
        textLower.includes('applicant');

      if (!candCards && isCandQuery) {
        const sources = [...shortlistedCandidates, ...allCandidates, ...acceptedCandidates].filter(Boolean);
        const seen = new Set();
        const fallbackPool = [];
        for (const c of sources) {
          const name = (c.candidate_name || c.name || '').trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            fallbackPool.push(c);
          }
        }
        if (fallbackPool.length > 0) {
          candCards = fallbackPool.slice(0, 5).map((c, idx) => formatCandidateCard(c, idx));
        }
      }

      // 1b. Interview Proposal extraction from schedule_candidate_interview
      let interviewProposal = null;
      const schedAction = executedActions.find((a) => a.tool === 'schedule_candidate_interview');
      if (schedAction && schedAction.result && (schedAction.result.candidate || schedAction.result.candidate_name)) {
        interviewProposal = schedAction.result;
      }

      // 2. Draft requisition cards from backend tool or context
      let reqDraft = null;
      const draftAction = executedActions.find((a) => a.tool === 'draft_hiring_requisition');
      if (draftAction && draftAction.result) {
        const r = draftAction.result;
        reqDraft = {
          id: `draft-${Date.now()}`,
          title: r.title || 'Job Requisition',
          department: r.department || 'Engineering',
          location: r.location || 'Bangalore, India (Hybrid)',
          experience: r.experience_level || 'Mid (2-4 yrs)',
          employment_type: r.employment_type || 'Contract',
          hiring_model: (r.location && r.location.toLowerCase().includes('remote')) ? 'Remote' : 'Hybrid',
          openings: 1,
          target_start_date: 'Flexible',
          skills: Array.isArray(r.skills)
            ? r.skills
            : typeof r.skills === 'string'
            ? r.skills.split(',').map((s) => s.trim()).filter(Boolean)
            : ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
          summary: r.job_description || `We are seeking a talented ${r.title || 'professional'} to join our engineering team.`,
        };
      } else if (
        textLower.includes('draft') ||
        textLower.includes('create req') ||
        replyContent.toLowerCase().includes('drafted the requisition') ||
        replyContent.toLowerCase().includes('draft details below')
      ) {
        const prevDraft = [...messages].reverse().find((m) => m.requisitionDraft)?.requisitionDraft;
        if (prevDraft) {
          reqDraft = prevDraft;
        } else {
          let roleTitle = 'Python Backend Engineer';
          const match = replyContent.match(/for\s+\*\*?([A-Za-z0-9\s\/\+\#\-]+?)\*\*?(?:\s*\(|\.|\?|$|,)/i) ||
                        replyContent.match(/requisition for\s+([A-Za-z0-9\s\/\+\#\-]+?)(?:\s*\(|\.|\?|$|,)/i);
          if (match && match[1] && match[1].trim()) {
            roleTitle = match[1].trim();
          }
          reqDraft = {
            id: `draft-${Date.now()}`,
            title: roleTitle,
            department: 'Engineering',
            location: 'Bangalore, India (Hybrid)',
            experience: 'Mid (2-4 yrs)',
            employment_type: 'Contract',
            hiring_model: 'Hybrid',
            openings: 1,
            target_start_date: 'Flexible',
            skills: roleTitle.toLowerCase().includes('python')
              ? ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker']
              : ['Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Security'],
            summary: `We are looking for a ${roleTitle} to help build and maintain secure, scalable systems and robust APIs.`,
          };
        }
      }

      // 3. Requisitions list results from backend tool or query
      let reqList = null;
      const listAction = executedActions.find((a) => a.tool === 'list_hiring_requisitions');
      if (listAction && Array.isArray(listAction.result) && listAction.result.length > 0) {
        reqList = listAction.result;
      }

      // Robust typo-tolerant check for requisitions query (e.g. "requsitions", "requisitions", "requsition", "reqs", "jobs", "roles")
      const isReqQuery =
        /(requsition|requisition|requstion|requision|recquisition|req|role|job|opening|position)s?/i.test(textLower) &&
        /(show|list|all|view|display|what|get|see|active|open|draft|have|tell)/i.test(textLower);

      if (
        !reqList &&
        (isReqQuery ||
          replyContent.toLowerCase().includes('job requisitions directory') ||
          replyContent.toLowerCase().includes('live requisition') ||
          replyContent.toLowerCase().includes('total requisitions'))
      ) {
        reqList = requisitions.length > 0 ? requisitions : null;
      }

      // If user specifically asked for requisitions and we have cards, ensure reply text is informative
      if (isReqQuery && reqList && reqList.length > 0 && (!replyContent || replyContent.includes('0 Total') || replyContent.startsWith('I am here to help'))) {
        replyContent = `Here are the ${reqList.length} requisitions currently in your active pipeline:`;
      }

      // If user asked for candidates and we have cards, ensure reply text is informative
      if (isCandQuery && candCards && candCards.length > 0 && (!replyContent || replyContent.startsWith('I am here to help'))) {
        replyContent = `Here are the ${candCards.length} candidates from your candidate pool:`;
      }

      if (!replyContent) {
        if (reqList && reqList.length > 0) {
          replyContent = `Here are your ${reqList.length} active requisitions:`;
        } else if (candCards && candCards.length > 0) {
          replyContent = `Here are the candidates from your candidate pool:`;
        } else {
          replyContent = `I am here to help you manage your requisitions, candidates, and hiring pipeline. Would you like me to draft a new requisition, review candidates from your pool, or schedule an interview?`;
        }
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyContent,
        executedActions,
        candidatesList: candCards,
        requisitionDraft: reqDraft,
        requisitionsList: reqList,
        interviewProposal,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI chat error:', err);
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: 'I am here to help you manage your hiring pipeline. Feel free to draft a requisition, review candidates, or schedule an interview.',
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiTyping(false);
      setTimeout(() => {
        promptInputRef.current?.focus({ preventScroll: true });
      }, 50);
    }
  };

  const userInitials = useMemo(() => {
    if (!user?.name || user?.name === 'r') return 'HM';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [user]);

  // Right-side tools drawer state
  const [isToolsDrawerOpen, setIsToolsDrawerOpen] = useState(false);
  const [toolsSearchQuery, setToolsSearchQuery] = useState('');

  // Right-side Conversations Drawer & History state (Stores all chats)
  const [isConversationsDrawerOpen, setIsConversationsDrawerOpen] = useState(false);
  const [conversationsSearchQuery, setConversationsSearchQuery] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isTeamChatDrawerOpen, setIsTeamChatDrawerOpen] = useState(false);

  const [conversations, setConversations] = useState(() => {
    try {
      const storageKey = `termjobs_hm_conversations_${user?.id || 'default'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved conversations:', e);
    }

    // Default Seed Conversations matching user's exact reference screenshot
    const now = Date.now();
    return [
      {
        id: 'conv-seeded-1',
        title: 'Create requisition for DevSecOps',
        preview: 'Help me create a new requisition for a DevSecOps Engineer...',
        categoryIcon: 'requisition',
        updatedAt: now - 1000 * 60 * 25,
        createdAt: now - 1000 * 60 * 25,
        messages: [
          {
            id: 'seed-u1',
            sender: 'user',
            text: 'Help me create a new requisition for a DevSecOps Engineer',
            timestamp: '10:24 AM',
          },
          {
            id: 'seed-a1',
            sender: 'ai',
            text: 'I have prepared a comprehensive requisition draft for **DevSecOps Engineer**.',
            requisitionDraft: {
              id: 'draft-devsecops',
              title: 'DevSecOps Engineer',
              department: 'Cloud Security',
              location: 'Bangalore, India (Hybrid)',
              experience: 'Senior (5-8 yrs)',
              employment_type: 'Contract',
              hiring_model: 'Hybrid',
              openings: 1,
              target_start_date: 'Immediate',
              skills: ['AWS', 'Kubernetes Security', 'CI/CD', 'Terraform', 'Docker'],
              summary: 'We are seeking an experienced DevSecOps Engineer to lead cloud infrastructure security and automate CI/CD pipeline scans.',
            },
            timestamp: '10:25 AM',
          },
        ],
      },
      {
        id: 'conv-seeded-2',
        title: 'Find top candidates',
        preview: 'Search best candidates for Senior Backend role...',
        categoryIcon: 'candidates',
        updatedAt: now - 1000 * 60 * 75,
        createdAt: now - 1000 * 60 * 75,
        messages: [
          {
            id: 'seed-u2',
            sender: 'user',
            text: 'Find top candidates for backend engineer',
            timestamp: '09:40 AM',
          },
          {
            id: 'seed-a2',
            sender: 'ai',
            text: 'Here are the top candidates matching your active requisitions with high match scores.',
            timestamp: '09:41 AM',
          },
        ],
      },
      {
        id: 'conv-seeded-3',
        title: 'Compare candidates',
        preview: 'Compare these 3 candidates based on AI interview scores...',
        categoryIcon: 'candidates',
        updatedAt: now - 1000 * 60 * 160,
        createdAt: now - 1000 * 60 * 160,
        messages: [
          {
            id: 'seed-u3',
            sender: 'user',
            text: 'Compare top shortlisted candidates and their match scores',
            timestamp: '08:15 AM',
          },
          {
            id: 'seed-a3',
            sender: 'ai',
            text: 'Candidate scorecard comparison complete with spoken fluency and verified skills.',
            timestamp: '08:16 AM',
          },
        ],
      },
      {
        id: 'conv-seeded-4',
        title: 'Interview questions',
        preview: 'Generate technical interview questions for cloud architect...',
        categoryIcon: 'interview',
        updatedAt: now - 1000 * 60 * 190,
        createdAt: now - 1000 * 60 * 190,
        messages: [
          {
            id: 'seed-u4',
            sender: 'user',
            text: 'Generate technical interview questions for cloud architect',
            timestamp: '11:20 AM',
          },
          {
            id: 'seed-a4',
            sender: 'ai',
            text: 'Here are 5 targeted scenario questions for Cloud Architect evaluation focusing on high-availability architectures and security compliance.',
            timestamp: '11:21 AM',
          },
        ],
      },
      {
        id: 'conv-seeded-5',
        title: 'Market salary insights',
        preview: "What's the current market rate for senior contractors...",
        categoryIcon: 'requisition',
        updatedAt: now - 1000 * 60 * 60 * 25,
        createdAt: now - 1000 * 60 * 60 * 25,
        messages: [
          {
            id: 'seed-u5',
            sender: 'user',
            text: 'What is the current market rate for senior contractors?',
            timestamp: 'Sep 29',
          },
          {
            id: 'seed-a5',
            sender: 'ai',
            text: 'Standard billing rates for Senior React and Python contractors currently range between ₹1,400 to ₹1,800/hr in Bangalore.',
            timestamp: 'Sep 29',
          },
        ],
      },
      {
        id: 'conv-seeded-6',
        title: 'Hiring process guidance',
        preview: 'Explain the approval workflow for new contract positions...',
        categoryIcon: 'requisition',
        updatedAt: now - 1000 * 60 * 60 * 28,
        createdAt: now - 1000 * 60 * 60 * 28,
        messages: [
          {
            id: 'seed-u6',
            sender: 'user',
            text: 'Explain the approval workflow for requisitions',
            timestamp: 'Sep 29',
          },
          {
            id: 'seed-a6',
            sender: 'ai',
            text: 'Contract requisitions require HM draft submission followed by Director budget approval before being broadcast to verified vendor partners.',
            timestamp: 'Sep 29',
          },
        ],
      },
      {
        id: 'conv-seeded-7',
        title: 'Onboarding checklist',
        preview: 'Create onboarding checklist for incoming contract engineers...',
        categoryIcon: 'chat',
        updatedAt: now - 1000 * 60 * 60 * 24 * 5,
        createdAt: now - 1000 * 60 * 60 * 24 * 5,
        messages: [
          {
            id: 'seed-u7',
            sender: 'user',
            text: 'Create onboarding checklist for incoming contract engineers',
            timestamp: 'Sep 28',
          },
          {
            id: 'seed-a7',
            sender: 'ai',
            text: 'Here is the onboarding checklist: NDA execution, Background check clearance, Hardware delivery confirmation, and AWS SSO access grant.',
            timestamp: 'Sep 28',
          },
        ],
      },
    ];
  });

  // Automatically save and sync messages to active conversation in localStorage
  useEffect(() => {
    if (messages.length === 0) return;

    setConversations((prev) => {
      let currentId = activeConversationId;
      if (!currentId) {
        currentId = `conv-${Date.now()}`;
        setActiveConversationId(currentId);
        const firstUserMsg = messages.find((m) => m.sender === 'user');
        const rawText = firstUserMsg?.text || messages[0]?.text || 'New conversation';
        const title = rawText.length > 36 ? rawText.slice(0, 36) + '...' : rawText;
        const newConv = {
          id: currentId,
          title,
          preview: rawText,
          categoryIcon: rawText.toLowerCase().includes('candidate')
            ? 'candidates'
            : rawText.toLowerCase().includes('interview')
            ? 'interview'
            : rawText.toLowerCase().includes('requisition')
            ? 'requisition'
            : 'chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages,
        };
        const updated = [newConv, ...prev];
        try {
          const storageKey = `termjobs_hm_conversations_${user?.id || 'default'}`;
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (e) {
          console.warn('Storage save error:', e);
        }
        return updated;
      }

      const existingIndex = prev.findIndex((c) => c.id === currentId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const lastMsg = messages[messages.length - 1];
        updated[existingIndex] = {
          ...updated[existingIndex],
          messages,
          updatedAt: Date.now(),
          preview: lastMsg?.text?.slice(0, 60) || updated[existingIndex].preview,
        };
        try {
          const storageKey = `termjobs_hm_conversations_${user?.id || 'default'}`;
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (e) {
          console.warn('Storage save error:', e);
        }
        return updated;
      }

      return prev;
    });
  }, [messages, activeConversationId, user?.id]);

  // Open Telegram Bot (deep link or open existing bot username)
  const handleOpenTelegramBot = useCallback(() => {
    if (botStatus?.telegram?.bot_username) {
      window.open(`https://t.me/${botStatus.telegram.bot_username}`, '_blank');
      return;
    }
    handleConnectTelegram();
  }, [botStatus, handleConnectTelegram]);

  // Start a fresh new chat
  const handleStartNewChat = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setPromptInput('');
    setIsConversationsDrawerOpen(false);
    setActivePanel({
      type: 'overview',
      title: 'Dashboard Overview',
      data: null,
    });
    setTimeout(() => {
      promptInputRef.current?.focus({ preventScroll: true });
    }, 50);
  }, []);

  // Select a previous conversation to view/resume
  const handleSelectConversation = useCallback((conv) => {
    setActiveConversationId(conv.id);
    setMessages(conv.messages || []);
    setIsConversationsDrawerOpen(false);
  }, []);

  // Grouped conversations for the Drawer
  const filteredConversations = useMemo(() => {
    if (!conversationsSearchQuery.trim()) return conversations;
    const q = conversationsSearchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.preview || '').toLowerCase().includes(q)
    );
  }, [conversations, conversationsSearchQuery]);

  const groupedConversations = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const last7DaysStart = todayStart - 6 * 86400000;

    const groups = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    filteredConversations.forEach((c) => {
      const time = c.updatedAt || c.createdAt || Date.now();
      if (time >= todayStart) {
        groups.today.push(c);
      } else if (time >= yesterdayStart) {
        groups.yesterday.push(c);
      } else if (time >= last7DaysStart) {
        groups.last7Days.push(c);
      } else {
        groups.older.push(c);
      }
    });

    return groups;
  }, [filteredConversations]);

  const formatConvTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  const getConvIcon = (cat) => {
    switch (cat) {
      case 'candidates':
        return <Users size={14} className="text-gray-700" />;
      case 'interview':
        return <BarChart2 size={14} className="text-gray-700" />;
      case 'chat':
        return <MessageSquare size={14} className="text-gray-700" />;
      case 'requisition':
      default:
        return <FileText size={14} className="text-gray-700" />;
    }
  };

  // Close drawers on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isConversationsDrawerOpen) setIsConversationsDrawerOpen(false);
        if (isToolsDrawerOpen) setIsToolsDrawerOpen(false);
        if (isTeamChatDrawerOpen) setIsTeamChatDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConversationsDrawerOpen, isToolsDrawerOpen, isTeamChatDrawerOpen]);

  // Pending requisitions count for badge
  const pendingRequisitionsCount = useMemo(() => {
    if (!Array.isArray(requisitions)) return 0;
    return requisitions.filter((r) => (r.status || '').toLowerCase().includes('pending')).length;
  }, [requisitions]);

  // Compact tool groups for the Right-Side Drawer
  const TOOL_GROUPS = useMemo(() => [
    {
      id: 'requisitions',
      name: 'REQUISITIONS',
      tools: [
        {
          id: 'create_req',
          name: 'Create Requisition',
          icon: Plus,
          description: 'Launch new job requisition workflow',
          action: () => {
            setIsToolsDrawerOpen(false);
            navigate('/dashboard/requisitions/new');
          },
        },
        {
          id: 'view_reqs',
          name: 'View Requisitions',
          icon: FileText,
          description: 'Explore all active and draft requisitions',
          action: () => {
            setIsToolsDrawerOpen(false);
            navigate('/dashboard/requisitions');
          },
        },
        {
          id: 'templates',
          name: 'Templates',
          icon: Layers,
          description: 'Role templates for engineering, product & design',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Show me available requisition templates and job descriptions');
          },
        },
        {
          id: 'pending_approvals',
          name: 'Pending Approvals',
          icon: Clock,
          description: 'Requisitions awaiting approval',
          badge: pendingRequisitionsCount > 0 ? pendingRequisitionsCount : null,
          action: () => {
            setIsToolsDrawerOpen(false);
            navigate('/dashboard/requisitions/pending-approval');
          },
        },
      ],
    },
    {
      id: 'candidates',
      name: 'CANDIDATES',
      tools: [
        {
          id: 'screen_candidates',
          name: 'Screen Candidates',
          icon: UserCheck,
          description: 'AI resume screening against active roles',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Screen top candidates for my open requisitions and summarize their fit scores');
          },
        },
        {
          id: 'compare_candidates',
          name: 'Compare Candidates',
          icon: BarChart2,
          description: 'Head-to-head comparison and match scores',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Compare top shortlisted candidates and their match scores');
          },
        },
        {
          id: 'candidate_pool',
          name: 'Candidate Pool',
          icon: Users,
          description: 'Browse candidate pool and talent database',
          action: () => {
            setIsToolsDrawerOpen(false);
            navigate('/dashboard/candidates');
          },
        },
        {
          id: 'import_candidates',
          name: 'Import Candidates',
          icon: Upload,
          description: 'Add external profiles, resumes or ATS candidates',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('How do I import candidates from external job boards or CSV?');
          },
        },
      ],
    },
    {
      id: 'interviews',
      name: 'INTERVIEWS',
      tools: [
        {
          id: 'schedule_interview',
          name: 'Schedule Interview',
          icon: Calendar,
          description: 'Book interview round with candidate',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Schedule an interview');
          },
        },
        {
          id: 'interview_questions',
          name: 'Interview Questions',
          icon: MessageSquare,
          description: 'Role-specific behavioral & technical questions',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Generate tailored technical and competency interview questions for our active roles');
          },
        },
        {
          id: 'ai_interview_plan',
          name: 'AI Interview Plan',
          icon: Sparkles,
          description: 'Structured rounds, rubrics & assessment plans',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Create an AI interview plan with rounds, rubrics, and evaluation criteria');
          },
        },
        {
          id: 'feedback_scores',
          name: 'Feedback & Scores',
          icon: CheckCircle2,
          description: 'Review interview evaluation rubrics & scores',
          action: () => {
            setIsToolsDrawerOpen(false);
            navigate('/dashboard/interviews');
          },
        },
      ],
    },
    {
      id: 'reports',
      name: 'REPORTS',
      tools: [
        {
          id: 'hiring_analytics',
          name: 'Hiring Analytics',
          icon: BarChart2,
          description: 'Pipeline velocity, pass rates & funnel metrics',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Summarize my hiring pipeline and talent analytics');
          },
        },
        {
          id: 'export_reports',
          name: 'Export Reports',
          icon: FileText,
          description: 'Export CSV / PDF hiring report',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Export hiring progress and pipeline report for my department');
          },
        },
      ],
    },
    {
      id: 'settings',
      name: 'SETTINGS',
      tools: [
        {
          id: 'ai_preferences',
          name: 'AI Preferences',
          icon: Settings,
          description: 'Personalize prompt guidance & AI persona',
          action: () => {
            setIsToolsDrawerOpen(false);
            handleSendPrompt('Show my AI assistant preferences, role context, and conversation settings');
          },
        },
        {
          id: 'integrations',
          name: 'Integrations',
          icon: Bot,
          description: 'Telegram, Zoho Cliq & Microsoft Teams bots',
          action: () => {
            setIsToolsDrawerOpen(false);
            setShowCliqModal(true);
          },
        },
      ],
    },
  ], [navigate, handleSendPrompt, pendingRequisitionsCount]);

  const filteredToolGroups = useMemo(() => {
    if (!toolsSearchQuery.trim()) return TOOL_GROUPS;
    const query = toolsSearchQuery.toLowerCase().trim();
    return TOOL_GROUPS.map((group) => {
      const matchingTools = group.tools.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          group.name.toLowerCase().includes(query)
      );
      return { ...group, tools: matchingTools };
    }).filter((group) => group.tools.length > 0);
  }, [toolsSearchQuery, TOOL_GROUPS]);

  return (
    <div
      className="w-full h-full max-h-screen lg:h-[calc(100vh-32px)] overflow-hidden flex flex-col text-left relative selection:bg-black selection:text-white bg-transparent"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Mobile Top Navigation Bar (< lg) */}
      <div className="lg:hidden shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200/80 bg-white/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
            className="p-1.5 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-800 transition-colors cursor-pointer"
            title="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 flex items-center justify-center">
              <img src={termjobsLogo} alt="Logo" className="w-4.5 h-4.5 object-contain" />
            </div>
            <span className="font-bold text-xs text-gray-900 tracking-tight">Hiring Assistant</span>
          </div>
        </div>

        {/* Mobile compact tool buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleStartNewChat}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-black hover:text-white text-gray-800 flex items-center justify-center transition-all cursor-pointer text-xs"
            title="New Chat"
          >
            <Plus size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => {
              setConversationsSearchQuery('');
              setIsConversationsDrawerOpen((prev) => !prev);
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isConversationsDrawerOpen ? 'bg-black text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
            title="Chat History"
          >
            <History size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setToolsSearchQuery('');
              setIsToolsDrawerOpen((prev) => !prev);
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isToolsDrawerOpen ? 'bg-black text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
            title="Tools & Actions"
          >
            <MoreHorizontal size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Live Bot Feedback Banner */}
      {botFeedback.text && (
        <div className="max-w-4xl mx-auto px-4 pt-3 shrink-0 w-full">
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-all shadow-xs ${
              botFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : botFeedback.type === 'info'
                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {botFeedback.type === 'success' ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : botFeedback.type === 'info' ? (
                <Loader2 size={15} className="text-sky-600 animate-spin shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-red-600 shrink-0" />
              )}
              <span>{botFeedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBotFeedback({ type: '', text: '' })}
              className="text-gray-400 hover:text-black cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Top-Right Icon Toolbar (Desktop only) */}
      <div className="hidden lg:flex absolute top-1.5 sm:top-2 right-2 sm:right-2.5 z-20 items-center gap-1">
        {/* + Icon: Opens a New Chat */}
        <button
          type="button"
          onClick={handleStartNewChat}
          className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg bg-white hover:bg-[#F7F7F5] border border-[#E5E5E5] text-[#111111] shadow-2xs hover:shadow-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="New Chat (+)"
        >
          <Plus size={12.5} strokeWidth={2.4} />
        </button>

        {/* History / Previous Chat History Icon */}
        <button
          type="button"
          onClick={() => {
            setConversationsSearchQuery('');
            setIsConversationsDrawerOpen((prev) => !prev);
          }}
          className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
            isConversationsDrawerOpen
              ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
              : 'bg-white hover:bg-[#F7F7F5] border-[#E5E5E5] text-[#111111] shadow-2xs hover:shadow-xs'
          }`}
          title="Previous Chat History / Conversations"
        >
          <History size={12.5} strokeWidth={2} />
        </button>

        {/* Telegram Bot Icon (Replaced Candidate Icon) */}
        <button
          type="button"
          onClick={handleOpenTelegramBot}
          className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg bg-white hover:bg-[#F7F7F5] border border-[#E5E5E5] text-[#111111] shadow-2xs hover:shadow-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title={
            botStatus?.telegram?.is_linked
              ? `Open Telegram Bot (@${botStatus.telegram.bot_username || 'TermJobsBot'})`
              : 'Open Telegram Bot / Connect on Telegram'
          }
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-[#111111]" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </button>

        {/* Team Chat Drawer Icon */}
        <button
          type="button"
          onClick={() => setIsTeamChatDrawerOpen((prev) => !prev)}
          className={`relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
            isTeamChatDrawerOpen
              ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
              : 'bg-white hover:bg-[#F7F7F5] border-[#E5E5E5] text-[#111111] shadow-2xs hover:shadow-xs'
          }`}
          title="Team Messages (Chat with Company Admin & Hiring Managers)"
        >
          <MessageSquare size={12.5} strokeWidth={2} />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-black text-white text-[8.5px] font-bold flex items-center justify-center font-mono">
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setToolsSearchQuery('interview');
            setIsToolsDrawerOpen(true);
          }}
          className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg bg-white hover:bg-[#F7F7F5] border border-[#E5E5E5] text-[#111111] shadow-2xs hover:shadow-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Interviews & Calendar"
        >
          <Calendar size={12.5} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => {
            setToolsSearchQuery('');
            setIsToolsDrawerOpen((prev) => !prev);
          }}
          className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
            isToolsDrawerOpen
              ? 'bg-[#111111] text-white border-[#111111] shadow-xs'
              : 'bg-white hover:bg-[#F7F7F5] border-[#E5E5E5] text-[#111111] shadow-2xs hover:shadow-xs'
          }`}
          title="Tools & Actions"
        >
          <MoreHorizontal size={12.5} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => setShowProfileModal(true)}
          className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg bg-[#000000] text-white text-[9px] font-bold shadow-2xs hover:bg-[#111111] flex items-center justify-center transition-all cursor-pointer active:scale-95 uppercase tracking-tight"
          title="Hiring Manager Profile & Account Settings"
        >
          {userInitials || 'HM'}
        </button>
      </div>

      {messages.length === 0 ? (
        /* ========================================================================= */
        /* CLEAN CENTERED AI WORKSPACE (FIXED & NON-SCROLLING, MOBILE OPTIMISED)     */
        /* ========================================================================= */
        <div className="flex-1 w-full min-h-0 flex flex-col items-center justify-center px-3 sm:px-6 py-2 sm:py-3 max-w-4xl mx-auto overflow-hidden">
          {/* Centered TermJobs Logo */}
          <div className="flex items-center justify-center mx-auto mb-1">
            <img src={termjobsLogo} alt="TermJobs" className="w-11 h-11 sm:w-14 sm:h-14 object-contain" />
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight text-center px-2">
            {greetingText}, {userName} <span className="inline-block">👋</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm font-medium text-gray-500 text-center mt-0.5 sm:mt-1 mb-3 sm:mb-5">
            I'm your Hiring Assistant.
          </p>

          {/* Centered Main Chat Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="w-full max-w-2xl sm:max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-xl transition-all p-3 sm:p-4.5 flex flex-col justify-between min-h-[105px] sm:min-h-[120px] border-0 focus-within:shadow-xl"
          >
            <textarea
              ref={promptInputRef}
              rows={2}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              placeholder="Ask me anything about requisitions, candidates, interviews, or team..."
              disabled={isAiTyping}
              className="w-full bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none resize-none font-normal leading-relaxed disabled:opacity-50"
            />

            <div className="flex items-center justify-end pt-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`cursor-pointer p-1.5 rounded-xl hover:bg-gray-100 transition-colors ${
                    isListening ? 'text-red-500 animate-pulse bg-red-50' : 'text-gray-400 hover:text-gray-700'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Voice input (Speech to Text)'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <button
                  type="submit"
                  disabled={!promptInput.trim() || isAiTyping}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#18181B] text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer shadow-xs disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="Send message"
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          </form>

          {/* Centered Suggestion Pills */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 flex-wrap w-full max-w-2xl sm:max-w-3xl py-1">
            <button
              type="button"
              disabled={isAiTyping}
              onClick={() => handleSendPrompt('Help me create a new requisition for a DevSecOps Engineer')}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-gray-50 border-0 text-[10.5px] sm:text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <FileText size={12} className="text-gray-600 shrink-0" />
              <span>Create requisition</span>
            </button>

            <button
              type="button"
              disabled={isAiTyping}
              onClick={() => handleSendPrompt('Also suggest 5 potential candidates from our candidate pool')}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-gray-50 border-0 text-[10.5px] sm:text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <Users size={12} className="text-gray-600 shrink-0" />
              <span>Screen candidates</span>
            </button>

            <button
              type="button"
              disabled={isAiTyping}
              onClick={() => handleSendPrompt('Compare top shortlisted candidates and their match scores')}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-gray-50 border-0 text-[10.5px] sm:text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <BarChart2 size={12} className="text-gray-600 shrink-0" />
              <span>Compare candidates</span>
            </button>

            <button
              type="button"
              disabled={isAiTyping}
              onClick={() => handleSendPrompt('Schedule an interview')}
              className="hidden sm:flex px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-gray-50 border-0 text-[10.5px] sm:text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm transition-all cursor-pointer items-center gap-1 sm:gap-1.5 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <Calendar size={12} className="text-gray-600 shrink-0" />
              <span>Schedule interview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setToolsSearchQuery('');
                setIsToolsDrawerOpen(true);
              }}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-gray-50 border-0 text-[10.5px] sm:text-xs font-semibold text-gray-500 shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-95"
              title="More actions in tools drawer"
            >
              •••
            </button>
          </div>
        </div>
      ) : (
        /* Conversation Mode */
        <div className="flex-1 w-full min-h-0 flex flex-col max-w-5xl mx-auto px-2 sm:px-6 pt-1 sm:pt-2 overflow-hidden relative z-10">
          <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* TOP HEADER (Desktop only - mobile already has top bar) */}
              <div className="hidden lg:flex items-center justify-between pb-2 mb-1 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    <img src={termjobsLogo} alt="TermJobs" className="w-5.5 h-5.5 object-contain" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-gray-900 leading-tight">Hiring Assistant</h2>
                    <p className="text-[10px] text-gray-400">Ask anything or select actions</p>
                  </div>
                </div>
              </div>

              {/* CHAT MESSAGES STREAM CONTAINER */}
              <div
                ref={chatContainerRef}
                className="flex-1 min-h-0 overflow-y-auto pr-1.5 overscroll-contain flex flex-col gap-4 pt-1 pb-3"
                style={{ scrollBehavior: 'auto' }}
              >

              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className="w-full shrink-0">
                    {/* User Message Bubble */}
                    {isUser ? (
                      <div className="w-full flex justify-end items-start py-1 px-1 relative isolate select-text">
                        <div className="bg-[#111417] text-white text-[12.5px] sm:text-[13px] font-medium leading-relaxed max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-2xs select-text break-words">
                          {msg.text}
                        </div>
                      </div>
                    ) : parseHiringPipelineData(msg.text, msg.executedActions) ? (
                      <div className="w-full flex items-start gap-2.5 sm:gap-3 py-1 px-1 relative isolate select-text">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0 mt-0.5">
                          <img src={termjobsLogo} alt="TermJobs" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0 max-w-3xl xl:max-w-4xl">
                          <HiringPipelineResponseCard
                            data={parseHiringPipelineData(msg.text, msg.executedActions)}
                            timestamp={msg.timestamp || 'Just now'}
                            onSendMessage={(prompt) => handleSendPrompt(prompt)}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Assistant Message Bubble - Matching AiChat.jsx Modern Borderless Design */
                      <div className="w-full flex items-start gap-2.5 sm:gap-3 py-1 px-1 relative isolate select-text">
                        {/* Assistant Avatar */}
                        <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0 mt-0.5">
                          <img src={termjobsLogo} alt="TermJobs" className="w-full h-full object-contain" />
                        </div>

                        {/* Message Bubble - BORDERLESS white card with high-end ergonomics */}
                        <div className="flex-1 min-w-0 bg-white border-0 rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-xs space-y-3 select-text max-w-3xl xl:max-w-4xl">
                          {msg.heading && (
                            <div className="font-extrabold text-gray-950 text-xs sm:text-[13px] tracking-tight select-text">
                              {msg.heading}
                            </div>
                          )}

                          {/* Markdown Body using .chat-markdown-body and formatMarkdownContent */}
                          {msg.text && (
                            <div
                              className="chat-markdown-body prose prose-sm max-w-none text-gray-800 font-sans text-xs sm:text-[12.5px] leading-relaxed select-text"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(formatMarkdownContent(msg.text || ''))
                              }}
                            />
                          )}

                          {/* Inline Requisition Card (Exact Image 2 Match) */}
                          {msg.requisitionDraft && (
                            <div className="w-full max-w-3xl xl:max-w-4xl bg-white rounded-2xl border border-gray-200/90 shadow-xs p-5 sm:p-6 text-left">
                              {/* Card Header */}
                              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                  <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                                    {msg.requisitionDraft.title}
                                  </h3>
                                  {msg.requisitionDraft.status && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      msg.requisitionDraft.status === 'Published'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : msg.requisitionDraft.status === 'Pending Approval' || msg.requisitionDraft.isSubmittedForApproval
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}>
                                      {msg.requisitionDraft.isSubmittedForApproval ? 'Pending Approval' : msg.requisitionDraft.status}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {msg.requisitionDraft.id && !msg.requisitionDraft.id.startsWith('draft-') && (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/dashboard/requisitions/${msg.requisitionDraft.id}`)}
                                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
                                      title="Open full requisition page"
                                    >
                                      <span>Open Page</span>
                                      <ExternalLink size={12} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(msg.requisitionDraft, msg.id)}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                  >
                                    <Pencil size={12} className="text-gray-500" />
                                    <span>Edit</span>
                                  </button>
                                </div>
                              </div>

                              {/* 2-Column Content */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                {/* Left Column Parameters */}
                                <div className="space-y-2.5">
                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <Building2 size={14} className="text-gray-400" />
                                      <span>Department</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.department}
                                    </span>
                                  </div>

                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <MapPin size={14} className="text-gray-400" />
                                      <span>Location</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.location}
                                    </span>
                                  </div>

                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <Clock size={14} className="text-gray-400" />
                                      <span>Experience</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.experience}
                                    </span>
                                  </div>

                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <Briefcase size={14} className="text-gray-400" />
                                      <span>Employment Type</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.employment_type}
                                    </span>
                                  </div>

                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <Globe size={14} className="text-gray-400" />
                                      <span>Hiring Model</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.hiring_model}
                                    </span>
                                  </div>

                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <Users size={14} className="text-gray-400" />
                                      <span>No. of Openings</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.openings}
                                    </span>
                                  </div>

                                  <div className="flex items-center text-xs">
                                    <div className="flex items-center gap-2 text-gray-500 w-36 shrink-0">
                                      <CalendarCheck size={14} className="text-gray-400" />
                                      <span>Target Start Date</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 truncate">
                                      {msg.requisitionDraft.target_start_date}
                                    </span>
                                  </div>
                                </div>

                                {/* Right Column: Key Skills & Role Summary */}
                                <div className="space-y-4">
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 mb-2">
                                      <Shield size={14} className="text-gray-600" />
                                      <span>Key Skills</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {msg.requisitionDraft.skills?.slice(0, 5).map((skill, si) => (
                                        <span
                                          key={si}
                                          className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-[11px] font-medium border border-gray-200/50"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                      {msg.requisitionDraft.skills?.length > 5 && (
                                        <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-[11px] font-semibold">
                                          +{msg.requisitionDraft.skills.length - 5}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 mb-1.5">
                                      <FileText size={14} className="text-gray-600" />
                                      <span>Role Summary</span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed font-normal">
                                      {msg.requisitionDraft.summary}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Card Action Buttons (Under "What would you like to do next?") */}
                              <div className="mt-5 pt-3.5 border-t border-gray-100">
                                <p className="text-xs text-gray-600 font-medium mb-2.5">
                                  What would you like to do next?
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {msg.requisitionDraft.id && !msg.requisitionDraft.id.startsWith('draft-') ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/dashboard/requisitions/${msg.requisitionDraft.id}`)}
                                        className="px-3.5 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                                      >
                                        <ExternalLink size={13} />
                                        <span>Open Full Requisition</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(msg.requisitionDraft, msg.id)}
                                        className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                      >
                                        <Pencil size={13} className="text-gray-500" />
                                        <span>Edit Details</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleSendPrompt(`Show candidates for ${msg.requisitionDraft.title}`)}
                                        className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                      >
                                        <Users size={13} className="text-gray-500" />
                                        <span>View Candidates</span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {msg.requisitionDraft.isSubmittedForApproval || msg.requisitionDraft.status === 'Pending Approval' ? (
                                        <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                                          <Clock size={13} className="text-amber-600" />
                                          <span>Awaiting Director Approval</span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleSubmitForApprovalFromCard(msg.requisitionDraft, msg.id)}
                                          className="px-3.5 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                                        >
                                          <ShieldCheck size={13} />
                                          <span>Send to Director for Approval</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(msg.requisitionDraft, msg.id)}
                                        className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                      >
                                        <Pencil size={13} className="text-gray-500" />
                                        <span>Edit Details</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAddRequirements(msg.requisitionDraft, msg.id)}
                                        className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                      >
                                        <Shield size={13} className="text-gray-500" />
                                        <span>Add Requirements</span>
                                      </button>
                                    </>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleGenerateJD(msg.requisitionDraft, msg.id)}
                                    className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <Sparkles size={13} className="text-gray-500" />
                                    <span>Generate Job Description</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSendPrompt(
                                        `What else is needed to finalize the ${msg.requisitionDraft.title} requisition?`
                                      )
                                    }
                                    className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    •••
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Inline Interview Proposal Card */}
                          {msg.interviewProposal && (
                            <div className="mt-3.5 p-4 rounded-2xl bg-white border border-gray-200/90 shadow-2xs w-full max-w-xl text-left">
                              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100">
                                    <CalendarCheck size={16} />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-900">
                                      Interview Scheduled: {msg.interviewProposal.round || 'Technical Round'}
                                    </h4>
                                    <p className="text-[11px] text-gray-500">
                                      For {msg.interviewProposal.requisition || 'Active Role'}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Calendar Ready
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5 my-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                  <span className="text-[10px] text-gray-400 font-medium block">Candidate</span>
                                  <span className="font-semibold text-gray-800 truncate block mt-0.5">
                                    {msg.interviewProposal.candidate}
                                  </span>
                                  <span className="text-[10.5px] text-gray-500 truncate block">
                                    {msg.interviewProposal.candidate_email}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                  <span className="text-[10px] text-gray-400 font-medium block">Date & Time</span>
                                  <span className="font-semibold text-gray-800 block mt-0.5">
                                    {msg.interviewProposal.scheduled_date} at {msg.interviewProposal.scheduled_time}
                                  </span>
                                  <span className="text-[10.5px] text-gray-500 block">
                                    Duration: {msg.interviewProposal.duration || '45 mins'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendPrompt(
                                      `Dispatch calendar invitation and meeting link to ${msg.interviewProposal.candidate}`
                                    )
                                  }
                                  className="flex-1 py-2 px-3 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                  <Send size={12} />
                                  <span>Dispatch Invitation</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendPrompt(
                                      `Reschedule interview for ${msg.interviewProposal.candidate} to next week`
                                    )
                                  }
                                  className="py-2 px-3 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
                                >
                                  Reschedule
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inline Candidate Suggestions Cards (Exact Image 2 Match) */}
                          {msg.candidatesList && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-3 w-full max-w-4xl xl:max-w-5xl">
                              {msg.candidatesList.map((cand) => (
                                <div
                                  key={cand.id}
                                  className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-3.5 flex flex-col justify-between hover:shadow-md transition-all text-left"
                                >
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <div className="w-8 h-8 rounded-full bg-black text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                        {cand.initials || (cand.name || 'C').charAt(0)}
                                      </div>
                                      <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200/60">
                                        {cand.match_score || '85% Match'}
                                      </span>
                                    </div>

                                    <div className="mt-2.5">
                                      <h4 className="font-bold text-xs sm:text-[13px] text-gray-900 truncate">
                                        {cand.name}
                                      </h4>
                                      <p className="text-[10.5px] text-gray-500 font-medium truncate mt-0.5">
                                        {cand.role}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-2">
                                      <div className="flex items-center gap-1">
                                        <Users size={11} className="text-gray-400" />
                                        <span>{cand.experience}</span>
                                      </div>
                                      <span>•</span>
                                      <div className="flex items-center gap-1 truncate">
                                        <MapPin size={11} className="text-gray-400" />
                                        <span className="truncate">{cand.location}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 flex-wrap mt-2.5 mb-3">
                                      {cand.skills?.slice(0, 2).map((skill, si) => (
                                        <span
                                          key={si}
                                          className="text-[9.5px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium border border-gray-200/50"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                      {cand.skills?.length > 2 && (
                                        <span className="text-[9.5px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">
                                          +{cand.skills.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedCandidateProfile(cand)}
                                    className="w-full py-1.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors shadow-2xs mt-auto cursor-pointer"
                                  >
                                    View Profile
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Requisitions List Cards */}
                          {msg.requisitionsList && msg.requisitionsList.length > 0 && (
                            <div className="space-y-2 mt-3 w-full max-w-4xl xl:max-w-5xl text-left">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {msg.requisitionsList.map((req) => {
                                  const sLower = (req.status || '').toLowerCase();
                                  const isLive = ['published', 'open', 'active'].includes(sLower);
                                  const isPending = sLower.includes('pending');
                                  const isDraft = sLower.includes('draft');

                                  const badgeColor = isLive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isPending
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : isDraft
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-gray-100 text-gray-700 border-gray-200';

                                  return (
                                    <div
                                      key={req.id || req.title}
                                      className="p-4 rounded-2xl bg-white border border-gray-200/90 shadow-2xs hover:border-gray-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3 text-left"
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-1.5 mb-2">
                                          <h4 className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-1">
                                            {req.title}
                                          </h4>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${badgeColor}`}>
                                            {req.status || 'Active'}
                                          </span>
                                        </div>

                                        <div className="space-y-1 text-xs text-gray-500">
                                          <div className="flex items-center gap-2 truncate">
                                            <Building2 size={13} className="text-gray-400 shrink-0" />
                                            <span className="truncate">{req.department || 'Engineering'}</span>
                                          </div>
                                          <div className="flex items-center gap-2 truncate">
                                            <MapPin size={13} className="text-gray-400 shrink-0" />
                                            <span className="truncate">{req.location || 'Remote'}</span>
                                          </div>
                                          {req.salary_range && (
                                            <div className="flex items-center gap-2 text-gray-800 font-semibold truncate pt-0.5">
                                              <span className="text-gray-400 text-xs shrink-0">💼</span>
                                              <span className="truncate">{req.salary_range}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/dashboard/requisitions/${req.id}`)}
                                          className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
                                        >
                                          View Details
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSendPrompt(`Show candidates for ${req.title}`)}
                                          className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                                        >
                                          Candidates
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Initial Briefing Recent Activity Component */}
                          {msg.showActivity && (
                            <div className="pt-0.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-900 tracking-tight">
                                  <Clock size={13} className="text-gray-700" />
                                  <span>Recent activity</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSwitchTab('overview', 'Dashboard Overview')}
                                  className="text-[10.5px] font-semibold text-gray-500 hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <span>View overview</span>
                                  <ArrowRight size={10} />
                                </button>
                              </div>

                              <div className="bg-white rounded-xl border border-gray-100/90 shadow-xs divide-y divide-gray-100 overflow-hidden">
                                {recentActivities.length === 0 ? (
                                  <div className="p-3 text-center text-gray-400 text-[11px] font-medium">
                                    No pending urgent items • Pipeline is clear and active.
                                  </div>
                                ) : (
                                  recentActivities.map((act) => {
                                    const IconComp = act.icon || Clock;
                                    return (
                                      <div
                                        key={act.id}
                                        onClick={() => handleSwitchTab(act.type, act.tabTitle, act.data)}
                                        className={`p-2.5 sm:px-3 sm:py-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer group ${
                                          act.isAlert
                                            ? 'bg-[#FEF9EE] hover:bg-[#FDF3DA] border-l-4 border-amber-400'
                                            : 'hover:bg-gray-50/80'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                                              act.isAlert
                                                ? 'bg-amber-100 border-amber-200 text-amber-700'
                                                : 'bg-gray-50 border-gray-200/60 text-gray-700'
                                            }`}
                                          >
                                            <IconComp size={13} />
                                          </div>
                                          <div className="min-w-0">
                                            <div
                                              className={`text-[11.5px] font-bold truncate ${
                                                act.isAlert ? 'text-amber-950' : 'text-gray-900'
                                              }`}
                                            >
                                              {act.title}
                                            </div>
                                            <div
                                              className={`text-[10px] font-normal truncate mt-0.5 ${
                                                act.isAlert ? 'text-amber-800/80' : 'text-gray-400'
                                              }`}
                                            >
                                              {act.subtitle}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span
                                            className={`text-[10px] font-medium ${
                                              act.isAlert ? 'text-amber-700' : 'text-gray-400'
                                            }`}
                                          >
                                            {act.time}
                                          </span>
                                          <ChevronRight
                                            size={13}
                                            className={`group-hover:translate-x-0.5 transition-all ${
                                              act.isAlert
                                                ? 'text-amber-500 group-hover:text-amber-900'
                                                : 'text-gray-300 group-hover:text-gray-700'
                                            }`}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bottom Right Corner Timestamp (Matching AiChat.jsx) */}
                          <div className="text-[10px] text-gray-400 font-mono text-right pt-0.5 select-text">
                            {msg.timestamp || 'Just now'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* AI Thinking / Typing Indicator */}
              {isAiTyping && (
                <div className="w-full flex items-start gap-2.5 sm:gap-3 py-1 px-1 relative isolate">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0 mt-0.5">
                    <img src={termjobsLogo} alt="TermJobs" className="w-full h-full object-contain animate-pulse" />
                  </div>
                  <div className="bg-white border-0 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-2.5 text-xs font-medium text-gray-600">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    </div>
                    <span>Assistant is analyzing your pipeline...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* FLOATING / DOCKED BOTTOM ASSISTANT PROMPT BAR */}
            <div className="pt-2 pb-2 shrink-0 mt-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendPrompt();
                }}
                className="bg-white rounded-2xl border border-gray-200/90 shadow-md p-2 pl-4 flex items-center gap-2.5 transition-all focus-within:ring-2 focus-within:ring-black/10 focus-within:border-gray-300"
              >

                <input
                  ref={promptInputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Ask me anything about requisitions, candidates, interviews, or team..."
                  disabled={isAiTyping}
                  className="w-full bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none font-normal disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`cursor-pointer p-1.5 shrink-0 rounded-xl transition-colors ${isListening ? 'text-red-500 animate-pulse bg-red-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  title={isListening ? 'Listening... click to stop' : 'Voice input (Speech to Text)'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  type="submit"
                  disabled={!promptInput.trim() || isAiTyping}
                  className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors cursor-pointer shrink-0 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <ArrowUp size={15} />
                </button>
              </form>

              {/* Prompt Suggestion Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button
                  type="button"
                  disabled={isAiTyping}
                  onClick={() => handleSendPrompt('Summarize my hiring pipeline')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-[11px] font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Summarize my hiring pipeline"
                >
                  Pipeline summary
                </button>
                <button
                  type="button"
                  disabled={isAiTyping}
                  onClick={() => handleSendPrompt('Also suggest 5 potential candidates from our candidate pool')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-[11px] font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Show me candidates for DevSecOps"
                >
                  DevSecOps candidates
                </button>
                <button
                  type="button"
                  disabled={isAiTyping}
                  onClick={() => handleSendPrompt('Schedule an interview')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-[11px] font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Schedule an interview"
                >
                  Schedule interview
                </button>
                <button
                  type="button"
                  disabled={isAiTyping}
                  onClick={() => handleSendPrompt('Help me create a new requisition for a DevSecOps Engineer')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-[11px] font-medium text-gray-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Draft a new requisition"
                >
                  Draft requisition
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/hiring-manager/chat')}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-[11px] font-medium text-gray-500 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                  title="View Dashboard Overview"
                >
                  •••
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Requisition Modal (Inline Card Tweak) */}
      {editingDraftData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Edit Requisition Details</h3>
                <p className="text-xs text-gray-400 mt-0.5">Modify parameters for {editingDraftData.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDraftData(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={editingDraftData.title || ''}
                  onChange={(e) => setEditingDraftData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editingDraftData.department || ''}
                    onChange={(e) => setEditingDraftData((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingDraftData.location || ''}
                    onChange={(e) => setEditingDraftData((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Experience</label>
                  <input
                    type="text"
                    value={editingDraftData.experience || ''}
                    onChange={(e) => setEditingDraftData((prev) => ({ ...prev, experience: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Employment Type</label>
                  <input
                    type="text"
                    value={editingDraftData.employment_type || ''}
                    onChange={(e) => setEditingDraftData((prev) => ({ ...prev, employment_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Openings</label>
                  <input
                    type="number"
                    min="1"
                    value={editingDraftData.openings || 1}
                    onChange={(e) => setEditingDraftData((prev) => ({ ...prev, openings: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Key Skills (comma separated)</label>
                <input
                  type="text"
                  value={Array.isArray(editingDraftData.skills) ? editingDraftData.skills.join(', ') : editingDraftData.skills || ''}
                  onChange={(e) =>
                    setEditingDraftData((prev) => ({
                      ...prev,
                      skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Role Summary</label>
                <textarea
                  rows={4}
                  value={editingDraftData.summary || ''}
                  onChange={(e) => setEditingDraftData((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-black/10 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setEditingDraftData(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedDraft(editingDraftData)}
                className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile Modal */}
      {selectedCandidateProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black text-white font-bold text-sm flex items-center justify-center">
                  {selectedCandidateProfile.initials || (selectedCandidateProfile.name || 'C').charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">{selectedCandidateProfile.name}</h3>
                  <p className="text-xs text-gray-500">{selectedCandidateProfile.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateProfile(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Match Score</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {selectedCandidateProfile.match_score || '85% Match'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Experience</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {selectedCandidateProfile.experience}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Location</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {selectedCandidateProfile.location}
                  </div>
                </div>
              </div>

              {selectedCandidateProfile.bio && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Candidate Profile Overview</div>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    {selectedCandidateProfile.bio}
                  </p>
                </div>
              )}

              <div>
                <div className="font-semibold text-gray-700 mb-2">Verified Skills & Tools</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedCandidateProfile.skills?.map((skill, si) => (
                    <span
                      key={si}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-medium border border-gray-200/60"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {selectedCandidateProfile.rate && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50/30">
                  <span className="text-gray-500 font-medium">Expected Billing Rate:</span>
                  <span className="font-bold text-gray-900">{selectedCandidateProfile.rate}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setSelectedCandidateProfile(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const candName = selectedCandidateProfile.name;
                  setSelectedCandidateProfile(null);
                  handleSendPrompt(`Schedule an interview with ${candName}`);
                }}
                className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Zoho Cliq Integration Modal */}
      {showCliqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-sm sm:text-base">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageSquare size={17} />
                </div>
                <span>Zoho Cliq Assistant Connection</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCliqModal(false)}
                className="text-gray-400 hover:text-black cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-600">
              {/* Primary Direct Launch Card */}
              <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Direct Bot Access Link
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300/60 font-mono">
                    @{botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}
                  </span>
                </div>
                <p className="text-[12px] text-emerald-950 font-medium leading-relaxed">
                  Open the bot in Zoho Cliq to chat, draft requisitions, and review candidates:
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <a
                    href={botStatus?.zoho_cliq?.bot_url_in || botStatus?.zoho_cliq?.bot_url || `https://cliq.zoho.in/#chat:bot:${botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare size={13} />
                    <span>Launch in Zoho Cliq (.in)</span>
                    <ExternalLink size={12} className="opacity-80" />
                  </a>
                  <a
                    href={botStatus?.zoho_cliq?.bot_url_com || `https://cliq.zoho.com/#chat:bot:${botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Zoho Cliq (.com)</span>
                    <ExternalLink size={12} className="opacity-70" />
                  </a>
                  <a
                    href={botStatus?.zoho_cliq?.bot_url_eu || `https://cliq.zoho.eu/#chat:bot:${botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2.5 rounded-xl bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>(.eu)</span>
                    <ExternalLink size={12} className="opacity-70" />
                  </a>
                </div>
              </div>

              {/* Shareable Direct URL Input */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Direct Bot Chat URL (Click or Copy)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={botStatus?.zoho_cliq?.bot_url || `https://cliq.zoho.in/#chat:bot:${botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}`}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl font-mono text-[11px] text-gray-800 border border-gray-200 select-all focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        botStatus?.zoho_cliq?.bot_url || `https://cliq.zoho.in/#chat:bot:${botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}`
                      );
                      setCopiedCliqUrl(true);
                      setTimeout(() => setCopiedCliqUrl(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Copy size={13} />
                    <span>{copiedCliqUrl ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Universal Extension Direct Install Button */}
              <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                    <span>Install for Your Entire Zoho Organization</span>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 uppercase bg-sky-100 px-2 py-0.5 rounded-full border border-sky-300">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-sky-900 leading-normal">
                  Zoho Cliq keeps bots private to the creating company by default. If your team is in a different Zoho organization, click below to install the bot directly into your organization:
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <a
                    href={
                      botStatus?.zoho_cliq?.extension_install_url ||
                      'https://cliq.zoho.in/developer'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Install TermJobs Extension in Zoho Cliq</span>
                    <ExternalLink size={12} className="opacity-80" />
                  </a>
                </div>
                <p className="text-[10px] text-sky-700">
                  {botStatus?.zoho_cliq?.extension_install_url
                    ? 'Clicking install adds the bot and slash commands to your Zoho workspace with zero manual coding.'
                    : 'Company Admins can generate a universal Extension link from Zoho Developer Console and paste it in Company Settings > Bot Integrations.'}
                </p>
              </div>

              {/* How to add if not present in workspace */}
              <div className="bg-gray-50 rounded-xl p-3.5 text-[11px] text-gray-600 space-y-2 border border-gray-200/70">
                <div className="font-bold text-gray-800 flex items-center gap-1.5">
                  <Info size={13} className="text-emerald-600 shrink-0" />
                  <span>Don't have this bot in your Cliq yet?</span>
                </div>
                <ul className="list-decimal list-inside space-y-1.5 text-gray-600 pl-0.5 leading-relaxed">
                  <li>
                    Click <b>Install TermJobs Extension</b> above if your company is external.
                  </li>
                  <li>
                    Or inside Zoho Cliq, click the <b>+</b> icon next to <b>Bots</b> in the left sidebar, search for <code>@{botStatus?.zoho_cliq?.bot_name || 'hiringmanagerterm'}</code>, and click <b>Subscribe</b>.
                  </li>
                  <li>
                    Send any message (e.g. <code>hi</code> or <code>show requisitions</code>) to begin chatting!
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCliqModal(false)}
                className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Microsoft Teams Integration Modal */}
      {showTeamsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5 text-indigo-700 font-bold text-sm sm:text-base">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 7.5a2.5 2.5 0 1 0-2.45-3h-1.55a3.5 3.5 0 0 1 3.5 3.5v.5h.5zm-3.5 1h-8A2.5 2.5 0 0 0 5.5 11v6a2.5 2.5 0 0 0 2.5 2.5h8a2.5 2.5 0 0 0 2.5-2.5v-6a2.5 2.5 0 0 0-2.5-2.5zm-5 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z"/>
                  </svg>
                </div>
                <span>Microsoft Teams AI Assistant</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTeamsModal(false)}
                className="text-gray-400 hover:text-black cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-600">
              {/* Connection Status Card */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                botStatus?.ms_teams?.is_linked
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${botStatus?.ms_teams?.is_linked ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`}></span>
                    {botStatus?.ms_teams?.is_linked ? 'Account Linked' : 'Connect in 1 Click'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 border font-mono">
                    {botStatus?.ms_teams?.bot_name || 'TermJobs Assistant'}
                  </span>
                </div>

                <p className="text-[12px] font-medium leading-relaxed">
                  {botStatus?.ms_teams?.is_linked
                    ? `Your Teams user is authenticated and paired to your ${botStatus?.ms_teams?.bot_name || 'TermJobs'} workspace. You will receive Adaptive Cards for candidate match alerts and pending approvals.`
                    : 'Pair your Microsoft Teams account in 1 click to draft job requisitions, approve contractor timesheets, and review candidate profiles directly inside Teams.'}
                </p>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {botStatus?.ms_teams?.is_linked ? (
                    <>
                      <a
                        href={botStatus?.ms_teams?.bot_url || `https://teams.microsoft.com/l/chat/0/0?users=28:${botStatus?.ms_teams?.app_id || ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>Launch in Teams</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleUnlinkTeams}
                        className="px-3.5 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Disconnect</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectTeams}
                      disabled={linkingTeams}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {linkingTeams ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                      <span>{linkingTeams ? 'Opening Teams...' : 'Connect to Microsoft Teams'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Download App Manifest Package */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-800 text-xs">Microsoft Teams App Package (.zip)</div>
                  <a
                    href={botStatus?.ms_teams?.package_url || '/api/teams/package'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>Download App (.zip)</span>
                  </a>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  If the bot is not yet installed in your company's Teams workspace, download the package and upload it in <b>Teams</b> &gt; <b>Apps</b> &gt; <i>Manage your apps</i> &gt; <b>Upload an app</b>.
                </p>
              </div>

              {/* What you can do inside Teams */}
              <div className="bg-indigo-50/50 rounded-xl p-3 text-[11px] text-indigo-950 space-y-1.5 border border-indigo-100">
                <div className="font-bold text-indigo-900">⚡ What you can do directly inside Microsoft Teams:</div>
                <ul className="list-disc list-inside space-y-0.5 text-indigo-900/80">
                  <li>Type <code>pending works</code> to review active approval cards.</li>
                  <li>Type <code>draft a React developer with 3 yrs exp</code> to generate requisitions.</li>
                  <li>Type <code>upcoming meetings</code> to inspect today's candidate interviews.</li>
                  <li>Click <b>Approve</b> or <b>Reject</b> directly on Teams Adaptive Cards.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowTeamsModal(false)}
                className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hiring Manager Profile & Account Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 text-left font-sans animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            onClick={() => setShowProfileModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 sm:p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar select-text">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs">
                  <User size={15} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-950">Hiring Manager Profile</h3>
                  <p className="text-[11px] text-gray-500">Account identity, team messaging & preferences</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Summary Card */}
            <div className="p-4 rounded-xl bg-[#FAFBFD] border border-gray-200/80 flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-black text-white font-black text-base flex items-center justify-center shrink-0 shadow-2xs">
                {userInitials || 'HM'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-gray-950 truncate">{userName}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black text-white">
                    {user?.role || 'Hiring Manager'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</div>
                <div className="flex items-center gap-3 text-[11px] text-gray-600 mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-gray-400" />
                    <b>{user?.tenant_name || 'TermJobs Company'}</b>
                  </span>
                  {user?.department && (
                    <span className="flex items-center gap-1">
                      <Layers size={12} className="text-gray-400" />
                      {user.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Team Messaging Status & Quick Access */}
            <div className="p-3.5 rounded-xl bg-white border border-gray-200/90 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-gray-800" />
                  <span className="text-xs font-bold text-gray-900">Internal Team Messaging</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PERMITTED
                </span>
              </div>
              <p className="text-[11.5px] text-gray-600 leading-relaxed">
                You have active messaging access. Chat directly with your Company Admin and fellow Hiring Managers to coordinate requisitions and interview feedback.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setIsTeamChatDrawerOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageSquare size={13} />
                  <span>Open Team Messages</span>
                  {unreadChatCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-white text-black text-[9.5px] font-bold">
                      {unreadChatCount} new
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Change Password Collapsible Card */}
            <form onSubmit={handleChangePassword} className="p-3.5 rounded-xl bg-white border border-gray-200/90 shadow-3xs space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-gray-800" />
                <span className="text-xs font-bold text-gray-900">Change Password</span>
              </div>

              {pwdMessage.text && (
                <div
                  className={`p-2 rounded-lg text-xs font-medium ${
                    pwdMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {pwdMessage.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Current Password</label>
                  <input
                    type="password"
                    value={pwdForm.current_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-1.5 text-xs bg-[#F6F8FA] border border-gray-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">New Password</label>
                  <input
                    type="password"
                    value={pwdForm.new_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-1.5 text-xs bg-[#F6F8FA] border border-gray-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPwd || !pwdForm.current_password || !pwdForm.new_password}
                  className="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold disabled:opacity-40 cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  {changingPwd && <Loader2 size={12} className="animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>

            {/* Modal Actions Footer */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to sign out?')) {
                    logout?.();
                    navigate('/login');
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>

              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Right-Side Tools Drawer (Slide-in Panel) */}
      <AnimatePresence>
        {isToolsDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden text-left">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsToolsDrawerOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-2xs cursor-pointer"
            />

            {/* Sliding Drawer Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] max-w-[100vw] bg-white border-l border-[#E5E5E5] shadow-2xl flex flex-col z-10 select-none"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#111111] tracking-tight">Tools</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7F7F5] text-[#737373] border border-[#E5E5E5]">
                    Workspace
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsToolsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-[#F7F7F5] text-[#737373] hover:text-[#111111] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Optional Search */}
              <div className="px-5 pt-3.5 pb-2 shrink-0 border-b border-gray-100 bg-white">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-[#737373] pointer-events-none" />
                  <input
                    type="text"
                    value={toolsSearchQuery}
                    onChange={(e) => setToolsSearchQuery(e.target.value)}
                    placeholder="Search tools..."
                    autoFocus
                    className="w-full pl-8.5 pr-8 py-2 bg-[#F7F7F5] hover:bg-gray-100/70 focus:bg-white rounded-xl border border-[#E5E5E5] text-xs text-[#111111] placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#111111]/30 transition-all"
                  />
                  {toolsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setToolsSearchQuery('')}
                      className="absolute right-2.5 text-[#737373] hover:text-[#111111] cursor-pointer p-0.5"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tool Groups Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
                {filteredToolGroups.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#737373] space-y-2">
                    <p>No tools matching "{toolsSearchQuery}"</p>
                    <button
                      type="button"
                      onClick={() => setToolsSearchQuery('')}
                      className="text-xs font-semibold text-[#111111] underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  filteredToolGroups.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <div className="text-[10px] font-bold text-[#737373] uppercase tracking-wider px-0.5">
                        {group.name}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.tools.map((tool) => {
                          const IconComp = tool.icon;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={tool.action}
                              className="p-2.5 rounded-xl bg-white hover:bg-[#F7F7F5] border border-[#E5E5E5] hover:border-[#111111]/30 text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer flex items-center gap-2 group active:scale-[0.98]"
                              title={tool.description || tool.name}
                            >
                              <div className="w-7 h-7 rounded-lg bg-[#F7F7F5] border border-[#E5E5E5] flex items-center justify-center text-[#111111] group-hover:bg-white group-hover:border-gray-300 shrink-0 transition-colors">
                                <IconComp size={13.5} strokeWidth={2} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-semibold text-[#111111] leading-tight truncate">
                                  {tool.name}
                                </div>
                              </div>
                              {tool.badge && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#111111] text-white font-mono shrink-0">
                                  {tool.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Right-Side Conversations Drawer (Exact Match to User's Reference Screenshot) */}
      <AnimatePresence>
        {isConversationsDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden text-left">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsConversationsDrawerOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-2xs cursor-pointer"
            />

            {/* Sliding Drawer Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute top-0 right-0 bottom-0 w-full sm:w-[380px] max-w-[100vw] bg-white border-l border-[#E5E5E5] shadow-2xl flex flex-col z-10 select-none"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] bg-white shrink-0">
                <h2 className="text-base font-bold text-[#111111] tracking-tight">Conversations</h2>
                <button
                  type="button"
                  onClick={() => setIsConversationsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-[#F7F7F5] text-[#737373] hover:text-[#111111] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Action Bar: + New Chat & Search */}
              <div className="p-4 pb-2.5 bg-white shrink-0 space-y-3">
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#000000] hover:bg-[#181818] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
                >
                  <Plus size={14} strokeWidth={2.4} />
                  <span>New Chat</span>
                </button>

                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-[#737373] pointer-events-none" />
                  <input
                    type="text"
                    value={conversationsSearchQuery}
                    onChange={(e) => setConversationsSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-8.5 pr-8 py-2 bg-[#F7F7F5] hover:bg-gray-100/70 focus:bg-white rounded-xl border border-[#E5E5E5] text-xs text-[#111111] placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#111111]/30 transition-all"
                  />
                  {conversationsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setConversationsSearchQuery('')}
                      className="absolute right-2.5 text-[#737373] hover:text-[#111111] cursor-pointer p-0.5"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Grouped Conversations List (Today, Yesterday, Last 7 days, Older) */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 custom-scrollbar">
                {filteredConversations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#737373] space-y-2">
                    <p>No conversations found</p>
                    {conversationsSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setConversationsSearchQuery('')}
                        className="text-xs font-semibold text-[#111111] underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  [
                    { label: 'Today', items: groupedConversations.today },
                    { label: 'Yesterday', items: groupedConversations.yesterday },
                    { label: 'Last 7 days', items: groupedConversations.last7Days },
                    { label: 'Older', items: groupedConversations.older },
                  ]
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <div key={group.label} className="space-y-1.5">
                        <div className="text-xs font-bold text-gray-700 tracking-tight px-1 mb-1.5">
                          {group.label}
                        </div>
                        <div className="space-y-1">
                          {group.items.map((conv) => {
                            const isActive = conv.id === activeConversationId;
                            return (
                              <button
                                key={conv.id}
                                type="button"
                                onClick={() => handleSelectConversation(conv)}
                                className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99] border ${
                                  isActive
                                    ? 'bg-gray-100/90 border-gray-200 shadow-2xs'
                                    : 'bg-white hover:bg-[#F7F7F5] border-transparent hover:border-[#E5E5E5]'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-xl bg-[#F7F7F5] border border-[#E5E5E5] flex items-center justify-center shrink-0 group-hover:bg-white group-hover:shadow-2xs transition-all">
                                  {getConvIcon(conv.categoryIcon)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-gray-900 leading-snug truncate">
                                    {conv.title}
                                  </div>
                                  <div className="text-[11px] text-gray-400 truncate mt-0.5 font-normal">
                                    {conv.preview}
                                  </div>
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium shrink-0 ml-1">
                                  {formatConvTime(conv.updatedAt || conv.createdAt)}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Right-Side Team Chat Drawer (Chat with Admins & Hiring Managers) */}
      <TeamChatDrawer
        isOpen={isTeamChatDrawerOpen}
        onClose={() => setIsTeamChatDrawerOpen(false)}
        currentUserName={userName}
      />

</div>
);
}