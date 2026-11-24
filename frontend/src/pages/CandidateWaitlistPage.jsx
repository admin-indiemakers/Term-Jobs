import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Upload } from 'lucide-react';
import CandidateAuthModal from '../components/CandidateAuthModal';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import SEOHead from '../components/SEOHead';

export default function CandidateWaitlistPage() {
  const navigate = useNavigate();
  const candidateAuth = useCandidateAuth();
  const [authOpen, setAuthOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const joinCandidatePool = async (candidate) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    const current = candidateAuth.candidateUser || candidate || {};
    const name = current.candidate_name || current.name || '';
    const email = current.candidate_email || current.email || '';
    const candidateId = current.id || current.candidate_id || '';
    const title = current.candidate_title || current.title || '';

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('title', title);
    formData.append('skills', current.skills ? (Array.isArray(current.skills) ? current.skills.join(', ') : String(current.skills)) : '');
    if (candidateId) formData.append('candidate_id', String(candidateId));

    try {
      const response = await fetch('/api/public/talent-pool/join', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || 'Could not add you to the candidate pool.');
      }
      navigate('/candidate-pool/added', {
        replace: true,
        state: { poolSubmitted: true },
      });
    } catch (submitError) {
      setError(submitError.message || 'Could not add you to the candidate pool.');
      setAuthOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh overflow-hidden bg-[#f5f5f2] text-neutral-950">
      <SEOHead
        title="Join the Candidate Waiting List — TermJobs"
        description="Join the verified TermJobs candidate pool and add your resume for contract and permanent opportunities."
        noindex
      />

      <header className="relative z-20 flex h-20 items-center justify-between border-b border-neutral-200/80 px-5 sm:px-10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft size={17} />
          Back
        </button>
        <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 sm:flex">
          <ShieldCheck size={15} />
          Verified talent network
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100dvh-5rem)] max-w-[1440px] grid-cols-1 lg:grid-cols-[1.12fr_.88fr]">
        <div className="relative flex flex-col justify-center px-5 py-14 sm:px-10 lg:px-16 xl:px-24">
          <div className="absolute right-6 top-6 hidden h-52 w-52 items-center justify-center rounded-full border border-neutral-300/70 bg-white/70 shadow-[0_18px_50px_-35px_rgba(0,0,0,.45)] sm:flex xl:right-12 xl:top-10">
            <img
              src="/logo.png"
              alt="TermJobs"
              className="h-[58%] w-[58%] object-contain"
            />
          </div>
          <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
            <span className="h-px w-8 bg-neutral-400" />
            Candidate waiting list
          </p>
          <h1 className="max-w-2xl text-[clamp(3.25rem,7vw,7rem)] font-bold leading-[0.88] tracking-[-0.065em]">
            Your next role,
            <br />
            <span className="text-neutral-400">on your terms.</span>
          </h1>
          <p className="mt-8 max-w-lg text-base leading-7 text-neutral-600 sm:text-lg">
            Add your resume and join our verified candidate pool. We match your skills with contract and permanent opportunities.
          </p>

          <div className="mt-12 grid max-w-xl gap-6 sm:grid-cols-3">
            {[
              ['01', 'Create profile'],
              ['02', 'Add your resume'],
              ['03', 'Enter candidate pool'],
            ].map(([number, label]) => (
              <div key={number} className="border-t border-neutral-300 pt-4">
                <p className="text-xs font-bold text-neutral-400">{number}</p>
                <p className="mt-2 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-center border-t border-neutral-800 bg-[#111213] px-5 py-14 lg:border-l lg:border-t-0">
          <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(#fff_0.7px,transparent_0.7px)] [background-size:18px_18px]" />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#fbfbf9] p-7 text-neutral-950 shadow-[0_32px_90px_-28px_rgba(0,0,0,.9)] sm:p-9">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Step 1 of 1</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Join the waiting list</h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-neutral-100">
                <Upload size={19} />
              </div>
            </div>

            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6 text-neutral-600">
                Sign in with Google or create a profile with email and upload a PDF or DOCX resume.
              </p>
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {submitting ? 'Adding you…' : 'Continue'}
            </button>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
              Your profile and resume are used only to match you with relevant opportunities.
            </p>
          </div>
        </div>
      </section>

      <CandidateAuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={joinCandidatePool}
        initialTab="register"
      />
    </main>
  );
}
