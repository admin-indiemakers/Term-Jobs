import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { interviewApi } from '../services/interviewApi';

export function CandidateInterviewLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const urlEmail = searchParams.get('email');
    const urlPasscode = searchParams.get('passcode');
    const urlToken = searchParams.get('token');

    if (urlEmail) setEmail(urlEmail);
    if (urlPasscode) setPasscode(urlPasscode);
    if (urlToken) setToken(urlToken);

    // Auto-login if all required credentials are in URL
    if (urlEmail && (urlPasscode || urlToken)) {
      handleAutoLogin(urlEmail, urlPasscode, urlToken);
    }
  }, [searchParams]);

  const handleAutoLogin = async (eVal, pVal, tVal) => {
    setLoading(true);
    try {
      const res = await interviewApi.candidateLogin({
        email: eVal.trim().toLowerCase(),
        passcode: pVal ? pVal.trim().toUpperCase() : undefined,
        token: tVal ? tVal.trim() : undefined,
      });

      if (res && res.authenticated) {
        sessionStorage.setItem('termjobs_candidate_session', JSON.stringify(res));
        navigate('/interview/candidate');
      }
    } catch (err) {
      console.warn('Auto-login could not complete automatically, requiring manual submission:', err);
      setErrorMsg(err?.message || 'Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!passcode.trim() && !token.trim()) {
      setErrorMsg('Please enter your temporary interview passcode.');
      return;
    }

    setLoading(true);
    try {
      const res = await interviewApi.candidateLogin({
        email: email.trim().toLowerCase(),
        passcode: passcode.trim().toUpperCase(),
        token: token.trim() || undefined,
      });

      if (res && res.authenticated) {
        sessionStorage.setItem('termjobs_candidate_session', JSON.stringify(res));
        navigate('/interview/candidate');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Authentication failed. Please verify your email and passcode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-zinc-950 flex flex-col justify-between items-center p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2 text-zinc-950 font-black tracking-tight text-lg">
          <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-xs font-black">
            TJ
          </div>
          <span>Term Jobs</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 rounded-full shadow-xs">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Secure Candidate Portal</span>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xl p-7 sm:p-9 relative overflow-hidden">
          <div className="mb-6">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-950 flex items-center justify-center mb-4 shadow-xs">
              <KeyRound size={22} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950">Candidate Interview Login</h1>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Enter your invitation email and temporary interview passcode provided by the hiring team to access your interview portal.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-medium text-rose-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                Candidate Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-sm font-medium text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Temporary Passcode
                </label>
                <span className="text-[11px] text-zinc-400">e.g. TJ-INT-5829</span>
              </div>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  required
                  placeholder="TJ-INT-XXXX"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 font-mono text-sm font-bold text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Enter Interview Portal'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
            <p className="text-[11.5px] text-zinc-400">
              Need assistance? Contact your hiring manager or recruiter.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-4 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} Term Jobs Workforce Platform. All rights reserved.
      </footer>
    </div>
  );
}
