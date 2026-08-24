import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icons, WelcomeBanner } from '../components/Dashboard';

const EMPTY_FORM = {
  vendor_name: '',
  industry: '',
  size: '',
  location: '',
  specializations: '',
  notes: '',
  name: '',
  email: '',
  password: '',
  candidate_limit: 3,
};

export default function OnboardVendor() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nameStatus, setNameStatus] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const nameCheckTimer = useRef(null);

  const validateField = (name, value) => {
    const errs = { ...fieldErrors };
    delete errs[name];
    if (name === 'vendor_name' && (!value || value.trim().length < 2)) {
      errs[name] = 'Vendor name must be at least 2 characters';
    }
    if (name === 'name' && (!value || value.trim().length < 2)) {
      errs[name] = 'Recruiter name is required';
    }
    if (name === 'email') {
      if (!value || !value.trim()) errs[name] = 'Recruiter email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) errs[name] = 'Enter a valid email address';
    }
    if (name === 'password') {
      if (!value) errs[name] = 'Password is required';
      else if (value.length < 4) errs[name] = 'Password must be at least 4 characters';
    }
    if (name === 'candidate_limit') {
      const num = Number(value);
      if (!value || isNaN(num) || num < 1) errs[name] = 'Must be at least 1';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateAll = () => {
    const fields = [
      ['vendor_name', form.vendor_name],
      ['name', form.name],
      ['email', form.email],
      ['password', form.password],
      ['candidate_limit', form.candidate_limit],
    ];
    const errs = {};
    for (const [k, v] of fields) {
      if (k === 'vendor_name' && (!v || v.trim().length < 2)) errs[k] = 'Vendor name must be at least 2 characters';
      if (k === 'name' && (!v || v.trim().length < 2)) errs[k] = 'Recruiter name is required';
      if (k === 'email') {
        if (!v || !v.trim()) errs[k] = 'Recruiter email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) errs[k] = 'Enter a valid email address';
      }
      if (k === 'password') {
        if (!v) errs[k] = 'Password is required';
        else if (v.length < 4) errs[k] = 'Password must be at least 4 characters';
      }
      if (k === 'candidate_limit') {
        const num = Number(v);
        if (!v || isNaN(num) || num < 1) errs[k] = 'Must be at least 1';
      }
    }
    if (nameStatus === 'taken') errs.vendor_name = 'This vendor name already exists';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setError('');
    setSuccess('');
    validateField(name, value);
    if (name === 'vendor_name' && value.trim().length >= 2) {
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
    } else if (name === 'vendor_name') {
      setNameStatus('');
    }
  };

  const handleAiDescribe = async () => {
    if (!form.vendor_name.trim()) {
      setError('Enter a vendor name first before using AI autofill.');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const res = await request('/api/auth/tenants/ai-describe', {
        method: 'POST',
        token,
        body: { name: form.vendor_name },
      });
      setForm((prev) => ({
        ...prev,
        industry: res.industry || prev.industry,
        size: res.size || prev.size,
        location: res.location || prev.location,
        specializations: res.tech_stack || prev.specializations,
        notes: res.notes || prev.notes,
      }));
    } catch (err) {
      setError('AI autofill failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const specializations = form.specializations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const tenant = await request('/api/auth/tenants', {
        method: 'POST',
        token,
        body: {
          name: form.vendor_name,
          tenant_type: 'consultancy',
          industry: form.industry,
          size: form.size,
          location: form.location,
          tech_stack: specializations,
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
          role: 'Recruiter',
          tenant_id: tenant.id,
          candidate_limit: Math.max(1, Math.round(Number(form.candidate_limit) || 0)),
        },
      });
      setSuccess(`Vendor "${form.vendor_name}" created with Recruiter account for ${form.email}.`);
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
        title="Onboard Vendor Consultancy"
        subtitle="Create a consultancy tenant and its first Recruiter account. Vendors screen candidates against published requisitions."
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
              Onboard Another Vendor
            </button>
          </div>
        </>
      )}

      <div className="glass-panel">
        <div className="form-panel-head">
          <div className="form-panel-icon">{Icons.users}</div>
          <div>
            <div className="form-panel-title">Vendor Details</div>
            <div className="form-panel-caption">
              Consultancy profile, specializations, and its first Recruiter account. Vendors submit screened candidates.
            </div>
          </div>
        </div>
        <form onSubmit={handleCreateVendor}>
          <div className="form-grid">
            <div>
              <label className="form-label">
                Vendor / Agency Name
                {nameStatus === 'taken' && <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, marginLeft: 8 }}>⚠ Already exists</span>}
                {nameStatus === 'ok' && <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600, marginLeft: 8 }}>✓ Available</span>}
                {nameStatus === 'checking' && <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, marginLeft: 8 }}>Checking...</span>}
              </label>
              <input
                type="text"
                name="vendor_name"
                required
                minLength={2}
                value={form.vendor_name}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. TalentBridge Consulting"
                style={nameStatus === 'taken' || fieldErrors.vendor_name ? { borderColor: '#dc2626' } : nameStatus === 'ok' ? { borderColor: '#059669' } : {}}
              />
              {fieldErrors.vendor_name && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.vendor_name}</p>}
            </div>
            <div>
              <label className="form-label">Industry</label>
              <input
                type="text"
                name="industry"
                value={form.industry}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. Staffing, Tech Recruiting"
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
                placeholder="e.g. 10-50, 200+"
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
              <label className="form-label">Specializations</label>
              <input
                type="text"
                name="specializations"
                value={form.specializations}
                onChange={handleInput}
                className="auth-input"
                placeholder="Comma separated — e.g. Backend, Frontend, Data Science, Cloud"
              />
              <p className="field-hint">Areas this vendor focuses on when sourcing candidates.</p>
            </div>
            <div className="form-field-full">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>About the Vendor <span className="form-optional">(optional)</span></label>
                <button
                  type="button"
                  onClick={handleAiDescribe}
                  disabled={aiLoading || !form.vendor_name.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 6, border: '1px solid #e0e7ff', background: aiLoading ? '#f5f3ff' : '#eef2ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 700, cursor: aiLoading || !form.vendor_name.trim() ? 'not-allowed' : 'pointer', opacity: aiLoading || !form.vendor_name.trim() ? 0.6 : 1 }}>
                  {aiLoading ? '⏳ Researching...' : '✨ Auto-fill with AI'}
                </button>
              </div>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInput}
                className="auth-input"
                rows={3}
                placeholder="Footprint, hiring strengths, anything Super Admin should know about the vendor."
              />
            </div>
            <div>
              <label className="form-label">Recruiter Full Name</label>
              <input type="text" name="name" required value={form.name} onChange={handleInput} onBlur={(e) => validateField('name', e.target.value)} className="auth-input" placeholder="e.g. Priya Menon" style={fieldErrors.name ? { borderColor: '#dc2626' } : {}} />
              {fieldErrors.name && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="form-label">Recruiter Email</label>
              <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} onBlur={(e) => validateField('email', e.target.value)} className="auth-input" placeholder="recruiter@talentbridge.com" style={fieldErrors.email ? { borderColor: '#dc2626' } : {}} />
              {fieldErrors.email && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="form-label">Recruiter Password</label>
              <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} onBlur={(e) => validateField('password', e.target.value)} className="auth-input" placeholder="••••••••" style={fieldErrors.password ? { borderColor: '#dc2626' } : {}} />
              {fieldErrors.password && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.password}</p>}
            </div>
            <div>
              <label className="form-label">Candidate Submission Limit</label>
              <input
                type="number"
                name="candidate_limit"
                min={1}
                value={form.candidate_limit}
                onChange={handleInput}
                onBlur={(e) => validateField('candidate_limit', e.target.value)}
                className="auth-input"
                placeholder="e.g. 3"
                style={fieldErrors.candidate_limit ? { borderColor: '#dc2626' } : {}}
              />
              {fieldErrors.candidate_limit && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>{fieldErrors.candidate_limit}</p>}
              <p className="field-hint">Max candidates this recruiter can submit per requisition. Defaults to 3.</p>
            </div>
          </div>
          <div className="form-actions" style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            <button type="submit" className="glow-btn" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Vendor + Recruiter'}
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
