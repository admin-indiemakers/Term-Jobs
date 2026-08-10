import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function DirectorLogin() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedIn = await login(formData.email, formData.password);
      if (loggedIn.role !== 'Director') {
        logout();
        setError('This portal is reserved for company Directors. Please use the Employee Login for your account.');
        return;
      }
      navigate('/dashboard/director');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b0d12] px-5 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 700px at 85% -10%, rgba(245,158,11,0.16), transparent 55%), radial-gradient(1000px 600px at 0% 110%, rgba(234,179,8,0.14), transparent 55%), radial-gradient(800px 500px at 50% 50%, rgba(255,255,255,0.05), transparent 60%), linear-gradient(160deg,#0b0d12 0%,#13141c 45%,#0b0d12 100%)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_20%,transparent_70%)]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="absolute -top-1/4 -left-1/4 h-[60vw] w-[60vw] min-h-[560px] min-w-[560px] rounded-full bg-amber-500/20 blur-[120px] animate-sa-drift" />
      <div className="absolute top-2/5 -right-1/5 h-[60vw] w-[60vw] min-h-[560px] min-w-[560px] rounded-full bg-yellow-400/15 blur-[120px] animate-sa-drift [animation-delay:-6s]" />
      <div className="absolute top-[10%] right-[30%] h-[60vw] w-[60vw] min-h-[560px] min-w-[560px] rounded-full bg-orange-500/15 blur-[120px] animate-sa-drift [animation-delay:-12s]" />

      <main className="relative z-[2] flex w-full max-w-[460px] flex-col items-center gap-7 animate-sa-rise">
        <header className="flex items-center gap-2.5 text-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-500/25 to-amber-500/5 text-amber-300 shadow-[0_0_24px_-6px_rgba(245,158,11,0.6)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
              <path d="M12 3l7 4v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V7z" />
            </svg>
          </div>
          <span className="text-[1.05rem] font-extrabold tracking-[0.18em] text-slate-50">TERMJOBS</span>
          <span className="rounded-md border border-amber-300/40 bg-amber-500/10 px-[7px] py-[3px] text-[0.6rem] font-bold tracking-[0.16em] text-amber-300">DIRECTOR</span>
        </header>

        <div className="relative w-full overflow-hidden rounded-[22px] border border-white/15 p-8 pb-7 backdrop-blur-2xl backdrop-saturate-150 max-sm:p-6"
          style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)' }}
        >
          <div className="pointer-events-none absolute -top-20 -right-14 h-[220px] w-[220px] rounded-full bg-amber-500/40 blur-[50px]" />

          <div className="mb-[18px] inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-amber-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-sa-pulse" />
            Executive Gateway
          </div>

          <h1 className="mb-2 text-[2rem] font-extrabold tracking-tight text-slate-50">
            Director <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 bg-clip-text text-transparent">Portal</span>
          </h1>
          <p className="mb-6 text-[0.9rem] leading-[1.55] text-slate-400">
            Company leadership access. View hiring activity across your organisation — read-only.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            <label className="flex flex-col gap-2">
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-amber-300">Email</span>
              <div className="flex h-[52px] items-center gap-3 rounded-[14px] border border-white/10 bg-slate-900/45 px-4 transition-all duration-200 focus-within:border-amber-400/60 focus-within:shadow-[0_0_0_4px_rgba(245,158,11,0.15),0_0_24px_-8px_rgba(245,158,11,0.5)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-amber-400">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.6-3.4 4.6-5 8-5s6.4 1.6 8 5" />
                </svg>
                <input
                  type="text"
                  name="email"
                  required
                  autoComplete="username"
                  inputMode="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="director@company.com"
                  className="flex-1 bg-transparent text-[0.95rem] text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-amber-300">Password</span>
              <div className="flex h-[52px] items-center gap-3 rounded-[14px] border border-white/10 bg-slate-900/45 px-4 transition-all duration-200 focus-within:border-amber-400/60 focus-within:shadow-[0_0_0_4px_rgba(245,158,11,0.15),0_0_24px_-8px_rgba(245,158,11,0.5)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-amber-400">
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  className="flex-1 bg-transparent text-[0.95rem] text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </label>

            {error && <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-[0.85rem] font-semibold text-rose-300">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-300 text-[0.95rem] font-bold text-slate-900 shadow-[0_12px_30px_-10px_rgba(245,158,11,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_38px_-12px_rgba(245,158,11,0.7)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{loading ? 'Authorizing...' : 'Enter Director Portal'}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-[18px]">
            <span className="inline-flex items-center gap-[7px] text-[0.78rem] text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-400">
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Read-only session
            </span>
            <Link to="/login" className="text-[0.82rem] font-semibold text-amber-300 transition-colors duration-200 hover:text-amber-100">
              Employee Login
            </Link>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-[18px] left-1/2 z-[2] -translate-x-1/2 text-[0.62rem] font-semibold tracking-[0.28em] text-slate-500/50">
        TERMJOBS CONTROL PLANE · DIRECTOR ACCESS
      </footer>
    </div>
  );
}
