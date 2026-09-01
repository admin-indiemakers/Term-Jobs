import { useState, useEffect } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { X, Check, AlertCircle, Loader2, Building2, Layers } from 'lucide-react';

export default function EditAccountModal({ isOpen, onClose, userAccount, tenant, onSuccess }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [candidateLimit, setCandidateLimit] = useState(3);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isVendor = tenant?.tenant_type === 'consultancy' || userAccount?.role === 'Recruiter';

  useEffect(() => {
    if (userAccount) {
      setName(userAccount.name || '');
      setEmail(userAccount.email || '');
      setPassword('');
      setCandidateLimit(userAccount.candidate_limit ?? 3);
      setError('');
      setSuccess('');
    }
  }, [userAccount, isOpen]);

  if (!isOpen || !userAccount) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
      };

      if (password.trim()) {
        if (password.trim().length < 4) {
          throw new Error('Password must be at least 4 characters');
        }
        payload.password = password.trim();
      }

      if (isVendor) {
        const limitNum = parseInt(candidateLimit, 10);
        if (isNaN(limitNum) || limitNum < 1) {
          throw new Error('Candidate submission limit must be at least 1');
        }
        payload.candidate_limit = limitNum;
      }

      await request(`/api/auth/users/${userAccount.id}`, {
        method: 'PATCH',
        token,
        body: payload,
      });

      setSuccess('Account updated successfully!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to update account');
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
        className="relative w-full max-w-[540px] my-6 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
              {isVendor ? <Layers size={17} /> : <Building2 size={17} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                {isVendor ? 'Edit Vendor Recruiter' : 'Edit Buyer Administrator'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {tenant?.name || 'Company'} • {userAccount.email}
              </p>
            </div>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
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

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              {isVendor ? 'Recruiter Full Name *' : 'Admin Full Name *'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              {isVendor ? 'Recruiter Email *' : 'Admin Email *'}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          {/* Password (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Reset Password <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                className="w-full px-3.5 py-2 pr-16 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-1.5 py-0.5 rounded transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Only fill this in if you want to update the user's login password.
            </p>
          </div>

          {/* Candidate Limit (Vendor Only) */}
          {isVendor && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Candidate Submission Limit *
              </label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={candidateLimit}
                onChange={(e) => setCandidateLimit(e.target.value)}
                className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Maximum candidates this vendor recruiter can submit per requisition.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
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
              disabled={submitting}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                submitting ? 'bg-gray-800 cursor-not-allowed opacity-75' : 'bg-black hover:bg-gray-900'
              }`}
            >
              {submitting && <Loader2 size={13} className="animate-spin text-white" />}
              <span>{submitting ? 'Saving...' : 'Save changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
