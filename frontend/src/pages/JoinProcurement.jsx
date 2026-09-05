import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { request } from '../api/client';
import {
  CheckCircle2, AlertCircle, Eye, EyeOff, ArrowRight, ShieldCheck,
  Building2, Lock, User, Mail, Briefcase, FileCheck2
} from 'lucide-react';

export default function JoinProcurement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const companyParam = searchParams.get('company') || searchParams.get('company_name') || 'Bearitt';
  const tenantIdParam = searchParams.get('tenant_id') || searchParams.get('tenant') || '';

  const [companyName, setCompanyName] = useState(companyParam);
  const [tenantId, setTenantId] = useState(tenantIdParam);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Procurement & Vendor Commercials');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
        department: department.trim() || 'Procurement & Commercials',
        password,
        company_name: companyName,
        tenant_id: tenantId || undefined,
      };

      await request('/api/auth/join/procurement', {
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
    <div className="min-h-screen bg-[#ECECE9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center font-extrabold text-2xl shadow-lg">
            <FileCheck2 className="w-7 h-7 text-amber-400" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-[#0A0A0A] tracking-tight">
          Join {companyName} Procurement Team
        </h2>
        <p className="mt-1 text-center text-xs text-[#8A8A85] font-semibold">
          Commercial Vendor Work Orders & Rate Authorization Portal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-[#E2E2DC] sm:px-10">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-extrabold text-[#0A0A0A]">Access Request Submitted!</h3>
              <p className="text-xs text-[#8A8A85] leading-relaxed">
                Your Procurement account for <strong>{email}</strong> has been created and sent to your company administrator for authorization.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-[#0A0A0A] text-white font-extrabold text-xs rounded-xl hover:bg-[#262626] transition-colors cursor-pointer border-none"
              >
                Proceed to Login →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] mb-1">Company</label>
                <input
                  type="text"
                  disabled
                  value={companyName}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aditi Varma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E2DC] rounded-xl text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] mb-1">Company Email *</label>
                <input
                  type="email"
                  required
                  placeholder="aditi@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E2DC] rounded-xl text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E2DC] rounded-xl text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E2DC] rounded-xl text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A8A85] mb-1">Confirm Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E2DC] rounded-xl text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#0A0A0A] hover:bg-[#262626] text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer border-none disabled:opacity-50 mt-2"
              >
                {submitting ? 'Submitting Request...' : 'Submit Procurement Access Request →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
