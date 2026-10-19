import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  Send,
  AlertCircle,
  FileText,
  Upload,
  Check,
  User,
  Mail,
  Phone,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import { validatePhone } from '../utils/phoneValidation';

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Termjobs_alertbot';

function formatApiErrorMessage(errOrResult, fallback = 'Operation failed. Please try again.') {
  if (!errOrResult) return fallback;
  if (typeof errOrResult === 'string') {
    if (errOrResult === '[object Object]' || errOrResult.trim() === '') return fallback;
    return errOrResult;
  }
  const detail = errOrResult.detail !== undefined ? errOrResult.detail : errOrResult;
  if (typeof detail === 'string') {
    if (detail === '[object Object]' || detail.trim() === '') return fallback;
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
          const msg = d.msg || d.message || JSON.stringify(d);
          return field && field !== 'body' ? `${field}: ${msg}` : msg;
        }
        return String(d);
      })
      .filter(Boolean)
      .join(', ');
  }
  return fallback;
}

export default function GeneralTalentPoolModal({ isOpen, onClose }) {
  const { candidateUser, candidateAuth, refreshProfile } = useCandidateAuth();

  const [poolForm, setPoolForm] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    linkedin_url: '',
    github_url: '',
    cover_note: '',
  });

  const [poolResume, setPoolResume] = useState(null);
  const [poolIsDragging, setPoolIsDragging] = useState(false);
  const [poolUseCustomResume, setPoolUseCustomResume] = useState(false);
  const poolFileInputRef = useRef(null);
  const [poolSubmitting, setPoolSubmitting] = useState(false);
  const [poolSuccess, setPoolSuccess] = useState(null);
  const [poolError, setPoolError] = useState(null);

  const hasResume = Boolean(
    candidateUser?.has_resume ||
    candidateUser?.resume_name ||
    candidateUser?.filename ||
    candidateUser?.resume_pdf
  );
  const currentResumeName = candidateUser?.resume_name || candidateUser?.filename || 'Verified resume from candidate profile';

  useEffect(() => {
    if (isOpen && candidateUser) {
      setPoolForm((prev) => ({
        ...prev,
        name: prev.name || candidateUser.candidate_name || candidateUser.name || '',
        email: prev.email || candidateUser.candidate_email || candidateUser.email || '',
        phone: prev.phone || candidateUser.candidate_phone || candidateUser.details?.candidate_phone || '',
        title: prev.title || candidateUser.candidate_title || '',
        linkedin_url: prev.linkedin_url || candidateUser.details?.linkedin_url || '',
        github_url: prev.github_url || candidateUser.details?.github_url || '',
      }));
    }
  }, [isOpen, candidateUser]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Intercept and prevent background page wheel, touchmove, and slider keydown navigation
    const stopBackgroundWheel = (e) => {
      const target = e.target;
      const modalEl = document.getElementById('general-talent-pool-modal-card');
      if (modalEl && modalEl.contains(target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const stopBackgroundKeys = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        e.stopPropagation();
      }
    };

    window.addEventListener('wheel', stopBackgroundWheel, { capture: true, passive: false });
    window.addEventListener('keydown', stopBackgroundKeys, { capture: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('wheel', stopBackgroundWheel, { capture: true });
      window.removeEventListener('keydown', stopBackgroundKeys, { capture: true });
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleClose = () => {
    setPoolError(null);
    onClose?.();
  };

  const handlePoolSubmit = async (e) => {
    e.preventDefault();
    setPoolSubmitting(true);
    setPoolError(null);

    const poolPhone = poolForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '';
    if (poolPhone) {
      const phoneErr = validatePhone(poolPhone);
      if (phoneErr) {
        setPoolError(phoneErr);
        setPoolSubmitting(false);
        return;
      }
    }

    if (!hasResume && !poolResume) {
      setPoolError('Please upload your resume file (PDF or DOCX).');
      setPoolSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', poolForm.name.trim() || candidateUser?.candidate_name || '');
      formData.append('email', poolForm.email.trim() || candidateUser?.candidate_email || '');
      formData.append('phone', poolPhone);
      formData.append('title', poolForm.title.trim() || candidateUser?.candidate_title || '');
      formData.append('linkedin_url', poolForm.linkedin_url.trim() || candidateUser?.details?.linkedin_url || '');
      formData.append('github_url', poolForm.github_url.trim() || candidateUser?.details?.github_url || '');
      formData.append('cover_note', poolForm.cover_note.trim());

      if (candidateUser?.id || candidateUser?.candidate_id) {
        formData.append('candidate_id', candidateUser.id || candidateUser.candidate_id);
      }
      if (poolResume) {
        formData.append('resume', poolResume);
      }

      const headers = {};
      if (candidateAuth?.candidateToken) {
        headers['Authorization'] = `Bearer ${candidateAuth.candidateToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/public/talent-pool/join`, {
        method: 'POST',
        headers,
        body: formData,
      });

      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }

      if (!res.ok) {
        const errorText = formatApiErrorMessage(result, `Could not join talent pool (${res.status}).`);
        throw new Error(errorText);
      }
      setPoolSuccess(result);
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (err) {
      const displayMsg = formatApiErrorMessage(err?.message || err, 'Failed to submit profile. Please ensure all required fields are filled out.');
      setPoolError(displayMsg);
    } finally {
      setPoolSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Main Glassmorphic Modal Card matching Coming Soon popup */}
      <div
        id="general-talent-pool-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-neutral-950/80 p-6 sm:p-7 max-w-[700px] w-full my-auto transition-all text-white shadow-[0_24px_70px_-10px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.35)] backdrop-blur-2xl"
      >
        {/* Top ambient crystalline sheen matching ComingSoonNotification */}
        <div
          aria-hidden="true"
          className="absolute -top-14 left-1/2 -translate-x-1/2 h-28 w-80 rounded-full bg-white/10 blur-2xl pointer-events-none"
        />

        {/* Modal Header */}
        <div className="relative flex items-start gap-3 sm:gap-3.5 pb-4 border-b border-white/12">
          {/* Glass monochrome badge matching ComingSoonNotification */}
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] text-white shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl">
            <Sparkles className="h-5 w-5 text-white/90" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
              <span>Candidate Talent Network</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-sans mt-0.5">
              Join the TermJobs Waitlist
            </h3>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed max-w-md">
              Be among the first to join TermJobs. We'll notify you when we launch and future opportunities become available.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 text-neutral-400 hover:text-white transition cursor-pointer shrink-0 ml-1"
          >
            <X size={16} />
          </button>
        </div>

        {poolSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/15 text-white flex items-center justify-center mx-auto border border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.25),inset_0_1px_1px_rgba(255,255,255,0.5)] backdrop-blur-xl">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white tracking-tight drop-shadow-sm">Profile Submitted to Talent Pool</h4>
              <p className="text-xs text-neutral-300 max-w-xs mx-auto mt-1">
                We will notify you as soon as an enterprise requisition matching your skillset is published.
              </p>
            </div>

            {/* Start Telegram Bot Callout */}
            <div className="p-4 bg-white/[0.06] border border-white/15 rounded-2xl text-left max-w-sm mx-auto shadow-inner mt-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-white font-bold text-xs mb-1.5">
                <Send size={13} className="text-neutral-200" />
                <span className="tracking-wide">Instant Telegram Job Matching</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed mb-3">
                Connect with <strong className="text-white">@{TELEGRAM_BOT_USERNAME}</strong> to receive priority contract pings with 1-tap accept buttons.
              </p>
              <a
                href={poolSuccess.telegram_bot_url || `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${poolSuccess.candidate_id || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs uppercase tracking-wider transition text-decoration-none cursor-pointer shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
              >
                <Send size={13} />
                <span>Start Bot (@{TELEGRAM_BOT_USERNAME})</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => {
                setPoolSuccess(null);
                handleClose();
              }}
              className="mt-4 px-7 py-2.5 rounded-full bg-white/[0.12] hover:bg-white/[0.22] border border-white/25 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer backdrop-blur-md shadow-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handlePoolSubmit} className="relative mt-4 space-y-3.5 text-xs">
            {/* Authenticated Candidate Pill */}
            {candidateUser && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.06] border border-white/15 backdrop-blur-xl flex items-center justify-between shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12)] transition">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border border-white/20 bg-neutral-950 flex items-center justify-center text-sm font-extrabold text-white shrink-0 shadow-inner">
                    {(candidateUser.candidate_name || candidateUser.candidate_email || 'C')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs text-neutral-300 flex items-center gap-2 flex-wrap">
                      <span className="text-neutral-400">Joining as</span>
                      <span className="font-bold text-white text-[13px]">{candidateUser.candidate_name || candidateUser.candidate_email}</span>
                      <span className="text-[9px] font-mono font-black uppercase tracking-wider bg-white text-neutral-950 px-2.5 py-0.5 rounded-full shadow-xs">
                        VERIFIED
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {hasResume ? '✓ Master resume on profile ready' : 'Upload your resume below to complete'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {poolError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 backdrop-blur-lg">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span className="leading-snug">{typeof poolError === 'string' ? poolError : formatApiErrorMessage(poolError)}</span>
              </div>
            )}

            {/* Row 1: Full Name (Left) & Email Address (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">
                  Full Name *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={poolForm.name}
                    onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                    placeholder="Mohammed Hashil"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border border-white/15 hover:border-white/25 focus:border-white/50 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">
                  Email Address *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    required
                    value={poolForm.email}
                    onChange={(e) => setPoolForm({ ...poolForm, email: e.target.value })}
                    placeholder="mohammedhashil2018@gmail.com"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border border-white/15 hover:border-white/25 focus:border-white/50 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Phone Number (Left) & Target Title (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">
                  Phone Number *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center">
                    <Phone size={15} />
                  </div>
                  <input
                    type="tel"
                    required
                    value={poolForm.phone}
                    onChange={(e) => {
                      setPoolForm({ ...poolForm, phone: e.target.value });
                      if (poolError) setPoolError(null);
                    }}
                    placeholder="8590955632"
                    className={`w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border ${poolForm.phone && validatePhone(poolForm.phone)
                      ? 'border-red-500/70 focus:border-red-400'
                      : 'border-white/15 hover:border-white/25 focus:border-white/50'
                      } rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md`}
                  />
                </div>
                {poolForm.phone && validatePhone(poolForm.phone) && (
                  <p className="mt-1 text-[10px] text-red-400 font-medium">
                    {validatePhone(poolForm.phone)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">
                  Target Title / Role *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center">
                    <Briefcase size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={poolForm.title}
                    onChange={(e) => setPoolForm({ ...poolForm, title: e.target.value })}
                    placeholder="Flutter Developer"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border border-white/15 hover:border-white/25 focus:border-white/50 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md"
                  />
                </div>
              </div>
            </div>

            {/* Resume Document Section */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">
                Resume Document *
              </label>

              {hasResume && !poolUseCustomResume ? (
                <div className="p-3.5 rounded-2xl border border-dashed border-white/20 bg-white/[0.04] backdrop-blur-xl flex items-center justify-between shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
                      <FileText size={18} className="text-white" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{currentResumeName}</div>
                      <div className="text-[10px] text-neutral-400">Verified resume from candidate profile</div>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <div className="h-8 w-px bg-white/15 mx-3" />
                    <button
                      type="button"
                      onClick={() => setPoolUseCustomResume(true)}
                      className="text-[11px] font-medium text-neutral-300 hover:text-white underline cursor-pointer transition whitespace-nowrap"
                    >
                      Upload different file
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setPoolIsDragging(true);
                  }}
                  onDragLeave={() => setPoolIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setPoolIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setPoolResume(file);
                      setPoolError(null);
                    }
                  }}
                  onClick={() => poolFileInputRef.current?.click()}
                  className={`p-4 sm:p-5 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200 backdrop-blur-xl group ${poolIsDragging
                    ? 'border-white bg-white/[0.14] scale-[1.01] shadow-[0_0_25px_rgba(255,255,255,0.2)]'
                    : 'border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.07] shadow-inner'
                    }`}
                >
                  <input
                    type="file"
                    ref={poolFileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPoolResume(file);
                        setPoolError(null);
                      }
                    }}
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                  />
                  <Upload size={18} className="text-neutral-400 group-hover:text-white transition mx-auto mb-1.5" />
                  {poolResume ? (
                    <div className="text-xs font-semibold text-white flex items-center justify-center gap-1.5">
                      <Check size={14} className="text-emerald-400" />
                      <span className="truncate max-w-[280px]">{poolResume.name} ({(poolResume.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-white">
                        Drop resume here or click to browse
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">PDF, DOCX up to 10MB</div>
                    </>
                  )}
                </div>
              )}

              {poolUseCustomResume && hasResume && (
                <button
                  type="button"
                  onClick={() => {
                    setPoolUseCustomResume(false);
                    setPoolResume(null);
                  }}
                  className="mt-1.5 text-[11px] text-neutral-400 hover:text-white underline cursor-pointer transition block"
                >
                  ← Use saved profile resume instead
                </button>
              )}
            </div>

            {/* Primary Submit Button: Capsule Pill */}
            <button
              type="submit"
              disabled={poolSubmitting}
              className="w-full py-3.5 rounded-full bg-white hover:bg-neutral-100 active:scale-[0.99] text-neutral-950 font-extrabold text-xs uppercase tracking-[0.18em] transition-all duration-200 cursor-pointer shadow-[0_4px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_4px_32px_rgba(255,255,255,0.38)] disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
            >
              {poolSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Profile...</span>
                </>
              ) : (
                'JOIN THE WAITLIST →'
              )}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
