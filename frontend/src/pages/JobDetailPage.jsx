import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, MapPin, Clock, Building2, Calendar, ArrowLeft, 
  Share2, CheckCircle2, AlertCircle, Sparkles, Shield, DollarSign,
  ChevronRight, ExternalLink, Send
} from 'lucide-react';
import { API_BASE_URL, request } from '../api/client';
import SEOHead from '../components/SEOHead';
import { marked } from 'marked';
import { formatDueDate } from '../utils/dateUtils';
import { TermJobsLoader } from '../components/TermJobsLoader';

// Helper to sanitize strings for structured data
function sanitizeForJsonLd(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '').trim();
}

export default function JobDetailPage() {
  const { slugOrId } = useParams();
  const navigate = useNavigate();

  // Extract stable ID if format is [slug]-[id] or pure [id]
  const jobId = slugOrId ? slugOrId.split('-').pop() : '';

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Application Modal state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantFile, setApplicantFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    if (!jobId) {
      setError('Invalid job identifier');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/api/public/requisitions/${jobId}`, {
      headers: { Accept: 'application/json' }
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('This role is closed, expired, or does not exist.');
          }
          throw new Error('Unable to load job details at this time.');
        }
        return res.json();
      })
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Job requisition not found');
        setLoading(false);
      });
  }, [jobId]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: job?.title ? `${job.title} | TermJobs` : 'Contract Job on TermJobs',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantEmail.trim() || !applicantFile) {
      setApplyError('Please provide your name, email, and upload your resume (PDF/DOCX).');
      return;
    }

    setSubmitting(true);
    setApplyError('');

    try {
      const formData = new FormData();
      formData.append('name', applicantName.trim());
      formData.append('email', applicantEmail.trim());
      formData.append('phone', applicantPhone.trim());
      formData.append('resume', applicantFile);

      const res = await fetch(`${API_BASE_URL}/api/public/requisitions/${job.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      const respData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(respData.detail || 'Failed to submit application. Please try again.');
      }

      setApplySuccess(true);
    } catch (err) {
      setApplyError(err.message || 'Error submitting application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex flex-col items-center justify-center p-4">
        <TermJobsLoader size={42} ariaLabel="Loading job details..." />
        <p className="mt-4 text-xs font-mono text-neutral-400">Loading verified requisition...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex flex-col items-center justify-center p-6 text-center">
        <SEOHead
          title="Job Closed or Not Found | TermJobs"
          description="The requested contract job requisition has expired, been fulfilled, or is no longer accepting applications."
          canonicalUrl={`https://www.termjobs.in/jobs/${slugOrId}`}
          noindex={true}
        />
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 text-amber-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">Requisition Unavailable</h1>
        <p className="text-sm text-neutral-400 max-w-md mb-6">
          {error || 'This contract role has reached its submission deadline or is no longer publicly open.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/jobs/contract"
            className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition"
          >
            Explore Active Contract Roles
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const role = job.structured_role || {};
  const jobTitle = job.title || role.title || 'Contract Specialist';
  const companyName = job.company_name || 'Verified Hiring Partner';
  const workMode = role.work_mode || 'Remote';
  const locations = Array.isArray(role.location) ? role.location.join(', ') : (role.location || 'India');
  const engagementType = role.engagement_type || 'Contract';
  const duration = role.duration || '6 Months';
  const experience = role.experience || '3+ years';
  const weeklyHours = role.weekly_hours || 40;
  const currency = role.currency || 'INR';
  const rangeMin = role.range_min;
  const rangeMax = role.range_max;

  const rawDescription = job.generated_jd_markdown || `${jobTitle} contract position at ${companyName}.`;
  const cleanDescription = sanitizeForJsonLd(rawDescription);

  // Construct valid Schema.org JobPosting
  const isRemote = workMode.toLowerCase().includes('remote') || locations.toLowerCase().includes('remote');
  const datePosted = job.created_at ? new Date(job.created_at).toISOString() : new Date().toISOString();
  const validThrough = job.due_date ? new Date(job.due_date).toISOString() : undefined;

  const jobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: jobTitle,
    description: cleanDescription,
    datePosted: datePosted,
    validThrough: validThrough,
    employmentType: engagementType.toUpperCase().includes('TEMP') ? 'TEMPORARY' : 'CONTRACTOR',
    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      sameAs: 'https://www.termjobs.in',
      logo: job.company_logo_url || 'https://www.termjobs.in/logo.png',
    },
    identifier: {
      '@type': 'PropertyValue',
      name: 'TermJobs Requisition ID',
      value: job.ref || job.id,
    },
    directApply: true,
  };

  if (isRemote) {
    jobPostingSchema.jobLocationType = 'TELECOMMUTE';
    jobPostingSchema.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'India',
    };
  } else {
    jobPostingSchema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: locations,
        addressCountry: 'IN',
      },
    };
  }

  if (rangeMin && rangeMax) {
    jobPostingSchema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: currency,
      value: {
        '@type': 'QuantitativeValue',
        minValue: Number(rangeMin),
        maxValue: Number(rangeMax),
        unitText: 'MONTH',
      },
    };
  }

  const canonicalUrl = `https://www.termjobs.in/jobs/${slugOrId}`;
  const seoTitle = `${jobTitle} (${engagementType}) – ${companyName} | TermJobs`;
  const seoDesc = `Apply for ${jobTitle} (${engagementType}, ${workMode}) at ${companyName}. TermJobs offers verified contract and temporary jobs with fast-track direct application.`;

  return (
    <div className="min-h-screen bg-[#08090b] text-white selection:bg-neutral-800 selection:text-white">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonicalUrl={canonicalUrl}
        jsonLd={jobPostingSchema}
      />

      {/* Top Breadcrumb Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#08090b]/90 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link to="/" className="hover:text-white transition">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <Link to="/jobs/contract" className="hover:text-white transition">Contract Jobs</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-neutral-200 truncate max-w-[200px] sm:max-w-xs">{jobTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 text-neutral-300 text-xs hover:border-neutral-700 transition"
            title="Share Job"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{copied ? 'Link Copied!' : 'Share'}</span>
          </button>
          <button
            onClick={() => setApplyModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Apply Now</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Job Description and Details (2 cols on desktop) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Header Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800/80">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Verified Active Requisition
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-300">
                  {job.ref || `REQ-${job.id.slice(0, 6).toUpperCase()}`}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {engagementType}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
                {jobTitle}
              </h1>

              <div className="flex items-center gap-3 text-sm text-neutral-400 mb-6">
                <span className="flex items-center gap-1.5 font-medium text-neutral-200">
                  <Building2 className="w-4 h-4 text-neutral-400" />
                  {companyName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-neutral-400" />
                  {locations} ({workMode})
                </span>
              </div>

              {/* High-level tags */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-neutral-800/80 text-xs">
                <div>
                  <span className="block text-neutral-500 text-[10px] uppercase font-mono tracking-wider">Duration</span>
                  <span className="font-semibold text-neutral-200 mt-0.5 block">{duration}</span>
                </div>
                <div>
                  <span className="block text-neutral-500 text-[10px] uppercase font-mono tracking-wider">Experience</span>
                  <span className="font-semibold text-neutral-200 mt-0.5 block">{experience}</span>
                </div>
                <div>
                  <span className="block text-neutral-500 text-[10px] uppercase font-mono tracking-wider">Weekly Commitment</span>
                  <span className="font-semibold text-neutral-200 mt-0.5 block">{weeklyHours} Hours / Week</span>
                </div>
                <div>
                  <span className="block text-neutral-500 text-[10px] uppercase font-mono tracking-wider">Deadline</span>
                  <span className="font-semibold text-amber-400 mt-0.5 block">{formatDueDate(job.due_date) || 'Open'}</span>
                </div>
              </div>
            </div>

            {/* Skills Card */}
            {(role.must_have_skills?.length > 0 || role.nice_to_have_skills?.length > 0) && (
              <div className="p-6 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                  Skill Requirements
                </h2>
                {role.must_have_skills?.length > 0 && (
                  <div>
                    <h3 className="text-xs text-neutral-400 mb-2">Primary / Must-Have</h3>
                    <div className="flex flex-wrap gap-2">
                      {role.must_have_skills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg text-xs bg-neutral-800 text-neutral-200 font-medium border border-neutral-700/60">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {role.nice_to_have_skills?.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-xs text-neutral-400 mb-2">Bonus / Nice-to-Have</h3>
                    <div className="flex flex-wrap gap-2">
                      {role.nice_to_have_skills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg text-xs bg-neutral-900 text-neutral-400 border border-neutral-800">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rendered Job Description (Markdown) */}
            <div className="p-6 sm:p-8 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 prose prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-blue-400 prose-p:text-neutral-300 prose-li:text-neutral-300 text-sm leading-relaxed">
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono not-prose mb-4 pb-2 border-b border-neutral-800">
                Detailed Scope of Work & Responsibilities
              </h2>
              <div dangerouslySetInnerHTML={{ __html: marked.parse(rawDescription) }} />
            </div>

            {/* Trust and Verification Footnote */}
            <div className="p-5 rounded-2xl bg-neutral-900/20 border border-neutral-800/50 flex items-start gap-4 text-xs text-neutral-400">
              <Shield className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-neutral-300 block mb-1">TermJobs Fair Hiring & Verified Requisitions Guarantee</strong>
                All requisitions published on TermJobs are authorized by partner enterprise directors and hiring managers. We do not aggregate phantom roles or crawl unverified job boards. Applications are routed directly to hiring teams.
              </div>
            </div>

          </div>

          {/* Right Column: Application Card & Related Links (1 col on desktop) */}
          <div className="space-y-6">
            
            {/* Quick Apply Card */}
            <div className="sticky top-20 p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md shadow-xl space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider font-semibold">Immediate Application</span>
                <h3 className="text-lg font-bold text-white mt-1">Apply for this Role</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  1-click submission with direct delivery to the requisition reviewer.
                </p>
              </div>

              {rangeMin && rangeMax && (
                <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">Indicative Monthly Range</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    {currency} {Number(rangeMin).toLocaleString()} – {Number(rangeMax).toLocaleString()}
                    <span className="text-xs font-normal text-neutral-400"> / mo</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setApplyModalOpen(true)}
                className="w-full py-3 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Application
              </button>

              <div className="text-[11px] text-neutral-400 space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No account or sign-up needed to view or apply</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Direct delivery to hiring decision-makers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Automated work orders & compliant billing upon hire</span>
                </div>
              </div>

              {/* Related Category Links for Internal Linking */}
              <div className="pt-4 border-t border-neutral-800/80 space-y-2.5">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">Explore Related Opportunities</span>
                <Link to="/jobs/contract" className="flex items-center justify-between text-xs text-neutral-300 hover:text-white transition py-1">
                  <span>Explore all Contract Jobs</span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </Link>
                <Link to="/jobs/temporary" className="flex items-center justify-between text-xs text-neutral-300 hover:text-white transition py-1">
                  <span>Explore Temporary Jobs</span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </Link>
                <Link to="/career-guides/temporary-vs-contract-jobs" className="flex items-center justify-between text-xs text-neutral-300 hover:text-white transition py-1">
                  <span>Guide: Contract vs Temporary Work</span>
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                </Link>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Direct Application Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111215] border border-neutral-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => { setApplyModalOpen(false); setApplySuccess(false); setApplyError(''); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              aria-label="Close modal"
            >
              ✕
            </button>

            {applySuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Application Received!</h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
                  Your resume has been forwarded to the hiring team for <strong>{jobTitle}</strong>. You will receive email status updates as your candidacy progresses.
                </p>
                <button
                  onClick={() => setApplyModalOpen(false)}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Direct Application</h3>
                  <p className="text-xs text-neutral-400 truncate">{jobTitle} • {companyName}</p>
                </div>

                {applyError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{applyError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Phone Number (optional)</label>
                  <input
                    type="tel"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Attach Resume (PDF/DOCX) *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setApplicantFile(e.target.files[0] || null)}
                    className="w-full text-xs text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    {submitting ? 'Submitting Application...' : 'Send Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
