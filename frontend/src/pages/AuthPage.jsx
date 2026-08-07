import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

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
    <div className="auth-page">
      <div className="matrix-grid"></div>
      <div className="ai-bg-glow"></div>
      <div className="ai-bg-glow-secondary"></div>

      <div className="glass-panel auth-panel">
        <div className="auth-heading">
          <h1>Term Jobs</h1>
          <p>Enterprise Workforce Automation Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="form-label">Email or Username</label>
            <input
              type="text"
              name="email"
              required
              autoComplete="username"
              inputMode="email"
              value={formData.email}
              onChange={handleInputChange}
              className="auth-input"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              className="auth-input"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="glow-btn auth-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div className="auth-switch">
          <span className="muted">Accounts are provisioned by your platform administrator.</span>
        </div>
      </div>
    </div>
  );
}
