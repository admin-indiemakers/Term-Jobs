import React, { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { interviewApi } from '../services/interviewApi';

export function InterviewCompletedCard({ round, invitationToken = '', onBack }) {
  const navigate = useNavigate();
  const [candidateRounds, setCandidateRounds] = useState([]);

  useEffect(() => {
    const ident = invitationToken || round?.candidate_token || round?.candidate_email;
    if (ident) {
      interviewApi
        .getCandidatePortal({
          token: invitationToken || round?.candidate_token,
          email: round?.candidate_email,
        })
        .then((res) => {
          if (res?.rounds) {
            setCandidateRounds(res.rounds);
          }
        })
        .catch(() => {});
    }
  }, [round?.id, round?.candidate_email, invitationToken]);

  const companyName = round?.company_name || round?.vendor_company_name || 'Bearitt';
  const companyInitial = (companyName || 'B').trim()[0].toUpperCase();
  const positionTitle = round?.requisition_title || round?.round_name || 'Backend Developer';
  const roundName = round?.round_name || round?.round_type ? `${round.round_name || round.round_type} Interview` : 'HR Interview';
  const durationMinutes = round?.duration_minutes || 45;

  // Next round name detection from candidate submission rounds
  const nextRound = candidateRounds.find(
    (r) => r.id !== round?.id && (r.status === 'Scheduled' || r.status === 'Upcoming' || r.status === 'In Progress')
  );
  const nextRoundName = nextRound?.round_name || 'Technical Interview';

  // Format Date (e.g., "Thu, Oct 16, 2026")
  const formatDate = () => {
    try {
      const rawDate = round?.scheduled_date || round?.created_at;
      if (!rawDate) return 'Thu, Oct 16, 2026';
      if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [y, m, d] = rawDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return String(rawDate);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return 'Thu, Oct 16, 2026';
    }
  };

  // Format Time Range (e.g., "09:30 AM – 10:15 AM")
  const formatTimeRange = () => {
    try {
      const rawTime = round?.scheduled_time || '09:30 AM';
      // If already a range formatted string
      if (rawTime.includes('–') || rawTime.includes('-')) return rawTime;

      // Parse time components
      const timeParts = rawTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!timeParts) return rawTime;

      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const ampm = timeParts[3] ? timeParts[3].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      const formatTime = (d) => {
        let h = d.getHours();
        const m = d.getMinutes().toString().padStart(2, '0');
        const period = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h.toString().padStart(2, '0')}:${m} ${period}`;
      };

      return `${formatTime(startDate)} – ${formatTime(endDate)}`;
    } catch (_) {
      return '09:30 AM – 10:15 AM';
    }
  };

  const handleDashboard = () => {
    if (onBack) {
      onBack();
      return;
    }

    const email = round?.candidate_email || 'mohammedhashil2018@gmail.com';
    const candidateName = round?.candidate_name || 'Mohammed Hashil';
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
            candidate_name: existing.candidate_name || candidateName,
            name: existing.name || candidateName,
          })
        );
      }
      sessionStorage.setItem(
        'termjobs_candidate_session',
        JSON.stringify({
          candidate_token: token,
          candidate_email: email,
          candidate_name: candidateName,
          id: round?.id || '',
        })
      );
    } catch (_) {}

    const searchParams = new URLSearchParams();
    searchParams.set('tab', 'interview');
    if (email) searchParams.set('email', email);
    if (token) searchParams.set('token', token);
    navigate(`/open-roles?${searchParams.toString()}`);
  };

  return (
    <div className="w-full min-h-screen bg-[#090B10] text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -top-32 left-1/2 -translate-x-1/2" />
      <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none -bottom-32 left-1/2 -translate-x-1/2" />

      {/* Main Centered Card Container */}
      <div className="w-full max-w-[620px] bg-[#0E121C]/95 border border-white/[0.08] rounded-[28px] p-6 sm:p-9 shadow-[0_20px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Top Checkmark Glowing Circle */}
        <div className="relative flex items-center justify-center mb-1">
          {/* Decorative Sparkle Stars */}
          <span className="absolute -top-1 left-[34%] text-emerald-400 text-xs animate-pulse">✦</span>
          <span className="absolute top-2 right-[33%] text-teal-300 text-[10px] animate-pulse">✧</span>
          <span className="absolute bottom-2 left-[32%] text-emerald-300 text-[10px]">✧</span>

          {/* Concentric metallic ring */}
          <div className="w-20 h-20 rounded-full p-2 bg-[#141B26] border border-emerald-500/30 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.3)]">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-inner">
              <Check size={28} className="stroke-[3]" />
            </div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl sm:text-3xl font-black text-white text-center mt-3 tracking-tight">
          Interview <span className="text-white">Completed!</span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 text-center mt-1 font-normal">
          Thank you for attending the interview.
        </p>

        {/* Card 1: Position & Meeting Details */}
        <div className="bg-[#121623] border border-white/[0.08] rounded-2xl p-4 sm:p-5 mt-6 shadow-md">
          {/* Header Row: Company Avatar + Name + Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-black border border-white/15 flex items-center justify-center text-white font-black text-lg shadow-inner shrink-0">
              {companyInitial}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-white truncate">{companyName}</h3>
              <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">{positionTitle}</p>
            </div>
          </div>

          {/* Details 3-Column Grid */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-4 pt-4 border-t border-white/[0.06]">
            {/* Col 1: Date */}
            <div className="flex items-start gap-2 min-w-0">
              <Calendar size={16} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10.5px] text-zinc-400 font-medium">Date</div>
                <div className="text-xs font-bold text-zinc-100 mt-0.5 truncate">{formatDate()}</div>
              </div>
            </div>

            {/* Col 2: Time */}
            <div className="flex items-start gap-2 min-w-0">
              <Clock size={16} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10.5px] text-zinc-400 font-medium">Time</div>
                <div className="text-xs font-bold text-zinc-100 mt-0.5 truncate">{formatTimeRange()}</div>
                <div className="text-[10px] text-zinc-400 truncate">({durationMinutes} minutes)</div>
              </div>
            </div>

            {/* Col 3: Round */}
            <div className="flex items-start gap-2 min-w-0">
              <FileText size={16} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10.5px] text-zinc-400 font-medium mb-1">Round</div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 truncate inline-block">
                  {roundName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Under Review Notice Box */}
        <div className="bg-[#101524] border border-blue-500/20 rounded-2xl p-4 sm:p-4.5 mt-3.5 flex items-start gap-3.5 shadow-md">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            {/* Document with search icon */}
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 15l2 2m0 0l-2-2m2 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white">Your interview is under review</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
              The interviewer is currently reviewing your responses and feedback. We will notify you once the evaluation is complete.
            </p>
          </div>
        </div>

        {/* Card 3: 3-Step Horizontal Stepper / Progress Tracker */}
        <div className="mt-6 px-2 sm:px-6">
          <div className="flex items-center justify-between relative">
            {/* Step 1: HR Interview (Completed) */}
            <div className="flex flex-col items-center text-center z-10 min-w-[90px]">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                <Check size={14} className="stroke-[3]" />
              </div>
              <span className="text-white text-xs font-bold mt-2 truncate max-w-[100px]">
                {roundName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1">
                Completed
              </span>
            </div>

            {/* Connecting Line 1 */}
            <div className="flex-1 border-t-2 border-dashed border-emerald-500/40 mx-2 -mt-5" />

            {/* Step 2: Technical Interview (Next Step) */}
            <div className="flex flex-col items-center text-center z-10 min-w-[90px]">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border-2 border-blue-500 text-blue-400 flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                2
              </div>
              <span className="text-white text-xs font-bold mt-2 truncate max-w-[100px]">
                {nextRoundName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 mt-1">
                Next Step
              </span>
            </div>

            {/* Connecting Line 2 */}
            <div className="flex-1 border-t-2 border-dashed border-zinc-700 mx-2 -mt-5" />

            {/* Step 3: Final Decision (Pending) */}
            <div className="flex flex-col items-center text-center z-10 min-w-[90px]">
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <span className="text-zinc-400 text-xs font-medium mt-2 truncate max-w-[100px]">
                Final Decision
              </span>
              <span className="text-[10.5px] font-medium text-zinc-500 mt-1">
                Pending
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Action Button */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleDashboard}
            className="w-full max-w-xs py-3 px-6 rounded-full bg-white hover:bg-zinc-100 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl active:scale-95"
          >
            <span>Back to Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
