import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Send
} from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { marked } from 'marked';

export default function PublicJobBoard({ onBackToHome }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedWorkMode, setSelectedWorkMode] = useState('ALL');
  const [selectedFamily, setSelectedFamily] = useState('ALL');

  // Selected Requisition for View & Apply Modal
  const [selectedJob, setSelectedJob] = useState(null);

  // Application Form State
  const [applyForm, setApplyForm] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    cover_note: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // General talent pool modal state
  const [showGeneralPoolModal, setShowGeneralPoolModal] = useState(false);
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

  // Drag & drop highlight
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch public requisitions
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
          setError(err.message || 'Unable to connect to the server.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchJobs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter options derived from data
  const companies = useMemo(() => {
    const set = new Set();
    requisitions.forEach(r => {
      if (r.company_name) set.add(r.company_name);
    });
    return Array.from(set).sort();
  }, [requisitions]);

  const jobFamilies = useMemo(() => {
    const set = new Set();
    requisitions.forEach(r => {
      const fam = r.structured_role?.job_family;
      if (fam) set.add(fam);
    });
    return Array.from(set).sort();
  }, [requisitions]);

  // Filtered requisitions
  const filteredJobs = useMemo(() => {
    return requisitions.filter(job => {
      const role = job.structured_role || {};
      const title = (job.title || role.title || '').toLowerCase();
      const comp = (job.company_name || '').toLowerCase();
      const desc = (job.generated_jd_markdown || '').toLowerCase();
      const skills = (role.must_have_skills || []).concat(role.nice_to_have_skills || []).map(s => s.toLowerCase());

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || 
        title.includes(query) || 
        comp.includes(query) || 
        desc.includes(query) ||
        skills.some(s => s.includes(query));

      const matchesCompany = selectedCompany === 'ALL' || job.company_name === selectedCompany;
      const matchesWorkMode = selectedWorkMode === 'ALL' || (role.work_mode || '').toLowerCase() === selectedWorkMode.toLowerCase();
      const matchesFamily = selectedFamily === 'ALL' || role.job_family === selectedFamily;

      return matchesSearch && matchesCompany && matchesWorkMode && matchesFamily;
    });
  }, [requisitions, searchQuery, selectedCompany, selectedWorkMode, selectedFamily]);

  const handleOpenJob = (job) => {
    setSelectedJob(job);
    setSubmitSuccess(null);
    setSubmitError(null);
    setResumeFile(null);
    setApplyForm({
      name: '',
      email: '',
      phone: '',
      linkedin_url: '',
      github_url: '',
      cover_note: '',
    });
  };

  const handleCloseModal = () => {
    setSelectedJob(null);
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setSubmitError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
        setResumeFile(file);
        setSubmitError(null);
      } else {
        setSubmitError('Please upload a PDF or DOCX document.');
      }
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!applyForm.name.trim()) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (!applyForm.email.trim()) {
      setSubmitError('Please enter your email address.');
      return;
    }
    if (!resumeFile) {
      setSubmitError('Please upload your resume (PDF or DOCX).');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append('name', applyForm.name.trim());
      formData.append('email', applyForm.email.trim());
      formData.append('phone', applyForm.phone.trim());
      formData.append('linkedin_url', applyForm.linkedin_url.trim());
      formData.append('github_url', applyForm.github_url.trim());
      formData.append('cover_note', applyForm.cover_note.trim());
      formData.append('resume', resumeFile);

      const res = await fetch(`${API_BASE_URL}/api/public/requisitions/${selectedJob.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || 'Failed to submit application. Please try again.');
      }

      setSubmitSuccess(result);
    } catch (err) {
      console.error('Error applying to requisition:', err);
      setSubmitError(err.message || 'An unexpected error occurred while submitting your application.');
    } finally {
      setSubmitting(false);
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

      const res = await fetch(`${API_BASE_URL}/api/public/candidate/register`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || 'Failed to submit profile.');
      }
      setPoolSuccess(result);
    } catch (err) {
      setPoolError(err.message || 'Error joining talent pool');
    } finally {
      setPoolSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#111110] font-inter antialiased pt-[90px] pb-24 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      {/* Top Breadcrumb & Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-[#666660] hover:text-[#0A0A0A] transition-colors duration-150 cursor-pointer border-none bg-transparent"
        >
          <ArrowLeft size={16} />
          Back to Homepage
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E5E5E0] text-[12px] font-semibold text-[#0A0A0A] shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Talent Marketplace
        </div>
      </div>

      {/* Hero Header */}
      <div className="text-center max-w-[780px] mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F0F0EC] text-[#0A0A0A] text-[11.5px] font-bold tracking-[0.15em] uppercase mb-4">
          <Sparkles size={14} className="text-amber-600" />
          Verified Enterprise Requisitions
        </div>
        <h1 className="font-extrabold text-[clamp(32px,4.5vw,52px)] text-[#0A0A0A] leading-[1.08] tracking-tight mb-4">
          Explore Active Roles Posted by Partner Companies
        </h1>
        <p className="font-inter text-[#666660] text-[15.5px] md:text-[17.5px] leading-[1.6]">
          Browse live contract positions across leading enterprises. Apply directly with your resume — our platform AI parses your skills and matches you straight to the hiring manager.
        </p>

        {/* Live Metrics Header Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
          <div className="px-4 py-2 rounded-xl bg-white border border-[#EAEAE6] shadow-xs text-xs font-semibold text-[#0A0A0A] flex items-center gap-2">
            <Briefcase size={14} className="text-[#666660]" />
            <span>{requisitions.length} Active Positions</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white border border-[#EAEAE6] shadow-xs text-xs font-semibold text-[#0A0A0A] flex items-center gap-2">
            <Building2 size={14} className="text-[#666660]" />
            <span>{companies.length} Hiring Enterprises</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white border border-[#EAEAE6] shadow-xs text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Direct Hiring Team Review</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E5E0] p-4 sm:p-5 shadow-xs mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8A85]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title, skill (Python, React...), or company..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-sm text-[#0A0A0A] placeholder-[#8A8A85] outline-none focus:border-[#0A0A0A] focus:bg-white transition-all duration-150"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A85] hover:text-[#0A0A0A] border-none bg-transparent cursor-pointer p-0.5"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Company Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white transition-all duration-150 cursor-pointer"
            >
              <option value="ALL">All Companies ({companies.length})</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Work Mode Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedWorkMode}
              onChange={(e) => setSelectedWorkMode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white transition-all duration-150 cursor-pointer"
            >
              <option value="ALL">All Work Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white transition-all duration-150 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {jobFamilies.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Tag Bar */}
        {(searchQuery || selectedCompany !== 'ALL' || selectedWorkMode !== 'ALL' || selectedFamily !== 'ALL') && (
          <div className="mt-3.5 pt-3 border-t border-[#F0F0EC] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap text-[#666660]">
              <span className="font-semibold text-[#0A0A0A]">Active Filters:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-[#F0F0EC] px-2.5 py-1 rounded-md text-[#0A0A0A]">
                  Keyword: "{searchQuery}"
                  <X size={12} className="cursor-pointer" onClick={() => setSearchQuery('')} />
                </span>
              )}
              {selectedCompany !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-[#F0F0EC] px-2.5 py-1 rounded-md text-[#0A0A0A]">
                  Company: {selectedCompany}
                  <X size={12} className="cursor-pointer" onClick={() => setSelectedCompany('ALL')} />
                </span>
              )}
              {selectedWorkMode !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-[#F0F0EC] px-2.5 py-1 rounded-md text-[#0A0A0A]">
                  Work Mode: {selectedWorkMode}
                  <X size={12} className="cursor-pointer" onClick={() => setSelectedWorkMode('ALL')} />
                </span>
              )}
              {selectedFamily !== 'ALL' && (
                <span className="inline-flex items-center gap-1 bg-[#F0F0EC] px-2.5 py-1 rounded-md text-[#0A0A0A]">
                  Department: {selectedFamily}
                  <X size={12} className="cursor-pointer" onClick={() => setSelectedFamily('ALL')} />
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCompany('ALL');
                setSelectedWorkMode('ALL');
                setSelectedFamily('ALL');
              }}
              className="text-[#0A0A0A] font-semibold underline hover:opacity-75 border-none bg-transparent cursor-pointer p-0"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-2 border-black border-t-transparent mb-4"></div>
          <p className="text-sm font-semibold text-[#666660]">Loading live company requisitions...</p>
        </div>
      ) : error ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-red-200 p-8 max-w-[540px] mx-auto">
          <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-[#0A0A0A] mb-1">Failed to Load Positions</h3>
          <p className="text-sm text-[#666660] mb-5">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-semibold rounded-xl hover:opacity-85 transition-opacity cursor-pointer border-none"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-[#E5E5E0] p-10 max-w-[560px] mx-auto">
          <div className="w-14 h-14 bg-[#F5F5F2] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#8A8A85]">
            <Briefcase size={26} />
          </div>
          <h3 className="font-extrabold text-xl text-[#0A0A0A] mb-2">No Matching Requisitions Found</h3>
          <p className="text-sm text-[#666660] leading-relaxed mb-6">
            We couldn't find any live positions matching your current search criteria. Try adjusting your filters or keyword query.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCompany('ALL');
              setSelectedWorkMode('ALL');
              setSelectedFamily('ALL');
            }}
            className="px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-semibold rounded-xl hover:opacity-85 transition-opacity cursor-pointer border-none"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredJobs.map((job) => {
            const role = job.structured_role || {};
            const skills = (role.must_have_skills || []).slice(0, 4);
            const extraCount = (role.must_have_skills || []).length - skills.length;

            return (
              <div
                key={job.id}
                className="group bg-white rounded-2xl border border-[#E5E5E0] p-6 shadow-xs hover:shadow-md hover:border-[#0A0A0A] transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Company & Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-sm shrink-0 uppercase shadow-xs">
                        {(job.company_name || 'E').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold text-[#0A0A0A] truncate">
                          {job.company_name || 'Partner Company'}
                        </div>
                        <div className="text-[11.5px] text-[#8A8A85] flex items-center gap-1.5 truncate">
                          <Building2 size={12} />
                          <span>{job.company_industry || 'Enterprise'}</span>
                          <span>•</span>
                          <span>{role.job_family || 'General'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        (role.work_mode || '').toLowerCase() === 'remote'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : (role.work_mode || '').toLowerCase() === 'hybrid'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {role.work_mode || 'Remote'}
                      </span>
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3 className="font-extrabold text-[19px] text-[#0A0A0A] leading-snug group-hover:text-black mb-2 transition-colors">
                    {job.title || role.title || 'Role'}
                  </h3>

                  {/* Ref & Metadata Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#666660] mb-4">
                    <span className="font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F5F5F2] text-[#444440]">
                      {job.ref || `REQ-${job.id.slice(0,6).toUpperCase()}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-[#8A8A85]" />
                      {Array.isArray(role.location) ? role.location.join(', ') : (role.location || 'Flexible')}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-[#8A8A85]" />
                      {role.duration || 'Contract'} ({role.weekly_hours || 40}h/wk)
                    </span>
                    <span>•</span>
                    <span>{role.experience || '3+ yrs'}</span>
                  </div>

                  {/* Skills Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F5F2] border border-[#EAEAE6] text-[12px] font-medium text-[#222220]"
                      >
                        {skill}
                      </span>
                    ))}
                    {extraCount > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-[#F0F0EC] text-[11px] font-semibold text-[#666660]">
                        +{extraCount} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 border-t border-[#F0F0EC] flex items-center justify-between gap-3">
                  <div className="text-[11.5px] text-[#8A8A85] flex items-center gap-1.5">
                    <Calendar size={12} className="text-emerald-600" />
                    <span>
                      {role.submission_deadline
                        ? `Deadline: ${new Date(role.submission_deadline).toLocaleDateString()}`
                        : `Verified ${job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Active'}`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenJob(job)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#222220] text-white text-[13px] font-semibold transition-all duration-150 shadow-xs cursor-pointer border-none"
                  >
                    View & Apply
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Universal Talent Pool CTA Banner */}
      <div className="mt-14 bg-gradient-to-br from-[#0A0A0A] to-[#1C1C1A] rounded-3xl p-8 sm:p-10 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-white/10">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-bold tracking-wider uppercase text-emerald-400 mb-3">
            <Sparkles size={13} />
            Universal Candidate Pool
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Don&apos;t see your target role listed today?
          </h3>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed font-inter">
            Register directly into the TermJobs Global Talent Pool. Our enterprise clients, vendors, and AI hiring agents review submitted candidate profiles daily for upcoming contract and direct engineering requisitions.
          </p>
        </div>
        <button
          onClick={() => {
            setShowGeneralPoolModal(true);
            setPoolSuccess(null);
            setPoolError(null);
          }}
          className="px-6 py-3.5 rounded-xl bg-white text-black hover:bg-gray-100 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer border-none"
        >
          Join Candidate Pool →
        </button>
      </div>

      {/* ============================================================ */}
      {/* JOB DETAIL & APPLICATION MODAL / DRAWER                      */}
      {/* ============================================================ */}
      {selectedJob && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="relative w-full max-w-[940px] max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-[#E5E5E0] flex flex-col overflow-hidden animate-[riseIn_0.3s_cubic-bezier(.16,1,.3,1)_both]">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-[#EAEAE6] flex items-center justify-between bg-[#FAFAF8]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {(selectedJob.company_name || 'E').charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold text-[#0A0A0A] leading-snug truncate">
                    {selectedJob.title || selectedJob.structured_role?.title}
                  </div>
                  <div className="text-[12px] text-[#666660] truncate flex items-center gap-2">
                    <span className="font-semibold text-[#0A0A0A]">{selectedJob.company_name}</span>
                    <span>•</span>
                    <span className="font-mono">{selectedJob.ref}</span>
                    <span>•</span>
                    <span>{selectedJob.structured_role?.work_mode || 'Remote'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="w-9 h-9 rounded-full bg-white border border-[#E5E5E0] text-[#666660] hover:text-[#0A0A0A] hover:bg-[#F0F0EC] flex items-center justify-center transition-colors cursor-pointer border-none shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {submitSuccess ? (
                /* SUCCESS STATE */
                <div className="py-12 text-center max-w-[540px] mx-auto animate-[fadeIn_0.3s_ease-out]">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">
                    <CheckCircle2 size={36} />
                  </div>
                  <h2 className="font-extrabold text-2xl text-[#0A0A0A] mb-2">Application Submitted!</h2>
                  <p className="text-[15px] text-[#666660] leading-relaxed mb-6">
                    {submitSuccess.message || `Your application for '${selectedJob.title}' has been successfully forwarded to ${selectedJob.company_name}.`}
                  </p>

                  <div className="bg-[#F5F5F2] border border-[#EAEAE6] rounded-2xl p-5 mb-5 text-left">
                    <div className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider mb-2">Application Summary</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#8A8A85] text-xs block">Reference ID</span>
                        <span className="font-mono font-bold text-[#0A0A0A]">{submitSuccess.application_ref}</span>
                      </div>
                      <div>
                        <span className="text-[#8A8A85] text-xs block">Applicant</span>
                        <span className="font-semibold text-[#0A0A0A]">{submitSuccess.candidate_name}</span>
                      </div>
                      <div>
                        <span className="text-[#8A8A85] text-xs block">Target Company</span>
                        <span className="font-semibold text-[#0A0A0A]">{submitSuccess.company_name}</span>
                      </div>
                      <div>
                        <span className="text-[#8A8A85] text-xs block">Initial Screening Match</span>
                        <span className="font-semibold text-emerald-700">{submitSuccess.match_score || 85}% ({submitSuccess.recommendation || 'Strong'})</span>
                      </div>
                    </div>
                  </div>

                  {/* Connect Telegram Callout */}
                  <div className="p-5 bg-sky-50/80 border border-sky-200 rounded-2xl mb-7 text-left">
                    <div className="flex items-center gap-2 text-sky-950 font-bold text-sm mb-1.5">
                      <Send size={16} className="text-[#229ED9]" />
                      <span>Get Instant Job Alerts with 1-Tap RSVP in Telegram</span>
                    </div>
                    <p className="text-xs text-sky-800 leading-relaxed mb-3.5">
                      Link your Telegram to get matched opportunities delivered directly to your chat. You can reply with <strong>"Interested"</strong> or <strong>"Not Interested"</strong> in 1 tap!
                    </p>
                    <a
                      href={`https://t.me/Termjobs_alertbot?start=${submitSuccess.candidate_id || submitSuccess.application_ref || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs rounded-xl shadow-xs transition-all text-decoration-none cursor-pointer"
                    >
                      <Send size={14} />
                      <span>Connect Telegram (@Termjobs_alertbot)</span>
                    </a>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-6 py-3 rounded-xl bg-[#0A0A0A] text-white font-semibold text-sm hover:opacity-85 transition-opacity cursor-pointer border-none"
                    >
                      Browse More Roles
                    </button>
                  </div>
                </div>
              ) : (
                /* TWO COLUMN LAYOUT: JOB DETAILS & APPLICATION FORM */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Job Description & Criteria */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Quick Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#F9F9F7] p-4 rounded-2xl border border-[#EAEAE6]">
                      <div>
                        <span className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-wider block">Duration</span>
                        <span className="text-[13px] font-bold text-[#0A0A0A]">{selectedJob.structured_role?.duration || 'Contract'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-wider block">Commitment</span>
                        <span className="text-[13px] font-bold text-[#0A0A0A]">{selectedJob.structured_role?.weekly_hours || 40} hrs/week</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-wider block">Experience</span>
                        <span className="text-[13px] font-bold text-[#0A0A0A]">{selectedJob.structured_role?.experience || '3+ years'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-wider block">Work Mode</span>
                        <span className="text-[13px] font-bold text-[#0A0A0A]">{selectedJob.structured_role?.work_mode || 'Remote'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-wider block">Engagement</span>
                        <span className="text-[13px] font-bold text-[#0A0A0A]">{selectedJob.structured_role?.engagement_type || 'Contract Staffing'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-wider block">Location</span>
                        <span className="text-[13px] font-bold text-[#0A0A0A] truncate">
                          {Array.isArray(selectedJob.structured_role?.location) ? selectedJob.structured_role.location.join(', ') : (selectedJob.structured_role?.location || 'Remote')}
                        </span>
                      </div>
                    </div>

                    {/* Must-Have Skills */}
                    <div>
                      <h4 className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider mb-2.5">
                        Required Core Competencies
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(selectedJob.structured_role?.must_have_skills || []).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg bg-[#0A0A0A] text-white text-xs font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Nice-to-Have Skills */}
                    {(selectedJob.structured_role?.nice_to_have_skills || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider mb-2.5">
                          Preferred / Nice-to-Have Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.structured_role.nice_to_have_skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-[#F0F0EC] border border-[#E5E5E0] text-xs font-medium text-[#444440]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full JD Markdown Description */}
                    <div>
                      <h4 className="text-xs font-bold text-[#8A8A85] uppercase tracking-wider mb-2.5">
                        Role Overview & Scope of Work
                      </h4>
                      <div className="prose prose-sm max-w-none text-[#333330] leading-relaxed bg-[#FDFDFD] p-5 rounded-2xl border border-[#EAEAE6]">
                        {selectedJob.generated_jd_markdown ? (
                          <div 
                            dangerouslySetInnerHTML={{ __html: marked(selectedJob.generated_jd_markdown) }}
                          />
                        ) : (
                          <p className="text-sm text-[#666660] italic">
                            This contract role involves collaborating closely with the engineering and product team at {selectedJob.company_name} to execute platform roadmap deliverables under standard milestones.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Direct Application Form */}
                  <div className="lg:col-span-5 bg-[#FAFAF8] p-6 rounded-2xl border border-[#E5E5E0] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Send size={16} className="text-[#0A0A0A]" />
                        <h3 className="font-extrabold text-lg text-[#0A0A0A]">Apply for this Position</h3>
                      </div>
                      <p className="text-xs text-[#666660] mb-5">
                        Submit your profile directly to {selectedJob.company_name}'s hiring team.
                      </p>

                      {submitError && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                          <AlertCircle size={15} className="shrink-0 mt-0.5" />
                          <span>{submitError}</span>
                        </div>
                      )}

                      <form onSubmit={handleApplySubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#444440] mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={applyForm.name}
                            onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                            placeholder="e.g. Maya Chen"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors"
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#444440] mb-1">
                            Email Address <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            value={applyForm.email}
                            onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                            placeholder="maya.chen@example.com"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors"
                          />
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#444440] mb-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={applyForm.phone}
                            onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors"
                          />
                        </div>

                        {/* LinkedIn / GitHub */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                              LinkedIn Profile
                            </label>
                            <input
                              type="url"
                              value={applyForm.linkedin_url}
                              onChange={(e) => setApplyForm({ ...applyForm, linkedin_url: e.target.value })}
                              placeholder="https://linkedin.com/in/..."
                              className="w-full px-3 py-2 rounded-xl border border-[#E5E5E0] bg-white text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                              GitHub / Portfolio
                            </label>
                            <input
                              type="url"
                              value={applyForm.github_url}
                              onChange={(e) => setApplyForm({ ...applyForm, github_url: e.target.value })}
                              placeholder="https://github.com/..."
                              className="w-full px-3 py-2 rounded-xl border border-[#E5E5E0] bg-white text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                            />
                          </div>
                        </div>

                        {/* Brief Note */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#444440] mb-1">
                            Cover Note / Summary
                          </label>
                          <textarea
                            rows="2"
                            value={applyForm.cover_note}
                            onChange={(e) => setApplyForm({ ...applyForm, cover_note: e.target.value })}
                            placeholder="Briefly highlight your relevant technical experience..."
                            className="w-full px-3.5 py-2 rounded-xl border border-[#E5E5E0] bg-white text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] resize-none"
                          />
                        </div>

                        {/* Resume File Dropzone */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#444440] mb-1">
                            Resume (PDF / DOCX) <span className="text-red-500">*</span>
                          </label>
                          
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.doc"
                            onChange={handleFileChange}
                            className="hidden"
                          />

                          {resumeFile ? (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E5E5E0] shadow-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText size={18} className="text-[#0A0A0A] shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-[#0A0A0A] truncate block">{resumeFile.name}</span>
                                  <span className="text-[11px] text-[#8A8A85]">{(resumeFile.size / 1024).toFixed(0)} KB</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setResumeFile(null)}
                                className="text-[#8A8A85] hover:text-red-600 border-none bg-transparent cursor-pointer p-1"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                                isDragging 
                                  ? 'border-[#0A0A0A] bg-[#F0F0EC]' 
                                  : 'border-[#D5D5D0] bg-white hover:border-[#0A0A0A] hover:bg-[#FAFAF8]'
                              }`}
                            >
                              <Upload size={20} className="mx-auto mb-1.5 text-[#8A8A85]" />
                              <div className="text-xs font-bold text-[#0A0A0A]">
                                Drop your resume here, or <span className="underline">browse</span>
                              </div>
                              <div className="text-[10.5px] text-[#8A8A85] mt-0.5">Supports PDF or DOCX (max 10MB)</div>
                            </div>
                          )}
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full mt-2 py-3 bg-[#0A0A0A] hover:bg-[#222220] text-white text-xs font-bold tracking-wide uppercase rounded-xl transition-all shadow-xs cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Analyzing Profile & Submitting...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>Submit Application</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#EAEAE6] text-center text-[11px] text-[#8A8A85]">
                      🔒 Secure direct application to {selectedJob.company_name}.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ============================================================ */}
      {/* GENERAL TALENT POOL REGISTRATION MODAL                       */}
      {/* ============================================================ */}
      {showGeneralPoolModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="relative w-full max-w-[620px] bg-white rounded-3xl shadow-2xl border border-[#E5E5E0] flex flex-col overflow-hidden animate-[riseIn_0.3s_cubic-bezier(.16,1,.3,1)_both]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-[#EAEAE6] flex items-center justify-between bg-[#FAFAF8]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0A0A0A]">Join Universal Candidate Pool</h3>
                  <p className="text-xs text-[#666660]">Submit your profile to be considered for upcoming enterprise openings</p>
                </div>
              </div>
              <button
                onClick={() => setShowGeneralPoolModal(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5E5E0] text-[#666660] hover:text-[#0A0A0A] flex items-center justify-center cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
              {poolSuccess ? (
                <div className="py-8 text-center animate-[fadeIn_0.3s_ease-out]">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-xl font-extrabold text-[#0A0A0A] mb-2">Registration Complete!</h4>
                  <p className="text-xs text-[#666660] max-w-md mx-auto leading-relaxed mb-5">
                    {poolSuccess.message || 'Your resume and details have been registered into the candidate pool.'}
                  </p>

                  {/* Connect Telegram Callout */}
                  <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl mb-6 text-left max-w-md mx-auto">
                    <div className="flex items-center gap-2 text-sky-950 font-bold text-xs mb-1">
                      <Send size={15} className="text-[#229ED9]" />
                      <span>Connect Telegram for Instant 1-Tap Job Matches</span>
                    </div>
                    <p className="text-[11.5px] text-sky-800 leading-relaxed mb-3">
                      Receive VIP alerts in Telegram when new positions match your profile. Confirm with <strong>"Interested"</strong> or <strong>"Not Interested"</strong> buttons instantly.
                    </p>
                    <a
                      href={`https://t.me/Termjobs_alertbot?start=${poolSuccess.candidate_id || poolSuccess.id || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3.5 bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs rounded-xl shadow-xs transition-all text-decoration-none cursor-pointer"
                    >
                      <Send size={13} />
                      <span>Connect to @Termjobs_alertbot</span>
                    </a>
                  </div>

                  <button
                    onClick={() => {
                      setShowGeneralPoolModal(false);
                      setPoolSuccess(null);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-bold border-none cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePoolSubmit} className="space-y-4 text-xs">
                  {poolError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} />
                      <span>{poolError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={poolForm.name}
                        onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                        placeholder="Sarah Jenkins"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={poolForm.email}
                        onChange={(e) => setPoolForm({ ...poolForm, email: e.target.value })}
                        placeholder="sarah@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={poolForm.phone}
                        onChange={(e) => setPoolForm({ ...poolForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                        Professional Title
                      </label>
                      <input
                        type="text"
                        value={poolForm.title}
                        onChange={(e) => setPoolForm({ ...poolForm, title: e.target.value })}
                        placeholder="Lead Backend Architect"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                      Key Technical Skills (comma separated)
                    </label>
                    <input
                      type="text"
                      value={poolForm.skills}
                      onChange={(e) => setPoolForm({ ...poolForm, skills: e.target.value })}
                      placeholder="Python, React, FastAPI, AWS, Docker, Kubernetes"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                        LinkedIn Profile URL
                      </label>
                      <input
                        type="url"
                        value={poolForm.linkedin_url}
                        onChange={(e) => setPoolForm({ ...poolForm, linkedin_url: e.target.value })}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                        GitHub / Portfolio URL
                      </label>
                      <input
                        type="url"
                        value={poolForm.github_url}
                        onChange={(e) => setPoolForm({ ...poolForm, github_url: e.target.value })}
                        placeholder="https://github.com/..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                      Upload Resume (PDF / DOCX) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.docx,.doc"
                      onChange={(e) => setPoolResume(e.target.files?.[0] || null)}
                      className="w-full px-3.5 py-2 bg-[#FAFAF8] border border-[#E5E5E0] rounded-xl text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0A0A0A] file:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444440] mb-1">
                      Brief Note or Overview
                    </label>
                    <textarea
                      rows={2}
                      value={poolForm.cover_note}
                      onChange={(e) => setPoolForm({ ...poolForm, cover_note: e.target.value })}
                      placeholder="Share a short note on your experience, availability, or target roles..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A] focus:bg-white resize-none"
                    />
                  </div>

                  <div className="pt-3 border-t border-[#EAEAE6] flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowGeneralPoolModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-[#E5E5E0] text-xs font-bold text-[#666660] hover:bg-[#F5F5F2] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={poolSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#222220] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 border-none"
                    >
                      {poolSubmitting ? 'Registering...' : 'Register Profile'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
