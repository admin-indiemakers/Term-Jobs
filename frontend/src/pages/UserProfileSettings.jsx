import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import {
  User,
  Mail,
  Phone,
  Building2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Sparkles,
  Layers,
  Check,
  Shield,
  Copy,
  Clock,
  ArrowRight,
  FileCheck2,
  Wallet,
  X
} from 'lucide-react';

export default function UserProfileSettings({ portalTitle = 'Executive Profile' }) {
  const { user, token, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'session'
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    department: '',
  });

  // Password Form state
  const [pwdForm, setPwdForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Sync profile fields from user session
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        department: user.department || '',
      });
    }
  }, [user]);

  // Clear notices on tab switch
  useEffect(() => {
    setSuccessMsg('');
    setErrorMsg('');
  }, [activeTab]);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleProfileSubmit = async (e) => {
    e?.preventDefault();
    if (!profileForm.name.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await request('/api/auth/me', {
        method: 'PUT',
        token,
        body: {
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim(),
          department: profileForm.department.trim(),
        },
      });

      if (refreshUser) {
        await refreshUser();
      }

      setSuccessMsg('Profile details successfully updated.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setErrorMsg(err?.message || 'Failed to update profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e?.preventDefault();
    if (!pwdForm.current_password) {
      setErrorMsg('Please enter your current password.');
      return;
    }
    if (!pwdForm.new_password) {
      setErrorMsg('Please enter your new password.');
      return;
    }
    if (pwdForm.new_password.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      setErrorMsg('New passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        token,
        body: {
          current_password: pwdForm.current_password,
          new_password: pwdForm.new_password,
        },
      });

      setSuccessMsg('Your account password has been updated successfully.');
      setPwdForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Failed to change password:', err);
      setErrorMsg(err?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const initials = (user?.name || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const isDirector = user?.role === 'Director' || user?.role?.toLowerCase() === 'director';
  const isFinance = user?.role === 'Finance' || user?.role === 'Finance Team' || user?.role?.toLowerCase() === 'finance';

  // Password strength calculation (0 to 3)
  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[0-9]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd) && pwd.length >= 10) score++;
    return score;
  };
  const pwdStrength = getPasswordStrength(pwdForm.new_password);

  return (
    <div className="w-full min-w-0 pt-7 sm:pt-9 px-4 sm:px-6 pb-20 space-y-5 text-left max-w-6xl mx-auto font-sans">
      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              {user?.tenant_name || 'TERM JOBS'} • ACCOUNT SETTINGS
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/70 border border-white/90 text-gray-800 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              Active Session
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
            {portalTitle}
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            Configure your personal profile details, contact preferences, and secure credentials for enterprise governance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refreshUser && refreshUser()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Modern High-Contrast Pill Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl overflow-x-auto shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-black text-white shadow-xs'
              : 'text-gray-600 hover:text-black hover:bg-white/60'
          }`}
        >
          <User size={14} className={activeTab === 'profile' ? 'text-white' : 'text-gray-400'} />
          <span>Profile & Account</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'security'
              ? 'bg-black text-white shadow-xs'
              : 'text-gray-600 hover:text-black hover:bg-white/60'
          }`}
        >
          <KeyRound size={14} className={activeTab === 'security' ? 'text-white' : 'text-gray-400'} />
          <span>Security & Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('session')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'session'
              ? 'bg-black text-white shadow-xs'
              : 'text-gray-600 hover:text-black hover:bg-white/60'
          }`}
        >
          <ShieldCheck size={14} className={activeTab === 'session' ? 'text-white' : 'text-gray-400'} />
          <span>Governance Authority</span>
        </button>
      </div>

      {/* Status Notifications (Monochrome) */}
      {errorMsg && (
        <div className="p-4 bg-gray-50 border border-gray-300 rounded-2xl text-xs text-gray-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-black" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-gray-500 hover:text-black cursor-pointer font-bold text-xs"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-black text-white border border-black rounded-2xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-white" />
            <span className="font-bold">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-gray-300 hover:text-white cursor-pointer font-bold text-xs"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Grid Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Identity Snapshot Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col items-center text-center relative overflow-hidden">
            {/* Ambient Background Accent */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-black/5 blur-2xl pointer-events-none" />

            {/* Avatar with Concentric Rings */}
            <div className="relative mb-3.5">
              <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center font-black text-2xl shadow-xl border border-white/80 shrink-0 uppercase">
                {user?.logo_url ? (
                  <img src={user.logo_url} alt="Logo" className="w-full h-full object-contain rounded-full p-2" />
                ) : (
                  initials
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
              </div>
            </div>

            <h3 className="text-base font-black text-gray-900 tracking-tight">
              {user?.name || 'Authenticated User'}
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5 break-all">
              {user?.email || '—'}
            </p>

            {/* Role Badges (Monochrome) */}
            <div className="flex flex-wrap justify-center items-center gap-1.5 mt-3.5">
              <span className="px-3 py-1 rounded-full text-[10.5px] font-black bg-black text-white tracking-wide uppercase shadow-2xs">
                {isDirector ? 'Executive Director' : isFinance ? 'Finance Officer' : user?.role || 'Corporate User'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/80 border border-gray-200 text-gray-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-black" />
                Verified
              </span>
            </div>

            <div className="w-full border-t border-gray-200/60 my-4" />

            {/* Profile Micro Details */}
            <div className="w-full text-left space-y-3 text-xs">
              <div className="bg-white/60 rounded-2xl p-3 border border-white/90 shadow-3xs">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider block">Organization</span>
                <span className="font-bold text-gray-900 mt-0.5 flex items-center gap-1.5 truncate text-[12px]">
                  <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{user?.tenant_name || 'Term Jobs Enterprise'}</span>
                </span>
              </div>

              <div className="bg-white/60 rounded-2xl p-3 border border-white/90 shadow-3xs">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider block">Account ID</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-[10px] text-gray-500 hover:text-black font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy size={11} />
                    <span>{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <span className="font-mono text-gray-700 mt-1 block truncate text-[11px]">
                  {user?.id || '—'}
                </span>
              </div>

              <div className="bg-white/60 rounded-2xl p-3 border border-white/90 shadow-3xs">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider block">Governance Tier</span>
                <span className="font-bold text-gray-900 mt-0.5 block text-[11.5px]">
                  {isDirector ? 'Tier 1 Corporate Executive' : isFinance ? 'Tier 1 Accounts & Settlement' : 'Authorized Operator'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Tab Panels (8 cols) */}
        <div className="lg:col-span-8">
          {/* Tab 1: Profile Details */}
          {activeTab === 'profile' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">Personal Details & Contacts</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Your official corporate identity displayed on audits, requisitions, and approvals.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10.5px] font-bold bg-white/80 border border-gray-200 text-gray-800 shadow-3xs">
                  Editable Profile
                </span>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <User size={15} />
                    </div>
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full bg-white/90 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-3xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Corporate Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail size={15} />
                    </div>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full bg-gray-50/80 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-gray-600 font-medium cursor-not-allowed shadow-3xs"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-black" title="Verified Corporate Identity">
                      <CheckCircle2 size={15} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 font-normal">Assigned by Enterprise Workspace Administrator.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Phone size={15} />
                      </div>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full bg-white/90 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-3xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                      Department / Pod
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Layers size={15} />
                      </div>
                      <input
                        type="text"
                        value={profileForm.department}
                        onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                        placeholder="e.g. Executive Governance / Finance"
                        className="w-full bg-white/90 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-3xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Check size={14} />
                    <span>{loading ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Security & Password */}
          {activeTab === 'security' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">Change Password</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Update credentials used to access this console.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10.5px] font-bold bg-white/80 border border-gray-200 text-gray-800 shadow-3xs">
                  Encrypted & Hashed
                </span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock size={15} />
                    </div>
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      required
                      value={pwdForm.current_password}
                      onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                      placeholder="Enter existing password"
                      className="w-full bg-white/90 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-3xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-black cursor-pointer"
                    >
                      {showCurrentPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <KeyRound size={15} />
                    </div>
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      required
                      value={pwdForm.new_password}
                      onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                      placeholder="Enter minimum 8 characters"
                      className="w-full bg-white/90 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-3xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-black cursor-pointer"
                    >
                      {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Meter (Monochrome) */}
                  {pwdForm.new_password && (
                    <div className="pt-1.5 space-y-1">
                      <div className="flex gap-1 h-1.5 w-full">
                        <div className={`h-full flex-1 rounded-full ${pwdStrength >= 1 ? 'bg-black' : 'bg-gray-200'}`} />
                        <div className={`h-full flex-1 rounded-full ${pwdStrength >= 2 ? 'bg-black' : 'bg-gray-200'}`} />
                        <div className={`h-full flex-1 rounded-full ${pwdStrength >= 3 ? 'bg-black' : 'bg-gray-200'}`} />
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium block">
                        {pwdStrength === 0 && 'Too short (min 8 characters required)'}
                        {pwdStrength === 1 && 'Basic password'}
                        {pwdStrength === 2 && 'Good security strength'}
                        {pwdStrength === 3 && 'Excellent strong password'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <KeyRound size={15} />
                    </div>
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      required
                      value={pwdForm.confirm_password}
                      onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                      placeholder="Re-type new password"
                      className="w-full bg-white/90 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-3xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-black cursor-pointer"
                    >
                      {showConfirmPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {pwdForm.new_password && pwdForm.confirm_password && (
                    <p className="text-[10.5px] font-bold mt-1 text-gray-700">
                      {pwdForm.new_password === pwdForm.confirm_password ? '✓ Passwords match' : '✕ Passwords do not match'}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Lock size={14} />
                    <span>{loading ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Governance Authority & Session Audit */}
          {activeTab === 'session' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">Governance Scope & Audit Warrants</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Assigned commercial authorizations and digital audit signatures.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10.5px] font-bold bg-white/80 border border-gray-200 text-gray-800 shadow-3xs">
                  Enterprise Clearance
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {isDirector ? (
                  <>
                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <CheckCircle2 size={15} className="text-black shrink-0" />
                        <span>Requisition Executive Signoff</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Empowered to inspect, approve, or reject open hiring requisitions and mandate restructured rate ceilings.
                      </p>
                    </div>

                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <FileCheck2 size={15} className="text-black shrink-0" />
                        <span>Master Role Templates</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Authority to create, seed, and enforce pre-approved role templates across the hiring organization.
                      </p>
                    </div>

                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <ShieldCheck size={15} className="text-black shrink-0" />
                        <span>Work Order (SOW) Authorization</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Grants formal executive approval on contractor agreements prior to financial invoice disbursement.
                      </p>
                    </div>

                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <Clock size={15} className="text-black shrink-0" />
                        <span>Audit Log Immutable Trace</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        All sign-offs and feedback are digitally stamped with timestamp, user ID, and cryptographic hashes.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <Wallet size={15} className="text-black shrink-0" />
                        <span>Commercial Disbursals</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Authorized to record and release corporate payments for Director-approved Work Orders.
                      </p>
                    </div>

                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <FileCheck2 size={15} className="text-black shrink-0" />
                        <span>Remittance Advice Execution</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Generates verified UTR transaction vouchers and financial settlement audit trails.
                      </p>
                    </div>

                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <ShieldCheck size={15} className="text-black shrink-0" />
                        <span>3-Stage Governance Compliance</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Enforces dual verification (Procurement & Director) before any funds can be disbursed.
                      </p>
                    </div>

                    <div className="p-4 bg-white/70 rounded-2xl border border-white/90 shadow-3xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-gray-900">
                        <Clock size={15} className="text-black shrink-0" />
                        <span>Financial Warrants Audit</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                        Payment records are permanently cataloged with transaction reference and bank settlement timestamps.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
