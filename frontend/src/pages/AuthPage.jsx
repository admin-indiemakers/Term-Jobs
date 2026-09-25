import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SEOHead from '../components/SEOHead';
import { Backdrop } from '../components/landing/Backdrop';

function Mark() {
  return (
    <img
      src="/logo.png"
      alt="TermJobs Logo"
      className="h-8 w-8 object-contain rounded-md"
    />
  );
}

const FEATURES = [
  { title: 'Workforce Orchestration', text: 'Every role, requisition and approval in one command center.' },
  { title: 'AI-Assisted Hiring', text: 'Structured roles and candidate screening, guided by intelligence.' },
  { title: 'Enterprise Security', text: 'Role-based access and encrypted sessions across your teams.' },
];

export default function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    if (user.role === 'Candidate') return <Navigate to="/dashboard/candidate" replace />;
    if (user.role === 'Director') return <Navigate to="/dashboard/director" replace />;
    if (user.role === 'Super Admin') return <Navigate to="/dashboard/superadmin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedUser = await login(formData.email, formData.password);
      if (loggedUser?.role === 'Candidate') {
        navigate('/dashboard/candidate');
      } else if (loggedUser?.role === 'Director') {
        navigate('/dashboard/director');
      } else if (loggedUser?.role === 'Super Admin') {
        navigate('/dashboard/superadmin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clp">
      <SEOHead
        title="Sign In | Term Jobs Portal"
        description="Sign in to your Term Jobs portal to manage contractor requisitions, talent onboarding, timesheets, and automated workforce billing."
        canonicalUrl="https://termjobs.vercel.app/login"
      />

      <main className="clp-shell">
        {/* ——— Editorial / brand panel ——— */}
        <section className="clp-brand">
          {/* Statement section dark background system */}
          <Backdrop tone="dark" />

          <div className="clp-brand-inner">
            <Link to="/" className="clp-lockup" title="Return to Home">
              <span className="clp-mark"><Mark /></span>
              <span className="clp-wordmark">TERMJOBS</span>
              <span className="clp-edition">WORKFORCE</span>
            </Link>

            <div className="clp-hero">
              <p className="clp-eyebrow">Enterprise workforce automation</p>
              <h1 className="clp-headline">
                Command your
                <br />
                entire hiring
                <br />
                <span className="clp-headline-accent">operation.</span>
              </h1>
              <p className="clp-lede">
                Requisitions, approvals and candidates — orchestrated across your
                organization with clarity, speed and absolute control.
              </p>
            </div>

            <div className="clp-features">
              {FEATURES.map((f) => (
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

          <p className="clp-footnote">© 2026 TermJobs · Enterprise Platform v2.0</p>
        </section>

        {/* ——— Sign-in panel ——— */}
        <section className="clp-form-side">
          {/* Landing page background system */}
          <Backdrop tone="light" />

          <div className="clp-form-wrap">
            <Link to="/" className="clp-mobile-lockup" title="Return to Home">
              <span className="clp-mark"><Mark /></span>
              <span className="clp-wordmark">TERMJOBS</span>
              <span className="clp-edition">WORKFORCE</span>
            </Link>

            <div className="clp-form-head">
              <p className="clp-eyebrow">Welcome back</p>
              <h2 className="clp-form-title">Sign in to your workspace</h2>
              <p className="clp-form-sub">Access your role, assignments, and portal.</p>
            </div>

            <form onSubmit={handleSubmit} className="clp-form" noValidate autoComplete="off">
              {error && (
                <div className="clp-error" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <label className="clp-field">
                <span className="clp-label">Email, username, or Work Order ID</span>
                <div className="clp-input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <input
                    type="text"
                    name="email"
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => { e.target.readOnly = false; }}
                    onClick={(e) => { e.target.readOnly = false; }}
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@company.com or Work Order ID"
                    required
                    disabled={loading}
                    className="cursor-text"
                  />
                </div>
              </label>

              <label className="clp-field">
                <span className="clp-label">Password</span>
                <div className="clp-input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    readOnly
                    onFocus={(e) => { e.target.readOnly = false; }}
                    onClick={(e) => { e.target.readOnly = false; }}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    className="cursor-text"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="clp-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <button type="submit" disabled={loading} className="clp-submit">
                <span>{loading ? 'Signing in…' : 'Sign in to workspace'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>

            <div className="clp-foot">
              <span className="clp-secure">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Encrypted session
              </span>

              <Link to="/" className="clp-switch group" title="Return to Platform Overview">
                <span>Platform overview</span>
                <span className="clp-switch-arrow">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}