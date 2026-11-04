import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  Briefcase, MapPin, Clock, Building2, Search, Filter, 
  ChevronRight, ArrowRight, CheckCircle2, AlertCircle, Sparkles, HelpCircle 
} from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import SEOHead from '../components/SEOHead';
import { formatDueDate } from '../utils/dateUtils';
import { TermJobsLoader } from '../components/TermJobsLoader';

// Definitions for the 3 high-intent categories
const CATEGORY_CONFIG = {
  contract: {
    type: 'contract',
    title: 'Contract Jobs – Explore Contract Opportunities | TermJobs',
    h1: 'Explore Verified Contract Jobs & Flexible Engagements',
    description: 'Browse genuine, enterprise-backed contract jobs. Compare verified monthly rates, project durations, and remote terms without third-party spam.',
    directAnswer: 'A contract job is a fixed-duration professional engagement where a specialist is hired directly or through a staffing partner to deliver specific projects or scope of work, without long-term permanent payroll obligations. Contract roles offer higher flexibility, competitive rates, and direct enterprise exposure.',
    canonicalUrl: 'https://www.termjobs.in/jobs/contract',
    badge: 'Contract Opportunities',
  },
  temporary: {
    type: 'temporary',
    title: 'Temporary Jobs – Find Short-Term Work | TermJobs',
    h1: 'Find Verified Temporary Jobs & Immediate Short-Term Roles',
    description: 'Discover immediate short-term and temporary jobs with verified companies. Quick application turnarounds, flexible durations, and transparent weekly terms.',
    directAnswer: 'A temporary job is a short-term work arrangement designed to cover immediate business needs, seasonal peaks, or temporary staffing leaves. Temporary positions feature fast hiring cycles, clearly defined engagement dates, and structured milestone approvals.',
    canonicalUrl: 'https://www.termjobs.in/jobs/temporary',
    badge: 'Temporary & Short-Term Work',
  },
  'remote-contract': {
    type: 'remote',
    title: 'Remote Contract Jobs – Flexible Work From Anywhere | TermJobs',
    h1: 'Remote Contract Jobs & Work-From-Anywhere Projects',
    description: 'Find 100% remote contract positions across engineering, product, data, and design. Apply directly to verified organizations with asynchronous workflows.',
    directAnswer: 'Remote contract jobs allow independent professionals to deliver project-based work entirely from home or anywhere in India. Requisitions on TermJobs specify weekly hours, deliverables, digital timesheets, and milestone payments for remote contractors.',
    canonicalUrl: 'https://www.termjobs.in/jobs/remote-contract',
    badge: '100% Remote Contracts',
  },
};

