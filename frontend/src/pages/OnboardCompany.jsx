import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, WelcomeBanner } from '../components/Dashboard';

const EMPTY_FORM = {
  company_name: '',
  industry: '',
  size: '',
  location: '',
  tech_stack: '',
  notes: '',
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
  const [nameStatus, setNameStatus] = useState(''); // '' | 'checking' | 'ok' | 'taken'
  const [aiLoading, setAiLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const nameCheckTimer = useRef(null);

  const validateField = (name, value) => {
    const errs = { ...fieldErrors };
    delete errs[name];
    if (name === 'company_name' && (!value || value.trim().length < 2)) {
      errs[name] = 'Company name must be at least 2 characters';
    }
    if (name === 'industry' && value && value.trim().length > 0 && value.trim().length < 2) {
      errs[name] = 'Industry must be at least 2 characters';
    }
    if (name === 'name' && (!value || value.trim().length < 2)) {
      errs[name] = 'Admin name is required';
    }
    if (name === 'email') {
      if (!value || !value.trim()) errs[name] = 'Admin email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) errs[name] = 'Enter a valid email address';
    }
    if (name === 'password') {
      if (!value) errs[name] = 'Password is required';
      else if (value.length < 4) errs[name] = 'Password must be at least 4 characters';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateAll = () => {
    const fields = [
      ['company_name', form.company_name],
      ['name', form.name],
      ['email', form.email],
      ['password', form.password],
    ];
    const errs = {};
    for (const [k, v] of fields) {
      if (k === 'company_name' && (!v || v.trim().length < 2)) errs[k] = 'Company name must be at least 2 characters';
      if (k === 'name' && (!v || v.trim().length < 2)) errs[k] = 'Admin name is required';
      if (k === 'email') {
        if (!v || !v.trim()) errs[k] = 'Admin email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) errs[k] = 'Enter a valid email address';
      }
      if (k === 'password') {
        if (!v) errs[k] = 'Password is required';
        else if (v.length < 4) errs[k] = 'Password must be at least 4 characters';
      }
    }
    if (nameStatus === 'taken') errs.company_name = 'This company name already exists';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setError('');
    setSuccess('');
    validateField(name, value);
    // Debounced uniqueness check for company name
    if (name === 'company_name' && value.trim().length >= 2) {
      setNameStatus('checking');
      clearTimeout(nameCheckTimer.current);
      nameCheckTimer.current = setTimeout(async () => {
        try {
          const res = await request(`/api/auth/tenants/check-name?name=${encodeURIComponent(value.trim())}`, { token });
          setNameStatus(res.taken ? 'taken' : 'ok');
        } catch {
          setNameStatus('');
        }
      }, 500);
    } else if (name === 'company_name') {
      setNameStatus('');
    }
  };

  const handleAiDescribe = async () => {
    if (!form.company_name.trim()) {
      setError('Enter a company name first before using AI autofill.');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const res = await request('/api/auth/tenants/ai-describe', {
        method: 'POST',
        token,
        body: { name: form.company_name },
      });
      setForm((prev) => ({
        ...prev,
        industry: res.industry || prev.industry,
        size: res.size || prev.size,
        location: res.location || prev.location,
        tech_stack: res.tech_stack || prev.tech_stack,
        notes: res.notes || prev.notes,
      }));
    } catch (err) {
      setError('AI autofill failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const techStack = form.tech_stack
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const tenant = await request('/api/auth/tenants', {
        method: 'POST',
        token,
        body: {
          name: form.company_name,
          tenant_type: 'client',
          industry: form.industry,
          size: form.size,
          location: form.location,
          tech_stack: techStack,
          notes: form.notes,
        },
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
          <div className="form-panel-caption">
            Company profile, tech stack, and its first Admin account. The profile feeds automated requisitions.
          </div>
          </div>
        </div>
        <form onSubmit={handleCreateCompany}>
          <div className="form-grid">
            <div>
              <label className="form-label">
                Company Name
                {nameStatus === 'taken' && <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, marginLeft: 8 }}>⚠ Already exists</span>}
                {nameStatus === 'ok' && <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600, marginLeft: 8 }}>✓ Available</span>}
                {nameStatus === 'checking' && <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, marginLeft: 8 }}>Checking...</span>}
              </label>
              <input
                type="text"
                name="company_name"
                required
                minLength={2}
                value={form.company_name}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. Acme Systems"
                style={nameStatus === 'taken' || fieldErrors.company_name ? { borderColor: '#dc2626' } : nameStatus === 'ok' ? { borderColor: '#059669' } : {}}
              />
              {fieldErrors.company_name && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.company_name}</p>}
            </div>
            <div>
              <label className="form-label">Industry</label>
              <input
                type="text"
                name="industry"
                value={form.industry}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. SaaS, Fintech, IT Services"
              />
            </div>
            <div>
              <label className="form-label">Company Size</label>
              <input
                type="text"
                name="size"
                value={form.size}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. 50-200, 1000+"
              />
            </div>
            <div>
              <label className="form-label">Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. Bangalore, Remote"
              />
            </div>
            <div className="form-field-full">
              <label className="form-label">Tech Stack</label>
              <input
                type="text"
                name="tech_stack"
                value={form.tech_stack}
                onChange={handleInput}
                className="auth-input"
                placeholder="Comma separated — e.g. Python, React, PostgreSQL, AWS"
              />
              <p className="field-hint">Used to auto-populate skills when the AI structures a requisition.</p>
            </div>
            <div className="form-field-full">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>About the Company <span className="form-optional">(optional)</span></label>
                <button
                  type="button"
                  onClick={handleAiDescribe}
                  disabled={aiLoading || !form.company_name.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 6, border: '1px solid #e0e7ff', background: aiLoading ? '#f5f3ff' : '#eef2ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 700, cursor: aiLoading || !form.company_name.trim() ? 'not-allowed' : 'pointer', opacity: aiLoading || !form.company_name.trim() ? 0.6 : 1 }}>
                  {aiLoading ? '⏳ Researching...' : '✨ Auto-fill with AI'}
                </button>
              </div>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInput}
                className="auth-input"
                rows={3}
                placeholder="Products, hiring culture, anything the AI should know about the company."
              />
            </div>
            <div>
              <label className="form-label">Admin Full Name</label>
              <input type="text" name="name" required value={form.name} onChange={handleInput} onBlur={(e) => validateField('name', e.target.value)} className="auth-input" placeholder="e.g. Rahul Sharma" style={fieldErrors.name ? { borderColor: '#dc2626' } : {}} />
              {fieldErrors.name && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="form-label">Admin Email</label>
              <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} onBlur={(e) => validateField('email', e.target.value)} className="auth-input" placeholder="admin@acme.com" style={fieldErrors.email ? { borderColor: '#dc2626' } : {}} />
              {fieldErrors.email && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="form-label">Admin Password</label>
              <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} onBlur={(e) => validateField('password', e.target.value)} className="auth-input" placeholder="••••••••" style={fieldErrors.password ? { borderColor: '#dc2626' } : {}} />
              {fieldErrors.password && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.password}</p>}
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
