import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import PublicJobBoard from '../components/PublicJobBoard';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import { ArrowLeft, Briefcase, Sparkles, LogIn } from 'lucide-react';
import logo from '../assets/termjobs-logo.png';

export default function OpenRolesPage() {
  const navigate = useNavigate();
  const { candidateUser, logout } = useCandidateAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      <SEOHead
        title="Open Roles & Contract Opportunities — TermJobs"
        description="Browse published contract and technical roles on the TermJobs platform. Fast-track screening, transparent rates, and direct hiring matches."
        canonicalUrl="https://termjobs.vercel.app/open-roles"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to Overview</span>
            </Link>

            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

            <Link to="/" className="flex items-center gap-2.5 group">
              <img src={logo} alt="TermJobs Logo" className="h-7 w-7 object-contain" />
              <span className="text-xs font-extrabold tracking-[0.25em] text-white uppercase group-hover:text-emerald-400 transition-colors">
                TermJobs
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE REQUISITIONS</span>
            </span>

            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-colors"
            >
              <LogIn size={13} />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Job Board Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <PublicJobBoard
          candidateProfile={candidateUser}
          onCandidateLogout={logout}
          onBackToHome={() => navigate('/')}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 px-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-400">TermJobs</span>
            <span>·</span>
            <span>Autonomous Contract Workforce Platform</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400 text-xs">
            <Link to="/" className="hover:text-white transition">Platform Overview</Link>
            <Link to="/open-roles" className="hover:text-white transition">Open Roles</Link>
            <Link to="/interview/login" className="hover:text-white transition">Interview Portal</Link>
            <Link to="/login" className="hover:text-white transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
