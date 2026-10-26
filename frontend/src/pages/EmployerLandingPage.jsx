import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Users, ShieldCheck, Clock, FileCheck, Layers, 
  ArrowRight, CheckCircle2, ChevronRight, Sparkles, BarChart3, Lock 
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

  return (
    <div className="min-h-screen bg-[#08090b] text-white selection:bg-neutral-800 selection:text-white">
      <SEOHead
        title="Contract Staffing & Workforce Management Platform | TermJobs"
        description="Streamline contract hiring with TermJobs Vendor Management System (VMS). AI candidate screening, verified staffing agencies, digital work orders, and automated timesheet clearing."
        canonicalUrl="https://www.termjobs.in/employers"
        jsonLd={jsonLd}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-[#08090b]/90 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link to="/" className="hover:text-white transition">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-neutral-200">For Employers & Staffing Partners</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white transition"
          >
            Portal Sign In
          </Link>
          <Link
            to="/join/hiring-manager"
            className="text-xs px-3.5 py-1.5 rounded-lg bg-white text-black font-semibold uppercase tracking-wider hover:bg-neutral-200 transition"
          >
            Create Employer Account
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-12 sm:pt-20 pb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900 border border-neutral-800 text-neutral-300 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Vendor Management System (VMS) & Contract Staffing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Modern Contract Workforce Management & Staffing Platform
        </h1>

        <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mb-8 leading-relaxed">
          Unify requisition drafting, agency vendor management, candidate screening, digital work orders, automated timesheets, and compliant invoice clearing in one secure operating system.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/join/hiring-manager"
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition shadow-lg flex items-center gap-2"
          >
            <span>Start Hiring Contractors</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="px-5 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition"
          >
            Access Director / Manager Portal
          </Link>
        </div>
      </section>

      {/* Feature Grid: Core VMS Capabilities */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 border-t border-neutral-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
            Designed for Modern Flexible Teams & Staffing Ecosystems
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Eliminate fragmented email chains, spreadsheet tracking, and rogue agency markups. TermJobs introduces transparency across the entire contingent workforce lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Centralized Requisitions</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Draft role specifications once with AI-powered competency templates. Route requisitions to partner agencies and verified independent talent with synchronized rate caps.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Automated Timesheets</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Contractors log weekly hours with digital milestone approvals. Managers review with one click, eliminating discrepancy disputes and payroll delays.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Digital Work Orders</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Generate transparent work orders detailing scope of work, contract tenure, rate structures, and compliance terms before contractor onboarding starts.
            </p>
          </div>

        </div>
      </section>

      {/* Role-Based Workflows (Hiring Managers, Directors, Procurement, Finance) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 border-t border-neutral-800/80">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-6">
          Enterprise Multi-Stakeholder Governance
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-xl bg-neutral-900/30 border border-neutral-800">
            <strong className="text-sm font-semibold text-white block mb-1">For Hiring Managers</strong>
            <p className="text-neutral-400 leading-relaxed">
              Review AI-ranked candidate profiles, conduct built-in WebRTC video interviews, and fast-track contractor deployment in days rather than months.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900/30 border border-neutral-800">
            <strong className="text-sm font-semibold text-white block mb-1">For Executive Directors</strong>
            <p className="text-neutral-400 leading-relaxed">
              Set role budget thresholds, approve or modify vendor agreements, and track active team allocations across all ongoing organizational initiatives.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900/30 border border-neutral-800">
            <strong className="text-sm font-semibold text-white block mb-1">For Procurement & Legal</strong>
            <p className="text-neutral-400 leading-relaxed">
              Manage master service agreements (MSAs), enforce compliance checklists, and maintain a qualified vendor bench without rogue contracting.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900/30 border border-neutral-800">
            <strong className="text-sm font-semibold text-white block mb-1">For Finance & AP Teams</strong>
            <p className="text-neutral-400 leading-relaxed">
              Consolidated billing clearinghouses match approved timesheets directly against authorized purchase orders and tax-compliant invoices.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA & Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950/80 py-12 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Ready to optimize contract staffing?</h3>
            <p className="text-xs text-neutral-400">Join leading organizations building flexible, compliant teams on TermJobs.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/join/hiring-manager"
              className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition"
            >
              Sign Up as Employer
            </Link>
            <Link
              to="/jobs/contract"
              className="px-5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition"
            >
              Explore Public Roles
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
