import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  ArrowRight,
  Briefcase,
  User,
  Mail,
  Phone,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
  Layers,
  X
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function JoinCandidate() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile) => {
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setError('Please upload a PDF or DOCX resume document.');
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File size exceeds the 15MB limit.');
      return;
    }
    setError('');
    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!file) {
      setError('Please upload your resume to enter the Talent Pool.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim().toLowerCase());
      if (phone.trim()) formData.append('phone', phone.trim());
      if (roleTitle.trim()) formData.append('role_title', roleTitle.trim());
      if (skills.trim()) formData.append('skills', skills.trim());
      if (linkedinUrl.trim()) formData.append('linkedin_url', linkedinUrl.trim());
      if (portfolioUrl.trim()) formData.append('portfolio_url', portfolioUrl.trim());
      formData.append('resume', file);

      const res = await fetch('/api/candidates/join', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to submit application.');
      }

      setSuccessData({
        name: data.candidate_name || name,
        email: data.candidate_email || email,
        title: data.candidate_title || roleTitle || 'Candidate',
        skills: data.skills || (skills ? skills.split(',').map((s) => s.trim()) : []),
      });
    } catch (err) {
      console.error('Candidate submission error:', err);
      setError(err.message || 'Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setRoleTitle('');
    setSkills('');
    setLinkedinUrl('');
    setPortfolioUrl('');
    setFile(null);
    setError('');
    setSuccessData(null);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-gray-900 font-sans flex flex-col justify-between selection:bg-black selection:text-white">
      <SEOHead
        title="Join Talent Pool | Direct Candidate Network | TermJobs"
        description="Submit your resume directly into the TermJobs Candidate Pool. No recruitment agencies, no markups, direct matching with top hiring companies."
        canonicalUrl="https://termjobs.vercel.app/join/candidate"
      />

      {/* Top Navbar */}
      <header className="w-full border-b border-gray-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="TermJobs" className="w-7 h-7 object-contain" />
          <span className="font-extrabold text-sm tracking-tight text-gray-950 uppercase">
            Term<span className="text-gray-400">Jobs</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-black text-white ml-1">
            Talent Pool
          </span>
        </Link>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link
            to="/login"
            className="text-gray-600 hover:text-black transition-colors px-3 py-1.5"
          >
            Company Sign In
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 sm:py-14">
        {successData ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Enrolled in Talent Pool
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight pt-1">
                Application Received, {successData.name}!
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
                Your resume and profile have been parsed and safely enrolled into our review-gated <strong>Candidate Pool</strong>.
              </p>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-500 text-[11px]">
                <span>Registered Email</span>
                <span className="font-bold text-gray-900">{successData.email}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-[11px]">
                <span>Primary Target Role</span>
                <span className="font-bold text-gray-900">{successData.title}</span>
              </div>
              {successData.skills && successData.skills.length > 0 && (
                <div className="pt-2 border-t border-gray-200/60">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1.5">
                    Extracted Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {successData.skills.slice(0, 8).map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800 text-[11px] font-medium"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Next Steps Roadmap */}
            <div className="border-t border-gray-100 pt-5 text-left space-y-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                What happens next?
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-xs text-gray-600">
                    <strong>Autonomous AI Matching</strong>: Whenever a verified company posts a new approved requisition, our AI automatically evaluates your profile against the criteria.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-xs text-gray-600">
                    <strong>Direct AI Voice/Video Interview</strong>: If shortlisted, you will receive an invitation link directly in your inbox to conduct an interactive AI interview.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-xs text-gray-600">
                    <strong>Direct Contractor SOW</strong>: Selected candidates receive an immediate company offer and statement of work without any agency deductions.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
              >
                Submit Another Application
              </button>
              <Link
                to="/"
                className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Back to Homepage</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Hero */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-extrabold shadow-2xs">
                <Sparkles size={13} className="text-amber-600" />
                <span>Direct Talent Pool • Zero Recruiter Middlemen</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight leading-tight">
                Get Matched Directly with Leading Companies
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-normal leading-relaxed">
                Submit your profile in under 60 seconds. No passwords or account setup required.
                Our AI scores your resume directly against verified job requisitions and fast-tracks you into interviews.
              </p>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                  <Zap size={15} className="text-amber-500" />
                  <span>Frictionless Join</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Zero password or login required. Just upload your resume and basic contact details.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                  <Layers size={15} className="text-blue-500" />
                  <span>Automated AI Scoring</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Your skills and experience are evaluated across every newly published requisition.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  <span>Direct Contracts</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  100% direct contractor SOWs with client directors. No agency commission cut.
                </p>
              </div>
            </div>

            {/* The Application Form Card */}
            <div className="bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-10 shadow-xs">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle size={17} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <div className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                    <User size={14} className="text-gray-400" />
                    <span>Candidate Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jane Doe"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jane@example.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 019-2834"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Target Role / Headline <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={roleTitle}
                          onChange={(e) => setRoleTitle(e.target.value)}
                          placeholder="e.g. Senior Backend Engineer"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Qualifications & Links */}
                <div className="space-y-4 pt-2">
                  <div className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                    <Sparkles size={14} className="text-gray-400" />
                    <span>Skills & Links</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Core Skills <span className="text-gray-400 font-normal">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="e.g. Python, FastAPI, React, PostgreSQL, Docker, AWS"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Our AI will automatically extract and enrich your skills directly from your resume.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        LinkedIn Profile URL
                      </label>
                      <div className="relative">
                        <LinkIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        GitHub or Portfolio URL
                      </label>
                      <div className="relative">
                        <LinkIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          value={portfolioUrl}
                          onChange={(e) => setPortfolioUrl(e.target.value)}
                          placeholder="https://github.com/username"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black text-xs outline-none transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resume Upload Zone */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                    <FileText size={14} className="text-gray-400" />
                    <span>Resume Document</span>
                    <span className="text-red-500">*</span>
                  </div>

                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                      dragActive
                        ? 'border-black bg-gray-50'
                        : file
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-gray-200 hover:border-gray-400 bg-gray-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {file ? (
                      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs max-w-md mx-auto">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="text-left truncate">
                            <div className="text-xs font-bold text-gray-900 truncate">
                              {file.name}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Parsing
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center mx-auto shadow-2xs">
                          <UploadCloud size={22} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">
                            Click to upload or drag & drop your resume
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            PDF or DOCX format (Max 15MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-2xl bg-black hover:bg-gray-900 text-white text-sm font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Extracting Profile & Enrolling in Talent Pool...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Talent Pool</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-2.5">
                    By submitting, your resume is safely stored in our encrypted talent pool. No agency spam.
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="w-full border-t border-gray-200/80 bg-white px-6 py-4 text-center text-xs text-gray-500">
        TermJobs Platform • Direct Workforce Intelligence • Built for Modern Contractors
      </footer>
    </div>
  );
}
