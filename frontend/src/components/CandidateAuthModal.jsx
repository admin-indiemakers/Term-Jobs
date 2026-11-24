import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import { validateCandidateEmail } from '../utils/candidateEmailValidation';
import { validatePhone } from '../utils/phoneValidation';
import ResumeUploadField from './ResumeUploadField';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '215468136876-3e4icbpr6blejlb9vibvecr6ck2tfm5g.apps.googleusercontent.com';

function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.15C3.25 21.36 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.61l4 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export default function CandidateAuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'login',
}) {
  const { login, loginWithGoogle, register } = useCandidateAuth();

  const [authTab, setAuthTab] = useState(initialTab);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regSkills, setRegSkills] = useState('');
  const [regResume, setRegResume] = useState(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  const [googleResumeRequired, setGoogleResumeRequired] = useState(false);
  const [pendingGooglePayload, setPendingGooglePayload] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAuthTab(initialTab);
      setAuthError(null);
      setAuthSuccessMsg('');
    }
  }, [isOpen, initialTab]);

  const ensureGoogleSdk = () =>
    new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        resolve(true);
        return;
      }
      const existing = document.getElementById('google-jssdk');
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        setTimeout(() => resolve(Boolean(window.google?.accounts?.oauth2)), 2000);
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
      setTimeout(() => resolve(Boolean(window.google?.accounts?.oauth2)), 2500);
    });

  const handleGoogleSignIn = async () => {
    setAuthError(null);

    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google OAuth Client ID is not configured.');
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setAuthLoading(true);
      const loaded = await ensureGoogleSdk();
      setAuthLoading(false);
      if (!loaded || !window.google?.accounts?.oauth2) {
        setAuthError('Google Sign-In SDK is loading. Please try again in a few moments.');
        return;
      }
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setAuthError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }

          if (tokenResponse.access_token) {
            setAuthError(null);
            setAuthLoading(true);
            try {
              let userInfo = {};
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (userRes.ok) {
                  userInfo = await userRes.json();
                }
              } catch (userErr) {
                console.warn('Could not fetch userinfo directly from Google:', userErr);
              }

              let resumeFields = {};
              if (regResume) {
                if (!regResume.size || regResume.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(regResume.name)) {
                  throw new Error('Upload a non-empty PDF or DOCX resume up to 10 MB.');
                }
                const encoded = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(regResume);
                });
                resumeFields = { resume_base64: encoded, resume_filename: regResume.name };
              }

              const data = await loginWithGoogle({
                ...resumeFields,
                access_token: tokenResponse.access_token,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub,
              });

              if (data?.status === 'resume_required') {
                setPendingGooglePayload({
                  access_token: tokenResponse.access_token,
                  email: userInfo.email,
                  name: userInfo.name,
                  picture: userInfo.picture,
                  sub: userInfo.sub,
                });
                setGoogleResumeRequired(true);
                setAuthError(null);
                return;
              }

              setGoogleResumeRequired(false);
              setPendingGooglePayload(null);
              setAuthError(null);
              setAuthSuccessMsg('Signed in with Google successfully!');

              const candidate = data?.candidate || userInfo;
              setTimeout(() => {
                if (onSuccess) onSuccess(candidate);
                onClose();
              }, 500);
            } catch (err) {
              setAuthError(err.message || 'Google authentication failed.');
            } finally {
              setAuthLoading(false);
            }
          }
        },
        error_callback: (err) => {
          if (err?.type === 'popup_closed') return;
          if (err?.type === 'popup_failed_to_open') {
            setAuthError('Popup was blocked by your browser. Please allow popups for Google Sign-In.');
            return;
          }
          setAuthError('Google Sign-In was cancelled or failed to open.');
        },
      });

      client.requestAccessToken();
    } catch (err) {
      console.error('Google OAuth trigger error:', err);
      setAuthError('Could not open Google Sign-In popup. Please check your browser popup blocker.');
    }
  };

  const handleCompleteGoogleRegistration = async () => {
    if (!regResume) {
      setAuthError('Please upload your resume file (PDF or DOCX) to complete your profile.');
      return;
    }
    if (!regResume.size || regResume.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(regResume.name)) {
      setAuthError('Upload a non-empty PDF or DOCX resume up to 10 MB.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(regResume);
      });

      const payload = {
        ...(pendingGooglePayload || {}),
        resume_base64: encoded,
        resume_filename: regResume.name,
      };

      const data = await loginWithGoogle(payload);
      setGoogleResumeRequired(false);
      setPendingGooglePayload(null);
      setAuthError(null);
      setAuthSuccessMsg('Profile created! Signed in successfully.');

      const candidate = data?.candidate;
      setTimeout(() => {
        if (onSuccess) onSuccess(candidate);
        onClose();
      }, 500);
    } catch (err) {
      setAuthError(err.message || 'Could not complete profile registration.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Please enter your email and password.');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await login(authEmail.trim(), authPassword);
      setAuthSuccessMsg('Welcome back! Loading candidate profile...');
      const candidate = data?.candidate;
      setTimeout(() => {
        if (onSuccess) onSuccess(candidate);
        onClose();
      }, 500);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setAuthError('Full name, email, and password (min 6 chars) are required.');
      return;
    }
    const emailErr = validateCandidateEmail(regEmail);
    if (emailErr) {
      setAuthError(emailErr);
      return;
    }
    if (!regResume || regResume.size === 0) {
      setAuthError('Please upload a non-empty resume file to create your profile.');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    if (regPhone.trim()) {
      const regPhoneErr = validatePhone(regPhone, { required: false });
      if (regPhoneErr) {
        setAuthError(regPhoneErr);
        return;
      }
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', regName.trim());
      formData.append('email', regEmail.trim().toLowerCase());
      formData.append('password', regPassword);
      formData.append('phone', regPhone.trim());
      formData.append('title', regTitle.trim());
      formData.append('skills', regSkills.trim());
      if (regResume) {
        formData.append('resume', regResume);
      }
      const data = await register(formData);
      setAuthSuccessMsg('Candidate Profile created successfully!');
      const candidate = data?.candidate;
      setTimeout(() => {
        if (onSuccess) onSuccess(candidate);
        onClose();
      }, 500);
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#090a0c]/75 backdrop-blur-md font-sans animate-in fade-in duration-200">
      <div className="relative w-full max-w-[520px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-white/80 bg-[#fbfbf9] p-6 shadow-[0_32px_90px_-24px_rgba(0,0,0,.65)] sm:p-7 text-neutral-900">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-10 grid h-9 w-9 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:-translate-y-0.5 hover:text-neutral-950 cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Brand Header */}
        <div className="mb-6 pr-10 text-left">
          {authTab === 'register' && !googleResumeRequired && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-600 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-950" />
              <span>Candidate waiting list</span>
            </div>
          )}
          <h3 className="font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-neutral-950">
            {googleResumeRequired
              ? 'Complete your profile'
              : authTab === 'login'
              ? 'Welcome back'
              : 'Join the talent network'}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {googleResumeRequired
              ? 'One final step — add your résumé to enter the candidate pool.'
              : authTab === 'login'
              ? 'Sign in to manage your profile and matched opportunities.'
              : 'Use Google or email to create your verified candidate profile.'}
          </p>
        </div>

        {googleResumeRequired && (
          <div className="mb-5">
            <div className="mb-5 flex items-center justify-center gap-2 text-[11px] font-medium text-neutral-500">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Google account verified</span>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-900">Upload resume</span>
            </div>
            <ResumeUploadField
              file={regResume}
              onChange={(file) => {
                setRegResume(file);
                setAuthError(null);
              }}
              disabled={authLoading}
              required
            />
          </div>
        )}

        {/* Primary Action Button */}
        {googleResumeRequired ? (
          <button
            type="button"
            onClick={handleCompleteGoogleRegistration}
            disabled={authLoading || !regResume}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {authLoading ? (
              <span>Saving profile & signing in…</span>
            ) : (
              <>
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>Complete Profile & Sign In</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="mb-4 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-900 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleIcon className="w-4 h-4" />
            <span>{authLoading ? 'Connecting…' : 'Continue with Google'}</span>
          </button>
        )}

        {!googleResumeRequired && (
          <>
            {/* Divider */}
            <div className="relative mb-4 flex items-center justify-center">
              <div className="border-t border-neutral-200 w-full" />
              <span className="absolute bg-[#fbfbf9] px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                or continue with email
              </span>
            </div>

            {/* Tab Switcher */}
            <div className="mb-4 flex rounded-full border border-neutral-200 bg-neutral-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Create Profile
              </button>
            </div>
          </>
        )}

        {/* Alerts */}
        {authError && !authSuccessMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
            <span className="flex-1">{authError}</span>
          </div>
        )}

        {authSuccessMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>{authSuccessMsg}</span>
          </div>
        )}

        {/* TAB 1: LOGIN FORM */}
        {!googleResumeRequired && authTab === 'login' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="h-12 w-full rounded-xl border border-neutral-300 bg-neutral-50 pl-10 pr-3.5 text-sm text-neutral-900 placeholder-neutral-400 transition hover:bg-neutral-100/60 focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-neutral-300 bg-neutral-50 pl-10 pr-10 text-sm text-neutral-900 placeholder-neutral-400 transition hover:bg-neutral-100/60 focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-5 h-13 w-full rounded-full bg-neutral-950 px-5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authLoading ? 'Signing in…' : 'Sign in to continue'}
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER FORM */}
        {!googleResumeRequired && authTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Alex Johnson"
                  className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950/10"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Personal Email *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="alex@gmail.com"
                  className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                    regEmail && validateCandidateEmail(regEmail, { required: false })
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                  } h-11 rounded-xl px-3.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 transition-all`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Password (min 6) *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Target Role / Title
                </label>
                <input
                  type="text"
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  placeholder="e.g. Frontend Developer"
                  className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Key Skills
                </label>
                <input
                  type="text"
                  value={regSkills}
                  onChange={(e) => setRegSkills(e.target.value)}
                  placeholder="e.g. React, TypeScript, Node.js"
                  className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>

            <div className="pt-1">
              <ResumeUploadField
                file={regResume}
                onChange={(file) => {
                  setRegResume(file);
                  setAuthError(null);
                }}
                disabled={authLoading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-4 h-12 w-full rounded-full bg-neutral-950 px-5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authLoading ? 'Creating your profile…' : 'Create profile & join the pool'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
