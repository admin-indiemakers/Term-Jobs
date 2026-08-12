import { useState } from 'react';
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

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
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
              <label className="form-label">Vendor / Agency Name</label>
              <input
                type="text"
                name="vendor_name"
                required
                minLength={2}
                value={form.vendor_name}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. TalentBridge Consulting"
              />
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
              <label className="form-label">About the Vendor <span className="form-optional">(optional)</span></label>
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
              <input type="text" name="name" required value={form.name} onChange={handleInput} className="auth-input" placeholder="e.g. Priya Menon" />
            </div>
            <div>
              <label className="form-label">Recruiter Email</label>
              <input type="text" name="email" required inputMode="email" value={form.email} onChange={handleInput} className="auth-input" placeholder="recruiter@talentbridge.com" />
            </div>
            <div>
              <label className="form-label">Recruiter Password</label>
              <input type="password" name="password" required minLength={4} value={form.password} onChange={handleInput} className="auth-input" placeholder="••••••••" />
            </div>
            <div>
              <label className="form-label">Candidate Submission Limit</label>
              <input
                type="number"
                name="candidate_limit"
                min={1}
                value={form.candidate_limit}
                onChange={handleInput}
                className="auth-input"
                placeholder="e.g. 3"
              />
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
