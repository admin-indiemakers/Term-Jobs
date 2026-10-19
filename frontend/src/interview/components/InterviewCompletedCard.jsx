import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Check,
  ArrowRight,
  Bot,
  Sparkles,
  Home,
  CheckCircle2,
  Video,
  BarChart2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { interviewApi } from '../services/interviewApi';
import { isAiInterviewRound } from '../utils/interviewMode';
import termjobsLogo from '../../assets/termjobs-logo.png';

export function InterviewCompletedCard({ round, invitationToken = '', onBack }) {
  const navigate = useNavigate();
  const [candidateRounds, setCandidateRounds] = useState([]);

  const isAi =
    window.location.pathname.startsWith('/interview/ai') ||
    isAiInterviewRound(round) ||
    String(round?.round_type || '').toUpperCase() === 'AI' ||
    /AI/i.test(String(round?.round_name || ''));

  useEffect(() => {
    if (isAi) {
      document.title = 'AI Interview Completed · TermJobs';
    } else {
      document.title = 'Interview Completed · TermJobs';
    }
  }, [isAi]);

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
  const positionTitle = round?.requisition_title || round?.round_name || 'Senior Product Designer';

  // Sanitize round name to prevent duplicate "AI Interview Interview"
  const rawRoundName = round?.round_name || (round?.round_type ? `${round.round_type} Interview` : (isAi ? 'AI Interview' : 'HR Interview'));
  const roundName = isAi
    ? 'AI Autonomous Assessment'
    : (rawRoundName.toLowerCase().includes('interview') ? rawRoundName : `${rawRoundName} Interview`);

  const durationMinutes = round?.duration_minutes || 45;

  // Next round name detection from candidate submission rounds
  const nextRound = candidateRounds.find(
    (r) => r.id !== round?.id && (r.status === 'Scheduled' || r.status === 'Upcoming' || r.status === 'In Progress')
  );
  const nextRoundName = isAi
    ? (nextRound?.round_name || 'Hiring Team Review')
    : (nextRound?.round_name || 'Technical Interview');

  // Format Date (e.g., "Mon, Oct 19, 2026")
  const formatDate = () => {
    try {
      const rawDate = round?.scheduled_date || round?.created_at;
      if (!rawDate) return 'Mon, Oct 19, 2026';
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
      return 'Mon, Oct 19, 2026';
    }
  };

  // Format Time Range (e.g., "09:30 AM – 10:15 AM")
  const formatTimeRange = () => {
    if (isAi) return 'Immediate / On-Demand';
    try {
      const rawTime = round?.scheduled_time || '09:30 AM';
      if (rawTime.includes('–') || rawTime.includes('-')) return rawTime;

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

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="w-full min-h-screen bg-[#090B10] text-white flex flex-col items-center justify-center py-3 px-3 sm:py-5 sm:px-6 select-none relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -top-32 left-1/2 -translate-x-1/2" />
      <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none -bottom-32 left-1/2 -translate-x-1/2" />

      {/* Main Centered Card Container - Expanded width/length, compact vertical height */}
      <div className="w-full max-w-[760px] bg-[#0E121C]/95 border border-white/[0.08] rounded-2xl sm:rounded-3xl py-4 px-5 sm:py-5 sm:px-8 shadow-[0_20px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Brand Tag */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-black border border-white/15 flex items-center justify-center p-0.5 shadow-inner">
            <img src={termjobsLogo} alt="TermJobs" className="w-full h-full object-contain" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
            TermJobs · {isAi ? 'AI Assessor' : 'Live Interview'}
          </span>
        </div>

        {/* Top Checkmark Glowing Circle (Compact) */}
        <div className="relative flex items-center justify-center mb-0.5">
          {/* Decorative Sparkle Stars */}
          <span className="absolute -top-1 left-[38%] text-emerald-400 text-[10px] animate-pulse">✦</span>
          <span className="absolute top-1 right-[38%] text-teal-300 text-[9px] animate-pulse">✧</span>

          {/* Metallic ring */}
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full p-1.5 bg-[#141B26] border border-emerald-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.25)]">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-inner">
              <Check size={18} className="stroke-[3]" />
            </div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-xl sm:text-2xl font-black text-white text-center mt-1 tracking-tight">
          {isAi ? 'AI Interview ' : 'Interview '}
          <span className="text-white">Completed!</span>
        </h1>
        <p className="text-[11.5px] sm:text-xs text-zinc-400 text-center mt-0.5 font-normal max-w-md mx-auto">
          {isAi
            ? 'Your autonomous interview with Aria (TermJobs AI Assessor) has ended.'
            : 'Thank you for attending the interview.'}
        </p>

        {/* Card 1: Position & Meeting Details (Compact Padding) */}
        <div className="bg-[#121623] border border-white/[0.08] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 mt-2.5 shadow-md">
          {/* Header Row: Company Avatar + Name + Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-black border border-white/15 flex items-center justify-center text-white font-black text-sm shadow-inner shrink-0">
              {companyInitial}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-xs sm:text-sm text-white truncate">{companyName}</h3>
              <p className="text-[11px] text-zinc-400 font-medium truncate">{positionTitle}</p>
            </div>
            {isAi && (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-white text-zinc-950 flex items-center gap-1.5 shadow-sm shrink-0">
                <Sparkles size={11} />
                <span>AI Assessed</span>
              </span>
            )}
          </div>

          {/* Details 3-Column Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-2.5 pt-2.5 border-t border-white/[0.06]">
            {/* Col 1: Date */}
            <div className="flex items-start gap-1.5 min-w-0">
              <Calendar size={14} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[9.5px] text-zinc-400 font-medium">Date</div>
                <div className="text-[11px] sm:text-xs font-bold text-zinc-100 truncate">{formatDate()}</div>
              </div>
            </div>

            {/* Col 2: Time */}
            <div className="flex items-start gap-1.5 min-w-0">
              <Clock size={14} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[9.5px] text-zinc-400 font-medium">Time / Mode</div>
                <div className="text-[11px] sm:text-xs font-bold text-zinc-100 truncate">{formatTimeRange()}</div>
                <div className="text-[9.5px] text-zinc-400 truncate">({durationMinutes} min)</div>
              </div>
            </div>

            {/* Col 3: Round */}
            <div className="flex items-start gap-1.5 min-w-0">
              <FileText size={14} className="text-zinc-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[9.5px] text-zinc-400 font-medium mb-0.5">Round</div>
                <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold truncate inline-block ${
                  isAi
                    ? 'bg-zinc-800 text-zinc-100 border border-white/20'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {roundName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: AI Details Notice Box vs Peer Review Notice Box (Shortened Height) */}
        {isAi ? (
          <div className="bg-[#101524] border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 mt-2 shadow-md space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                <Bot size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white">AI Evaluation & Responses Processed</h4>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Recorded
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                  Your spoken answers and communication clarity metrics have been securely processed by Aria (TermJobs AI Assessor) and submitted to the <strong className="text-zinc-200">{companyName}</strong> hiring team for review.
                </p>
              </div>
            </div>

            {/* AI Session Highlights Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1.5 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-400 font-medium">Assessor</div>
                  <div className="text-[10.5px] font-bold text-zinc-200 truncate">Aria AI Bot</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <Video size={13} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-400 font-medium">Session Video</div>
                  <div className="text-[10.5px] font-bold text-zinc-200 truncate">Securely Archived</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <BarChart2 size={13} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-400 font-medium">STAR Metrics</div>
                  <div className="text-[10.5px] font-bold text-zinc-200 truncate">Analyzed & Scored</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#101524] border border-blue-500/20 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 mt-2 flex items-start gap-2.5 shadow-md">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <FileText size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-bold text-white">Your interview is under review</h4>
              <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                The interviewer is currently reviewing your responses and feedback. We will notify you once the evaluation is complete.
              </p>
            </div>
          </div>
        )}

        {/* Card 3: 3-Step Horizontal Stepper / Progress Tracker (Compact Height) */}
        <div className="mt-3 px-2 sm:px-6">
          <div className="flex items-center justify-between relative">
            {/* Step 1: AI Interview / Round 1 (Completed) */}
            <div className="flex flex-col items-center text-center z-10 min-w-[85px]">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                <Check size={12} className="stroke-[3]" />
              </div>
              <span className="text-white text-[11px] font-bold mt-1 truncate max-w-[110px]">
                {isAi ? 'AI Interview' : roundName}
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-0.5">
                Completed
              </span>
            </div>

            {/* Connecting Line 1 */}
            <div className="flex-1 border-t-2 border-dashed border-emerald-500/40 mx-2 -mt-4" />

            {/* Step 2: Next Step */}
            <div className="flex flex-col items-center text-center z-10 min-w-[85px]">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 border-2 border-blue-500 text-blue-400 flex items-center justify-center text-[10px] font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                2
              </div>
              <span className="text-white text-[11px] font-bold mt-1 truncate max-w-[110px]">
                {isAi ? 'Hiring Review' : nextRoundName}
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 mt-0.5">
                Next Step
              </span>
            </div>

            {/* Connecting Line 2 */}
            <div className="flex-1 border-t-2 border-dashed border-zinc-700 mx-2 -mt-4" />

            {/* Step 3: Final Decision (Pending) */}
            <div className="flex flex-col items-center text-center z-10 min-w-[85px]">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center text-[10px] font-bold">
                3
              </div>
              <span className="text-zinc-400 text-[11px] font-medium mt-1 truncate max-w-[110px]">
                Final Decision
              </span>
              <span className="text-[9.5px] font-medium text-zinc-500 mt-0.5">
                Pending
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Action Buttons (Shortened Vertical Height) */}
        <div className="mt-3.5 flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
          {/* Primary Button: Return to TermJobs Home */}
          <button
            type="button"
            onClick={handleReturnHome}
            className="w-full sm:w-auto py-2.5 px-6 rounded-full bg-white hover:bg-zinc-100 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl active:scale-95"
          >
            <Home size={14} />
            <span>Return to TermJobs Home</span>
          </button>

          {/* Secondary Button: Candidate Portal / Dashboard */}
          <button
            type="button"
            onClick={handleDashboard}
            className="w-full sm:w-auto py-2.5 px-5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
          >
            <span>Candidate Portal</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
