import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  MapPin,
  Clock,
  Calendar,
  ChevronRight,
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

export default function OpenRolesPage() {
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

  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMyAppsModal, setShowMyAppsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showGeneralPoolModal, setShowGeneralPoolModal] = useState(false);

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

      return matchesSearch && matchesWorkMode && matchesFamily;
    });
  }, [requisitions, searchQuery, selectedWorkMode, selectedFamily]);

  // Job families for filter pills
  const availableFamilies = useMemo(() => {
    const set = new Set();
    requisitions.forEach((j) => {
      if (j.structured_role?.job_family) set.add(j.structured_role.job_family);
    });
    return Array.from(set);
  }, [requisitions]);

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

    if (!isProfileComplete && !useCustomResume && !resumeFile) {
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

      if (useCustomResume && resumeFile) {
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
    if (!poolResume) {
      setPoolError('Please upload your resume (PDF or DOCX).');
      return;
    }
    setPoolSubmitting(true);
    setPoolError(null);
    try {
      const formData = new FormData();
      formData.append('name', poolForm.name.trim());
      formData.append('email', poolForm.email.trim());
      formData.append('phone', poolForm.phone.trim());
      formData.append('title', poolForm.title.trim());
      formData.append('skills', poolForm.skills.trim());
      formData.append('linkedin_url', poolForm.linkedin_url.trim());
      formData.append('github_url', poolForm.github_url.trim());
      formData.append('cover_note', poolForm.cover_note.trim());
      formData.append('resume', poolResume);

      const res = await fetch(`${API_BASE_URL}/api/public/talent-pool/join`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || 'Could not join talent pool.');
      }
      setPoolSuccess(result);
    } catch (err) {
      setPoolError(err.message || 'Failed to submit profile.');
    } finally {
      setPoolSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col font-sans selection:bg-emerald-500 selection:text-black relative overflow-x-hidden">
      <SEOHead
        title="Open Roles & Contract Opportunities — TermJobs"
        description="Browse live contract positions across enterprise partners on TermJobs. Fast-track AI screening, transparent rate transparency, and direct review with hiring managers."
        canonicalUrl="https://termjobs.vercel.app/open-roles"
      />

      {/* Atmospheric Background Layer */}
      <Backdrop tone="dark" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-ink/80 backdrop-blur-xl border-b border-paper/10 px-6 py-4 md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Back & Brand */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="group inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase text-paper/60 hover:text-paper transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
              <span>Platform Overview</span>
            </Link>

            <div className="h-4 w-px bg-paper/15 hidden sm:block" />

            <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
              <img src={logo} alt="TermJobs Logo" className="h-7 w-7 object-contain" />
              <span className="text-[0.7rem] font-extrabold tracking-[0.32em] text-paper uppercase group-hover:text-emerald-400 transition-colors">
                TermJobs
              </span>
            </Link>
          </div>

          {/* Right: Candidate Pill or Auth Links */}
          <div className="flex items-center gap-3">
            {candidateUser ? (
              <div className="flex items-center gap-2 p-1 pl-2.5 pr-2 rounded-full bg-paper/[0.06] border border-paper/15 backdrop-blur-md">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center justify-center border border-emerald-500/30">
                  {(candidateUser.candidate_name || 'C').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-paper max-w-[120px] truncate">
                    {candidateUser.candidate_name || candidateUser.candidate_email}
                  </span>
                  {hasResume && (
                    <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                      <CheckCircle2 size={10} />
                      Resume on File
                    </span>
                  )}
                </div>

                <div className="h-3 w-px bg-paper/20 mx-1" />

                <button
                  type="button"
                  onClick={() => setShowSetupModal(true)}
                  className="px-2.5 py-1 text-[11px] font-medium text-paper/80 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer"
                  title="Edit candidate profile & resume"
                >
                  Edit Profile
                </button>

                <button
                  type="button"
                  onClick={() => setShowMyAppsModal(true)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition rounded-lg hover:bg-emerald-500/10 cursor-pointer"
                >
                  Applications ({applications.length})
                </button>

                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${candidateUser.id || candidateUser.candidate_email || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#229ED9] hover:text-[#1E88E5] transition rounded-lg hover:bg-sky-500/10 text-decoration-none"
                  title="Link your Telegram to get 1-tap alerts"
                >
                  <Send size={11} />
                  <span>Start Bot</span>
                </a>

                <button
                  type="button"
                  onClick={logout}
                  className="p-1 text-paper/50 hover:text-rose-400 transition cursor-pointer"
                  title="Sign out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-2.5">
                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/30 text-[0.68rem] font-bold tracking-[0.14em] uppercase text-[#229ED9] transition cursor-pointer text-decoration-none"
                  title="Start Telegram Bot for Instant Job Matches"
                >
                  <Send size={12} className="text-[#229ED9]" />
                  <span>Start Bot</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleGoogleSignIn()}
                  disabled={authLoading}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 text-[0.68rem] font-bold tracking-wide transition shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Sign in with Google"
                >
                  <GoogleIcon className="w-3.5 h-3.5" />
                  <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAuthModalTab('login'); setShowAuthModal(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper/10 hover:bg-paper/15 border border-paper/15 text-[0.68rem] font-bold tracking-[0.14em] uppercase text-paper transition cursor-pointer"
                >
                  <User size={12} />
                  <span>Candidate Sign In</span>
                </button>

                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper text-ink hover:bg-paper/90 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition cursor-pointer"
                >
                  <LogIn size={12} />
                  <span>Staff Portal</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="relative z-10 pt-12 pb-8 px-6 md:px-12 max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-paper/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper/[0.06] border border-paper/15 text-[0.65rem] font-bold tracking-[0.24em] text-paper/70 uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>01 — Active Requisitions</span>
            </div>

            <h1 className="font-display text-[clamp(2rem,4.8vw,3.8rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-paper">
              EXPLORE OPEN ROLES.
              <span className="block text-haze">DIRECT WITH HIRING PARTNERS.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed text-paper/60">
              Browse live contract opportunities published by verified enterprise partners. Apply directly with 1-click
              resume parsing, instant skill matching, and verified compliance review.
            </p>
          </div>

          {/* Quick Metrics Ticker */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-paper/[0.04] border border-paper/10 backdrop-blur-sm text-center">
              <div className="text-[0.6rem] font-semibold tracking-[0.16em] uppercase text-paper/40">Open Roles</div>
              <div className="text-xl font-extrabold tabular-nums text-paper mt-0.5">{requisitions.length}</div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-paper/[0.04] border border-paper/10 backdrop-blur-sm text-center">
              <div className="text-[0.6rem] font-semibold tracking-[0.16em] uppercase text-paper/40">Enterprises</div>
              <div className="text-xl font-extrabold tabular-nums text-emerald-400 mt-0.5">
                {new Set(requisitions.map((r) => r.company_name).filter(Boolean)).size || 1}
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-paper/[0.04] border border-paper/10 backdrop-blur-sm text-center">
              <div className="text-[0.6rem] font-semibold tracking-[0.16em] uppercase text-paper/40">Review Speed</div>
              <div className="text-xl font-extrabold tabular-nums text-paper mt-0.5">&lt; 24h</div>
            </div>
          </div>
        </div>

        {/* Unauthenticated Candidate Fast-Track Google Banner */}
        {!candidateUser && (
          <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-paper/[0.03] to-blue-950/30 border border-emerald-500/20 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Fast-Track Candidate Access</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                    Google 1-Click
                  </span>
                </div>
                <p className="text-[11px] text-paper/60 mt-0.5 max-w-xl">
                  Sign in with Google or start our Telegram Bot to 1-click apply across all enterprise requisitions and track your interview invitations live.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1E88E5] text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer text-decoration-none"
                title="Connect Telegram Bot for 1-Tap Job Matches & RSVPs"
              >
                <Send size={13} />
                <span>Start Bot (@{TELEGRAM_BOT_USERNAME})</span>
              </a>
              <button
                type="button"
                onClick={() => handleGoogleSignIn()}
                disabled={authLoading}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthModalTab('login'); setShowAuthModal(true); }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-paper/10 hover:bg-paper/15 border border-paper/15 text-xs font-semibold text-paper transition cursor-pointer"
              >
                <span>Candidate Sign In</span>
              </button>
            </div>
          </div>
        )}

        {/* Search & Filters Controls Bar */}
        <div className="mt-8 p-3 sm:p-4 rounded-2xl bg-paper/[0.03] border border-paper/10 backdrop-blur-md flex flex-col md:flex-row items-center gap-3">
          {/* Keyword Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-paper/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role title, technology (React, Python, AWS), or company..."
              className="w-full bg-paper/[0.05] hover:bg-paper/[0.08] focus:bg-paper/[0.1] border border-paper/10 focus:border-paper/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-paper placeholder-paper/40 transition-colors focus:outline-none font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-paper/40 hover:text-paper cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Work Mode Toggle Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-paper/[0.05] border border-paper/10 shrink-0 w-full sm:w-auto overflow-x-auto">
            {['ALL', 'Remote', 'Hybrid', 'Onsite'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSelectedWorkMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-[0.68rem] font-bold tracking-[0.1em] uppercase transition cursor-pointer whitespace-nowrap ${
                  selectedWorkMode.toLowerCase() === mode.toLowerCase()
                    ? 'bg-paper text-ink shadow-sm'
                    : 'text-paper/60 hover:text-paper'
                }`}
              >
                {mode === 'ALL' ? 'All Modes' : mode}
              </button>
            ))}
          </div>

          {/* Department Filter if multiple exist */}
          {availableFamilies.length > 0 && (
            <div className="shrink-0 w-full sm:w-auto">
              <select
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="w-full sm:w-auto bg-paper/[0.05] border border-paper/10 rounded-xl px-3 py-2.5 text-xs text-paper focus:outline-none cursor-pointer uppercase font-semibold text-[0.68rem] tracking-[0.08em]"
              >
                <option value="ALL" className="bg-zinc-900 text-white">All Departments</option>
                {availableFamilies.map((fam) => (
                  <option key={fam} value={fam} className="bg-zinc-900 text-white">
                    {fam}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Main Roles Grid Section */}
      <main className="relative z-10 flex-1 px-6 md:px-12 max-w-7xl mx-auto w-full pb-20">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto" />
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-paper/60">
              Loading published requisitions...
            </div>
          </div>
        ) : error ? (
          <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center max-w-md mx-auto my-12">
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
          <div className="py-20 px-6 rounded-3xl bg-paper/[0.02] border border-paper/10 text-center max-w-xl mx-auto my-8">
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
                }}
                className="px-4 py-2 rounded-xl bg-paper/10 hover:bg-paper/15 text-paper text-xs font-bold transition cursor-pointer"
              >
                Clear All Filters
              </button>
              <button
                type="button"
                onClick={() => setShowGeneralPoolModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-950/40"
              >
                Join General Talent Pool
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredJobs.map((job) => {
              const role = job.structured_role || {};
              const skills = (role.must_have_skills || []).slice(0, 5);
              const workMode = role.work_mode || 'Remote';
              const isRemote = workMode.toLowerCase() === 'remote';
              const dueDateVal = job.due_date || job.submission_deadline || job.application_due_date || role.submission_deadline;
              const dueInfo = formatDueDate(dueDateVal);

              return (
                <article
                  key={job.id}
                  className="group relative rounded-3xl bg-paper/[0.03] hover:bg-paper/[0.06] border border-paper/10 hover:border-emerald-500/40 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60"
                >
                  <div>
                    {/* Top Row: Company & Badges */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-paper/60">
                          {job.company_name || 'Enterprise Partner'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper/[0.06] text-[10px] text-paper/50 font-mono">
                          {job.ref || `REQ-${job.id.slice(0, 6).toUpperCase()}`}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] border ${
                          isRemote
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-paper/10 border-paper/20 text-paper/80'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isRemote ? 'bg-emerald-400 animate-pulse' : 'bg-paper/50'}`} />
                        <span>{workMode}</span>
                      </span>
                    </div>

                    {/* Role Title */}
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-paper group-hover:text-emerald-300 transition-colors">
                      {job.title}
                    </h2>

                    {/* Meta Info: Family, Duration, Experience, Due Date */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-paper/60 mt-2 font-medium">
                      {role.job_family && (
                        <div className="flex items-center gap-1.5">
                          <Layers size={13} className="text-paper/40" />
                          <span>{role.job_family}</span>
                        </div>
                      )}
                      {role.duration && (
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-paper/40" />
                          <span>{role.duration}</span>
                        </div>
                      )}
                      {role.experience && (
                        <div className="flex items-center gap-1.5">
                          <Briefcase size={13} className="text-paper/40" />
                          <span>{role.experience}</span>
                        </div>
                      )}
                      {dueInfo && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${
                          dueInfo.isUrgent
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                            : 'bg-paper/[0.06] text-paper/80 border border-paper/10'
                        }`}>
                          <Calendar size={12} className={dueInfo.isUrgent ? 'text-amber-400' : 'text-emerald-400'} />
                          <span>Apply by <strong>{dueInfo.text}</strong></span>
                          <span className="opacity-50">•</span>
                          <span className="font-semibold">{dueInfo.daysLeft}</span>
                        </div>
                      )}
                    </div>

                    {/* Skill Tags */}
                    {skills.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-1.5">
                        {skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 rounded-lg bg-paper/[0.05] border border-paper/10 text-[11px] font-medium text-paper/80"
                          >
                            {skill}
                          </span>
                        ))}
                        {(role.must_have_skills || []).length > 5 && (
                          <span className="px-2 py-1 text-[11px] text-paper/40 font-mono">
                            +{(role.must_have_skills || []).length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA Bar */}
                  <div className="mt-7 pt-5 border-t border-paper/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenJob(job)}
                        className="text-xs font-bold text-paper/60 hover:text-paper transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Full JD</span>
                        <ChevronRight size={14} />
                      </button>
                      <a
                        href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${job.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[#229ED9] hover:underline"
                        title="Start bot & receive 1-tap alerts for this role"
                      >
                        <Send size={11} />
                        <span>Bot Alert</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenJob(job)}
                      className="inline-flex items-center gap-2 rounded-full bg-paper hover:bg-paper/90 text-ink px-5 py-2.5 text-[0.7rem] font-bold tracking-[0.14em] uppercase transition-all duration-300 hover:scale-102 active:scale-95 cursor-pointer shadow-md shadow-black/50"
                    >
                      <span>Apply Now</span>
                      <span>→</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* General Talent Pool Banner */}
        <div className="mt-14 rounded-3xl bg-gradient-to-r from-paper/[0.04] via-paper/[0.07] to-paper/[0.04] border border-paper/15 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-2">
              <Sparkles size={12} />
              <span>Direct Enterprise Sourcing</span>
            </div>
            <h3 className="text-xl md:text-2xl font-extrabold text-paper tracking-tight">
              Don't see your specific role?
            </h3>
            <p className="text-xs md:text-sm text-paper/60 mt-1 leading-relaxed">
              Upload your resume to the TermJobs Verified Talent Pool. Our AI matching pipeline continuously screens your
              profile against upcoming enterprise contract requirements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 rounded-full bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs tracking-[0.14em] uppercase transition-all hover:-translate-y-0.5 shadow-lg shadow-sky-950/50 cursor-pointer text-decoration-none inline-flex items-center gap-2"
              title="Start Telegram Bot for Live Opportunities"
            >
              <Send size={14} />
              <span>Start Bot</span>
            </a>
            <button
              type="button"
              onClick={() => setShowGeneralPoolModal(true)}
              className="px-6 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-[0.14em] uppercase transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              Join General Talent Pool →
            </button>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* MODAL 1: VIEW JOB DETAILS & 1-CLICK APPLY                    */}
      {/* ============================================================ */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-900/40">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-400">
                    {selectedJob.company_name || 'Enterprise Client'}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {selectedJob.ref || `REQ-${selectedJob.id.slice(0, 6).toUpperCase()}`}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {selectedJob.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium">
                    {selectedJob.structured_role?.work_mode || 'Remote'}
                  </span>
                  <span>·</span>
                  <span>{selectedJob.structured_role?.duration || '6 Months'}</span>
                  <span>·</span>
                  <span>{selectedJob.structured_role?.experience || 'Experienced'}</span>
                  {(() => {
                    const dVal = selectedJob.due_date || selectedJob.submission_deadline || selectedJob.application_due_date || selectedJob.structured_role?.submission_deadline;
                    const dInfo = formatDueDate(dVal);
                    if (!dInfo) return null;
                    return (
                      <>
                        <span>·</span>
                        <span className={`inline-flex items-center gap-1 font-medium ${dInfo.isUrgent ? 'text-amber-400' : 'text-emerald-400'}`}>
                          <Calendar size={13} />
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
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
              {submitSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Application Submitted Successfully!</h3>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      Your profile and resume have been submitted directly to the hiring partner for <strong>{selectedJob?.title || 'this role'}</strong>.
                    </p>
                  </div>

                  {/* Connect Telegram / Start Bot Callout */}
                  <div className="p-4 sm:p-5 bg-sky-950/40 border border-sky-400/30 rounded-2xl text-left max-w-lg mx-auto shadow-lg shadow-sky-950/40">
                    <div className="flex items-center gap-2 text-sky-300 font-bold text-xs sm:text-sm mb-1.5">
                      <Send size={16} className="text-[#229ED9]" />
                      <span>Start Bot to Receive 1-Tap Interview & Match Updates</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                      Never miss an update from hiring managers. Start our official Telegram Bot now to receive instant interview schedules, video room links, and status updates directly on your phone with 1-tap RSVP buttons.
                    </p>
                    <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20 text-[11px] font-mono text-sky-200 mb-3 flex items-center justify-between">
                      <span>Application Ref: <strong>{submitSuccess.application_ref || submitSuccess.candidate_id}</strong></span>
                      <span className="text-emerald-400 font-sans font-semibold">Match: {submitSuccess.match_score || 85}%</span>
                    </div>
                    <a
                      href={submitSuccess.telegram_bot_url || `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${submitSuccess.candidate_id || submitSuccess.application_ref || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs shadow-md transition text-decoration-none cursor-pointer active:scale-[0.99]"
                    >
                      <Send size={15} />
                      <span>Start Bot (@{TELEGRAM_BOT_USERNAME})</span>
                    </a>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(null);
                        setSubmitSuccess(null);
                      }}
                      className="px-6 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition cursor-pointer"
                    >
                      Done / Browse More Roles
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Deadline Notification Banner */}
                  {(() => {
                    const dVal = selectedJob.due_date || selectedJob.submission_deadline || selectedJob.application_due_date || selectedJob.structured_role?.submission_deadline;
                    const dInfo = formatDueDate(dVal);
                    if (!dInfo) return null;
                    return (
                      <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                        dInfo.isUrgent
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}>
                        <div className="flex items-center gap-2 font-medium">
                          <Calendar size={15} className="shrink-0" />
                          <span>Application Due Date: <strong className="font-semibold underline decoration-current/40">{dInfo.text}</strong></span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          dInfo.isUrgent ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'
                        }`}>
                          {dInfo.daysLeft}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Job Overview / Markdown */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Position Overview</h4>
                    {selectedJob.generated_jd_markdown ? (
                      <div
                        className="prose prose-invert prose-xs max-w-none text-zinc-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: marked.parse(selectedJob.generated_jd_markdown) }}
                      />
                    ) : (
                      <p className="text-zinc-400 text-xs">
                        This is a high-priority contract requisition delivered through the TermJobs platform. Candidates will
                        collaborate directly with the client engineering leadership.
                      </p>
                    )}

                    {/* Must-have skills grid */}
                    {selectedJob.structured_role?.must_have_skills?.length > 0 && (
                      <div className="pt-3">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                          Core Required Competencies
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.structured_role.must_have_skills.map((s) => (
                            <span
                              key={s}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Apply Section */}
                  <div className="pt-6 border-t border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Submit Your Application
                      </h4>
                    </div>

                    {!candidateUser ? (
                      /* Mandatory Candidate Authentication Gateway */
                      <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800 text-center space-y-4 shadow-xl">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                          <Lock size={22} className="text-emerald-400" />
                        </div>

                        <div className="max-w-md mx-auto space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>Sign-Up Mandatory</span>
                          </div>
                          <h3 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
                            Candidate Profile Required to Apply
                          </h3>
                          <p className="text-xs text-zinc-400 leading-relaxed">
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
                              className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 hover:text-white transition cursor-pointer"
                            >
                              Create Talent Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthModalTab('login');
                                setShowAuthModal(true);
                              }}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                            >
                              Candidate Sign In
                            </button>
                          </div>

                          {/* Alternative: Start Telegram Bot */}
                          <div className="pt-2 text-left">
                            <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/25 flex flex-col sm:flex-row items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[#229ED9]/20 text-[#229ED9] flex items-center justify-center shrink-0">
                                  <Send size={15} />
                                </div>
                                <div>
                                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                                    <span>Prefer Mobile? Start Bot</span>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#229ED9]/20 text-[#229ED9] font-mono">@{TELEGRAM_BOT_USERNAME}</span>
                                  </div>
                                  <p className="text-[10.5px] text-zinc-400 mt-0.5">
                                    Get 1-tap alerts & video interview invites in Telegram.
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${selectedJob?.id || 'open_roles'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#229ED9] hover:bg-[#1E88E5] text-white text-[11px] font-bold transition text-decoration-none cursor-pointer"
                              >
                                <Send size={12} />
                                <span>Start Bot</span>
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Reassurance pills */}
                        <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-center gap-4 text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            1-Click Verified Apply
                          </span>
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck size={13} className="text-emerald-400" />
                            Direct Partner Review
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={13} className="text-emerald-400" />
                            Live Interview Status
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Authenticated Application Form */
                      <form onSubmit={handleApplySubmit} className="space-y-4">
                        {/* Verified Candidate Header */}
                        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold border border-emerald-500/30">
                              {(candidateUser.candidate_name || candidateUser.candidate_email || 'C')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                <span>Applying as</span>
                                <span className="font-bold text-emerald-400">{candidateUser.candidate_name || candidateUser.candidate_email}</span>
                                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.2 rounded-full">
                                  Verified
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5">
                                {hasResume ? '✓ Master resume ready for 1-click submission' : 'Upload your resume below to complete'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={logout}
                            className="text-[11px] text-zinc-400 hover:text-rose-400 transition cursor-pointer"
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
                          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={applyForm.name}
                            onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                            placeholder="e.g. Alex Johnson"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            required
                            value={applyForm.email}
                            onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                            placeholder="alex@example.com"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      {/* Phone & LinkedIn Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            Phone Number *
                          </label>
                          <input
                            type="tel"
                            required
                            value={applyForm.phone}
                            onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                            LinkedIn Profile (Optional)
                          </label>
                          <input
                            type="url"
                            value={applyForm.linkedin_url}
                            onChange={(e) => setApplyForm({ ...applyForm, linkedin_url: e.target.value })}
                            placeholder="https://linkedin.com/in/..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>

                      {/* Resume Selection */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                          Resume Document *
                        </label>

                        {hasResume && !useCustomResume ? (
                          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <FileText size={18} className="text-emerald-400" />
                              <div>
                                <div className="text-xs font-semibold text-white">{currentResumeName}</div>
                                <div className="text-[10px] text-zinc-500">Verified resume from candidate profile</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setUseCustomResume(true)}
                              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
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
                              if (file) setResumeFile(file);
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition ${
                              isDragging
                                ? 'border-emerald-400 bg-emerald-500/10'
                                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                            }`}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setResumeFile(file);
                              }}
                              accept=".pdf,.docx,.doc"
                              className="hidden"
                            />
                            <Upload size={22} className="text-zinc-500 mx-auto mb-2" />
                            {resumeFile ? (
                              <div className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                                <Check size={14} />
                                <span>{resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                              </div>
                            ) : (
                              <>
                                <div className="text-xs font-semibold text-zinc-200">
                                  Drop resume here or click to browse
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-1">PDF, DOCX up to 10MB</div>
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
                            className="mt-2 text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            ← Use saved profile resume instead
                          </button>
                        )}
                      </div>

                      {/* Brief Cover Note */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                          Brief Note to Hiring Manager (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={applyForm.cover_note}
                          onChange={(e) => setApplyForm({ ...applyForm, cover_note: e.target.value })}
                          placeholder="Highlight your relevant experience or availability..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
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
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: MY APPLICATIONS DRAWER                              */}
      {/* ============================================================ */}
      {showMyAppsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Your Submitted Applications</h3>
              <button
                type="button"
                onClick={() => setShowMyAppsModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {applications.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  You haven't submitted any applications yet.
                </div>
              ) : (
                applications.map((app, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{app.requisition_title || 'Contract Position'}</div>
                      <div className="text-[11px] text-zinc-400">{app.company_name || 'Enterprise Client'}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {app.status || 'Under Review'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CANDIDATE PROFILE SETUP / EDIT                      */}
      {/* ============================================================ */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">Candidate Profile & Resume</h3>
                <p className="text-xs text-zinc-400">Keep your details up to date for instant 1-click applications.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {setupSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
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
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={setupForm.name}
                    onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Phone Number *</label>
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
                    <div className="text-[10px] text-emerald-400 mt-1">Existing resume: {currentResumeName}</div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={setupSubmitting}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer mt-2"
                >
                  {setupSubmitting ? 'Saving Profile...' : 'Save Profile Details'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: GENERAL TALENT POOL                                 */}
      {/* ============================================================ */}
      {showGeneralPoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">Join General Talent Pool</h3>
                <p className="text-xs text-zinc-400">Get matched with upcoming enterprise contract roles.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralPoolModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {poolSuccess ? (
              <div className="py-8 text-center space-y-4">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Profile Submitted to Talent Pool</h4>
                <p className="text-xs text-zinc-400">We will notify you when a matching role is published.</p>

                {/* Start Telegram Bot Callout */}
                <div className="p-4 bg-sky-950/40 border border-sky-400/30 rounded-2xl text-left max-w-sm mx-auto shadow">
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

                <div>
                  <button
                    type="button"
                    onClick={() => setShowGeneralPoolModal(false)}
                    className="mt-2 px-6 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePoolSubmit} className="mt-4 space-y-3 text-xs">
                {poolError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {poolError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={poolForm.name}
                      onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={poolForm.email}
                      onChange={(e) => setPoolForm({ ...poolForm, email: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={poolForm.phone}
                      onChange={(e) => setPoolForm({ ...poolForm, phone: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Target Title *</label>
                    <input
                      type="text"
                      required
                      value={poolForm.title}
                      onChange={(e) => setPoolForm({ ...poolForm, title: e.target.value })}
                      placeholder="e.g. Backend Lead"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">Resume File *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => setPoolResume(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={poolSubmitting}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer mt-2"
                >
                  {poolSubmitting ? 'Submitting...' : 'Join Talent Network'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Candidate Auth Modal (Google OAuth & Email/Password) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md font-sans">
          <div className="bg-[#0e0f14] border border-paper/15 rounded-2xl max-w-md w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
                setAuthSuccessMsg('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-paper/40 hover:text-white bg-paper/[0.04] hover:bg-paper/10 transition cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper/[0.06] border border-paper/10 text-[0.65rem] font-bold tracking-[0.2em] text-paper/70 uppercase mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Candidate Talent Portal</span>
              </div>
              <h3 className="font-display text-xl font-extrabold text-paper tracking-tight">
                {authModalTab === 'login' ? 'Sign In to Open Roles' : 'Create Talent Profile'}
              </h3>
              <p className="text-xs text-paper/60 mt-1">
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
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs tracking-wide shadow-md active:scale-[0.99] transition cursor-pointer disabled:opacity-50 mb-5"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>{authLoading ? 'Connecting Google Account…' : 'Continue with Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-paper/10 w-full" />
              <span className="bg-[#0e0f14] px-3 text-[10px] font-bold uppercase tracking-wider text-paper/40 absolute">
                or use candidate credentials
              </span>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-paper/[0.04] border border-paper/10 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('login');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authModalTab === 'login'
                    ? 'bg-paper text-ink shadow-xs'
                    : 'text-paper/60 hover:text-white'
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
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authModalTab === 'register'
                    ? 'bg-paper text-ink shadow-xs'
                    : 'text-paper/60 hover:text-white'
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
              <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {authModalTab === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-paper/60 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-paper/40" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-paper/60 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-paper/40" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-paper/40 hover:text-white cursor-pointer"
                    >
                      {showAuthPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer mt-2 disabled:opacity-50"
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
                    <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl px-3 py-2 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl px-3 py-2 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl px-3 py-2 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Phone</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl px-3 py-2 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="e.g. Senior Fullstack Engineer"
                    className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl px-3 py-2 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Key Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={regSkills}
                    onChange={(e) => setRegSkills(e.target.value)}
                    placeholder="React, TypeScript, Python, Node.js"
                    className="w-full bg-paper/[0.04] border border-paper/10 rounded-xl px-3 py-2 text-xs text-white placeholder-paper/30 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-paper/60 uppercase tracking-wider mb-1">Resume File (PDF/DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => setRegResume(e.target.files?.[0] || null)}
                    className="w-full text-xs text-paper/60 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-paper/10 file:text-paper hover:file:bg-paper/20 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer mt-2 disabled:opacity-50"
                >
                  {authLoading ? 'Creating Profile…' : 'Create Profile & Access Roles'}
                </button>
              </form>
            )}

            {/* Telegram Bot Direct Option */}
            <div className="mt-4 pt-3 border-t border-paper/10 text-center">
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#229ED9] hover:underline font-semibold text-decoration-none"
              >
                <Send size={12} />
                <span>Prefer instant mobile alerts? Start Bot (@{TELEGRAM_BOT_USERNAME})</span>
              </a>
            </div>

            {/* Footer Security Note */}
            <div className="mt-3 pt-2 border-t border-paper/10 flex items-center justify-center gap-1.5 text-[11px] text-paper/40">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Verified candidate session · Encrypted data</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer matching launchpad */}
      <footer className="border-t border-paper/10 bg-ink/90 py-8 px-6 md:px-12 text-center text-xs text-paper/40 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-paper uppercase tracking-[0.2em] text-[0.68rem]">TermJobs</span>
            <span>·</span>
            <span>Autonomous Contract Workforce Platform</span>
          </div>
          <div className="flex items-center gap-5 text-paper/60 text-xs">
            <Link to="/" className="hover:text-paper transition">Platform Overview</Link>
            <Link to="/open-roles" className="hover:text-paper transition text-emerald-400 font-semibold">Open Roles</Link>
            <Link to="/interview/login" className="hover:text-paper transition">Interview Vault</Link>
            <Link to="/login" className="hover:text-paper transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
