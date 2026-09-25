import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
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
  Bookmark,
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
} from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { marked } from 'marked';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import SEOHead from '../components/SEOHead';
import { Backdrop } from '../components/landing/Backdrop';
import logo from '../assets/termjobs-logo.png';
import { formatDueDate } from '../utils/dateUtils';

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
  const candidateAuth = useCandidateAuth();
  const candidateUser = candidateAuth?.candidateUser;
  const applications = candidateAuth?.applications || [];
  const logout = candidateAuth?.logout;
  const refreshProfile = candidateAuth?.refreshProfile;
  const setupProfile = candidateAuth?.setupProfile;
  const loginWithGoogle = candidateAuth?.loginWithGoogle;
  const login = candidateAuth?.login;
  const register = candidateAuth?.register;

  // Job search & filters
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkMode, setSelectedWorkMode] = useState('ALL');
  const [selectedFamily, setSelectedFamily] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('tj_saved_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleBookmark = (e, jobId) => {
    e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId];
      try {
        localStorage.setItem('tj_saved_jobs', JSON.stringify(next));
      } catch (err) {
        // ignore
      }
      return next;
    });
  };

  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMyAppsModal, setShowMyAppsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showGeneralPoolModal, setShowGeneralPoolModal] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('home');

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
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // General talent pool form
  const [poolForm, setPoolForm] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    skills: '',
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

  // Load Google Identity Services SDK on mount
  useEffect(() => {
    if (document.getElementById('google-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
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
  const handleGoogleSignIn = (onSuccess) => {
    setAuthError(null);

    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google OAuth Client ID is not configured.');
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setAuthError('Google Sign-In SDK is loading. Please try again in a few moments.');
      return;
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
    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
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
    candidateAuth?.hasResume ||
    candidateAuth?.resumeFilename ||
    candidateUser?.has_resume ||
    candidateUser?.filename ||
    candidateUser?.resume_pdf
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

  // Optimistic tracking of jobs applied in current session
  const [justAppliedJobIds, setJustAppliedJobIds] = useState(() => new Set());

  // Map of candidate's submitted applications for O(1) matching
  const appliedMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(applications)) return map;
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
  }, [applications]);

  const getJobApplication = useCallback((job) => {
    if (!job) return null;
    return (
      appliedMap.get(String(job.id)) ||
      (job._id && appliedMap.get(String(job._id))) ||
      (job.title && appliedMap.get(job.title.toLowerCase().trim())) ||
      null
    );
  }, [appliedMap]);

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
        skills: Array.isArray(candidateUser.skills) ? candidateUser.skills.join(', ') : prev.skills,
        linkedin_url: candidateUser.details?.linkedin_url || prev.linkedin_url,
        github_url: candidateUser.details?.github_url || prev.github_url,
      }));
    }
  }, [candidateUser, selectedJob]);

  // Fetch published requisitions
  useEffect(() => {
    let isMounted = true;
    async function fetchJobs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/requisitions`);
        if (!res.ok) {
          throw new Error(`Failed to load open roles (${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          setRequisitions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching public requisitions:', err);
        if (isMounted) {
          setError(err.message || 'Could not load open roles.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchJobs();
    return () => {
      isMounted = false;
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

  // Locations for filter dropdown
  const availableLocations = useMemo(() => {
    const set = new Set();
    requisitions.forEach((j) => {
      const loc = j.structured_role?.location || j.location || j.company_location;
      if (Array.isArray(loc)) {
        loc.forEach((l) => l && set.add(l));
      } else if (loc && typeof loc === 'string') {
        set.add(loc);
      }
    });
    return Array.from(set);
  }, [requisitions]);

  const getLocationDisplay = (job) => {
    const role = job.structured_role || {};
    if (Array.isArray(role.location) && role.location.length > 0) {
      return role.location[0];
    }
    if (role.location && typeof role.location === 'string') {
      return role.location;
    }
    if (job.company_location) {
      return job.company_location;
    }
    if (job.location) {
      return job.location;
    }
    return (role.work_mode || 'Remote').toLowerCase() === 'remote' ? 'Remote' : 'Hybrid';
  };

  const handleOpenJob = (job) => {
    setSelectedJob(job);
    setSubmitSuccess(null);
    setSubmitError(null);
    setResumeFile(null);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!candidateUser) {
      setSubmitError('Candidate sign-in or registration is mandatory to submit an application. Please sign in or create your profile.');
      setShowAuthModal(true);
      return;
    }

    if (!isProfileComplete && !useCustomResume && !resumeFile && !hasResume) {
      setShowSetupModal(true);
      return;
    }

    const applicantName = applyForm.name.trim() || candidateUser?.candidate_name || '';
    const applicantEmail = applyForm.email.trim() || candidateUser?.candidate_email || '';
    const applicantPhone = applyForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '';

    if (!applicantName) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (!applicantEmail) {
      setSubmitError('Please enter your email address.');
      return;
    }

    if (!hasResume && !resumeFile) {
      setSubmitError('Please choose or drop your resume file (PDF or DOCX) to complete your application.');
      return;
    }

    if (useCustomResume && !resumeFile) {
      setSubmitError('Please choose a resume file to upload, or uncheck to use your saved profile resume.');
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

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || 'Failed to submit application. Please try again.');
      }

      setSubmitSuccess(result);
      if (selectedJob?.id) {
        setJustAppliedJobIds((prev) => new Set([...prev, String(selectedJob.id)]));
      }
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (err) {
      console.error('Error applying to requisition:', err);
      setSubmitError(err.message || 'An unexpected error occurred while submitting your application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setSetupError(null);

    if (!setupForm.name.trim()) {
      setSetupError('Please enter your full name.');
      return;
    }
    if (!setupForm.phone.trim()) {
      setSetupError('Phone number is required so hiring managers can reach you.');
      return;
    }

    setSetupSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('candidate_name', setupForm.name.trim());
      formData.append('candidate_phone', setupForm.phone.trim());
      formData.append('candidate_title', setupForm.title.trim());
      formData.append('skills', setupForm.skills.trim());
      formData.append('linkedin_url', setupForm.linkedin_url.trim());
      formData.append('github_url', setupForm.github_url.trim());
      formData.append('summary', setupForm.summary.trim());

      if (setupResumeFile) {
        formData.append('resume', setupResumeFile);
      }

      if (setupProfile) {
        await setupProfile(formData);
      }
      setSetupSuccess(true);
      setTimeout(() => {
        setShowSetupModal(false);
        setSetupSuccess(false);
      }, 1200);
    } catch (err) {
      setSetupError(err.message || 'Could not update profile.');
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
    setPoolSubmitting(true);
    setPoolError(null);
    try {
      const formData = new FormData();
      formData.append('name', poolForm.name.trim() || candidateUser?.candidate_name || '');
      formData.append('email', poolForm.email.trim() || candidateUser?.candidate_email || '');
      formData.append('phone', poolForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '');
      formData.append('title', poolForm.title.trim() || candidateUser?.candidate_title || '');
      formData.append('skills', poolForm.skills.trim());
      formData.append('linkedin_url', poolForm.linkedin_url.trim() || candidateUser?.details?.linkedin_url || '');
      formData.append('github_url', poolForm.github_url.trim() || candidateUser?.details?.github_url || '');
      formData.append('cover_note', poolForm.cover_note.trim());
      if (poolResume) {
        formData.append('resume', poolResume);
      }

      const res = await fetch(`${API_BASE_URL}/api/public/talent-pool/join`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || 'Could not join talent pool.');
      }
      setPoolSuccess(result);
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (err) {
      setPoolError(err.message || 'Failed to submit profile.');
    } finally {
      setPoolSubmitting(false);
    }
  };

  const selectedJobApp = selectedJob
    ? getJobApplication(selectedJob) || (justAppliedJobIds.has(String(selectedJob.id)) ? { status: 'Screened' } : null)
    : null;
  const isSelectedJobApplied = Boolean(selectedJobApp);

  return (
    <div className="min-h-screen bg-[#08090b] text-white flex flex-col lg:flex-row font-sans selection:bg-emerald-500 selection:text-black">
      {enabled && (
        <SEOHead
          title="Open Roles & Contract Opportunities — TermJobs"
          description="Browse live contract positions across enterprise partners on TermJobs. Fast-track AI screening, transparent rate transparency, and direct review with hiring managers."
          canonicalUrl="https://termjobs.vercel.app/open-roles"
        />
      )}

      {/* ============================================================ */}
      {/* LEFT PANEL: LIGHT EDITORIAL COLUMN                          */}
      <aside className="w-full lg:w-[360px] xl:w-[400px] 2xl:w-[430px] shrink-0 bg-paper text-ink border-b lg:border-b-0 lg:border-r border-ink/10 flex flex-col justify-between relative overflow-hidden lg:h-screen lg:max-h-screen lg:sticky lg:top-0">
        {/* Light Atmospheric Background Layer - mathematically synced with Landing Page */}
        <Backdrop tone="sidebar" />

        {/* Zone 1: Main Scrollable Editorial Content (takes remaining height, never pushes bottom) */}
        <div className="relative z-10 flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar-none p-6 sm:p-7 xl:p-8 pb-2 flex flex-col justify-between">
          <div>
            {/* Brand Mark with overlapping rectangles */}
            <Link to="/" className="inline-flex items-center gap-2.5 group cursor-pointer">
              <svg className="w-7 h-7 text-neutral-900 shrink-0" viewBox="0 0 32 32" fill="none">
                <rect x="3" y="6" width="16" height="20" rx="4.5" stroke="currentColor" strokeWidth="2.4" />
                <rect x="13" y="6" width="16" height="20" rx="4.5" stroke="currentColor" strokeWidth="2.4" />
              </svg>
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
                  {requisitions.length > 0 ? requisitions.length : '24'}
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Open Roles
                </div>
              </div>

              {/* Card 2: Enterprise Partners */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Building2 size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  {new Set(requisitions.map((r) => r.company_name).filter(Boolean)).size || '36'}
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Partners
                </div>
              </div>

              {/* Card 3: Avg Review Time */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Zap size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  &lt; 24h
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
      <div className="flex-1 min-w-0 bg-ink text-paper p-4 sm:p-5 xl:p-7 flex flex-col relative overflow-hidden">
        {/* Atmospheric Background Layer */}
        <Backdrop tone="dark" />

        <div className="relative z-10 flex flex-col flex-1">
          {/* Top Header Navigation */}
          <header className="flex items-center justify-between gap-4 mb-4 sm:mb-5">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-paper/60 hover:text-white transition font-medium cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Platform Overview</span>
            </Link>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
              {candidateUser ? (
                <div className="flex items-center gap-2 p-0.5 pl-2 pr-1.5 rounded-full bg-paper/[0.06] border border-paper/15 backdrop-blur-md">
                  <div className="w-5.5 h-5.5 rounded-full bg-white/10 text-white font-bold text-[9.5px] flex items-center justify-center border border-white/20">
                    {(candidateUser.candidate_name || 'C').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold text-white max-w-[120px] truncate">
                    {candidateUser.candidate_name || candidateUser.candidate_email}
                  </span>
                  <div className="h-3 w-px bg-paper/20 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setShowSetupModal(true)}
                    className="px-2 py-0.5 text-[10.5px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMyAppsModal(true)}
                    className="px-2 py-0.5 text-[10.5px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer"
                  >
                    Applications ({applications.length})
                  </button>
                  <a
                    href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${candidateUser.id || candidateUser.candidate_email || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 text-[10.5px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer inline-flex items-center gap-1.5 text-decoration-none"
                    title="Connect Telegram for instant interview alerts & notifications"
                  >
                    <Send size={11} />
                    <span className="hidden sm:inline">Bot</span>
                  </a>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-1 text-paper/50 hover:text-white transition cursor-pointer"
                    title="Sign out"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-2.5">
                  {/* Candidate Auth Pill (Google Icon + Divider + Candidate Sign In) */}
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-white/15 bg-white/[0.03] hover:border-white/30 backdrop-blur-md transition-all">
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
                      className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-medium text-white/90 hover:text-white transition cursor-pointer"
                    >
                      <User size={12} className="text-white/70" />
                      <span>Candidate Sign In</span>
                    </button>
                  </div>

                  {/* Staff Portal Link (Border-only Transparent Pill) */}
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 rounded-full border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 text-white/90 hover:text-white text-[10.5px] sm:text-[11px] font-medium transition backdrop-blur-md active:scale-95"
                  >
                    <Users size={12} className="text-white/70" />
                    <span>Staff Portal</span>
                    <ArrowRight size={11} className="text-white/60" />
                  </Link>
                </div>
              )}
            </div>
          </header>

          {/* Glass Search & Filter Control Console */}
          <div className="mt-2 mb-4 sm:mb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full max-w-4xl p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.12] focus-within:border-white/35 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.14)] flex flex-col sm:flex-row items-center gap-2 transition-all">
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
                    className="w-full sm:w-auto appearance-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg pl-5.5 pr-5.5 py-1 text-[10.5px] text-white/90 font-medium cursor-pointer focus:outline-none focus:border-white/30 transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">All Modes</option>
                    <option value="Remote" className="bg-zinc-950 text-white">Remote</option>
                    <option value="Hybrid" className="bg-zinc-950 text-white">Hybrid</option>
                    <option value="Onsite" className="bg-zinc-950 text-white">Onsite</option>
                  </select>
                  <Briefcase size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>

                {/* Department Filter */}
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={selectedFamily}
                    onChange={(e) => setSelectedFamily(e.target.value)}
                    className="w-full sm:w-auto appearance-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg pl-5.5 pr-5.5 py-1 text-[10.5px] text-white/90 font-medium cursor-pointer focus:outline-none focus:border-white/30 transition max-w-[125px] truncate shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">All Depts</option>
                    {availableFamilies.map((fam) => (
                      <option key={fam} value={fam} className="bg-zinc-950 text-white">
                        {fam}
                      </option>
                    ))}
                  </select>
                  <Building2 size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>

                {/* Location Filter */}
                <div className="relative flex-1 sm:flex-initial hidden md:block">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full sm:w-auto appearance-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg pl-5.5 pr-5.5 py-1 text-[10.5px] text-white/90 font-medium cursor-pointer focus:outline-none focus:border-white/30 transition max-w-[115px] truncate shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">All Locations</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc} className="bg-zinc-950 text-white">
                        {loc}
                      </option>
                    ))}
                  </select>
                  <MapPin size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>

                {/* Glass Search Action Button (No Green) */}
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('roles-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
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
                  const isSaved = bookmarkedIds.includes(job.id);
                  const locDisplay = getLocationDisplay(job);
                  const existingApp = getJobApplication(job);
                  const isApplied = Boolean(existingApp || justAppliedJobIds.has(String(job.id)));

                  return (
                    <article
                      key={job.id}
                      onClick={() => handleOpenJob(job)}
                      className="group relative rounded-xl sm:rounded-2xl bg-paper/[0.04] hover:bg-paper/[0.08] border border-paper/10 hover:border-white/25 hover:shadow-[0_4px_24px_rgba(255,255,255,0.06)] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 shadow-md backdrop-blur-md cursor-pointer"
                    >
                      <div>
                        {/* Top Row: Company Initial, Name, Work Mode Badge, Bookmark */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-white text-black font-extrabold flex items-center justify-center text-[10px] shadow-sm shrink-0">
                              {companyInitial}
                            </div>
                            <span className="text-[10.5px] font-bold text-paper tracking-wider uppercase truncate max-w-[130px]">
                              {job.company_name || 'Enterprise'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-semibold bg-paper/10 text-paper/90 border border-paper/15">
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
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-semibold bg-white/10 text-white border border-white/20">
                                <Check size={9} className="text-white" />
                                <span>Applied</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => toggleBookmark(e, job.id)}
                            className="p-1 text-paper/40 hover:text-white transition cursor-pointer"
                            title={isSaved ? 'Remove Bookmark' : 'Save Role'}
                          >
                            <Bookmark size={13} className={isSaved ? 'text-white fill-white' : ''} />
                          </button>
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
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-[10px] tracking-tight transition shadow-sm cursor-pointer shrink-0"
                            title="Application Submitted · Click to view application status"
                          >
                            <Check size={11} className="text-white" />
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

            {/* Candidate Navigation (matching landing page SectionNavigation style, visible when signed in) */}
            {enabled && candidateUser && typeof document !== 'undefined' && createPortal(
              <nav
                aria-label="Candidate Navigation"
                className="fixed right-5 bottom-5 z-40 md:right-10 md:bottom-8 pointer-events-auto"
              >
                <ul className="flex flex-col items-end gap-2 md:gap-2.5">
                  {[
                    {
                      id: 'home',
                      label: 'HOME',
                      onClick: () => {
                        setActiveNavTab('home');
                        setShowAgreementModal(false);
                        setShowSetupModal(false);
                        setShowMyAppsModal(false);
                        document.getElementById('roles-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                      },
                    },
                    {
                      id: 'agreement',
                      label: 'AGREEMENT',
                      onClick: () => {
                        setActiveNavTab('agreement');
                        setShowAgreementModal(true);
                      },
                    },
                    {
                      id: 'profile',
                      label: 'PROFILE',
                      onClick: () => {
                        setActiveNavTab('profile');
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
                          className="text-[0.58rem] md:text-[0.62rem] font-semibold tracking-[0.2em] uppercase transition-opacity duration-300 hover:opacity-100 focus-visible:ring-1 focus-visible:ring-current focus-visible:outline-none text-white cursor-pointer"
                          style={{ opacity: isActive ? 1 : 0.4 }}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>,
              document.body
            )}
          </main>
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
                                {selectedJobApp?.created_at ? `Submitted on ${selectedJobApp.created_at}` : 'Your application is on file and actively being screened'}
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
                            <div className="text-xs font-bold text-white mt-1">{selectedJobApp?.status || 'Screened'}</div>
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
                            onClick={logout}
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
                              onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                              placeholder="+1 (555) 000-0000"
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                            />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Your Submitted Applications</h3>
              <button
                type="button"
                onClick={() => setShowMyAppsModal(false)}
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {applications.length === 0 ? (
                <div className="py-8 text-center text-xs text-white/50">
                  You haven't submitted any applications yet.
                </div>
              ) : (
                applications.map((app, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{app.requisition_title || 'Contract Position'}</div>
                      <div className="text-[11px] text-white/50">{app.company_name || 'Enterprise Client'}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white/90 border border-white/20">
                      {app.status || 'Under Review'}
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
      {showSetupModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Candidate Profile & Resume</h3>
                <p className="text-xs text-white/50">Keep your details up to date for instant 1-click applications.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSetupModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {setupSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="text-white mx-auto" />
                <h4 className="text-sm font-bold text-white">Profile Updated Successfully</h4>
              </div>
            ) : (
              <form onSubmit={handleSetupSubmit} className="mt-4 space-y-3.5 text-xs">
                {setupError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {setupError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={setupForm.name}
                    onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/35"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={setupForm.phone}
                    onChange={(e) => setSetupForm({ ...setupForm, phone: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={setupForm.title}
                    onChange={(e) => setSetupForm({ ...setupForm, title: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Skills (comma separated)</label>
                  <input
                    type="text"
                    value={setupForm.skills}
                    onChange={(e) => setSetupForm({ ...setupForm, skills: e.target.value })}
                    placeholder="React, TypeScript, Node.js, Next.js"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Resume File (PDF/DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => setSetupResumeFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                  />
                  {hasResume && !setupResumeFile && (
                    <div className="text-[10px] text-white/60 mt-1">Existing resume: {currentResumeName}</div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={setupSubmitting}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer mt-2 shadow-sm"
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
      {/* MODAL 4: GENERAL TALENT POOL                                 */}
      {/* ============================================================ */}
      {showGeneralPoolModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200">
          <div className="rounded-3xl bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] max-w-xl w-full p-6 sm:p-7 my-auto transition-all">
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 mb-1">
                  Candidate Talent Network
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                  Join General Talent Pool
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Get auto-matched with upcoming enterprise contract roles and verified hiring partners.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralPoolModal(false)}
                className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/60 hover:text-white transition cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {poolSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto border border-white/20">
                  <CheckCircle2 size={30} />
                </div>
                <h4 className="text-base font-bold text-white">Profile Submitted to Talent Pool</h4>
                <p className="text-xs text-white/60 max-w-xs mx-auto">
                  We will notify you via email as soon as an enterprise requisition matching your skillset is published.
                </p>

                {/* Start Telegram Bot Callout */}
                <div className="p-4 bg-sky-950/40 border border-sky-400/30 rounded-2xl text-left max-w-sm mx-auto shadow mt-4">
                  <div className="flex items-center gap-2 text-sky-300 font-bold text-xs mb-1">
                    <Send size={14} className="text-[#229ED9]" />
                    <span>Start Bot for 1-Tap Matching Alerts</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
                    Connect <strong>@{TELEGRAM_BOT_USERNAME}</strong> to receive notifications directly in Telegram with 1-tap RSVP buttons.
                  </p>
                  <a
                    href={poolSuccess.telegram_bot_url || `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${poolSuccess.candidate_id || ''}`}
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
                  onClick={() => {
                    setShowGeneralPoolModal(false);
                    setPoolSuccess(null);
                  }}
                  className="mt-4 px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePoolSubmit} className="mt-5 space-y-4 text-xs">
                {candidateUser && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-[11px] font-bold border border-white/20">
                        {(candidateUser.candidate_name || candidateUser.candidate_email || 'C')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>Joining as</span>
                          <span className="font-bold text-white">{candidateUser.candidate_name || candidateUser.candidate_email}</span>
                          <span className="text-[10px] font-bold bg-white/10 text-white/90 border border-white/20 px-1.5 py-0.2 rounded-full">
                            Verified
                          </span>
                        </div>
                        <div className="text-[10px] text-white/50 mt-0.5">
                          {hasResume ? '✓ Master resume on profile ready' : 'Upload your resume below to complete'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {poolError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{poolError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={poolForm.name}
                      onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                      placeholder="e.g. Alex Johnson"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={poolForm.email}
                      onChange={(e) => setPoolForm({ ...poolForm, email: e.target.value })}
                      placeholder="alex@example.com"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={poolForm.phone}
                      onChange={(e) => setPoolForm({ ...poolForm, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Target Title / Role *</label>
                    <input
                      type="text"
                      required
                      value={poolForm.title}
                      onChange={(e) => setPoolForm({ ...poolForm, title: e.target.value })}
                      placeholder="e.g. Senior Frontend Lead"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Core Skills (Optional)</label>
                  <input
                    type="text"
                    value={poolForm.skills}
                    onChange={(e) => setPoolForm({ ...poolForm, skills: e.target.value })}
                    placeholder="e.g. React, TypeScript, Node.js, AWS"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                  />
                </div>

                {/* Resume Dropzone */}
                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                    Resume Document *
                  </label>

                  {hasResume && !poolUseCustomResume ? (
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
                        onClick={() => setPoolUseCustomResume(true)}
                        className="text-[11px] font-medium text-white/70 hover:text-white underline cursor-pointer"
                      >
                        Upload different file
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setPoolIsDragging(true);
                      }}
                      onDragLeave={() => setPoolIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setPoolIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setPoolResume(file);
                          setPoolError(null);
                        }
                      }}
                      onClick={() => poolFileInputRef.current?.click()}
                      className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition ${poolIsDragging
                          ? 'border-white bg-white/[0.08]'
                          : 'border-white/15 bg-white/[0.02] hover:border-white/30'
                        }`}
                    >
                      <input
                        type="file"
                        ref={poolFileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPoolResume(file);
                            setPoolError(null);
                          }
                        }}
                        accept=".pdf,.docx,.doc"
                        className="hidden"
                      />
                      <Upload size={22} className="text-white/40 mx-auto mb-2" />
                      {poolResume ? (
                        <div className="text-xs font-semibold text-white flex items-center justify-center gap-1.5">
                          <Check size={14} className="text-white" />
                          <span>{poolResume.name} ({(poolResume.size / 1024 / 1024).toFixed(2)} MB)</span>
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

                  {poolUseCustomResume && hasResume && (
                    <button
                      type="button"
                      onClick={() => {
                        setPoolUseCustomResume(false);
                        setPoolResume(null);
                      }}
                      className="mt-2 text-[11px] text-white/50 hover:text-white underline cursor-pointer"
                    >
                      ← Use saved profile resume instead
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={poolSubmitting}
                  className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 active:scale-98 text-black font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-lg shadow-black/40 mt-3"
                >
                  {poolSubmitting ? 'Submitting Profile...' : 'Join Talent Network'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 5: CANDIDATE AGREEMENTS & CONTRACT TERMS                */}
      {/* ============================================================ */}
      {showAgreementModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Agreements & Contracts</h3>
                  <p className="text-[11px] text-white/50">Master Services Agreements & Compliance</p>
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

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {applications.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 mx-auto mb-2">
                    <FileText size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-white">No Active Agreements Pending</h4>
                  <p className="text-xs text-white/50 max-w-xs mx-auto leading-relaxed">
                    Once an enterprise partner approves your application, your Master Services Agreement (MSA) and Statement of Work (SOW) will appear here for digital review and signing.
                  </p>
                </div>
              ) : (
                applications.map((app, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{app.requisition_title || 'Contract Position'}</div>
                      <div className="text-[11px] text-white/50">{app.company_name || 'Enterprise Client'} · MSA Linked</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white/90 border border-white/20">
                      Standard Terms
                    </span>
                  </div>
                ))
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

      {/* Candidate Auth Modal (Google OAuth & Email/Password) */}
      {showAuthModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-2xl font-sans animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-md w-full shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
                setAuthSuccessMsg('');
                setActiveNavTab('home');
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-white/50 hover:text-white bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 transition cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[0.65rem] font-bold tracking-[0.2em] text-white/70 uppercase mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                <span>Candidate Talent Portal</span>
              </div>
              <h3 className="font-display text-xl font-extrabold text-white tracking-tight">
                {authModalTab === 'login' ? 'Sign In to Open Roles' : 'Create Talent Profile'}
              </h3>
              <p className="text-xs text-white/60 mt-1">
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
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-neutral-900 font-bold text-xs tracking-wide shadow-md active:scale-[0.99] transition cursor-pointer disabled:opacity-50 mb-5"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>{authLoading ? 'Connecting Google Account…' : 'Continue with Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#0a0b10] px-3 text-[10px] font-bold uppercase tracking-wider text-white/40 absolute">
                or use candidate credentials
              </span>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-white/[0.04] border border-white/10 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('login');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${authModalTab === 'login'
                    ? 'bg-white text-black shadow-xs'
                    : 'text-white/60 hover:text-white'
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
                    ? 'bg-white text-black shadow-xs'
                    : 'text-white/60 hover:text-white'
                  }`}
              >
                Create Profile
              </button>
            </div>

            {/* Alerts */}
            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="flex-1">{authError}</span>
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 mb-4 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-white" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {authModalTab === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                    >
                      {showAuthPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 active:scale-98 text-black font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-lg shadow-black/40 mt-3 disabled:opacity-50"
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
                    <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Phone</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="e.g. Senior Fullstack Engineer"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Key Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={regSkills}
                    onChange={(e) => setRegSkills(e.target.value)}
                    placeholder="React, TypeScript, Python, Node.js"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/[0.05] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Resume File (PDF/DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => setRegResume(e.target.files?.[0] || null)}
                    className="w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-white/15 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 file:transition cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 active:scale-98 text-black font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-lg shadow-black/40 mt-3 disabled:opacity-50"
                >
                  {authLoading ? 'Creating Profile…' : 'Create Profile & Access Roles'}
                </button>
              </form>
            )}

            {/* Footer Security Note */}
            <div className="mt-4 pt-3 border-t border-paper/10 flex items-center justify-center gap-1.5 text-[11px] text-paper/40">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Verified candidate session · Encrypted data</span>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
