import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  ShieldCheck,
  MessageSquare,
  Users,
  Eye,
  Check,
  Play,
} from 'lucide-react';
import { interviewApi } from '../services/interviewApi';

/**
 * Candidate Pre-Interview Onboarding Modal (Streamlined Single-Step)
 * - Displays Privacy & Proctoring consent
 * - Once consented, immediately launches the candidate directly into the live AI interview
 */
export function AiInterviewOnboarding({
  round,
  candidateName = 'Candidate',
  onComplete,
}) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fetch questions in background so they are ready the instant candidate enters
  useEffect(() => {
    if (round?.id && (round?.candidate_token || round?.interviewer_token)) {
      interviewApi.getAssessmentQuestions(round.id, round.candidate_token || round.interviewer_token).catch(() => { });
    }
  }, [round?.id, round?.candidate_token, round?.interviewer_token]);

  const handleStartInterview = async () => {
    if (!consentChecked || submitting) return;
    setSubmitting(true);
    const consentPayload = {
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
    };
    try {
      if (round?.id) {
        sessionStorage.setItem(`tj_onboarding_done_${round.id}`, 'true');
        await interviewApi.recordFocusConsent(
          round.id,
          true,
          consentPayload.consentTimestamp,
          round.candidate_token
        );
      }
    } catch (err) {
      console.warn('[Focus Consent] Recorded locally:', err);
    }
    if (round?.id) {
      try {
        sessionStorage.setItem(`tj_onboarding_done_${round.id}`, 'true');
      } catch (_) { }
    }
    onComplete?.(consentPayload);
  };

  return (
    <div className="w-full min-h-screen bg-[#0A0A0A] flex items-center justify-center p-2 sm:p-4 md:p-6 font-sans">
      <div className="w-full max-w-[960px] bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 shadow-2xl border border-zinc-200/80 flex flex-col animate-in fade-in zoom-in-95 duration-200 my-auto">

        {/* TOP BAR: Logo on Left, Step Indicator on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-3.5 border-b border-zinc-100 select-none">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white shadow-2xs">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <span className="font-black text-xs sm:text-sm tracking-wider text-black">TERMJOBS</span>
          </div>

          {/* Single Step Badge */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] sm:text-xs font-bold">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-950">
              Privacy &amp; Consent
            </span>
          </div>
        </div>

        {/* TWO-COLUMN BODY LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 pt-3 items-stretch">

          {/* LEFT COLUMN: Feature Illustration + Title & Description */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center md:border-r md:border-zinc-100 md:pr-6 py-2 select-none">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-3 p-2.5 shadow-inner relative">
              <svg viewBox="0 0 160 140" className="w-20 h-18 sm:w-22 sm:h-20 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="76" y="8" width="58" height="30" rx="15" fill="#18181B" />
                <path d="M92 38L86 44V38H92Z" fill="#18181B" />
                <line x1="90" y1="23" x2="90" y2="23" stroke="white" strokeWidth="3" strokeLinecap="round" />
                <line x1="97" y1="18" x2="97" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="105" y1="15" x2="105" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="113" y1="18" x2="113" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="120" y1="23" x2="120" y2="23" stroke="white" strokeWidth="3" strokeLinecap="round" />
                <rect x="22" y="32" width="94" height="64" rx="7" fill="#F4F4F5" stroke="#E4E4E7" strokeWidth="2" />
                <rect x="28" y="38" width="82" height="52" rx="4" fill="white" />
                <circle cx="69" cy="55" r="11" fill="#E4E4E7" />
                <path d="M51 80C51 72 59 70 69 70C79 70 87 72 87 80" fill="#E4E4E7" />
                <path d="M14 96H124C126 96 128 97.5 128 99.5V101H10V99.5C10 97.5 12 96 14 96Z" fill="#D4D4D8" />
                <rect x="58" y="97" width="22" height="2" rx="1" fill="#71717A" />
              </svg>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-zinc-950 mb-1">
              Privacy &amp; Consent
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-500 leading-relaxed max-w-[220px]">
              Please review and accept our AI interview and proctoring policies to begin your session.
            </p>
          </div>

          {/* RIGHT COLUMN: Interactive Policies & Consent */}
          <div className="md:col-span-8 flex flex-col justify-between py-1">
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-950 tracking-tight mb-0.5">
                  Candidate Privacy &amp; Proctoring Consent
                </h2>
                <p className="text-[11px] text-zinc-500">
                  TermJobs AI conducts objective, multi-modal technical interviews.
                </p>
              </div>

              {/* Policy Cards Grid */}
              <div className="space-y-1.5 sm:space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {/* 1. Automated AI Interview */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[11.5px] font-bold text-zinc-950 mb-0.5">
                      1. Automated AI Interview &amp; Evaluation
                    </h3>
                    <p className="text-[10.5px] text-zinc-600 leading-snug font-normal">
                      Your technical interview is conducted by an AI interviewer that asks scenario questions and evaluates spoken and technical responses against standardized role benchmarks.
                    </p>
                  </div>
                </div>

                {/* 2. Recording & Storage */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[11.5px] font-bold text-zinc-950 mb-0.5">
                      2. Video &amp; Audio Session Recording
                    </h3>
                    <p className="text-[10.5px] text-zinc-600 leading-snug font-normal">
                      Audio and video streams are securely recorded and transcribed solely for recruitment evaluation and quality audits. Data is encrypted and retained strictly per enterprise compliance.
                    </p>
                  </div>
                </div>

                {/* 3. Bias-Free Evaluation */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[11.5px] font-bold text-zinc-950 mb-0.5">
                      3. Fair &amp; Unbiased Assessment
                    </h3>
                    <p className="text-[10.5px] text-zinc-600 leading-snug font-normal">
                      The AI model evaluates only technical competence, reasoning, and domain skills. Personal identifiers, accent, and demographic factors are strictly excluded from evaluation scores.
                    </p>
                  </div>
                </div>

                {/* 4. Anti-Malpractice Policy */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[11.5px] font-bold text-zinc-950 mb-0.5">
                      4. Focus Monitoring &amp; Anti-Malpractice Policy
                    </h3>
                    <p className="text-[10.5px] text-zinc-600 leading-snug font-normal">
                      Browser tab switching, window minimization, or leaving this window will be monitored and timestamped for recruiter review. No keystrokes or unrelated application screens are captured.
                    </p>
                  </div>
                </div>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 rounded text-black border-zinc-300 focus:ring-black cursor-pointer accent-black"
                />
                <span className="text-[11px] text-zinc-900 font-medium leading-snug">
                  I consent to the real-time AI interview, evaluation of my responses, and browser focus-monitoring during this session. <span className="text-red-500">*</span>
                </span>
              </label>

              {/* Action Button: Starts Interview Immediately */}
              <div className="flex justify-end pt-2 sm:pt-2.5">
                <button
                  type="button"
                  disabled={!consentChecked || submitting}
                  onClick={handleStartInterview}
                  className="px-6 py-2.5 rounded-full bg-black hover:bg-zinc-800 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{submitting ? 'Starting Interview...' : 'Start AI Interview'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
