import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function AuthPage() {
  const { user, register, login } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [activeRole, setActiveRole] = useState('Hiring Manager');
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    company_name: '',
    industry: 'Fintech',
    size: '51-200 employees',
    location: 'Bangalore',
    tech_stack_input: 'Python, FastAPI, PostgreSQL, Docker, React',
    notes: 'Enterprise platform for automated recruitment.',
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        const techStackArray = formData.tech_stack_input
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        await register({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          role: activeRole,
          company_name: formData.company_name,
          tenant_type: activeRole === 'Recruiter' ? 'consultancy' : 'client',
          industry: formData.industry,
          size: formData.size,
          location: formData.location,
          tech_stack: techStackArray,
          notes: formData.notes,
        });
        setSuccessMsg(`Registration successful as ${activeRole}. Workspace initialized.`);
      } else {
        await login(formData.email, formData.password);
        setSuccessMsg('Session authenticated. Welcome back.');
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister((v) => !v);
    setError('');
    setSuccessMsg('');
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

        {isRegister && (
          <div className="role-tabs">
            {['Hiring Manager', 'Recruiter', 'Admin'].map((role) => (
              <button
                key={role}
                type="button"
                className={`role-tab ${activeRole === role ? 'active' : ''}`}
                onClick={() => setActiveRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <div className="form-row">
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="auth-input" placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="form-label">{activeRole === 'Recruiter' ? 'Agency / Consultancy Name' : 'Company Name'}</label>
                  <input type="text" name="company_name" required value={formData.company_name} onChange={handleInputChange} className="auth-input" placeholder={activeRole === 'Recruiter' ? 'e.g. Vendor A / Apex Staffing' : 'e.g. Acme Systems'} />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label className="form-label">Industry</label>
                  <input type="text" name="industry" value={formData.industry} onChange={handleInputChange} className="auth-input" placeholder="e.g. Fintech, Staffing, SaaS" />
                </div>
                <div>
                  <label className="form-label">Company Size</label>
                  <input type="text" name="size" value={formData.size} onChange={handleInputChange} className="auth-input" placeholder="e.g. 51-200 employees" />
                </div>
              </div>

              <div>
                <label className="form-label">Location</label>
                <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="auth-input" placeholder="e.g. Bangalore, Remote" />
              </div>

              <div>
                <label className="form-label">Primary Tech Stack Focus (Comma-separated)</label>
                <input type="text" name="tech_stack_input" value={formData.tech_stack_input} onChange={handleInputChange} className="auth-input" placeholder="Python, FastAPI, Postgres, Docker, React" />
              </div>

              <div>
                <label className="form-label">{activeRole === 'Recruiter' ? 'Recruitment Agency Overview' : 'Company Overview & Vision'}</label>
                <textarea name="notes" rows="2" value={formData.notes} onChange={handleInputChange} className="auth-input" placeholder={activeRole === 'Recruiter' ? 'Describe your talent acquisition agency focus...' : 'Describe enterprise engineering priorities...'} style={{ resize: 'none', fontFamily: 'inherit' }} />
              </div>
            </>
          )}

          <div>
            <label className="form-label">Email Address</label>
            <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="auth-input" placeholder="name@company.com" />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input type="password" name="password" required value={formData.password} onChange={handleInputChange} className="auth-input" placeholder="••••••••" />
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          <button type="submit" className="glow-btn auth-submit" disabled={loading}>
            {loading ? 'Processing...' : isRegister ? `Initialize ${activeRole} Account` : 'Sign In to Workspace'}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? 'Already registered?' : 'Need an enterprise workspace?'}{' '}
          <button type="button" onClick={toggleMode} className="auth-switch-link">
            {isRegister ? 'Sign in here' : 'Register workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
