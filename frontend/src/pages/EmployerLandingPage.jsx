import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Users, ShieldCheck, Clock, FileCheck, Layers, 
  ArrowRight, CheckCircle2, ChevronRight, Sparkles, BarChart3, 
  Lock, Check, Briefcase, Video, FileText, DollarSign, UserCheck
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function EmployerLandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'TermJobs Contract Workforce Management & Staffing Platform',
    provider: {
      '@type': 'Organization',
      name: 'TermJobs',
      url: 'https://www.termjobs.in/',
      logo: 'https://www.termjobs.in/logo.png',
      email: 'Termjobsofficial@gmail.com',
    },
    description: 'Enterprise Vendor Management System (VMS) and contract staffing platform. Source vetted contractors, automate interview scheduling, manage digital timesheets, and clear vendor invoices.',
    serviceType: 'Contract Workforce Management & Staffing Vendor Management',
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };

  const employerPillars = [
    {
      id: 'hiring-solutions',
      title: 'Hiring Solutions',
      tag: 'AI Screening & Sourcing',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700',
      icon: Sparkles,
      description: 'Streamline contingent talent acquisition with intelligent candidate matching, AI-assisted screening agents, and built-in WebRTC video interview assessment rooms.',
      features: [
        'AI Candidate Screening with automated skill-to-requisition matching',
        'Built-in WebRTC Video Interview Rooms with automated evaluation summaries',
        'Pre-vetted candidate bench with verified background documentation',
        'Accelerate candidate time-to-hire from weeks to under 4 business days',
      ],
      actions: [
        { text: 'Explore Candidate Bench', link: '/open-roles', primary: true },
        { text: 'Post a Requisition', link: '/join/hiring-manager', primary: false },
      ],
    },
    {
      id: 'employer-portal',
      title: 'Employer Portal',
      tag: 'Role-Based Workspace',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      icon: Building2,
      description: 'A unified enterprise operating system providing tailored, secure workspaces for Hiring Managers, Executive Directors, Procurement Leads, and Finance Officers.',
      features: [
        'Hiring Manager Portal: Candidate reviews, interview notes, and fast-track offers',
        'Director Portal: Department budget thresholds, headcount, and MSA sign-offs',
        'Procurement Portal: Agency vendor bench management and master contracts',
        'Finance Portal: One-click timesheet clearance, PO matching, and invoice audit',
      ],
      actions: [
        { text: 'Sign In to Portal', link: '/login', primary: true },
        { text: 'Create Employer Account', link: '/join/hiring-manager', primary: false },
      ],
    },
    {
      id: 'staffing-contracting',
      title: 'Staffing & Contracting',
      tag: 'VMS & Compliance',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      icon: Layers,
      description: 'Complete Vendor Management System (VMS) to eliminate rogue agency markups, enforce standard rate caps, generate digital work orders, and settle consolidated invoices.',
      features: [
        'Centralized Agency Bench with transparent markup controls and rate caps',
        'Enforceable Digital Work Orders detailing scope, tenure, and billing schedules',
        'Weekly Milestone Timesheets with automated manager approval workflows',
        'Compliant tax billing and single consolidated clearinghouse for all vendors',
      ],
      actions: [
        { text: 'VMS Staffing Solutions', link: '/solutions/contract-staffing', primary: true },
        { text: 'Vendor Partner Guidelines', link: '/platform-rules', primary: false },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] text-neutral-900 selection:bg-neutral-200 selection:text-neutral-900">
      <SEOHead
        title="For Employers – Hiring Solutions, Employer Portal & Staffing | TermJobs"
        description="TermJobs Employer Platform: Modern Hiring Solutions, unified Employer Portal, and enterprise Vendor Management System (VMS) for compliant contract staffing."
        canonicalUrl="https://www.termjobs.in/employers"
        jsonLd={jsonLd}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link to="/" className="font-semibold text-neutral-900 hover:text-emerald-700 transition">TermJobs</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-700 font-medium">For Employers</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/find-jobs"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition hidden sm:inline-block font-medium"
          >
            Find Jobs
          </Link>
          <Link
            to="/resources"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition hidden sm:inline-block font-medium"
          >
            Resources & Trust
          </Link>
          <Link
            to="/login"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 transition font-medium"
          >
            Portal Sign In
          </Link>
          <Link
            to="/join/hiring-manager"
            className="text-xs px-3.5 py-1.5 rounded-lg bg-neutral-950 text-white font-semibold uppercase tracking-wider hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-xs"
          >
            <span>Register Account</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-neutral-200 text-neutral-800 mb-5 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Contingent Workforce Platform & VMS</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 mb-4 leading-tight">
          Modern Staffing & Employer Solutions
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mb-8 leading-relaxed">
          Unify requisition drafting, candidate screening, digital work orders, agency vendor management, and automated timesheet clearing into one transparent, enterprise-grade operating system.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/join/hiring-manager"
            className="px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs tracking-wider uppercase transition shadow-xs flex items-center gap-2"
          >
            <span>Start Hiring Contractors</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            to="/login"
            className="px-5 py-3 rounded-xl bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50 font-semibold text-xs tracking-wider uppercase transition shadow-2xs"
          >
            Access Employer Portal
          </Link>
        </div>
      </section>

      {/* 3 Core Pillars: Hiring Solutions | Employer Portal | Staffing & Contracting */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 mb-1.5">
            Employer Capabilities
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600">
            Tailored tools for fast hiring, unified stakeholder governance, and transparent staffing administration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {employerPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-xl ${pillar.iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${pillar.badgeClass}`}>
                      {pillar.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-neutral-950 mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>

                  <div className="pt-2 space-y-2 border-t border-neutral-100">
                    {pillar.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-neutral-700">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex flex-col gap-2">
                  {pillar.actions.map((act, i) => (
                    <Link
                      key={i}
                      to={act.link}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wider transition ${
                        act.primary
                          ? 'bg-neutral-950 hover:bg-neutral-800 text-white shadow-2xs'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                      }`}
                    >
                      <span>{act.text}</span>
                      <ArrowRight size={13} />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Multi-Stakeholder Governance Details */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-xs">
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-950 mb-1">
              Multi-Stakeholder Governance Across Your Organization
            </h2>
            <p className="text-xs text-neutral-600">
              TermJobs connects every internal department with dedicated tools and automated approval handoffs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Users size={14} className="text-blue-600" />
                <span>Hiring Managers</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Review ranked candidate submissions, run video interviews, and fast-track contractor deployment.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Building2 size={14} className="text-emerald-600" />
                <span>Directors</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Approve budget ceilings, authorize agency vendor master agreements, and oversee team headcount.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-amber-600" />
                <span>Procurement</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Maintain a pre-qualified vendor bench, enforce rate caps, and ensure compliance MSAs are locked.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <DollarSign size={14} className="text-purple-600" />
                <span>Finance & AP</span>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                One-click invoice clearance matching approved weekly timesheets directly against authorized purchase orders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 px-4 sm:px-8 text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900">TermJobs</span>
            <span>•</span>
            <span>Contract Staffing & Vendor Management System</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <Link to="/find-jobs" className="hover:text-neutral-900 transition">Find Jobs</Link>
            <Link to="/resources" className="hover:text-neutral-900 transition">Resources & Trust</Link>
            <Link to="/open-roles" className="hover:text-neutral-900 transition">Open Roles</Link>
            <Link to="/privacy-policy" className="hover:text-neutral-900 transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
