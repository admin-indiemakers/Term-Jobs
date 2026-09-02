import { useState, useRef } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Sparkles, X, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';

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

export default function OnboardVendorModal({ isOpen, onClose, onSuccess }) {
  const { token } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nameStatus, setNameStatus] = useState(''); // '' | 'checking' | 'ok' | 'taken'
  const [aiLoading, setAiLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const nameCheckTimer = useRef(null);

  if (!isOpen) return null;

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
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) errs[name] = 'Limit must be at least 1';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateAll = () => {
    const errs = {};
    if (!form.vendor_name || form.vendor_name.trim().length < 2) {
      errs.vendor_name = 'Vendor name must be at least 2 characters';
    }
    if (!form.name || form.name.trim().length < 2) {
      errs.name = 'Recruiter full name is required';
    }
    if (!form.email || !form.email.trim()) {
      errs.email = 'Recruiter email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 4) {
      errs.password = 'Password must be at least 4 characters';
    }
    const limitNum = parseInt(form.candidate_limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      errs.candidate_limit = 'Limit must be at least 1';
    }
    if (nameStatus === 'taken') {
      errs.vendor_name = 'This vendor name already exists';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
    validateField(name, value);

    // Debounced uniqueness check for vendor name
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
        body: { name: form.vendor_name.trim() },
      });
      setForm((prev) => ({
        ...prev,
        industry: res.industry || prev.industry || 'Staffing / Tech Recruiting',
        size: res.size || prev.size || '10-50',
        location: res.location || prev.location || 'Bangalore / Remote',
        specializations: res.tech_stack || prev.specializations || 'Backend, Frontend, Fullstack, Cloud',
        notes: res.notes || prev.notes || `${form.vendor_name} is a technical recruiting partner specializing in engineering roles.`,
      }));
    } catch (err) {
      setError('AI autofill failed: ' + (err.message || 'Please try again.'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const specs = form.specializations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const tenant = await request('/api/auth/tenants', {
        method: 'POST',
        token,
        body: {
          name: form.vendor_name.trim(),
          tenant_type: 'consultancy',
          industry: form.industry.trim() || undefined,
          size: form.size.trim() || undefined,
          location: form.location.trim() || undefined,
          specializations: specs.length ? specs : undefined,
          notes: form.notes.trim() || undefined,
        },
      });

      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          email: form.email.trim(),
          name: form.name.trim(),
          password: form.password,
          role: 'Recruiter',
          tenant_id: tenant.id,
          candidate_limit: parseInt(form.candidate_limit, 10) || 3,
        },
      });

      setSuccess(`Vendor "${form.vendor_name}" created with Recruiter account for ${form.email}.`);
      setForm({ ...EMPTY_FORM });
      setNameStatus('');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to onboard vendor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[640px] my-6 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg sm:text-[1.2rem] font-bold text-gray-900 tracking-tight">
              Onboard Vendor Consultancy
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Create the sourcing vendor and its first recruiter administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto pr-1 pt-4 pb-2 space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <Check size={15} className="shrink-0 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          {/* AI Auto-fill Banner */}
          <div className="bg-[#FAFAFA] border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900">AI Auto-fill</div>
                <div className="text-[11px] text-gray-500 truncate">
                  Enter the vendor name, then let AI suggest sourcing strengths and details.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAiDescribe}
              disabled={aiLoading || !form.vendor_name.trim()}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                aiLoading || !form.vendor_name.trim()
                  ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100 hover:border-gray-400 shadow-2xs'
              }`}
            >
              {aiLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin text-gray-600" />
                  <span>Researching...</span>
                </>
              ) : (
                <>
                  <span>+ Auto-fill with AI</span>
                </>
              )}
            </button>
          </div>

          <form id="onboard-vendor-modal-form" onSubmit={handleSubmit} className="space-y-3.5">
            {/* Vendor Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Vendor / Agency Name *
                </label>
                {nameStatus === 'taken' && (
                  <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                    ⚠ Already exists
                  </span>
                )}
                {nameStatus === 'ok' && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    ✓ Available
                  </span>
                )}
                {nameStatus === 'checking' && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    Checking...
                  </span>
                )}
              </div>
              <input
                type="text"
                name="vendor_name"
                required
                minLength={2}
                value={form.vendor_name}
                onChange={handleInput}
                placeholder="e.g. TalentBridge Sourcing"
                className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                  fieldErrors.vendor_name || nameStatus === 'taken'
                    ? 'border-red-400 bg-red-50/20'
                    : nameStatus === 'ok'
                    ? 'border-emerald-400'
                    : 'border-gray-200'
                }`}
              />
              {fieldErrors.vendor_name && (
                <p className="text-[11px] text-red-500 mt-1">{fieldErrors.vendor_name}</p>
              )}
            </div>

            {/* Row: Industry & Company Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  name="industry"
                  value={form.industry}
                  onChange={handleInput}
                  placeholder="Staffing / Recruiting"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company Size
                </label>
                <input
                  type="text"
                  name="size"
                  value={form.size}
                  onChange={handleInput}
                  placeholder="10-50"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleInput}
                placeholder="Bangalore / Remote"
                className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
              />
            </div>

            {/* Specializations */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Specializations
              </label>
              <input
                type="text"
                name="specializations"
                value={form.specializations}
                onChange={handleInput}
                placeholder="Backend, Frontend, Fullstack, Cloud, Data"
                className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Areas this vendor focuses on when sourcing candidates.
              </p>
            </div>

            {/* About Vendor */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                About the Vendor <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInput}
                rows={2}
                placeholder="Footprint, hiring strengths, anything Super Admin should know about the vendor."
                className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all resize-none"
              />
            </div>

            {/* Row: Recruiter Name & Recruiter Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Recruiter Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleInput}
                  placeholder="e.g. Priya Menon"
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                    fieldErrors.name ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-red-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Recruiter Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleInput}
                  placeholder="recruiter@vendor.com"
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                    fieldErrors.email ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-red-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {/* Row: Recruiter Password & Candidate Limit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Recruiter Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={4}
                    value={form.password}
                    onChange={handleInput}
                    placeholder="Create a secure password"
                    className={`w-full px-3.5 py-2 pr-16 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                      fieldErrors.password ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-1.5 py-0.5 rounded transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-red-500 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Submission Limit
                </label>
                <input
                  type="number"
                  name="candidate_limit"
                  min={1}
                  value={form.candidate_limit}
                  onChange={handleInput}
                  placeholder="3"
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                    fieldErrors.candidate_limit ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Max candidates per requisition (default 3).
                </p>
                {fieldErrors.candidate_limit && (
                  <p className="text-[11px] text-red-500 mt-1">{fieldErrors.candidate_limit}</p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="onboard-vendor-modal-form"
            disabled={submitting}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
              submitting ? 'bg-gray-800 cursor-not-allowed opacity-75' : 'bg-black hover:bg-gray-900'
            }`}
          >
            {submitting && <Loader2 size={13} className="animate-spin text-white" />}
            <span>{submitting ? 'Creating...' : 'Create vendor + recruiter'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
