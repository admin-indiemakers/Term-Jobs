import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  MapPin,
  Clock,
  Building2,
  Calendar,
  ChevronRight,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
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
  Edit3,
  Check,
  LogIn,
  SlidersHorizontal,
} from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { marked } from 'marked';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import SEOHead from '../components/SEOHead';
import { Backdrop } from '../components/landing/Backdrop';
import logo from '../assets/termjobs-logo.png';

export default function OpenRolesPage() {
  const navigate = useNavigate();
  const candidateAuth = useCandidateAuth();
  const candidateUser = candidateAuth?.candidateUser;
  const applications = candidateAuth?.applications || [];
  const logout = candidateAuth?.logout;
  const refreshProfile = candidateAuth?.refreshProfile;
  const setupProfile = candidateAuth?.setupProfile;

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
              <div className="flex items-center gap-2.5">
                <Link
                  to="/candidate/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-paper/10 hover:bg-paper/15 border border-paper/15 text-[0.68rem] font-bold tracking-[0.14em] uppercase text-paper transition cursor-pointer"
                >
                  <User size={12} />
                  <span>Candidate Sign In</span>
                </Link>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-paper text-ink hover:bg-paper/90 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition cursor-pointer"
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

                    {/* Meta Info: Family, Duration, Experience */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-paper/60 mt-2 font-medium">
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
                    <button
                      type="button"
                      onClick={() => handleOpenJob(job)}
                      className="text-xs font-bold text-paper/60 hover:text-paper transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Full JD</span>
                      <ChevronRight size={14} />
                    </button>

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

          <button
            type="button"
            onClick={() => setShowGeneralPoolModal(true)}
            className="shrink-0 px-6 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-[0.14em] uppercase transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            Join General Talent Pool →
          </button>
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
                <div className="py-10 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white">Application Submitted Successfully!</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Your profile and resume have been submitted directly to the hiring partner. You will receive an interview
                    invite via email as soon as matching is verified.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="mt-4 px-6 py-2.5 rounded-full bg-emerald-500 text-zinc-950 font-bold text-xs transition hover:bg-emerald-400 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
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

                    {submitError && (
                      <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <form onSubmit={handleApplySubmit} className="space-y-4">
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
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Profile Submitted to Talent Pool</h4>
                <p className="text-xs text-zinc-400">We will notify you when a matching role is published.</p>
                <button
                  type="button"
                  onClick={() => setShowGeneralPoolModal(false)}
                  className="mt-4 px-5 py-2 rounded-full bg-emerald-500 text-zinc-950 font-bold text-xs"
                >
                  Close
                </button>
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
