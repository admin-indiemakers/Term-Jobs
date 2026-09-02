import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import {
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  Lock,
  User,
  Mail,
  Briefcase,
  Shield
} from 'lucide-react';

export default function JoinDirector() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Company / Tenant context (from URL param or default to Bearitt)
  const companyParam = searchParams.get('company') || searchParams.get('company_name') || 'Bearitt';
  const tenantIdParam = searchParams.get('tenant_id') || searchParams.get('tenant') || '';

  const [companyName, setCompanyName] = useState(companyParam);
  const [tenantId, setTenantId] = useState(tenantIdParam);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch company details if tenantId or company query param passed
  useEffect(() => {
    request(`/api/auth/join/company-info?company=${encodeURIComponent(companyParam)}&tenant_id=${encodeURIComponent(tenantIdParam)}`)
      .then((data) => {
        if (data?.company_name) setCompanyName(data.company_name);
        if (data?.tenant_id) setTenantId(data.tenant_id);
      })
      .catch(() => {});
  }, [companyParam, tenantIdParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your company email address.');
      return;
    }
    if (!password) {
      setError('Please provide a password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters in length.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim() || 'Executive',
        password,
        company_name: companyName,
        tenant_id: tenantId || undefined,
      };

      await request('/api/auth/join/director', {
        method: 'POST',
        body: payload,
      });

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to submit access request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-6 md:p-10"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="w-full max-w-2xl bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-10 md:p-12 shadow-sm text-left">
        {/* Top Header Tag Bar */}
        <div className="flex items-center justify-between pb-3">
          <span className="text-[11px] font-extrabold tracking-widest text-gray-500 uppercase">
            {companyName} • TEAM ACCESS
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-[11px] font-bold text-gray-800 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            SECURE INVITE
          </span>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200/80 shadow-2xs">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Access Request Submitted!
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                Your access request for <strong>{companyName}</strong> has been submitted successfully. You can log in after the company administrator approves your account.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/director/login')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-black hover:bg-gray-900 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Login</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Title & Subtitle */}
            <div className="mt-4 mb-6">
              <h1 className="text-2xl sm:text-[1.85rem] font-extrabold text-gray-900 tracking-tight">
                Join as a Director
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5 leading-relaxed">
                Complete the form below. Your account will be created as a pending request and activated after company admin approval.
              </p>
            </div>

            {/* Info Callout Card */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-4.5 flex items-center gap-4 mb-6 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-black text-white font-extrabold text-base flex items-center justify-center shrink-0">
                D
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>Director access</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 font-semibold text-gray-600 border border-gray-200">
                    Executive Oversight
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                  You can review and oversee executive job requisitions after approval.
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Full Name & Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Anand Menon"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@company.com"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-all font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Department & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Department / Area
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Executive, Engineering, Product"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 pr-14 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-black cursor-pointer select-none"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Use at least 8 characters.</p>
                </div>
              </div>

              {/* Row 3: Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 pr-14 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-black cursor-pointer select-none"
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Bottom Info & Submit Button */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-[11px] text-gray-400 max-w-sm leading-relaxed">
                  By submitting, your access request will be sent to the {companyName} company administrator for approval.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-black hover:bg-gray-900 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <span>{submitting ? 'Submitting...' : 'Submit Access Request →'}</span>
                </button>
              </div>
            </form>

            {/* Footer Existing Account Link */}
            <div className="mt-8 pt-5 border-t border-gray-100 text-center text-xs text-gray-500">
              Already have an account?{' '}
              <Link to="/director/login" className="font-bold text-black hover:underline">
                Use your existing {companyName} director login.
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
