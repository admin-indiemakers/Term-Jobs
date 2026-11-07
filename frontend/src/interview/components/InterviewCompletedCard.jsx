import React, { useEffect } from 'react';
import {
  Briefcase,
  Building2,
  Share2,
  Check,
  Home,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function InterviewCompletedCard({
  round,
  invitationToken = '',
  candidateName = '',
  onBack,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Interview Completed · TermJobs';
  }, []);

  const displayCandidateName =
    round?.candidate_name ||
    candidateName ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('name')
      : '') ||
    'Candidate';

  const positionTitle =
    round?.requisition_title ||
    round?.round_name ||
    'UI Developer';

  const companyName =
    round?.company_name ||
    'Zensbee Technologies Pvt Ltd';

  const handleReturnToOpenRoles = () => {
    if (onBack) {
      onBack();
      return;
    }

    const email = round?.candidate_email || 'mohammedhashil2018@gmail.com';
    const cName = displayCandidateName;
    const token = invitationToken || round?.candidate_token || '';

    // Auto-authenticate candidate session so OpenRoles interview view opens seamlessly
    try {
      if (email) {
        localStorage.setItem('candidate_email', email);
        const existing = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
        localStorage.setItem(
          'candidate_profile_user',
          JSON.stringify({
            ...existing,
            candidate_email: email,
            email: email,
            candidate_name: existing.candidate_name || cName,
            name: existing.name || cName,
          })
        );
      }
      sessionStorage.setItem(
        'termjobs_candidate_session',
        JSON.stringify({
          candidate_token: token,
          candidate_email: email,
          candidate_name: cName,
          id: round?.id || '',
        })
      );
    } catch (_) {}

    navigate('/open-roles');
  };

  return (
    <div className="w-full min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col items-center justify-center p-4 sm:p-8 select-none relative overflow-hidden font-sans">
      {/* Soft emerald ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-100/50 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-[450px] h-[350px] bg-emerald-100/35 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-[450px] h-[350px] bg-emerald-100/35 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Centered Card Container */}
      <div className="w-full max-w-[760px] bg-white border border-zinc-200/80 rounded-[32px] sm:rounded-[36px] py-10 px-6 sm:py-14 sm:px-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center text-center">
        {/* Top Checkmark Glowing Circle */}
        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-emerald-100/80 flex items-center justify-center mb-5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center text-emerald-500 shadow-xs">
            <Check className="w-5 h-5 stroke-[2.75]" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
          Interview Completed!
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-zinc-500 font-normal max-w-lg mx-auto mt-2.5 leading-relaxed">
          Thank you, {displayCandidateName}. Your interview has been successfully submitted and is now under review by our hiring team.
        </p>

        {/* Details 3-Column Box */}
        <div className="w-full max-w-[660px] bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/80 p-4 sm:p-5 mt-7 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left items-center">
          {/* Position */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shrink-0">
              <Briefcase className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-500 font-medium">Position</div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 truncate">
                {positionTitle}
              </div>
            </div>
          </div>

          {/* Company */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shrink-0">
              <Building2 className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-500 font-medium">Company</div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 truncate">
                {companyName}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shrink-0">
              <Share2 className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-500 font-medium">Status</div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-xs mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Under Review</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button: Return to Open Roles */}
        <button
          type="button"
          onClick={handleReturnToOpenRoles}
          className="mt-8 px-7 py-3 rounded-full bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Return to Open Roles</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
