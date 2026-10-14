import { useState, useRef } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { X, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { validateEmail } from '../utils/emailValidation';

const COMPANY_NAME_MAX_LENGTH = 255;
const FIELD_LIMITS = {
  company_name: COMPANY_NAME_MAX_LENGTH,
  industry: 100,
  size: 30,
  location: 150,
  tech_stack: 500,
  notes: 1000,
  name: 255,
  email: 255,
  password: 128,
};

function getFieldError(name, value) {
  const trimmed = value.trim();
  if (name === 'company_name' && trimmed.length < 2) return 'Company name must be at least 2 characters';
  if (name === 'name' && trimmed.length < 2) return 'Admin full name must be at least 2 characters';
  if (name === 'email') {
    const emailErr = validateEmail(trimmed);
    if (emailErr) return emailErr;
  }
  if (name === 'password' && !value) return 'Password is required';
  if (value.length > FIELD_LIMITS[name]) return `Maximum ${FIELD_LIMITS[name]} characters allowed`;
  if (name === 'password' && value.length < 4) return 'Password must be at least 4 characters';
  if (name === 'size' && trimmed) {
    if (!/^\d[\d,]*(?:\s*-\s*\d[\d,]*|\s*\+)?$/.test(trimmed)) return 'Use a number, range (50-200), or minimum (200+)';
    const [minimum, maximum] = trimmed.replaceAll(',', '').split('-').map((part) => Number.parseInt(part, 10));
    if (!Number.isSafeInteger(minimum) || minimum < 1 ||
        (maximum !== undefined && (!Number.isSafeInteger(maximum) || maximum < minimum))) {
      return 'Enter a valid company size range';
    }
  }
  if (name === 'tech_stack' && trimmed && !trimmed.split(',').some((skill) => skill.trim())) return 'Enter at least one technology';
  return '';
}

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

export default function OnboardCompanyModal({ isOpen, onClose, onSuccess }) {
  const { token } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nameStatus, setNameStatus] = useState(''); // '' | 'checking' | 'ok' | 'taken'
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const nameCheckTimer = useRef(null);
  const pointerStartedOnBackdrop = useRef(false);
  const pointerEndedOnBackdrop = useRef(false);

  if (!isOpen) return null;

  const validateField = (name, value) => {
    const message = getFieldError(name, value);
    setFieldErrors((previous) => {
      const next = { ...previous };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
    return !message;
  };

  const validateAll = () => {
    const errs = {};
    for (const [name, value] of Object.entries(form)) {
      const message = getFieldError(name, value);
      if (message) errs[name] = message;
    }
    if (nameStatus === 'taken') {
      errs.company_name = 'This company name already exists';
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

    // Debounced uniqueness check for company name
    if (name === 'company_name') clearTimeout(nameCheckTimer.current);
    if (name === 'company_name' && value.trim().length >= 2 && value.trim().length <= COMPANY_NAME_MAX_LENGTH) {
      setNameStatus('checking');
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


  const handleSubmit = async (e) => {
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
          name: form.company_name.trim(),
          tenant_type: 'client',
          industry: form.industry.trim() || undefined,
          size: form.size.trim() || undefined,
          location: form.location.trim() || undefined,
          tech_stack: techStack.length ? techStack : undefined,
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
          role: 'Admin',
          tenant_id: tenant.id,
        },
      });

      setForm({ ...EMPTY_FORM });
      setNameStatus('');
      setFieldErrors({});
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to onboard company.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-y-auto"
      onPointerDown={(event) => {
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
        pointerEndedOnBackdrop.current = false;
      }}
      onPointerUp={(event) => {
        pointerEndedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerCancel={() => {
        pointerStartedOnBackdrop.current = false;
        pointerEndedOnBackdrop.current = false;
      }}
      onClick={(event) => {
        if (pointerStartedOnBackdrop.current && pointerEndedOnBackdrop.current && event.target === event.currentTarget) onClose();
        pointerStartedOnBackdrop.current = false;
        pointerEndedOnBackdrop.current = false;
      }}
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
              Onboard Buyer Company
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Create the buyer tenant and its first company administrator.
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


          <form id="onboard-company-modal-form" onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off" noValidate>
            <p className="text-[11px] text-gray-500">Fields marked <span className="font-bold text-red-600">*</span> are required.</p>
            {/* Hidden trap inputs to prevent browser autofill of saved admin credentials */}
            <input type="text" name="prevent_autofill_name" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} autoComplete="off" readOnly />
            <input type="password" name="prevent_autofill_pwd" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} autoComplete="new-password" readOnly />

            {/* Company Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Company Name *
                </label>
                {nameStatus === 'taken' && (
                  <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                    ⚠ Already exists
                  </span>
                )}
                {nameStatus === 'ok' && !fieldErrors.company_name && (
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
                name="company_name"
                required
                minLength={2}
                maxLength={COMPANY_NAME_MAX_LENGTH}
                value={form.company_name}
                onChange={handleInput}
                aria-invalid={Boolean(fieldErrors.company_name || nameStatus === 'taken')}
                aria-describedby={fieldErrors.company_name ? 'company-name-error' : undefined}
                placeholder="e.g. Acme Systems"
                className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                  fieldErrors.company_name || nameStatus === 'taken'
                    ? 'border-red-400 bg-red-50/20'
                    : nameStatus === 'ok'
                    ? 'border-emerald-400'
                    : 'border-gray-200'
                }`}
              />
              {fieldErrors.company_name && (
                <p id="company-name-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.company_name}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-1 text-right">{form.company_name.length}/{COMPANY_NAME_MAX_LENGTH} characters</p>
            </div>

            {/* Row: Industry & Company Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Industry <span className="font-normal text-gray-500 normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  name="industry"
                  maxLength={FIELD_LIMITS.industry}
                  value={form.industry}
                  onChange={handleInput}
                  placeholder="Technology / Software"
                  aria-invalid={Boolean(fieldErrors.industry)}
                  aria-describedby={fieldErrors.industry ? 'industry-error' : undefined}
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${fieldErrors.industry ? 'border-red-400' : 'border-gray-200'}`}
                />
                {fieldErrors.industry && <p id="industry-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.industry}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company Size <span className="font-normal text-gray-500 normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  name="size"
                  maxLength={FIELD_LIMITS.size}
                  value={form.size}
                  onChange={handleInput}
                  placeholder="50-200"
                  aria-invalid={Boolean(fieldErrors.size)}
                  aria-describedby={fieldErrors.size ? 'size-error' : undefined}
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${fieldErrors.size ? 'border-red-400' : 'border-gray-200'}`}
                />
                {fieldErrors.size && <p id="size-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.size}</p>}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Location <span className="font-normal text-gray-500 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                name="location"
                maxLength={FIELD_LIMITS.location}
                value={form.location}
                onChange={handleInput}
                placeholder="Bangalore / Remote"
                aria-invalid={Boolean(fieldErrors.location)}
                aria-describedby={fieldErrors.location ? 'location-error' : undefined}
                className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${fieldErrors.location ? 'border-red-400' : 'border-gray-200'}`}
              />
              {fieldErrors.location && <p id="location-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.location}</p>}
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Tech Stack <span className="font-normal text-gray-500 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                name="tech_stack"
                maxLength={FIELD_LIMITS.tech_stack}
                value={form.tech_stack}
                onChange={handleInput}
                placeholder="React, Node.js, PostgreSQL, AWS"
                aria-invalid={Boolean(fieldErrors.tech_stack)}
                aria-describedby={fieldErrors.tech_stack ? 'tech-stack-error' : undefined}
                className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${fieldErrors.tech_stack ? 'border-red-400' : 'border-gray-200'}`}
              />
              {fieldErrors.tech_stack && <p id="tech-stack-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.tech_stack}</p>}
              <p className="text-[10px] text-gray-400 mt-1">
                Company's primary technology stack and technical environment.
              </p>
            </div>

            {/* About Company */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                About the Company <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                name="notes"
                maxLength={FIELD_LIMITS.notes}
                value={form.notes}
                onChange={handleInput}
                rows={2}
                placeholder="hp is a technology-focused organization with a modern digital product environment and a growing team."
                aria-invalid={Boolean(fieldErrors.notes)}
                aria-describedby={fieldErrors.notes ? 'notes-error' : undefined}
                className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all resize-none ${fieldErrors.notes ? 'border-red-400' : 'border-gray-200'}`}
              />
              {fieldErrors.notes && <p id="notes-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.notes}</p>}
              <p className="text-[10px] text-gray-400 mt-1 text-right">{form.notes.length}/{FIELD_LIMITS.notes} characters</p>
            </div>

            {/* Row: Admin Name & Admin Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Admin Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  minLength={2}
                  maxLength={FIELD_LIMITS.name}
                  value={form.name}
                  onChange={handleInput}
                  placeholder="e.g. Rahul Sharma"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'admin-name-error' : undefined}
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                    fieldErrors.name ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                />
                {fieldErrors.name && (
                  <p id="admin-name-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Admin Email *
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  required
                  maxLength={FIELD_LIMITS.email}
                  value={form.email}
                  onChange={handleInput}
                  placeholder="admin@company.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
                  className={`w-full px-3.5 py-2 text-xs text-gray-900 bg-white border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all ${
                    fieldErrors.email ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                />
                {fieldErrors.email && (
                  <p id="admin-email-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {/* Admin Password */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Admin Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  required
                  minLength={4}
                  maxLength={FIELD_LIMITS.password}
                  value={form.password}
                  onChange={handleInput}
                  placeholder="Create a secure password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
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
                <p id="admin-password-error" className="text-[11px] text-red-500 mt-1">{fieldErrors.password}</p>
              )}
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
            form="onboard-company-modal-form"
            disabled={submitting}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
              submitting ? 'bg-gray-800 cursor-not-allowed opacity-75' : 'bg-black hover:bg-gray-900'
            }`}
          >
            {submitting && <Loader2 size={13} className="animate-spin text-white" />}
            <span>{submitting ? 'Creating...' : 'Create company + admin'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
