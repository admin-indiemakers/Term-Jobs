import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function CandidatePoolAdded() {
  const location = useLocation();
  if (!location.state?.poolSubmitted) return <Navigate to="/" replace />;
  return (
    <main className="min-h-dvh bg-[#f7f7f5] flex items-center justify-center px-5 py-12">
      <SEOHead title="Added to Candidate Pool — TermJobs" noindex />
      <section className="w-full max-w-xl rounded-[32px] border border-neutral-200 bg-white p-8 sm:p-12 text-center shadow-sm">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">Candidate talent network</p>
        <CheckCircle2 className="mx-auto my-8 h-16 w-16 text-emerald-600" aria-hidden="true" />
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Added to Candidate Pool</h1>
        <p className="mt-5 text-sm leading-relaxed text-neutral-600">Your profile and résumé have been submitted successfully. We’ll contact you by email about matching opportunities.</p>
        <Link to="/" className="mt-8 inline-flex rounded-full bg-neutral-900 px-7 py-3 text-sm font-bold text-white hover:bg-neutral-700">Back to home</Link>
      </section>
    </main>
  );
}
