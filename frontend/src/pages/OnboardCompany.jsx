import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, WelcomeBanner } from '../components/Dashboard';

const EMPTY_FORM = {
  company_name: '',
  name: '',
  email: '',
  password: '',
};

export default function OnboardCompany() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const tenant = await request('/api/auth/tenants', {
        method: 'POST',
        token,
        body: { name: form.company_name, tenant_type: 'client' },
      });
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          email: form.email,
          name: form.name,
          password: form.password,
          role: 'Admin',
          tenant_id: tenant.id,
        },
      });
      setSuccess(`Company "${form.company_name}" created with Admin account for ${form.email}.`);
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-narrow">
      <WelcomeBanner
        title="Onboard Buyer Company"
        subtitle="Create a client tenant and its Admin account in one step. Hiring Managers are provisioned later by the company's Admin."
      />

      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <>
          <div className="alert alert-success">{success}</div>
          <div className="glass-panel" style={{ display: 'flex', gap: 12 }}>
            <button className="glow-btn" onClick={() => navigate('/dashboard/superadmin')}>
              Back to Dashboard
            </button>
            <button className="ghost-btn" onClick={() => setForm({ ...EMPTY_FORM })}>
              Onboard Another Company
            </button>
          </div>
        </>
      )}

      <div className="glass-panel">
        <div className="form-panel-head">
          <div className="form-panel-icon">{Icons.building}</div>
          <div>
            <div className="form-panel-title">Company Details</div>
            <div className="form-panel-caption">Fill in the buyer company and its first Admin account.</div>
          </div>
        </div>
        <form onSubmit={handleCreateCompany}>
          <div className="form-grid">
            <div>
              <label className="form-label">Company Name</label>
              <input
                type="text"
                name="company_name"
                required
                minLength={2}
                value={form.company_name}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. Acme Systems"
              />
            </div>
            <div>
              <label className="form-label">Admin Full Name</label>
              <input type="text" name="name" required value={form.name} onChange={handleInput} className="auth-input" placeholder="e.g. Rahul Sharma" />
            </div>
            <div>
              <label className="form-label">Admin Email</label>
              <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="admin@acme.com" />
            </div>
            <div>
              <label className="form-label">Admin Password</label>
              <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} className="auth-input" placeholder="••••••••" />
            </div>
          </div>
          <div className="form-actions" style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            <button type="submit" className="glow-btn" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Company + Admin'}
            </button>
            <button type="button" className="ghost-btn" onClick={() => navigate('/dashboard/superadmin')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
