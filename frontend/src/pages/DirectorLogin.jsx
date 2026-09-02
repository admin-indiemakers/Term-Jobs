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

  if (user) return <Navigate to="/dashboard/director" replace />;

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
    <div className="director-login-page">
      <div className="director-login-bg">
        <div className="director-login-glow" />
        <div className="director-login-grid" />
      </div>

      <main className="director-login-card">
        <header className="director-login-header">
          <div className="director-login-brand">
            <div className="director-login-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 4v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V7z" />
              </svg>
            </div>
            <div>
              <span className="director-login-name">TERMJOBS</span>
              <span className="director-login-badge">DIRECTOR</span>
            </div>
          </div>
          <p className="director-login-subtitle">Executive Gateway — Read-only oversight of hiring activity</p>
        </header>

        <form onSubmit={handleSubmit} className="director-login-form" noValidate>
          {error && (
            <div className="director-login-error" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="director-login-field">
            <label htmlFor="email" className="director-login-label">Email Address</label>
            <div className="director-login-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="director@company.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="director-login-field">
            <label htmlFor="password" className="director-login-label">Password</label>
            <div className="director-login-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="director-login-submit"
          >
            <span>{loading ? 'Authorizing...' : 'Enter Director Portal'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        <footer className="director-login-footer">
          <span className="director-login-readonly">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2.5" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Read-only session — Directors cannot create or modify data</span>
          </span>
          <Link to="/login" className="director-login-switch">
            Switch to Employee Login
          </Link>
        </footer>
      </main>
    </div>
  );
}