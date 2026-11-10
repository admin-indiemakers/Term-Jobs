import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import logo from '../assets/termjobs-logo.png';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Check,
  Briefcase,
  Bot,
  Bell,
  Send,
  Users,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Termjobs_alertbot';
const WHATSAPP_COMMUNITY_URL = import.meta.env.VITE_WHATSAPP_COMMUNITY_URL || '';

export default function CandidateOnboardingModal({
  isOpen,
  onClose,
  candidateUser,
  onComplete,
  openProfileSetup,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const modalRef = useRef(null);

  const slides = [
    {
      id: 'apply',
      stepNum: 1,
      title: 'Apply for Roles',
      nextTitle: 'AI Interview',
      description:
        'Browse verified opportunities and apply with your candidate profile in just a few clicks.',
      benefits: [
        'Explore verified roles',
        'One-click application',
        'Track your applications',
      ],
      renderIllustration: () => (
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-ink/10 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] flex flex-col items-center">
          {/* Card header */}
          <div className="w-full flex items-center gap-3 pb-3 border-b border-neutral-100">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900">
              <Briefcase size={18} />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-neutral-900" />
              <div className="h-2 w-1/2 rounded bg-neutral-200" />
            </div>
          </div>
          {/* Card spec lines */}
          <div className="w-full my-4 space-y-2">
            <div className="h-2 w-full rounded bg-neutral-100" />
            <div className="h-2 w-5/6 rounded bg-neutral-100" />
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
                Verified
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600">
                On-site / Hybrid
              </span>
            </div>
          </div>
          {/* Apply Now button with cursor pointer */}
          <div className="relative w-full pt-1">
            <button
              type="button"
              tabIndex={-1}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-950 hover:bg-black text-white text-xs font-bold tracking-wide shadow-md flex items-center justify-center gap-2"
            >
              <span>Apply Now</span>
              <ArrowRight size={13} />
            </button>
            {/* Hand / Cursor icon pointing directly at button */}
            <div className="absolute -bottom-3 right-5 pointer-events-none drop-shadow-md animate-bounce duration-1000">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                  fill="#0A0A0A"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'interview',
      stepNum: 2,
      title: 'Attend AI Interview',
      nextTitle: 'Track Applications',
      description:
        'After applying, complete an AI-powered interview from the Interview page at your convenience.',
      benefits: [
        'Smart, role-based questions',
        'Flexible interview access',
        'Receive interview feedback',
      ],
      renderIllustration: () => (
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-ink/10 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] flex flex-col items-center">
          {/* Laptop Frame */}
          <div className="w-full bg-neutral-950 rounded-t-xl p-3 pb-4 shadow-inner border border-neutral-800 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Screen shine & camera dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 mb-2" />
            {/* AI Avatar Face */}
            <div className="relative p-2 rounded-2xl bg-neutral-900 border border-neutral-700 flex flex-col items-center justify-center">
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-700 flex items-center justify-center shadow-lg text-white">
                <Bot size={32} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-pulse" />
                <span className="text-[10px] font-bold text-neutral-200 tracking-wider">AI EVALUATOR</span>
              </div>
            </div>
            {/* Soundwaves */}
            <div className="absolute left-2 bottom-3 flex items-end gap-0.5">
              <div className="w-1 h-3 rounded-full bg-neutral-500 animate-pulse" />
              <div className="w-1 h-5 rounded-full bg-neutral-300 animate-pulse" />
              <div className="w-1 h-2 rounded-full bg-neutral-600" />
            </div>
            <div className="absolute right-2 bottom-3 flex items-end gap-0.5">
              <div className="w-1 h-2 rounded-full bg-neutral-600" />
              <div className="w-1 h-5 rounded-full bg-neutral-300 animate-pulse" />
              <div className="w-1 h-3 rounded-full bg-neutral-500 animate-pulse" />
            </div>
          </div>
          {/* Laptop Keyboard Base */}
          <div className="w-[108%] -mt-0.5 h-3.5 bg-neutral-300 rounded-b-lg border-t border-neutral-400 shadow-sm relative flex justify-center">
            <div className="w-12 h-1 bg-neutral-500 rounded-b-sm" />
          </div>
        </div>
      ),
    },
    {
      id: 'tracking',
      stepNum: 3,
      title: 'Track Your Applications',
      nextTitle: 'Telegram Updates',
      description:
        'Stay updated on your application status, interview results, and next steps in real time.',
      benefits: [
        'Real-time status updates',
        'Interview and shortlist results',
        'Next-action guidance',
      ],
      renderIllustration: () => (
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-ink/10 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] flex flex-col">
          <div className="space-y-3">
            {/* Step 1: Applied */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800">Applied</span>
                <span className="text-[10px] text-emerald-600 font-medium">Completed</span>
              </div>
            </div>
            <div className="w-0.5 h-3 bg-neutral-300 ml-3 -my-1" />

            {/* Step 2: AI Interview */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800">AI Interview</span>
                <span className="text-[10px] text-emerald-600 font-medium">Evaluated</span>
              </div>
            </div>
            <div className="w-0.5 h-3 bg-neutral-900 ml-3 -my-1" />

            {/* Step 3: Shortlisted (Active pill in Black) */}
            <div className="flex items-center gap-3 p-2 rounded-xl bg-neutral-100 border border-neutral-300">
              <div className="w-6 h-6 rounded-full bg-neutral-950 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 size={14} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900">Shortlisted</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-neutral-950 text-white">
                  Active
                </span>
              </div>
            </div>
            <div className="w-0.5 h-3 bg-neutral-200 ml-3 -my-1" />

            {/* Step 4: Final Selection */}
            <div className="flex items-center gap-3 opacity-60">
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center shrink-0 text-neutral-400">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
              </div>
              <span className="text-xs font-medium text-neutral-600">Final Selection</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'telegram',
      stepNum: 4,
      title: 'Get Telegram Updates',
      nextTitle: 'WhatsApp Group',
      description:
        'Connect your Telegram account to receive new role alerts, interview invites, and important announcements.',
      benefits: [
        'New job opportunity alerts',
        'Interview and result notifications',
        'Platform announcements',
      ],
      extraAction: (
        <a
          href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${candidateUser?.id || candidateUser?.candidate_email || ''}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 mt-1.5 rounded-full border border-ink/15 bg-white/75 hover:bg-white text-ink text-[11px] sm:text-xs font-semibold tracking-wider uppercase backdrop-blur-xl shadow-xs hover:border-ink/35 transition-all duration-300 active:scale-95 cursor-pointer max-w-full"
        >
          <Send size={12} className="rotate-45 text-ink shrink-0" />
          <span className="truncate">Connect Telegram Alert Bot</span>
          <ExternalLink size={11} className="opacity-60 text-ink-soft shrink-0" />
        </a>
      ),
      renderIllustration: () => (
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-ink/10 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] flex flex-col items-center justify-center">
          {/* 3D Circular Telegram Paper Plane Icon */}
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#2AABEE] via-[#229ED9] to-[#1778A9] flex items-center justify-center shadow-xl shadow-[#229ED9]/30 transform -rotate-3 hover:rotate-0 transition duration-300">
              <Send size={44} className="text-white ml-[-4px] mt-[2px] -rotate-12" />
            </div>
            {/* Notification Bell Badge */}
            <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center shadow-lg text-amber-950 animate-bounce">
              <Bell size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neutral-900" />
            <span className="text-[11px] font-bold text-neutral-700 tracking-wide">
              @{TELEGRAM_BOT_USERNAME}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'whatsapp',
      stepNum: 5,
      title: 'Join WhatsApp Group',
      nextTitle: 'Build Your Profile',
      description:
        'Join the official TermJobs WhatsApp community to receive job alerts, career tips, and platform updates.',
      benefits: [
        'Instant job and role alerts',
        'Important updates and deadlines',
        'Community support and tips',
      ],
      extraAction: WHATSAPP_COMMUNITY_URL ? (
        <a
          href={WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 mt-1.5 rounded-full border border-ink/15 bg-white/75 hover:bg-white text-ink text-[11px] sm:text-xs font-semibold tracking-wider uppercase backdrop-blur-xl shadow-xs hover:border-ink/35 transition-all duration-300 active:scale-95 cursor-pointer max-w-full"
        >
          <Users size={12} className="text-ink shrink-0" />
          <span className="truncate">Join WhatsApp Community</span>
          <ExternalLink size={11} className="opacity-60 text-ink-soft shrink-0" />
        </a>
      ) : (
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 mt-1.5 rounded-full bg-white/60 text-ink-soft text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase border border-ink/12 backdrop-blur-xs max-w-full">
          <ShieldCheck size={12} className="text-ink shrink-0" />
          <span className="truncate">Official candidate community</span>
        </div>
      ),
      renderIllustration: () => (
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-ink/10 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* 3D Green WhatsApp Icon */}
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#25D366] via-[#20BD5A] to-[#128C7E] flex items-center justify-center shadow-xl shadow-emerald-500/25 transform rotate-3 hover:rotate-0 transition duration-300">
              <svg width="46" height="46" viewBox="0 0 24 24" fill="white">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.22 8.23zm4.51-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.13.17 1.74 2.66 4.21 3.73.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z" />
              </svg>
            </div>
            {/* Community user group badge in black */}
            <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-neutral-950 text-white flex items-center gap-1 shadow-md border-2 border-white">
              <Users size={12} />
              <span className="text-[10px] font-bold">Group</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-neutral-700 tracking-wide">
              Official Candidate Network
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'profile',
      stepNum: 6,
      title: 'Build Your Profile',
      nextTitle: null,
      description:
        'Create a complete candidate profile to improve your match score and discover more opportunities.',
      benefits: [
        'Add your skills, experience, and resume',
        'Improve your profile match score',
        'Get better role recommendations',
      ],
      extraAction: (
        <button
          type="button"
          onClick={() => {
            onClose();
            if (openProfileSetup) openProfileSetup();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 mt-1.5 rounded-full border border-ink/15 bg-white/75 hover:bg-white text-ink text-[11px] sm:text-xs font-semibold tracking-wider uppercase backdrop-blur-xl shadow-xs hover:border-ink/35 transition-all duration-300 active:scale-95 cursor-pointer max-w-full"
        >
          <Sparkles size={12} className="text-ink shrink-0" />
          <span className="truncate">Update Profile Details</span>
        </button>
      ),
      renderIllustration: () => (
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-ink/10 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] flex flex-col">
          {/* Top header with match score */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="w-10 h-10 rounded-full bg-neutral-950 text-white font-black text-sm flex items-center justify-center shadow-md">
              {(candidateUser?.candidate_name || candidateUser?.candidate_email || 'C').slice(0, 1).toUpperCase()}
            </div>
            <div className="px-2.5 py-1 rounded-full bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm">
              <Check size={12} strokeWidth={3} />
              <span>85% Match</span>
            </div>
          </div>
          {/* Skeleton lines for profile */}
          <div className="mt-3 space-y-2">
            <div className="h-3 w-1/2 rounded bg-neutral-900" />
            <div className="h-2 w-2/3 rounded bg-neutral-200" />
            <div className="pt-2 flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-semibold text-[10px] border border-neutral-200">
                React.js
              </span>
              <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-semibold text-[10px] border border-neutral-200">
                TypeScript
              </span>
              <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-semibold text-[10px] border border-neutral-200">
                Tailwind CSS
              </span>
            </div>
          </div>
          {/* Verified Candidate Badge */}
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck size={12} /> Verified Profile
            </span>
            <span>Resume Attached</span>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleComplete = useCallback(() => {
    if (onComplete) onComplete();
    onClose();
  }, [onComplete, onClose]);

  // Keyboard navigation & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleComplete();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentSlide < slides.length - 1) {
          setCurrentSlide((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSlide > 0) {
          setCurrentSlide((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide, slides.length, handleComplete]);

  if (!isOpen) return null;

  const current = slides[currentSlide];
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === slides.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Candidate Onboarding"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 font-sans"
    >
      {/* Centered Large Modal Container - Landing Page Editorial Style with Grid */}
      <div
        ref={modalRef}
        className="w-full max-w-4xl bg-paper text-ink rounded-[28px] sm:rounded-[36px] shadow-[0_25px_70px_rgba(0,0,0,0.35)] border border-ink/12 flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200"
      >
        {/* Soft Radial Atmospheric Background (Identical to Landing Page Backdrop) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 90% at 80% 0%, oklch(0.99 0.002 100) 0%, oklch(0.965 0.002 100) 55%, oklch(0.935 0.002 100) 100%)",
          }}
          aria-hidden="true"
        />
        {/* Subtle Grid Layer System */}
        <div
          className="grid-layer absolute inset-0 pointer-events-none text-ink opacity-45"
          aria-hidden="true"
        />

        {/* Top Header - Backgroundless & Elevated */}
        <div className="relative z-10 px-5 sm:px-8 pt-3 sm:pt-4 pb-1 sm:pb-2 flex items-center justify-between bg-transparent">
          {/* Logo & Header Text */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <img
              src={logo}
              alt="TermJobs"
              className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0"
            />
            <div className="flex flex-col">
              <span className="text-[11px] sm:text-xs font-black tracking-[0.22em] text-ink uppercase leading-tight font-sans">
                TERMJOBS
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-ink-soft/75 font-medium tracking-[0.18em] uppercase leading-tight mt-0.5">
                Candidate Onboarding
              </span>
            </div>
          </div>

          {/* Skip Button - Landing Pill Style */}
          <button
            type="button"
            onClick={handleComplete}
            className="text-ink-soft hover:text-ink text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-ink/12 hover:border-ink/30 bg-white/50 hover:bg-white/90 transition backdrop-blur-sm cursor-pointer active:scale-95"
          >
            Skip
          </button>
        </div>

        {/* Slide Content Area with Side Arrows (generous px to ensure zero arrow collision) */}
        <div className="relative z-10 px-14 sm:px-16 md:px-20 py-3 sm:py-5 flex-1 min-h-[320px] sm:min-h-[360px] flex items-center overflow-hidden">
          {/* Floating Left Arrow - Landing Page Style */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirstSlide}
            aria-label="Previous Slide"
            className={`flex absolute left-2 sm:left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-ink/12 bg-white/85 hover:bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-xl items-center justify-center transition-all z-20 ${
              isFirstSlide
                ? 'opacity-20 cursor-not-allowed text-ink/30'
                : 'cursor-pointer hover:scale-105 active:scale-95 text-ink'
            }`}
            title="Previous Slide"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Main Slide Layout: 2 Columns on desktop, single column on mobile */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center max-w-3xl mx-auto">
            {/* Left Column: Text & Benefits */}
            <div className="flex flex-col text-left">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-ink tracking-tight font-display">
                {current.title}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-ink-soft leading-relaxed font-normal">
                {current.description}
              </p>

              {/* Bullet Points with clean monochrome checkmarks */}
              <div className="mt-4 sm:mt-5 space-y-2 sm:space-y-2.5">
                {current.benefits.map((benefit, bIdx) => (
                  <div key={bIdx} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-white/90 border border-ink/15 text-ink flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Check size={11} strokeWidth={2.5} />
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-ink">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Extra optional CTA */}
              {current.extraAction && (
                <div className="mt-4 sm:mt-5 max-w-full overflow-hidden">{current.extraAction}</div>
              )}
            </div>

            {/* Right Column: Visual Feature Illustration */}
            <div className="w-full flex items-center justify-center">
              {current.renderIllustration()}
            </div>
          </div>

          {/* Floating Right Arrow - Landing Page Style */}
          <button
            type="button"
            onClick={handleNext}
            disabled={isLastSlide}
            aria-label="Next Slide"
            className={`flex absolute right-2 sm:right-3.5 md:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-ink/12 bg-white/85 hover:bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-xl items-center justify-center transition-all z-20 ${
              isLastSlide
                ? 'opacity-20 cursor-not-allowed text-ink/30'
                : 'cursor-pointer hover:scale-105 active:scale-95 text-ink'
            }`}
            title="Next Slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Bottom Navigation Controls - Backgroundless (Zero collision layout) */}
        <div className="relative z-10 px-4 sm:px-8 py-3 sm:py-4 bg-transparent flex items-center justify-between min-h-[52px]">
          {/* Left Column Spacer (keeps dots centered) */}
          <div className="flex-1 flex justify-start items-center min-w-[70px] sm:min-w-[100px]">
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="text-ink-soft hover:text-ink text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full border border-transparent hover:border-ink/10 transition cursor-pointer"
              >
                ← Back
              </button>
            )}
          </div>

          {/* Center Column: Pagination Dots */}
          <div className="flex items-center gap-1.5 shrink-0 px-2">
            {slides.map((_, dotIdx) => {
              const isDotActive = dotIdx === currentSlide;
              return (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setCurrentSlide(dotIdx)}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                  aria-current={isDotActive ? "true" : undefined}
                  className="group relative flex h-6 w-3 sm:w-3.5 items-center justify-center focus-visible:outline-none cursor-pointer"
                >
                  <span
                    className={`block rounded-full transition-all duration-300 ${
                      isDotActive
                        ? 'h-1.5 sm:h-2 w-4 sm:w-5 bg-ink opacity-100'
                        : 'h-1.5 w-1.5 bg-ink opacity-25 group-hover:opacity-50'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Column: Get Started Action on final slide */}
          <div className="flex-1 flex justify-end items-center min-w-[70px] sm:min-w-[100px]">
            {isLastSlide ? (
              <button
                type="button"
                onClick={handleComplete}
                className="group inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-ink hover:bg-ink/90 text-paper text-[10.5px] sm:text-xs font-semibold tracking-[0.14em] uppercase shadow-[0_4px_16px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>Get Started</span>
                <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            ) : (
              <div className="w-12" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