export default function JobCategoryLandingPage({ forcedCategory }) {
  const params = useParams();
  const categoryKey = forcedCategory || params.category || 'contract';
  const config = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.contract;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/public/requisitions`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          // Filter matching the category intent
          const filtered = data.filter((job) => {
            const role = job.structured_role || {};
            const engType = (role.engagement_type || '').toLowerCase();
            const workMode = (role.work_mode || '').toLowerCase();
            const location = Array.isArray(role.location) ? role.location.join(' ').toLowerCase() : (role.location || '').toLowerCase();

            if (categoryKey === 'remote-contract') {
              return workMode.includes('remote') || location.includes('remote');
            }
            if (categoryKey === 'temporary') {
              return engType.includes('temp') || (role.duration && role.duration.toLowerCase().includes('month') && parseInt(role.duration) <= 3);
            }
            // Default contract
            return true;
          });
          setJobs(filtered);
        }
        setLoading(false);
      })
      .catch(() => {
        setJobs([]);
        setLoading(false);
      });
  }, [categoryKey]);

  const visibleJobs = jobs.filter((job) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const title = (job.title || job.structured_role?.title || '').toLowerCase();
    const company = (job.company_name || '').toLowerCase();
    const skills = (job.structured_role?.must_have_skills || []).join(' ').toLowerCase();
    return title.includes(term) || company.includes(term) || skills.includes(term);
  });

  return (
    <div className="min-h-screen bg-[#08090b] text-white selection:bg-neutral-800 selection:text-white">
      <SEOHead
        title={config.title}
        description={config.description}
        canonicalUrl={config.canonicalUrl}
      />

      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-[#08090b]/90 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link to="/" className="hover:text-white transition">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-neutral-200">{config.badge}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/open-roles"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:border-neutral-700 transition"
          >
            All Open Roles
          </Link>
          <Link
            to="/career-guides/temporary-vs-contract-jobs"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:border-neutral-700 transition hidden sm:inline-block"
          >
            Career Guide
          </Link>
        </div>
      </header>

      {/* Hero Section with Direct Answer (AEO / GEO Engine Friendly) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900 border border-neutral-800 text-neutral-300 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>{config.badge}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          {config.h1}
        </h1>

        <p className="text-base text-neutral-400 max-w-2xl mb-8 leading-relaxed">
          {config.description}
        </p>

        {/* Direct AEO Question-Answer Panel */}
        <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-200 mb-1.5">
                {categoryKey === 'temporary'
                  ? 'What is a Temporary Job?'
                  : categoryKey === 'remote-contract'
                  ? 'What is a Remote Contract Job?'
                  : 'What is a Contract Job?'}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                {config.directAnswer}
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter Switcher Tabs */}
        <div className="flex flex-wrap gap-2 mt-6">
          <Link
            to="/jobs/contract"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
              categoryKey === 'contract'
                ? 'bg-white text-black font-semibold'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Contract Jobs
          </Link>
          <Link
            to="/jobs/temporary"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
              categoryKey === 'temporary'
                ? 'bg-white text-black font-semibold'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Temporary Jobs
          </Link>
          <Link
            to="/jobs/remote-contract"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
              categoryKey === 'remote-contract'
                ? 'bg-white text-black font-semibold'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Remote Contracts
          </Link>
        </div>

        {/* Search input */}
        <div className="mt-6 relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Filter ${config.badge.toLowerCase()} by skill, title, or organization...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition"
          />
        </div>
      </section>

      {/* Requisitions List */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-6 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <TermJobsLoader size={36} ariaLabel="Loading requisitions..." />
            <p className="mt-3 text-xs text-neutral-400">Loading active positions...</p>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-2xl bg-neutral-900/30 border border-neutral-800/80 text-center">
            <Briefcase className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-neutral-200">No active postings matching this filter</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 mb-4">
              All active roles are refreshed dynamically. You can browse all verified open requisitions across all categories.
            </p>
            <Link
              to="/open-roles"
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition inline-block"
            >
              View All Open Roles
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
              <span>Showing {visibleJobs.length} verified {visibleJobs.length === 1 ? 'position' : 'positions'}</span>
              <span className="text-neutral-500">Live API Verified</span>
            </div>

            {visibleJobs.map((job) => {
              const role = job.structured_role || {};
              const title = job.title || role.title || 'Contract Professional';
              const company = job.company_name || 'Verified Partner';
              const location = Array.isArray(role.location) ? role.location.join(', ') : (role.location || 'India');
              const workMode = role.work_mode || 'Remote';
              const duration = role.duration || '6 Months';
              const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              const jobDetailUrl = `/jobs/${slug}-${job.id}`;

              return (
                <article
                  key={job.id}
                  className="group p-5 sm:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300">
                        {job.ref || `REQ-${job.id.slice(0, 6).toUpperCase()}`}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {role.engagement_type || 'Contract'}
                      </span>
                      {workMode.toLowerCase().includes('remote') && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Remote
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                      <Link to={jobDetailUrl}>{title}</Link>
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
                      <span className="flex items-center gap-1 text-neutral-300">
                        <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                        {company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                        {location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        {duration}
                      </span>
                    </div>

                    {role.must_have_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {role.must_have_skills.slice(0, 4).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-neutral-800/80 text-neutral-300">
                            {skill}
                          </span>
                        ))}
                        {role.must_have_skills.length > 4 && (
                          <span className="px-1.5 py-0.5 text-[10px] text-neutral-500">
                            +{role.must_have_skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                    {role.range_min && role.range_max ? (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase text-neutral-500 block">Rate</span>
                        <span className="text-xs font-bold text-emerald-400">
                          ₹{Number(role.range_min).toLocaleString()} - ₹{Number(role.range_max).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase text-neutral-500 block">Rate</span>
                        <span className="text-xs text-neutral-300">Competitive Contract</span>
                      </div>
                    )}

                    <Link
                      to={jobDetailUrl}
                      className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition inline-flex items-center gap-1.5 shrink-0"
                    >
                      <span>View Role</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Internal Linking & Educational Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950/60 py-10 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-neutral-400">
          <div>
            <h3 className="text-sm font-bold text-white mb-2">TermJobs Platform</h3>
            <p className="leading-relaxed">
              TermJobs is a modern contract hiring platform bringing verified requisitions, talent screening, video interviews, automated timesheets, and milestone payments into one unified system.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-2">Job Categories</h3>
            <ul className="space-y-1.5">
              <li><Link to="/jobs/contract" className="hover:text-white transition">Contract Jobs in India</Link></li>
              <li><Link to="/jobs/temporary" className="hover:text-white transition">Temporary Work Opportunities</Link></li>
              <li><Link to="/jobs/remote-contract" className="hover:text-white transition">Remote Contract Positions</Link></li>
              <li><Link to="/open-roles" className="hover:text-white transition">All Open Roles Directory</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-2">Guides & Employers</h3>
            <ul className="space-y-1.5">
              <li><Link to="/career-guides/temporary-vs-contract-jobs" className="hover:text-white transition">Temporary vs Contract Jobs Guide</Link></li>
              <li><Link to="/employers" className="hover:text-white transition">Contract Staffing for Employers</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy & Trust</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
