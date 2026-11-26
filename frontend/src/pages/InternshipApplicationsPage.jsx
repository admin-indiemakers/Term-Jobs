import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import InternshipApplications from '../components/InternshipApplications';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';

export default function InternshipApplicationsPage() {
  const { token } = useAuth();

  return (
    <main className="min-h-dvh bg-[#f4f4f1] text-neutral-950">
      <SEOHead title="Internship Applications | TermJobs" noindex />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10">
        <Link to="/statistics" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-950">
          <ArrowLeft size={16} aria-hidden="true" />
          Admin statistics
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Internship applications</h1>
        <InternshipApplications key={token} token={token} heading="Form responses" />
      </div>
    </main>
  );
}
