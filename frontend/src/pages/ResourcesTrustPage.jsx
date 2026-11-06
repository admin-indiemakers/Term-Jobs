import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Lock, Scale, CheckCircle2, ChevronRight, 
  ArrowRight, ShieldCheck, Sparkles, Check, HelpCircle, FileText
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function ResourcesTrustPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Resources & Trust Center | TermJobs',
    url: 'https://www.termjobs.in/resources',
    description: 'Access the TermJobs Resources & Trust Center: Career Guide, Privacy Policy, Terms & Conditions, and Platform Rules.',
  };

  const trustResources = [
    {
      id: 'career-guide',
      title: 'Career Guide',
      tag: 'Career Insights',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700',
      icon: BookOpen,
      description: 'An authoritative comparison between temporary, contract, and permanent employment. Understand compensation benchmarks, tax classifications, and milestone expectations.',
      features: [
        'Contract vs Temporary Work tenure and legal status breakdown',
        'Hourly, milestone, and monthly compensation frameworks',
        'Tax treatment under Indian law (Section 194J TDS deductions)',
        'Strategic roadmaps for converting contract engagements to permanent roles',
      ],
      link: '/career-guides/temporary-vs-contract-jobs',
      ctaText: 'Read Career Guide',
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      tag: 'Data Protection',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      icon: Lock,
      description: 'How TermJobs protects, stores, and governs candidate resumes, contact details, identity documentation, and employer hiring records under strict data security principles.',
      features: [
        'End-to-end encryption for candidate profile documents & resumes',
        'Strict zero-resale policy: candidate data is never sold or brokered',
        'Candidate consent required prior to submission to any enterprise employer',
        'Full data portability and account deletion request protocols',
      ],
      link: '/privacy-policy',
      ctaText: 'View Privacy Policy',
    },
    {
      id: 'terms-and-conditions',
      title: 'Terms & Conditions',
      tag: 'Legal Framework',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      icon: Scale,
      description: 'The formal service terms governing candidate applications, employer requisitions, digital signing, timesheet clearing, and mutual platform commitments.',
      features: [
        'Legally binding digital employment agreements and work orders',
        'Clear terms governing contract duration, deliverables, and notice periods',
        'Automated timesheet verification and dispute resolution mechanisms',
        'Platform service-level commitments for candidates and client organizations',
      ],
      link: '/terms-and-conditions',
      ctaText: 'Read Terms & Conditions',
    },
    {
      id: 'platform-rules',
      title: 'Platform Rules',
      tag: 'Community Standards',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      iconBg: 'bg-purple-100 text-purple-700',
      icon: CheckCircle2,
      description: 'Our behavioral standards and non-circumvention rules ensuring fair engagement, verified credential integrity, and transparent communication across all stakeholders.',
      features: [
        'Truth in hiring: verified candidate identities and genuine job specifications',
        'Fair recruitment standards with zero discrimination or fraudulent fees',
        'Anti-circumvention policies protecting candidates and registered agency vendors',
        'Responsible AI usage guidelines ensuring human oversight on all hiring decisions',
      ],
      link: '/platform-rules',
      ctaText: 'Review Platform Rules',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] text-neutral-900 selection:bg-neutral-200 selection:text-neutral-900">
      <SEOHead
        title="Resources & Trust – Career Guide, Privacy, Terms & Platform Rules | TermJobs"
        description="TermJobs Resources & Trust Center: Authoritative career guidance, privacy commitments, platform terms, and community standards."
        canonicalUrl="https://www.termjobs.in/resources"
        jsonLd={jsonLd}
      />

      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link to="/" className="font-semibold text-neutral-900 hover:text-emerald-700 transition">TermJobs</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-700 font-medium">Resources & Trust</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/find-jobs"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition hidden sm:inline-block font-medium"
          >
            Find Jobs
          </Link>
          <Link
            to="/employers"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition hidden sm:inline-block font-medium"
          >
            For Employers
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
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Governance & Knowledge Center</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 mb-4 leading-tight">
          Resources & Trust Center
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mb-8 leading-relaxed">
          Access authoritative career guidance, examine our privacy frameworks, review platform terms, and understand the standards that govern the TermJobs contingent staffing ecosystem.
        </p>

        {/* Trust Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex items-center gap-3 shadow-2xs">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-neutral-800">256-Bit Data Encryption</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex items-center gap-3 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold text-neutral-800">Verified Corporate Requisitions</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white border border-neutral-200 flex items-center gap-3 shadow-2xs">
            <Scale className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-neutral-800">Digital Agreements & Audits</span>
          </div>
        </div>
      </section>

      {/* 4 Cards Grid: Career Guide, Privacy Policy, Terms & Conditions, Platform Rules */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 mb-1.5">
            Governance & Documentation Directory
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600">
            Select a resource below to read comprehensive guides, legal terms, and operational frameworks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trustResources.map((res) => {
            const Icon = res.icon;
            return (
              <div
                key={res.id}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-xl ${res.iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${res.badgeClass}`}>
                      {res.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-neutral-950 mb-2">
                      {res.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      {res.description}
                    </p>
                  </div>

                  <div className="pt-2 space-y-2 border-t border-neutral-100">
                    {res.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-neutral-700">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={res.link}
                  className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-950 text-neutral-900 hover:text-white font-semibold text-xs tracking-wider transition group"
                >
                  <span>{res.ctaText}</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Support / Help Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0">
              <HelpCircle size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-900">Have questions about contracts, privacy, or compliance?</div>
              <div className="text-xs text-neutral-500">Our trust and compliance desk assists candidates and employers.</div>
            </div>
          </div>
          <a
            href="mailto:Termjobsofficial@gmail.com"
            className="text-xs font-bold text-neutral-900 hover:text-emerald-700 underline underline-offset-4 transition whitespace-nowrap"
          >
            Contact Legal & Trust Desk →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 px-4 sm:px-8 text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900">TermJobs</span>
            <span>•</span>
            <span>Governance, Security & Career Guidance</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <Link to="/find-jobs" className="hover:text-neutral-900 transition">Find Jobs</Link>
            <Link to="/employers" className="hover:text-neutral-900 transition">For Employers</Link>
            <Link to="/open-roles" className="hover:text-neutral-900 transition">Open Roles</Link>
            <Link to="/privacy-policy" className="hover:text-neutral-900 transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
