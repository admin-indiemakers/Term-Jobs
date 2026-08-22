import { useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function CandidateLogin() {
  const { user, loginWithCandidateId, logout } = useAuth();
  const navigate = useNavigate();

  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [candidateId, setCandidateId] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | swiping | verified | failed
  const [error, setError] = useState('');

  const sessionCode = '4471 · 09A2 · MRDN';

  if (user) return <Navigate to="/" replace />;

  const handleMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -8, y: px * 10 });
  };

  const handleLeave = () => setTilt({ x: 0, y: 0 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'swiping' || status === 'verified') return;
    setError('');
    setStatus('swiping');
    try {
      const loggedIn = await loginWithCandidateId(candidateId, password);
      if (loggedIn.role !== 'Candidate') {
        logout();
        setStatus('idle');
        setError('This portal is reserved for candidates. Please use the Employee Login for your account.');
        return;
      }
      setStatus('verified');
      setTimeout(() => navigate('/'), 900);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="clpcm min-h-screen w-full flex items-center justify-center bg-[#F1F0EC] px-6 py-16"
    >
      <style>{`
        html, body, #root { height: 100%; margin: 0; }

        .canvas-dots {
          background-image: radial-gradient(#00000014 1px, transparent 1px);
          background-size: 22px 22px;
        }

        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .rise { animation: rise .6s cubic-bezier(.2,.7,.2,1) both; }

        @keyframes shimmer-sweep {
          0% { transform: translateX(-140%) skewX(-12deg); }
          100% { transform: translateX(220%) skewX(-12deg); }
        }
        .shimmer::after {
          content: "";
          position: absolute;
          top: -20%;
          left: 0;
          width: 40%;
          height: 140%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent);
          animation: shimmer-sweep 5.5s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes stripe-swipe {
          0% { transform: translateX(-105%); }
          100% { transform: translateX(105%); }
        }
        .stripe-swipe {
          animation: stripe-swipe 0.85s cubic-bezier(.5,0,.2,1) forwards;
        }

        .card-field {
          border-bottom: 1px solid rgba(255,255,255,0.14);
          transition: border-color .2s ease;
        }
        .card-field.is-focused {
          border-color: rgba(255,255,255,0.65);
        }

        .clpcm-error {
          margin-bottom: 18px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px dashed rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.04);
          color: #f5f5f5;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (prefers-reduced-motion: reduce) {
          .rise, .shimmer::after, .stripe-swipe { animation: none !important; }
        }
      `}</style>

      <div className="canvas-dots fixed inset-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center rise">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]/70" />
          <span
            className="text-[11px] tracking-[0.28em] uppercase text-[#0A0A0A]/55"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Candidate access
          </span>
        </div>

        {/* the card object */}
        <div
          ref={cardRef}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          style={{
            transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform .35s cubic-bezier(.2,.7,.2,1)',
            background: 'linear-gradient(155deg, #1c1c1c 0%, #0d0d0d 45%, #000000 100%)',
            boxShadow:
              '0 40px 80px -24px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(255,255,255,0.07)',
          }}
          className="shimmer relative w-full max-w-[420px] rounded-[26px] px-8 sm:px-10 pt-8 pb-9 overflow-hidden"
        >
          {/* top row: chip + wordmark */}
          <div className="flex items-center justify-between mb-10">
            <div
              className="w-10 h-8 rounded-[6px]"
              style={{
                background: 'linear-gradient(135deg, #d9d9d6, #8b8b86 45%, #d9d9d6)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
              }}
            >
              <div className="w-full h-full grid grid-rows-3 gap-[2px] p-[3px]">
                <div className="border-b border-black/20" />
                <div className="border-b border-black/20" />
                <div />
              </div>
            </div>
            <span className="text-white/70 text-[12px] tracking-[0.24em] uppercase font-semibold">
              TermJobs
            </span>
          </div>

          {/* embossed headline */}
          <div className="mb-9">
            <span
              className="block text-[10.5px] tracking-[0.24em] uppercase text-white/35 mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Welcome back
            </span>
            <h1
              className="text-white font-semibold tracking-[0.01em]"
              style={{ fontSize: '26px', textShadow: '0 1px 0 rgba(255,255,255,0.08)' }}
            >
              Present your credentials.
            </h1>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="clpcm-error" role="alert">
                {error}
              </div>
            )}

            <label className="block mb-6">
              <span className="flex items-center gap-2 text-[10.5px] tracking-[0.16em] uppercase text-white/35 mb-2.5">
                <Mail size={12} strokeWidth={1.75} />
                Candidate ID
              </span>
              <div className={`card-field pb-2.5 ${focused === 'email' ? 'is-focused' : ''}`}>
                <input
                  type="text"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="e.g. c885133a"
                  className="w-full bg-transparent outline-none text-[15px] tracking-wide text-white placeholder:text-white/25"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
            </label>

            <label className="block mb-9">
              <span className="flex items-center gap-2 text-[10.5px] tracking-[0.16em] uppercase text-white/35 mb-2.5">
                <Lock size={12} strokeWidth={1.75} />
                Password
              </span>
              <div className={`card-field pb-2.5 ${focused === 'password' ? 'is-focused' : ''}`}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••••"
                  className="w-full bg-transparent outline-none text-[15px] tracking-wide text-white placeholder:text-white/25"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
            </label>

            {/* magnetic-stripe submit */}
            <button
              type="submit"
              disabled={status === 'swiping' || status === 'verified'}
              className="relative w-full h-12 rounded-[10px] overflow-hidden flex items-center justify-center gap-2 text-[13px] font-semibold tracking-[0.06em] uppercase focus:outline focus:outline-2 focus:outline-offset-2"
              style={{
                background:
                  status === 'verified'
                    ? 'linear-gradient(90deg, #e9e9e6, #ffffff)'
                    : '#050505',
                color: status === 'verified' ? '#0A0A0A' : '#F2F2F0',
                border: '1px solid rgba(255,255,255,0.14)',
                outlineColor: '#ffffff',
              }}
            >
              {status === 'swiping' && (
                <span
                  className="stripe-swipe absolute inset-y-0 left-0 w-1/3"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {status === 'idle' && (
                  <>
                    Swipe to verify
                    <ArrowRight size={14} strokeWidth={2} />
                  </>
                )}
                {status === 'swiping' && 'Reading card…'}
                {status === 'verified' && (
                  <>
                    <ShieldCheck size={14} strokeWidth={2} />
                    Access verified
                  </>
                )}
              </span>
            </button>
          </form>

          {/* bottom card details row */}
          <div className="mt-7 pt-5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10.5px] tracking-[0.12em] text-white/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {sessionCode}
            </span>
            <span className="text-[10.5px] tracking-[0.12em] uppercase text-white/30">
              Valid · encrypted
            </span>
          </div>
        </div>

        <Link
          to="/login"
          className="mt-7 text-[13px] text-[#0A0A0A]/50 hover:text-[#0A0A0A] underline underline-offset-4 decoration-[#0A0A0A]/25"
        >
          Employee login
        </Link>
      </div>
    </div>
  );
}