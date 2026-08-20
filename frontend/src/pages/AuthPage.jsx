import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

function Mark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3l7 4v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V7z" />
    </svg>
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
      await login(formData.email, formData.password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clp">
      <div className="clp-aurora" />
      <div className="clp-grid" />

      <main className="clp-shell">
        {/* ——— Editorial / brand panel ——— */}
        <section className="clp-brand">
          <div className="clp-brand-glow" />

          <div className="clp-brand-inner">
            <div className="clp-lockup">
              <span className="clp-mark"><Mark /></span>
              <span className="clp-wordmark">TERMJOBS</span>
              <span className="clp-edition">WORKFORCE</span>
            </div>

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
          <div className="clp-form-wrap">
            <div className="clp-mobile-lockup">
              <span className="clp-mark"><Mark /></span>
              <span className="clp-wordmark">TERMJOBS</span>
              <span className="clp-edition">WORKFORCE</span>
            </div>

            <div className="clp-form-head">
              <p className="clp-eyebrow">Welcome back</p>
              <h2 className="clp-form-title">Sign in to your workspace</h2>
              <p className="clp-form-sub">Access your role, requisitions and teams.</p>
            </div>

            <form onSubmit={handleSubmit} className="clp-form" noValidate>
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
                <span className="clp-label">Email or username</span>
                <div className="clp-input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <input
                    type="text"
                    name="email"
                    autoComplete="username"
                    inputMode="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@company.com"
                    required
                    disabled={loading}
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
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
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
              <button
                type="button"
                className="clp-switch candidate-portal-link"
                onClick={() => navigate('/candidate/login')}
              >
                Candidate login
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}