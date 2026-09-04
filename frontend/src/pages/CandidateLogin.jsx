import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function CandidateLogin() {
  const { user, loginWithCandidateId } = useAuth();

  const [candidateId, setCandidateId] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await loginWithCandidateId(candidateId, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen w-full flex bg-[#F7F7F5]"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        html, body, #root { height: 100%; margin: 0; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fade-up .45s ease both; }

        .field {
          border: 1px solid #E3E3E1;
          background: #FAFAFA;
          transition: border-color .2s ease, background .2s ease;
        }
        .field.is-focused {
          border-color: #0A0A0A;
          background: #ffffff;
        }
      `}</style>

      {/* ─── Sidebar ─── */}
      <aside className="w-[260px] shrink-0 bg-white border-r border-[#EDECE7] flex flex-col justify-between max-lg:hidden">
        <div>
          <div className="flex items-center gap-3 px-6 py-6 border-b border-[#EDECE7]">
            <img src="/logo.png" alt="TermJobs Logo" className="w-9 h-9 object-contain shrink-0" />
            <div>
              <div className="text-[14.5px] font-semibold text-[#0A0A0A] leading-tight">
                Term Jobs
              </div>
              <div className="text-[12px] text-[#8A8A87]">Candidate Portal</div>
            </div>
          </div>

          <div className="px-6 pt-6">
            <span className="text-[10.5px] tracking-[0.14em] uppercase text-[#A6A59F]">
              Access
            </span>
            <div className="mt-3">
              <div className="flex items-center gap-2.5 text-[14px] font-medium text-[#0A0A0A] bg-[#F1F0EC] rounded-lg px-3 py-2.5">
                <ShieldCheck size={15} strokeWidth={2} />
                Sign in
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#EDECE7]">
          <p className="text-[12px] text-[#A6A59F] leading-relaxed">
            Sign in with your Candidate ID and password to access your portal.
          </p>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col">
        {/* topbar */}
        <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-[#EDECE7] max-lg:px-5">
          <div className="flex items-center gap-1.5 text-[13.5px]">
            <span className="font-semibold text-[#0A0A0A]">candidate</span>
            <span className="text-[#B5B4AE]">/</span>
            <span className="text-[#6B6B67]">Sign in</span>
          </div>
          <Link
            to="/login"
            className="text-[12.5px] font-medium text-[#6B6B67] hover:text-[#0A0A0A] transition-colors"
          >
            Employee login →
          </Link>
        </div>

        {/* content */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="fade-up w-full max-w-[420px]">
            {/* mobile brand */}
            <div className="flex items-center gap-3 mb-8 max-lg:flex lg:hidden">
              <img src="/logo.png" alt="TermJobs Logo" className="w-9 h-9 object-contain shrink-0" />
              <div>
                <div className="text-[14.5px] font-semibold text-[#0A0A0A] leading-tight">
                  Term Jobs
                </div>
                <div className="text-[12px] text-[#8A8A87]">Candidate Portal</div>
              </div>
            </div>

            {/* heading */}
            <div className="mb-8">
              <span className="text-[11px] tracking-[0.14em] uppercase text-[#A6A59F] block mb-2">
                Welcome back
              </span>
              <h1 className="text-[26px] font-bold text-[#0A0A0A] tracking-[-0.01em] leading-[1.1]">
                Sign in to continue.
              </h1>
            </div>

            {/* form card */}
            <div className="bg-white border border-[#EDECE7] rounded-2xl px-7 py-7">
              {error && (
                <div className="mb-5 px-4 py-3 rounded-lg border border-dashed border-[#D9D8D2] bg-[#FAFAF8] text-[13px] text-[#3A3A37]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <label className="block mb-5">
                  <span className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase text-[#6B6B67] mb-2 font-medium">
                    Candidate ID
                  </span>
                  <div className={`field rounded-xl px-4 py-3 ${focused === 'id' ? 'is-focused' : ''}`}>
                    <input
                      type="text"
                      value={candidateId}
                      onChange={(e) => setCandidateId(e.target.value)}
                      onFocus={() => setFocused('id')}
                      onBlur={() => setFocused(null)}
                      placeholder="e.g. c885133a"
                      required
                      disabled={loading}
                      className="w-full bg-transparent outline-none text-[14.5px] text-[#0A0A0A] placeholder:text-[#B5B4AE]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  </div>
                </label>

                <label className="block mb-2">
                  <span className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase text-[#6B6B67] mb-2 font-medium">
                    <Lock size={12} strokeWidth={2} />
                    Password
                  </span>
                  <div className={`field rounded-xl px-4 py-3 ${focused === 'password' ? 'is-focused' : ''}`}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                      className="w-full bg-transparent outline-none text-[14.5px] text-[#0A0A0A] placeholder:text-[#B5B4AE]"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl py-3.5 text-[13.5px] font-semibold transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: loading ? '#333' : '#0A0A0A',
                    color: '#fff',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                  }}
                >
                  {loading ? (
                    'Signing in…'
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={15} strokeWidth={2} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#F1F0EC] flex items-center justify-between text-[12px] text-[#A6A59F]">
                <span className="flex items-center gap-1.5">
                  <Lock size={11} strokeWidth={2} />
                  Encrypted session
                </span>
                <Link to="/login" className="underline underline-offset-2 decoration-[#D9D8D2] hover:text-[#0A0A0A] transition-colors">
                  Employee login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
