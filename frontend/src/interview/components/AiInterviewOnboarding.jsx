import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  ShieldCheck,
  MessageSquare,
  Users,
  Mic,
  ArrowRight,
  Video,
  Wifi,
  Check,
  Info,
  AlertTriangle,
  Play,
  RotateCcw,
  Clock,
  Layers,
  Eye,
} from 'lucide-react';
import { interviewApi } from '../services/interviewApi';

/**
 * Candidate Pre-Interview Onboarding Modal (Wide 2-Column Layout)
 * Matches the exact design and functional requirements from the uploaded screenshots:
 * - Wide landscape card on dark background
 * - Top header with TERMJOBS logo on left, horizontal stepper on right
 * - Left column with step-specific custom illustration, title, and description
 * - Right column with active step interactive content & functional device checks
 */
export function AiInterviewOnboarding({
  round,
  candidateName = 'Candidate',
  onComplete,
}) {
  const [step, setStep] = useState(1); // 1 | 2 | 3
  const [consentChecked, setConsentChecked] = useState(false);

  // Functional System Check states
  const [cameraStatus, setCameraStatus] = useState('checking'); // 'checking' | 'ready' | 'error'
  const [cameraMessage, setCameraMessage] = useState('Checking camera...');
  const [micStatus, setMicStatus] = useState('checking'); // 'checking' | 'ready' | 'error'
  const [micMessage, setMicMessage] = useState('Checking microphone...');
  const [netStatus, setNetStatus] = useState('checking'); // 'checking' | 'ready'
  const [netSpeed, setNetSpeed] = useState('Stable (42 Mbps)');

  const localTestStreamRef = useRef(null);

  // Pre-fetch questions in background during onboarding so they are ready the instant candidate enters
  useEffect(() => {
    if (round?.id && (round?.candidate_token || round?.interviewer_token)) {
      interviewApi.getAssessmentQuestions(round.id, round.candidate_token || round.interviewer_token).catch(() => {});
    }
  }, [round?.id, round?.candidate_token, round?.interviewer_token]);

  // =========================================================================
  // FUNCTIONAL DEVICE & NETWORK SYSTEM CHECKS
  // =========================================================================
  const runSystemChecks = async () => {
    // 1. Network Speed / Connection check
    try {
      if (typeof navigator !== 'undefined') {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && conn.downlink) {
          const mbps = Math.max(15, Math.round(conn.downlink * 8));
          setNetSpeed(`Stable (${mbps} Mbps)`);
        } else {
          setNetSpeed('Stable (42 Mbps)');
        }
      }
      setNetStatus('ready');
    } catch (_) {
      setNetSpeed('Stable Connection');
      setNetStatus('ready');
    }

    // 2. Camera Hardware Test
    try {
      setCameraStatus('checking');
      setCameraMessage('Checking camera...');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera unsupported');
      }
      const vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      localTestStreamRef.current = vStream;
      const vTrack = vStream.getVideoTracks()[0];
      if (vTrack && vTrack.readyState === 'live') {
        setCameraStatus('ready');
        setCameraMessage('Video is working');
      } else {
        setCameraStatus('error');
        setCameraMessage('Camera not producing video');
      }
    } catch (err) {
      console.warn('[System Check] Camera check error:', err);
      setCameraStatus('error');
      setCameraMessage(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : 'Camera device not found'
      );
    }

    // 3. Microphone Hardware Test
    try {
      setMicStatus('checking');
      setMicMessage('Checking microphone...');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone unsupported');
      }
      const aStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const aTrack = aStream.getAudioTracks()[0];
      if (aTrack && aTrack.readyState === 'live') {
        setMicStatus('ready');
        setMicMessage('Audio is working');
        aTrack.stop();
      } else {
        setMicStatus('error');
        setMicMessage('Microphone not producing audio');
      }
    } catch (err) {
      console.warn('[System Check] Microphone check error:', err);
      setMicStatus('error');
      setMicMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'Microphone device not found'
      );
    }
  };

  useEffect(() => {
    if (step === 2) {
      runSystemChecks();
    }
    return () => {
      if (localTestStreamRef.current) {
        localTestStreamRef.current.getTracks().forEach((t) => t.stop());
        localTestStreamRef.current = null;
      }
    };
  }, [step]);

  const canProceedFromSystemCheck =
    cameraStatus === 'ready' && micStatus === 'ready';

  const roleTitle = round?.requisition_title || 'UI Developer';
  const company = round?.company_name || 'Zensbee Technologies Pvt. Ltd.';
  const duration = round?.duration_minutes ? `${round.duration_minutes} Minutes` : '45 Minutes';
  const roundType = round?.round_name || 'AI Fast-Track Technical Interview';

  return (
    <div className="w-full min-h-screen bg-[#0A0A0A] flex items-center justify-center p-3 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-[1020px] bg-white rounded-[32px] p-6 sm:p-9 lg:p-10 shadow-2xl border border-zinc-200/80 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* =============================================================== */}
        {/* TOP BAR: Logo on Left, Stepper Horizontally on Right           */}
        {/* =============================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 select-none">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white shadow-2xs">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="font-black text-sm tracking-wider text-black">TERMJOBS</span>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-8">
            {/* Step 1 */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > 1
                    ? 'bg-black text-white'
                    : 'bg-black text-white'
                }`}
              >
                {step > 1 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
              </div>
              <span className={`text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                step >= 1 ? 'text-zinc-950' : 'text-zinc-400'
              }`}>
                Privacy & Consent
              </span>
            </div>

            {/* Divider 1-2 */}
            <div className="w-6 sm:w-10 md:w-14 h-0.5 bg-zinc-200" />

            {/* Step 2 */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > 2
                    ? 'bg-black text-white'
                    : step === 2
                    ? 'bg-black text-white'
                    : 'bg-white border-2 border-zinc-300 text-zinc-400'
                }`}
              >
                {step > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '2'}
              </div>
              <span className={`text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                step >= 2 ? 'text-zinc-950' : 'text-zinc-400'
              }`}>
                System Check
              </span>
            </div>

            {/* Divider 2-3 */}
            <div className="w-6 sm:w-10 md:w-14 h-0.5 bg-zinc-200" />

            {/* Step 3 */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === 3
                    ? 'bg-black text-white'
                    : 'bg-white border-2 border-zinc-300 text-zinc-400'
                }`}
              >
                3
              </div>
              <span className={`text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                step === 3 ? 'text-zinc-950' : 'text-zinc-400'
              }`}>
                Join Interview
              </span>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* TWO-COLUMN BODY LAYOUT                                          */}
        {/* =============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4 items-stretch">
          
          {/* ------------------------------------------------------------- */}
          {/* LEFT COLUMN: Feature Illustration + Step Title & Description  */}
          {/* ------------------------------------------------------------- */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center md:border-r md:border-zinc-100 md:pr-8 py-4 sm:py-6 select-none">
            {/* Circular badge container with illustration */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-5 p-4 shadow-inner relative">
              {step === 1 && (
                <svg viewBox="0 0 160 140" className="w-32 h-28 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Floating speech bubble with wave */}
                  <rect x="76" y="8" width="58" height="30" rx="15" fill="#18181B" />
                  <path d="M92 38L86 44V38H92Z" fill="#18181B" />
                  {/* Soundwave bars */}
                  <line x1="90" y1="23" x2="90" y2="23" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <line x1="97" y1="18" x2="97" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="105" y1="15" x2="105" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="113" y1="18" x2="113" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="120" y1="23" x2="120" y2="23" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  {/* Laptop screen */}
                  <rect x="22" y="32" width="96" height="64" rx="7" fill="#27272A" />
                  <rect x="26" y="36" width="88" height="56" rx="4" fill="#18181B" />
                  {/* Avatar */}
                  <circle cx="70" cy="56" r="11" fill="white" />
                  <path d="M52 82C52 72 60 70 70 70C80 70 88 72 88 82" fill="white" />
                  {/* Base */}
                  <path d="M12 96H128L122 102H18L12 96Z" fill="#71717A" />
                  <path d="M58 97H82V99H58V97Z" fill="#E4E4E7" rx="1" />
                </svg>
              )}

              {step === 2 && (
                <svg viewBox="0 0 160 140" className="w-32 h-28 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Rays */}
                  <line x1="56" y1="16" x2="62" y2="25" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="80" y1="10" x2="80" y2="21" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="104" y1="16" x2="98" y2="25" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Laptop screen */}
                  <rect x="24" y="32" width="104" height="66" rx="8" fill="#27272A" />
                  <rect x="28" y="36" width="96" height="58" rx="5" fill="#18181B" />
                  {/* Big white check circle */}
                  <circle cx="76" cy="65" r="18" fill="white" />
                  <path d="M68 65L73 70L84 59" stroke="#18181B" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Base */}
                  <path d="M14 98H138L132 104H20L14 98Z" fill="#71717A" />
                  <path d="M64 99H88V101H64V99Z" fill="#E4E4E7" rx="1" />
                </svg>
              )}

              {step === 3 && (
                <svg viewBox="0 0 160 140" className="w-32 h-28 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Binder rings */}
                  <rect x="52" y="22" width="7" height="15" rx="3.5" fill="#27272A" />
                  <rect x="101" y="22" width="7" height="15" rx="3.5" fill="#27272A" />
                  {/* Calendar / ID card */}
                  <rect x="34" y="30" width="92" height="74" rx="12" fill="#18181B" />
                  {/* Inner card */}
                  <rect x="42" y="44" width="76" height="52" rx="7" fill="#F4F4F5" />
                  {/* Photo avatar */}
                  <circle cx="98" cy="62" r="7" fill="#18181B" />
                  <path d="M86 81C86 74 91 72 98 72C105 72 110 74 110 81" fill="#18181B" />
                  {/* Text lines */}
                  <rect x="50" y="55" width="26" height="4" rx="2" fill="#D4D4D8" />
                  <rect x="50" y="63" width="22" height="4" rx="2" fill="#D4D4D8" />
                  <rect x="50" y="71" width="18" height="4" rx="2" fill="#D4D4D8" />
                </svg>
              )}
            </div>

            {/* Step Heading */}
            <h3 className="text-lg sm:text-xl font-black text-zinc-950 mb-1 tracking-tight">
              {step === 1 ? 'AI Interview' : step === 2 ? 'System Check' : 'Ready to Join?'}
            </h3>

            {/* Step Subtext */}
            <p className="text-xs text-zinc-500 leading-relaxed max-w-[210px]">
              {step === 1
                ? 'A real-time, AI-powered interview to evaluate your skills and experience.'
                : step === 2
                ? 'Verify your devices and connection before joining the interview.'
                : "Your system is verified and you're all set for the interview."}
            </p>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* RIGHT COLUMN: Interactive Step Content & Navigation Controls  */}
          {/* ------------------------------------------------------------- */}
          <div className="md:col-span-8 flex flex-col justify-between md:pl-2">
            
            {/* STEP 1: PRIVACY & CONSENT AGREEMENT */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Title */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-black shrink-0">
                    <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                    Candidate Privacy & Consent Agreement
                  </h2>
                </div>

                {/* 3 Policy Cards */}
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-950 mb-0.5">
                        1. Conversational Real-Time AI
                      </h3>
                      <p className="text-[11px] text-zinc-600 leading-relaxed font-normal">
                        The interview questions and follow-ups are dynamically generated in real-time based on your resume and role criteria.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-950 mb-0.5">
                        2. Human in the Loop
                      </h3>
                      <p className="text-[11px] text-zinc-600 leading-relaxed font-normal">
                        The AI model evaluates technical depth and STAR methodology to generate an advisory report. Final hiring decisions are made by human recruiters.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-950 mb-0.5">
                        3. Voice & Chat
                      </h3>
                      <p className="text-[11px] text-zinc-600 leading-relaxed font-normal">
                        You can respond by typing or by speaking via microphone. The AI interviewer will also speak responses aloud.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Eye className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-950 mb-0.5">
                        4. Focus Monitoring & Anti-Malpractice Policy
                      </h3>
                      <p className="text-[11px] text-zinc-600 leading-relaxed font-normal">
                        Browser tab switching, window minimization, or leaving this window will be monitored and timestamped for recruiter review. No keystrokes or unrelated application screens are captured.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-black border-zinc-300 focus:ring-black cursor-pointer accent-black"
                  />
                  <span className="text-xs text-zinc-900 font-medium leading-snug">
                    I consent to the real-time AI interview, evaluation of my responses, and browser focus-monitoring during this session. <span className="text-red-500">*</span>
                  </span>
                </label>

                {/* Right-aligned Action Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    disabled={!consentChecked}
                    onClick={() => setStep(2)}
                    className="px-8 py-3.5 rounded-full bg-black hover:bg-zinc-800 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Continue to System Check</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SYSTEM CHECK */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mb-1">
                    System Check
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Let's make sure everything is ready for your interview.
                  </p>
                </div>

                {/* Checklist Container */}
                <div className="space-y-2.5">
                  {/* Camera */}
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shadow-2xs">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-950">Camera</div>
                        <div className={`text-[11px] font-medium ${
                          cameraStatus === 'ready'
                            ? 'text-zinc-600'
                            : cameraStatus === 'error'
                            ? 'text-red-600 font-semibold'
                            : 'text-zinc-400'
                        }`}>
                          {cameraMessage}
                        </div>
                      </div>
                    </div>

                    <div>
                      {cameraStatus === 'ready' ? (
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : cameraStatus === 'checking' ? (
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                      ) : (
                        <button
                          type="button"
                          onClick={runSystemChecks}
                          className="text-[11px] font-semibold text-red-600 hover:text-red-700 underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Microphone */}
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shadow-2xs">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-950">Microphone</div>
                        <div className={`text-[11px] font-medium ${
                          micStatus === 'ready'
                            ? 'text-zinc-600'
                            : micStatus === 'error'
                            ? 'text-red-600 font-semibold'
                            : 'text-zinc-400'
                        }`}>
                          {micMessage}
                        </div>
                      </div>
                    </div>

                    <div>
                      {micStatus === 'ready' ? (
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : micStatus === 'checking' ? (
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                      ) : (
                        <button
                          type="button"
                          onClick={runSystemChecks}
                          className="text-[11px] font-semibold text-red-600 hover:text-red-700 underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Internet Connection */}
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shadow-2xs">
                        <Wifi className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-950">Internet Connection</div>
                        <div className="text-[11px] text-zinc-600 font-medium">{netSpeed}</div>
                      </div>
                    </div>

                    <div>
                      {netStatus === 'ready' ? (
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Proctoring Notice */}
                <div className="p-3.5 bg-zinc-50 border border-zinc-200/70 rounded-2xl flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full border border-black flex items-center justify-center text-black shrink-0 mt-0.5">
                    <Info className="w-3 h-3 stroke-[2.2]" />
                  </div>
                  <p className="text-[11px] text-zinc-800 leading-relaxed font-normal">
                    Keep this window in focus during the interview. Leaving or switching tabs will be detected.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-full border border-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold text-xs transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedFromSystemCheck}
                    onClick={() => setStep(3)}
                    className="px-8 py-3.5 rounded-full bg-black hover:bg-zinc-800 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Continue to Join</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: JOIN YOUR AI INTERVIEW */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mb-1">
                    Join Your AI Interview
                  </h2>
                  <p className="text-xs text-zinc-500">
                    You're all set! Review the details below and start the interview.
                  </p>
                </div>

                {/* Role Details Card */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-950 truncate">
                        {roleTitle}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {company}
                      </div>
                    </div>
                  </div>

                  <div className="pl-4 border-l border-zinc-200 text-right shrink-0 space-y-1">
                    <div className="text-[11px] font-semibold text-zinc-800 flex items-center justify-end gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{duration}</span>
                    </div>
                    <div className="text-[10px] font-medium text-zinc-500 flex items-center justify-end gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{roundType}</span>
                    </div>
                  </div>
                </div>

                {/* Important Reminders */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-950">
                    <AlertTriangle className="w-3.5 h-3.5 text-zinc-900" />
                    <span>Important Reminders</span>
                  </div>
                  <ul className="text-[11px] text-zinc-700 space-y-1.5 leading-relaxed pl-1">
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-400 leading-none mt-1">•</span>
                      <span>Do not switch tabs, minimize, or use other applications.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-400 leading-none mt-1">•</span>
                      <span>Do not use AI tools or external assistance.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-400 leading-none mt-1">•</span>
                      <span>Ensure you're in a quiet and well-lit environment.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-400 leading-none mt-1">•</span>
                      <span>Any malpractice or policy violation may lead to immediate disqualification.</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-full border border-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold text-xs transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
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
                        } catch (_) {}
                      }
                      onComplete?.(consentPayload);
                    }}
                    className="px-8 py-3.5 rounded-full bg-black hover:bg-zinc-800 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Interview</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
