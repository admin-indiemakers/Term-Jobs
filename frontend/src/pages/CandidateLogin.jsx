import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function CandidateLogin() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [candidateId, setCandidateId] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | verifying | signed-in
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== 'idle') return;
    setError('');
    setStatus('verifying');
    try {
      const loggedIn = await login(null, password, candidateId);
      if (loggedIn.role !== 'Candidate') {
        logout();
        setStatus('idle');
        setError('This portal is reserved for candidates. Please use the Employee Login for your account.');
        return;
      }
      setStatus('signed-in');
      setTimeout(() => navigate('/dashboard/candidate'), 900);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen w-full bg-white flex items-center justify-center px-6 py-16"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        html, body, #root { height: 100%; margin: 0; }

        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .rise { animation: rise .5s cubic-bezier(.2,.7,.2,1) both; }

        .field {
          border: 1px solid #E3E3E1;
          background: #FAFAFA;
          transition: border-color .2s ease, background .2s ease;
        }
        .field.is-focused {
          border-color: #0A0A0A;
          background: #ffffff;
        }

        @media (prefers-reduced-motion: reduce) {
          .rise { animation: none !important; }
        }
      `}</style>

      <div className="w-full max-w-[400px] rise">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]" />
          <span
            className="text-[11px] tracking-[0.24em] uppercase text-[#6B6B6B]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Candidate access
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-[#EAEAE7] rounded-[22px] px-7 sm:px-9 pt-9 pb-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div
              className="w-10 h-10 rounded-full border border-[#0A0A0A] flex items-center justify-center"
            >
              <ShieldCheck size={18} strokeWidth={1.75} color="#0A0A0A" />
            </div>
            <span className="text-[13px] tracking-[0.22em] uppercase font-semibold text-[#0A0A0A]">
              Termjobs
            </span>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, lineHeight: 1.5 }} role="alert">
              {error}
            </div>
          )}

          <span
            className="block text-[11px] tracking-[0.16em] uppercase text-[#8A8A87] mb-2"
          >
            Welcome back
          </span>
          <h1 className="text-[26px] font-bold text-[#0A0A0A] tracking-[-0.01em] leading-[1.1] mb-8">
            Sign in to continue.
          </h1>

          <label className="block mb-5">
            <span className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase text-[#6B6B6B] mb-2">
              <Mail size={12} strokeWidth={1.75} />
              Candidate ID or email
            </span>
            <div
              className={`field rounded-xl px-4 py-3 ${
                focused === 'id' ? 'is-focused' : ''
              }`}
            >
              <input
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                onFocus={() => setFocused('id')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. c885133a or you@email.com"
                className="w-full bg-transparent outline-none text-[14.5px] text-[#0A0A0A] placeholder:text-[#B5B4AE]"
              />
            </div>
          </label>

          <label className="block mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase text-[#6B6B6B]">
                <Lock size={12} strokeWidth={1.75} />
                Password
              </span>
            </div>
            <div
              className={`field rounded-xl px-4 py-3 ${
                focused === 'password' ? 'is-focused' : ''
              }`}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="Enter your password"
                className="w-full bg-transparent outline-none text-[14.5px] text-[#0A0A0A] placeholder:text-[#B5B4AE]"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={status !== 'idle'}
            className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-semibold transition-colors focus:outline focus:outline-2 focus:outline-offset-2"
            style={{
              background: status === 'signed-in' ? '#FFFFFF' : '#0A0A0A',
              color: status === 'signed-in' ? '#0A0A0A' : '#FFFFFF',
              border: status === 'signed-in' ? '1px solid #0A0A0A' : '1px solid transparent',
              outlineColor: '#0A0A0A',
            }}
          >
            {status === 'idle' && (
              <>
                Sign in
                <ArrowRight size={15} strokeWidth={2} />
              </>
            )}
            {status === 'verifying' && 'Verifying…'}
            {status === 'signed-in' && (
              <>
                <ShieldCheck size={15} strokeWidth={2} />
                Signed in
              </>
            )}
          </button>

          <div className="mt-7 pt-5 border-t border-[#F1F0EC] flex items-center justify-between text-[12px] text-[#8A8A87]">
            <span className="flex items-center gap-1.5">
              <Lock size={11} strokeWidth={2} />
              Encrypted session
            </span>
            <Link to="/login" className="underline underline-offset-2 decoration-[#D9D8D2] hover:text-[#0A0A0A]">
              Employee login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
