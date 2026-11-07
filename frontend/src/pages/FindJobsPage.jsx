import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, Clock, Zap, Globe, ArrowRight, ChevronRight, 
  Sparkles, ShieldCheck, CheckCircle2, ArrowUpRight, Search, Check
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function FindJobsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Find Jobs - Contract, Temporary & Remote Roles | TermJobs',
    url: 'https://www.termjobs.in/find-jobs',
    description: 'Explore verified job openings across All Open Roles, Contract Jobs, Temporary Jobs, and Remote Jobs on TermJobs.',
  };

  const categories = [
    {
      id: 'open-roles',
      title: 'All Open Roles',
      tag: 'Live Board',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      icon: Briefcase,
      description: 'Access the complete live directory of verified enterprise positions. Enjoy instant 1-click verified application, automated skill matching, and fast-track interview scheduling.',
      features: [
        '18+ verified positions active right now',
        '1-Click instant application with candidate profile',
        'AI competency evaluation and priority interview status',
        'Direct hiring partner review with zero agency middlemen',
      ],
      link: '/open-roles',
      ctaText: 'View All Open Roles',
    },
    {
      id: 'contract-jobs',
      title: 'Contract Jobs',
      tag: 'Milestone & Tenure',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700',
      icon: Clock,
      description: 'Structured fixed-term contracts and milestone-driven engagements. Benefit from defined tenure timelines (3–12 months), transparent hourly/monthly compensation, and formal digital work orders.',
      features: [
        'Clearly defined deliverables and milestone scope',
        'Transparent pre-approved hourly or monthly rate caps',
        'Digitally executed work orders and formal agreements',
        'Direct weekly timesheet approval and automated clearance',
      ],
      link: '/jobs/contract',
      ctaText: 'Browse Contract Jobs',
    },
    {
      id: 'temporary-jobs',
      title: 'Temporary Jobs',
      tag: 'Immediate Placement',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      icon: Zap,
      description: 'Flexible short-term assignments and rapid-start placements to support peak workloads, project surges, and seasonal operational requirements across leading organizations.',
      features: [
        'Fast-track onboarding with placement in 48–72 hours',
        'Short-term engagements designed around your availability',
        'Weekly automated timesheet clearance with zero payment delays',
        'Seamless path to contract-to-hire permanent conversion',
      ],
      link: '/jobs/temporary',
      ctaText: 'Browse Temporary Jobs',
    },
    {
      id: 'remote-jobs',
      title: 'Remote Jobs',
      tag: 'Distributed Teams',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      iconBg: 'bg-purple-100 text-purple-700',
      icon: Globe,
      description: 'Distributed contract and freelance opportunities allowing you to collaborate with technology companies and enterprise leaders from anywhere with maximum schedule flexibility.',
      features: [
        '100% remote or hybrid flexible working arrangements',
        'Competitive national compensation benchmarks',
        'Asynchronous communication and modern collaboration workflows',
        'Built-in WebRTC video interviews and digital compliance signing',
      ],
      link: '/jobs/remote-contract',
      ctaText: 'Browse Remote Jobs',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] text-neutral-900 selection:bg-neutral-200 selection:text-neutral-900">
      <SEOHead
        title="Find Jobs – All Open Roles, Contract, Temporary & Remote | TermJobs"
        description="Browse all flexible employment formats on TermJobs: All Open Roles, Contract Jobs, Temporary Jobs, and Remote Jobs with verified employers and 1-click apply."
        canonicalUrl="https://www.termjobs.in/find-jobs"
        jsonLd={jsonLd}
      />

      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link to="/" className="font-semibold text-neutral-900 hover:text-emerald-700 transition">TermJobs</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-700 font-medium">Find Jobs</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/employers"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition hidden sm:inline-block font-medium"
          >
            For Employers
          </Link>
          <Link
            to="/resources"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition hidden sm:inline-block font-medium"
          >
            Resources & Trust
          </Link>
          <Link
            to="/open-roles"
            className="text-xs px-3.5 py-1.5 rounded-lg bg-neutral-950 text-white font-semibold uppercase tracking-wider hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-xs"
          >
            <span>Live Roles</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-neutral-200 text-neutral-800 mb-5 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Opportunity Directory</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 mb-4 leading-tight">
          Find Jobs on TermJobs
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mb-8 leading-relaxed">
          Choose the work arrangement that fits your career path. Discover verified direct openings, milestone-based contracts, flexible short-term placements, and distributed remote roles.
        </p>

        {/* Live Search Quick-Access Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-900">18+ Active Roles Available Right Now</div>
              <div className="text-xs text-neutral-500">Live positions in Calicut, Kochi, Bangalore, and Remote with 1-click apply.</div>
            </div>
          </div>
          <Link
            to="/open-roles"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition text-center shrink-0 shadow-xs"
          >
            Explore Live Board →
          </Link>
        </div>
      </section>

      {/* 4 Cards Grid: All Open Roles, Contract Jobs, Temporary Jobs, Remote Jobs */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 mb-1.5">
            Employment Categories
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600">
            Select an employment format below to access specific requisitions, compensation structures, and requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-xl ${cat.iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cat.badgeClass}`}>
                      {cat.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-neutral-950 mb-2">
                      {cat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  <div className="pt-2 space-y-2 border-t border-neutral-100">
                    {cat.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-neutral-700">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={cat.link}
                  className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-950 text-neutral-900 hover:text-white font-semibold text-xs tracking-wider transition group"
                >
                  <span>{cat.ctaText}</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Candidate Assurance Box */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <ShieldCheck size={16} />
              <span>Direct Enterprise Transparency</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-neutral-950">
              Zero Middleman Cuts & Standardized Contracts
            </h3>
            <p className="text-xs text-neutral-600 max-w-xl leading-relaxed">
              Every position on TermJobs is backed by verified corporate requisitions with guaranteed rate transparency, digital work orders, and direct bank settlement.
            </p>
          </div>
          <Link
            to="/career-guides/temporary-vs-contract-jobs"
            className="px-5 py-2.5 rounded-xl border border-neutral-300 hover:border-neutral-400 bg-white text-neutral-800 font-bold text-xs uppercase tracking-wider transition whitespace-nowrap"
          >
            Read Career Guide
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 px-4 sm:px-8 text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900">TermJobs</span>
            <span>•</span>
            <span>Flexible Employment & Contract Staffing Platform</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <Link to="/employers" className="hover:text-neutral-900 transition">For Employers</Link>
            <Link to="/resources" className="hover:text-neutral-900 transition">Resources & Trust</Link>
            <Link to="/privacy-policy" className="hover:text-neutral-900 transition">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-neutral-900 transition">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
