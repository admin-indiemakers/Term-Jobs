import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Shield,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Layers,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  Check
} from 'lucide-react';

const INDUSTRY_OPTIONS = [
  'Technology & Software',
  'Financial Services & Banking',
  'Healthcare & Life Sciences',
  'Consulting & Professional Services',
  'E-Commerce & Retail',
  'Telecommunications',
  'Manufacturing & Logistics',
  'Media & Entertainment',
  'Energy & Utilities',
  'Automotive & Transportation',
  'Staffing & Recruitment',
  'Other'
];

const COMPANY_SIZES = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '501-1,000 employees',
  '1,000-5,000 employees',
  '5,000+ employees'
];

export default function CompanyAdminProfile() {
  const { user, token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'admin' | 'security'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedTenantId, setCopiedTenantId] = useState(false);

  // Profile form state
  const [companyForm, setCompanyForm] = useState({
    name: '',
    industry: '',
    size: '',
    location: '',
    notes: '',
    logo_url: '',
    tech_stack: [],
  });

  const [adminForm, setAdminForm] = useState({
    admin_name: '',
    admin_email: '',
    admin_phone: '',
  });

  const [newTechInput, setNewTechInput] = useState('');
  const [tenantInfo, setTenantInfo] = useState({
    tenant_id: '',
    tenant_type: 'client',
    admin_role: 'Admin'
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Fetch company profile on load
  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/auth/company/profile', { token });
      setCompanyForm({
        name: data.name || '',
        industry: data.industry || '',
        size: data.size || '',
        location: data.location || '',
        notes: data.notes || '',
        logo_url: data.logo_url || '',
        tech_stack: Array.isArray(data.tech_stack) ? data.tech_stack : [],
      });
      setAdminForm({
        admin_name: data.admin_name || '',
        admin_email: data.admin_email || '',
        admin_phone: data.admin_phone || '',
      });
      setTenantInfo({
        tenant_id: data.tenant_id || '',
        tenant_type: data.tenant_type || 'client',
        admin_role: data.admin_role || 'Admin',
      });
    } catch (err) {
      setError(err.message || 'Failed to load company profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  // Auto-dismiss success notifications
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3500);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (passwordSuccess) {
      const t = setTimeout(() => setPasswordSuccess(''), 3500);
      return () => clearTimeout(t);
    }
  }, [passwordSuccess]);

  const handleCopyTenantId = () => {
    if (!tenantInfo.tenant_id) return;
    navigator.clipboard.writeText(tenantInfo.tenant_id);
    setCopiedTenantId(true);
    setTimeout(() => setCopiedTenantId(false), 2000);
  };

  // Tech stack tag addition/removal
  const handleAddTech = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = newTechInput.trim().replace(/,$/, '');
      if (val && !companyForm.tech_stack.includes(val)) {
        setCompanyForm((prev) => ({
          ...prev,
          tech_stack: [...prev.tech_stack, val],
        }));
      }
      setNewTechInput('');
    }
  };

  const handleRemoveTech = (techToRemove) => {
    setCompanyForm((prev) => ({
      ...prev,
      tech_stack: prev.tech_stack.filter((t) => t !== techToRemove),
    }));
  };

  // Logo file upload handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setError('Logo image must be smaller than 3MB');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError('Allowed file types: PNG, JPEG, WEBP, SVG');
      return;
    }

    setUploadingLogo(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/auth/company/logo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to upload company logo');
      }

      setCompanyForm((prev) => ({ ...prev, logo_url: json.logo_url }));
      setSuccess('Company logo updated successfully!');
      if (refreshUser) refreshUser();
    } catch (err) {
      setError(err.message || 'Error uploading company logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setCompanyForm((prev) => ({ ...prev, logo_url: '' }));
  };

  // Save company and admin profile details
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!companyForm.name.trim()) {
      setError('Company name cannot be empty');
      return;
    }
    if (!adminForm.admin_name.trim()) {
      setError('Admin name cannot be empty');
      return;
    }
    if (!adminForm.admin_email.trim()) {
      setError('Admin email cannot be empty');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: companyForm.name.trim(),
        industry: companyForm.industry,
        size: companyForm.size,
        location: companyForm.location.trim(),
        notes: companyForm.notes.trim(),
        logo_url: companyForm.logo_url,
        tech_stack: companyForm.tech_stack,
        admin_name: adminForm.admin_name.trim(),
        admin_email: adminForm.admin_email.trim(),
        admin_phone: adminForm.admin_phone.trim(),
      };

      await request('/api/auth/company/profile', {
        method: 'PUT',
        token,
        body: payload,
      });

      setSuccess('Profile and company settings saved successfully!');
      if (refreshUser) refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.current_password) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        token,
        body: {
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        },
      });

      setPasswordSuccess('Password updated successfully! Keep your new credentials secure.');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Verify your current password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const getCompanyInitials = (name) => {
    if (!name) return 'CO';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-5 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Header Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              Workspace
            </button>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              ORGANIZATION PROFILE
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Company & Admin Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Configure your enterprise tenant details, brand identity, administrative contact info, and workspace password.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs flex items-center gap-1.5">
              <Shield size={12} />
              {tenantInfo.admin_role}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs flex items-center gap-1.5">
              <Building2 size={12} className="text-gray-500" />
              {companyForm.name || 'Company'}
            </span>
            {tenantInfo.tenant_id && (
              <button
                type="button"
                onClick={handleCopyTenantId}
                title="Click to copy tenant ID"
                className="px-3 py-1 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="font-mono text-[11px]">{tenantInfo.tenant_id.slice(0, 10)}...</span>
                {copiedTenantId ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleSaveProfile()}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle size={16} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Container with Navigation Tabs */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'company'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Building2 size={14} />
            <span>Company Profile & Branding</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <User size={14} />
            <span>Admin Contact Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Lock size={14} />
            <span>Password & Security</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-gray-600" />
            <span>Loading company details...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: COMPANY DETAILS & BRANDING */}
            {activeTab === 'company' && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Branding / Logo Card */}
                <div className="p-5 rounded-2xl bg-gray-50/70 border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="relative group shrink-0">
                      {companyForm.logo_url ? (
                        <img
                          src={companyForm.logo_url}
                          alt={`${companyForm.name} Logo`}
                          className="w-20 h-20 rounded-2xl object-cover border border-gray-200 shadow-2xs bg-white"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#111417] to-gray-700 text-white font-extrabold text-xl flex items-center justify-center border border-white/20 shadow-2xs tracking-wider">
                          {getCompanyInitials(companyForm.name)}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Corporate Brand Logo</h3>
                      <p className="text-xs text-gray-500 mt-0.5 max-w-sm">
                        Displayed across your candidate job postings, vendor portals, and contract headers.
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Recommended: Square image (256x256px), max 3MB (PNG, JPG, WEBP, SVG)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>{companyForm.logo_url ? 'Replace Logo' : 'Upload Logo'}</span>
                        </>
                      )}
                    </button>

                    {companyForm.logo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        title="Remove Logo"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Company Form Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Company Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Company Name *
                    </label>
                    <div className="relative">
                      <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={companyForm.name}
                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                        placeholder="e.g. Asimovex Inc."
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Industry Sector
                    </label>
                    <select
                      value={companyForm.industry}
                      onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                    >
                      <option value="">Select an industry...</option>
                      {INDUSTRY_OPTIONS.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Organization Size */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Company Size
                    </label>
                    <select
                      value={companyForm.size}
                      onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                    >
                      <option value="">Select company size...</option>
                      {COMPANY_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Headquarters / Primary Location */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Headquarters / Office Location
                    </label>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={companyForm.location}
                        onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
                        placeholder="e.g. San Francisco, CA or Bengaluru, Karnataka"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                  </div>

                  {/* Tech Stack Tags Input */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Primary Technology Stack
                    </label>
                    <div className="p-3 border border-gray-200 rounded-xl bg-white space-y-2 focus-within:ring-1 focus-within:ring-black">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {companyForm.tech_stack.map((tech) => (
                          <span
                            key={tech}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 shadow-2xs"
                          >
                            <span>{tech}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTech(tech)}
                              className="text-gray-400 hover:text-black ml-0.5 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={newTechInput}
                          onChange={(e) => setNewTechInput(e.target.value)}
                          onKeyDown={handleAddTech}
                          placeholder="Type technology and press Enter (e.g. React, Python, AWS)..."
                          className="flex-1 min-w-[200px] text-xs text-gray-900 bg-transparent outline-none py-1 px-1"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Helps vendor recruiters and AI screening agents match your requisitions accurately.
                    </p>
                  </div>

                  {/* Company Bio / Notes */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Company Overview & Culture
                    </label>
                    <textarea
                      rows={3}
                      value={companyForm.notes}
                      onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                      placeholder="Brief overview of company mission, culture, and core engineering practices..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Save Company Information</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: ADMIN CONTACT DETAILS */}
            {activeTab === 'admin' && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-800 flex items-start gap-2.5">
                  <Shield size={16} className="shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Administrative Authority:</span> You are the primary Company Administrator for this organization. Updating your email will update the login credentials used to sign in to this portal.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Admin Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Admin Full Name *
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={adminForm.admin_name}
                        onChange={(e) => setAdminForm({ ...adminForm, admin_name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                  </div>

                  {/* Admin Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Login Email Address *
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={adminForm.admin_email}
                        onChange={(e) => setAdminForm({ ...adminForm, admin_email: e.target.value })}
                        placeholder="admin@company.com"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Your primary sign-in identifier and dispatch address for audit notices.
                    </p>
                  </div>

                  {/* Admin Phone */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Phone Number <span className="text-gray-400 font-normal lowercase">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={adminForm.admin_phone}
                        onChange={(e) => setAdminForm({ ...adminForm, admin_phone: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Update Contact Credentials</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: PASSWORD & SECURITY */}
            {activeTab === 'security' && (
              <form onSubmit={handleChangePassword} className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Change Workspace Password</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Update your account authentication secret. Passwords must be at least 8 characters.
                  </p>
                </div>

                {passwordError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 animate-in fade-in duration-200">
                    <AlertCircle size={15} className="shrink-0 text-red-500" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Current Password *
                  </label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      placeholder="Enter existing password"
                      className="w-full pl-9 pr-10 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      placeholder="Enter minimum 8 characters"
                      className="w-full pl-9 pr-10 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      placeholder="Repeat your new password"
                      className="w-full pl-9 pr-10 py-2.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {changingPassword ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound size={13} />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
