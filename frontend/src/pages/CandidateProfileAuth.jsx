import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  Briefcase, 
  Phone, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Upload
} from 'lucide-react';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import SEOHead from '../components/SEOHead';
import { Backdrop } from '../components/landing/Backdrop';

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '215468136876-3e4icbpr6blejlb9vibvecr6ck2tfm5g.apps.googleusercontent.com';

const CANDIDATE_FEATURES = [
  { 
    title: '1-Click Direct Apply', 
    text: 'Set up your talent profile and mandatory resume once — apply across all open requisitions with a single click.' 
  },
  { 
    title: 'Verified Enterprise Requisitions', 
    text: 'Direct contract and full-time opportunities posted by Bearitt and partner hiring teams.' 
  },
  { 
    title: 'Intelligent Competency Screening', 
    text: 'Automated skill extraction and matching directly against hiring manager role criteria.' 
  },
];

function Mark() {
  return (
    <img
      src="/logo.png"
      alt="TermJobs Logo"
      className="h-8 w-8 object-contain rounded-md"
    />
  );
}

export default function CandidateProfileAuth({ onLoginSuccess, onBackToHome }) {
  const { login, loginWithGoogle, register } = useCandidateAuth();

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regSkills, setRegSkills] = useState('');
  const [regLinkedin, setRegLinkedin] = useState('');
  const [regResume, setRegResume] = useState(null);

  // Load Google Identity Services SDK on component mount
  useEffect(() => {
    if (document.getElementById('google-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // Trigger Google OAuth popup
  const handleGoogleClick = () => {
    setError('');

    if (!GOOGLE_CLIENT_ID) {
      setError(
        'Google OAuth Client ID is not configured yet. Please use the email & password form below.'
      );
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError('Google Sign-In SDK is loading. Please try again in a few seconds.');
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }

          if (tokenResponse.access_token) {
            setLoading(true);
            setError('');
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

              await loginWithGoogle({
                access_token: tokenResponse.access_token,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub,
              });
              setSuccessMsg('Signed in with Google successfully! Unlocking Open Roles...');
              setTimeout(() => {
                if (onLoginSuccess) onLoginSuccess();
              }, 400);
            } catch (err) {
              setError(err.message || 'Google authentication failed.');
            } finally {
              setLoading(false);
            }
          }
        },
        error_callback: (err) => {
          console.warn('Google OAuth token client error:', err);
          const currentOrigin = window.location.origin;
          setError(
            `Google OAuth Error (origin_mismatch): "${currentOrigin}" is not registered in Google Cloud Console. Please add "${currentOrigin}" to Authorized JavaScript origins.`
          );
        },
      });

      client.requestAccessToken();
    } catch (err) {
      console.error('Google OAuth trigger error:', err);
      setError('Could not open Google Sign-In popup. Please check your browser popup blocker.');
    }
  };

  // Handle Standard Email Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      setSuccessMsg('Welcome back! Opening open roles...');
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess();
      }, 400);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Talent Profile Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Name, email, and password (min 6 characters) are required.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', regName.trim());
      formData.append('email', regEmail.trim().toLowerCase());
      formData.append('password', regPassword);
      formData.append('phone', regPhone.trim());
      formData.append('title', regTitle.trim());
      formData.append('skills', regSkills.trim());
      formData.append('linkedin_url', regLinkedin.trim());
      if (regResume) {
        formData.append('resume', regResume);
      }

      await register(formData);
      setSuccessMsg('Talent Profile created successfully! Opening Open Roles...');
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess();
      }, 500);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clp">
      <SEOHead
        title="Candidate Profile Sign In | TermJobs Talent Portal"
        description="Access live enterprise open roles, 1-click apply with your candidate profile, and track your interview invitations."
        canonicalUrl="https://termjobs.vercel.app/#jobs"
      />

      <main className="clp-shell">
        {/* ——— Left Side: TermJobs Editorial / Brand Panel ——— */}
        <section className="clp-brand">
          <Backdrop tone="dark" />

          <div className="clp-brand-inner">
            <button
              onClick={onBackToHome}
              type="button"
              className="clp-lockup border-none bg-transparent p-0 text-left cursor-pointer"
              title="Return to Home"
            >
              <span className="clp-mark"><Mark /></span>
              <span className="clp-wordmark">TERMJOBS</span>
              <span className="clp-edition">CANDIDATE</span>
            </button>

            <div className="clp-hero">
              <p className="clp-eyebrow">Enterprise talent access</p>
              <h1 className="clp-headline">
                Access verified
                <br />
                contractor roles
                <br />
                <span className="clp-headline-accent">with confidence.</span>
              </h1>
              <p className="clp-lede">
                Browse open requisitions across verified partner enterprises. Set up your profile once with your master resume, and apply to any position with a single click.
              </p>
            </div>

            <div className="clp-features">
              {CANDIDATE_FEATURES.map((f) => (
                <div key={f.title} className="clp-feature">
                  <span className="clp-feature-index" />
                  <div>
                    <h3 className="clp-feature-title">{f.title}</h3>
                    <p className="clp-feature-text">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="clp-footnote">© 2026 TermJobs · Candidate Network v2.0</p>
        </section>

        {/* ——— Right Side: Clean TermJobs Auth Panel ——— */}
        <section className="clp-form-side">
          <Backdrop tone="light" />
          <div className="clp-form-wrap">
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={onBackToHome}
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#666660] hover:text-[#0A0A0A] transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <ArrowLeft size={14} />
                <span>Back to Homepage</span>
              </button>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5F5F2] border border-[#E5E5E0] text-[11px] font-semibold text-[#0A0A0A]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Talent Access Gateway
              </div>
            </div>

            {/* Mobile Lockup */}
            <button
              onClick={onBackToHome}
              type="button"
              className="clp-mobile-lockup border-none bg-transparent p-0 cursor-pointer"
              title="Return to Home"
            >
              <span className="clp-mark"><Mark /></span>
              <span className="clp-wordmark">TERMJOBS</span>
              <span className="clp-edition">CANDIDATE</span>
            </button>

            {/* Form Header */}
            <div className="clp-form-head mb-5">
              <p className="clp-eyebrow">Candidate Network</p>
              <h2 className="clp-form-title">
                {activeTab === 'login' ? 'Sign in to Open Roles' : 'Create Talent Profile'}
              </h2>
              <p className="clp-form-sub">
                {activeTab === 'login' 
                  ? 'Access verified enterprise requisitions and 1-click applications.' 
                  : 'Join the verified talent network to browse and apply for roles.'}
              </p>
            </div>

            {/* Google OAuth (Primary Action) */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-[#FAFAF8] text-[#0A0A0A] font-semibold text-sm border border-[#E5E5E0] shadow-xs active:scale-[0.99] transition-all cursor-pointer mb-5 disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.15C3.25 21.36 7.31 24 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.61l4 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-[#E5E5E0] w-full" />
              <span className="bg-paper px-3 text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] absolute">
                or use candidate email
              </span>
            </div>

            {/* Tab Selector */}
            <div className="flex p-1 bg-[#F5F5F2] border border-[#E5E5E0] rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer border-none ${
                  activeTab === 'login'
                    ? 'bg-[#0A0A0A] text-white shadow-xs'
                    : 'text-[#666660] hover:text-[#0A0A0A] bg-transparent'
                }`}
              >
                Candidate Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setError('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer border-none ${
                  activeTab === 'register'
                    ? 'bg-[#0A0A0A] text-white shadow-xs'
                    : 'text-[#666660] hover:text-[#0A0A0A] bg-transparent'
                }`}
              >
                Create Talent Profile
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="clp-error mb-4">
                <AlertCircle size={18} className="text-[#0a0a0a] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-start gap-2.5 mb-4">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: CANDIDATE SIGN IN */}
            {activeTab === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-4" noValidate autoComplete="off">
                <label className="clp-field">
                  <span className="clp-label">Candidate Email</span>
                  <div className="clp-input">
                    <Mail size={18} className="text-[#8A8A85]" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@domain.com"
                      disabled={loading}
                    />
                  </div>
                </label>

                <label className="clp-field">
                  <span className="clp-label">Password</span>
                  <div className="clp-input">
                    <Lock size={18} className="text-[#8A8A85]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="clp-password-toggle bg-transparent border-none cursor-pointer p-1 text-[#8A8A85] hover:text-[#0A0A0A]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <button type="submit" disabled={loading} className="clp-submit w-full mt-2 cursor-pointer border-none">
                  <span>{loading ? 'Authenticating…' : 'Sign In to Candidate Profile'}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>
            )}

            {/* TAB 2: CREATE TALENT PROFILE */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5" noValidate autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="clp-field">
                    <span className="clp-label">Full Name *</span>
                    <div className="clp-input">
                      <User size={18} className="text-[#8A8A85]" />
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Arjun Sharma"
                        disabled={loading}
                      />
                    </div>
                  </label>

                  <label className="clp-field">
                    <span className="clp-label">Email *</span>
                    <div className="clp-input">
                      <Mail size={18} className="text-[#8A8A85]" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="arjun@example.com"
                        disabled={loading}
                      />
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="clp-field">
                    <span className="clp-label">Password *</span>
                    <div className="clp-input">
                      <Lock size={18} className="text-[#8A8A85]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        disabled={loading}
                      />
                    </div>
                  </label>

                  <label className="clp-field">
                    <span className="clp-label">Phone</span>
                    <div className="clp-input">
                      <Phone size={18} className="text-[#8A8A85]" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        disabled={loading}
                      />
                    </div>
                  </label>
                </div>

                <label className="clp-field">
                  <span className="clp-label">Professional Title</span>
                  <div className="clp-input">
                    <Briefcase size={18} className="text-[#8A8A85]" />
                    <input
                      type="text"
                      value={regTitle}
                      onChange={(e) => setRegTitle(e.target.value)}
                      placeholder="e.g. Senior Frontend Engineer"
                      disabled={loading}
                    />
                  </div>
                </label>

                <label className="clp-field">
                  <span className="clp-label">Skills (comma-separated)</span>
                  <div className="clp-input">
                    <Sparkles size={18} className="text-[#8A8A85]" />
                    <input
                      type="text"
                      value={regSkills}
                      onChange={(e) => setRegSkills(e.target.value)}
                      placeholder="React, TypeScript, Next.js, Python"
                      disabled={loading}
                    />
                  </div>
                </label>

                <label className="clp-field">
                  <span className="clp-label">Resume Upload (optional)</span>
                  <div className="border border-dashed border-[#D5D5D0] hover:border-[#0A0A0A] rounded-xl p-3 text-center transition-colors bg-[#FAFAF8] cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setRegResume(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex items-center justify-center gap-2 text-xs text-[#666660]">
                      <Upload size={16} className="text-[#0A0A0A]" />
                      <span className="font-semibold text-[#0A0A0A]">{regResume ? regResume.name : 'Click to select resume (PDF/DOCX)'}</span>
                    </div>
                  </div>
                </label>

                <button type="submit" disabled={loading} className="clp-submit w-full mt-2 cursor-pointer border-none">
                  <span>{loading ? 'Creating Profile…' : 'Create Profile & Access Roles'}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>
            )}

            {/* Footnote */}
            <div className="clp-foot mt-5 pt-4 border-t border-[#EAEAE6]">
              <span className="clp-secure text-xs text-[#8A8A85] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Verified candidate session · Separate from workforce login
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
