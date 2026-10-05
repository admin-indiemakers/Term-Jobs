import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Shield,
  User,
  Mail,
  Phone,
  MapPin,
  Users,
  FileText,
  Layers,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  Check,
  Edit3,
  X,
  Plus,
  Bot,
  Send,
  MessageSquare,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

const INDUSTRY_OPTIONS = [
  'Information Technology',
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

const DEFAULT_TECH_SUGGESTIONS = [
  'React',
  'Python',
  'AWS',
  'Node.js',
  'Docker',
  'Kubernetes',
  'PostgreSQL',
  'TypeScript',
  'Java',
  'Go'
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

  // Edit toggles for modular cards
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [editingOverview, setEditingOverview] = useState(false);
  const [editingTechStack, setEditingTechStack] = useState(false);
  const [editingAdminInfo, setEditingAdminInfo] = useState(false);

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

  // Bot Integrations State
  const [botConfig, setBotConfig] = useState({
    telegram: { enabled: true, bot_token: '', bot_username: '', webhook_url: '', is_verified: false, is_custom: false },
    zoho_cliq: { enabled: true, bot_name: '', incoming_webhook_url: '', webhook_url: '', is_verified: false }
  });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingCliq, setTestingCliq] = useState(false);
  const [savingBots, setSavingBots] = useState(false);
  const [botMessage, setBotMessage] = useState({ type: '', text: '' });
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [copiedTgWebhook, setCopiedTgWebhook] = useState(false);
  const [copiedCliqWebhook, setCopiedCliqWebhook] = useState(false);

  const loadBotConfig = async () => {
    try {
      const data = await request('/api/integrations/tenant-bots', { token });
      if (data) {
        setBotConfig({
          telegram: {
            enabled: data.telegram?.enabled ?? false,
            bot_token: data.telegram?.bot_token_masked || '',
            bot_username: data.telegram?.bot_username || '',
            webhook_url: data.telegram?.webhook_url || '',
            is_verified: data.telegram?.is_verified ?? false,
            is_custom: data.telegram?.is_custom ?? false,
            last_synced_at: data.telegram?.last_synced_at
          },
          zoho_cliq: {
            enabled: data.zoho_cliq?.enabled ?? false,
            bot_name: data.zoho_cliq?.bot_name || 'TermJobs Assistant',
            incoming_webhook_url: data.zoho_cliq?.incoming_webhook_url || '',
            webhook_url: data.zoho_cliq?.webhook_url || '',
            is_verified: data.zoho_cliq?.is_verified ?? false,
            last_synced_at: data.zoho_cliq?.last_synced_at
          }
        });
      }
    } catch (err) {
      console.error('Failed to load bot config:', err);
    }
  };

  const handleSaveTelegram = async () => {
    setSavingBots(true);
    setBotMessage({ type: '', text: '' });
    try {
      await request('/api/integrations/tenant-bots', {
        method: 'POST',
        token,
        body: {
          telegram: {
            enabled: botConfig.telegram.enabled,
            bot_token: botConfig.telegram.bot_token,
            bot_username: botConfig.telegram.bot_username
          }
        }
      });
      setBotMessage({ type: 'success', text: 'Telegram Bot credentials verified and webhook registered successfully!' });
      await loadBotConfig();
    } catch (err) {
      setBotMessage({ type: 'error', text: err.message || 'Failed to save Telegram Bot credentials' });
    } finally {
      setSavingBots(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setBotMessage({ type: '', text: '' });
    try {
      const res = await request('/api/integrations/tenant-bots/test-telegram', {
        method: 'POST',
        token,
        body: { bot_token: botConfig.telegram.bot_token }
      });
      if (res.success) {
        setBotMessage({ type: 'success', text: `Verified! Bot identity: @${res.bot_username} (${res.bot_name})` });
      } else {
        setBotMessage({ type: 'error', text: res.error || 'Telegram verification failed.' });
      }
    } catch (err) {
      setBotMessage({ type: 'error', text: err.message || 'Telegram test failed' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSaveCliq = async () => {
    setSavingBots(true);
    setBotMessage({ type: '', text: '' });
    try {
      await request('/api/integrations/tenant-bots', {
        method: 'POST',
        token,
        body: {
          zoho_cliq: {
            enabled: botConfig.zoho_cliq.enabled,
            bot_name: botConfig.zoho_cliq.bot_name,
            incoming_webhook_url: botConfig.zoho_cliq.incoming_webhook_url
          }
        }
      });
      setBotMessage({ type: 'success', text: 'Zoho Cliq configuration saved successfully!' });
      await loadBotConfig();
    } catch (err) {
      setBotMessage({ type: 'error', text: err.message || 'Failed to save Zoho Cliq config' });
    } finally {
      setSavingBots(false);
    }
  };

  const handleTestCliq = async () => {
    setTestingCliq(true);
    setBotMessage({ type: '', text: '' });
    try {
      const res = await request('/api/integrations/tenant-bots/test-cliq', {
        method: 'POST',
        token,
        body: {
          bot_name: botConfig.zoho_cliq.bot_name,
          incoming_webhook_url: botConfig.zoho_cliq.incoming_webhook_url
        }
      });
      if (res.success) {
        setBotMessage({ type: 'success', text: 'Test message delivered to your Zoho Cliq channel!' });
      } else {
        setBotMessage({ type: 'error', text: res.error || 'Failed to dispatch test message to Zoho Cliq.' });
      }
    } catch (err) {
      setBotMessage({ type: 'error', text: err.message || 'Zoho Cliq test failed' });
    } finally {
      setTestingCliq(false);
    }
  };

  const handleDisconnectBot = async (platform) => {
    if (!window.confirm(`Are you sure you want to disconnect ${platform.toUpperCase()} Bot?`)) return;
    setSavingBots(true);
    try {
      await request(`/api/integrations/tenant-bots/${platform}`, { method: 'DELETE', token });
      setBotMessage({ type: 'success', text: `${platform.toUpperCase()} Bot disconnected.` });
      await loadBotConfig();
    } catch (err) {
      setBotMessage({ type: 'error', text: err.message || 'Failed to disconnect bot' });
    } finally {
      setSavingBots(false);
    }
  };

  // Fetch company profile on load
  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/auth/company/profile', { token });
      setCompanyForm({
        name: data.name || user?.tenant_name || 'TCS',
        industry: data.industry || 'Information Technology',
        size: data.size || '201-500 employees',
        location: data.location || 'Bangalore, India',
        notes: data.notes || 'TCS is a global leader in IT services, consulting, and business solutions. We help organizations build a more secure, scalable, and innovative future through technology and talent.',
        logo_url: data.logo_url || '',
        tech_stack: Array.isArray(data.tech_stack) && data.tech_stack.length > 0
          ? data.tech_stack
          : ['React', 'Python', 'AWS', 'Node.js', 'Docker', 'Kubernetes', 'PostgreSQL'],
      });
      setAdminForm({
        admin_name: data.admin_name || user?.name || 'Administrator',
        admin_email: data.admin_email || user?.email || '',
        admin_phone: data.admin_phone || '',
      });
      setTenantInfo({
        tenant_id: data.tenant_id || user?.tenant_id || '',
        tenant_type: data.tenant_type || 'client',
        admin_role: data.admin_role || user?.role || 'Admin',
      });
    } catch (err) {
      setError(err.message || 'Failed to load company profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadBotConfig();
  }, [token]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
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

  const handleAddSpecificTech = (tech) => {
    if (!companyForm.tech_stack.includes(tech)) {
      setCompanyForm((prev) => ({
        ...prev,
        tech_stack: [...prev.tech_stack, tech],
      }));
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
      if (refreshUser) await refreshUser();
    } catch (err) {
      setError(err.message || 'Error uploading company logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setCompanyForm((prev) => ({ ...prev, logo_url: '' }));
    try {
      await request('/api/auth/company/profile', {
        method: 'PUT',
        token,
        body: {
          ...companyForm,
          logo_url: '',
          admin_name: adminForm.admin_name,
          admin_email: adminForm.admin_email,
          admin_phone: adminForm.admin_phone,
        },
      });
      setSuccess('Logo removed.');
      if (refreshUser) await refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to remove logo');
    }
  };

  // Save company and admin profile details
  const saveProfileData = async (updatedCompany = companyForm, updatedAdmin = adminForm) => {
    if (!updatedCompany.name.trim()) {
      setError('Company name cannot be empty');
      return false;
    }
    if (!updatedAdmin.admin_name.trim()) {
      setError('Admin name cannot be empty');
      return false;
    }
    if (!updatedAdmin.admin_email.trim()) {
      setError('Admin email cannot be empty');
      return false;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: updatedCompany.name.trim(),
        industry: updatedCompany.industry,
        size: updatedCompany.size,
        location: updatedCompany.location.trim(),
        notes: updatedCompany.notes.trim(),
        logo_url: updatedCompany.logo_url,
        tech_stack: updatedCompany.tech_stack,
        admin_name: updatedAdmin.admin_name.trim(),
        admin_email: updatedAdmin.admin_email.trim(),
        admin_phone: updatedAdmin.admin_phone.trim(),
      };

      await request('/api/auth/company/profile', {
        method: 'PUT',
        token,
        body: payload,
      });

      setSuccess('Changes saved successfully!');
      if (refreshUser) await refreshUser();
      return true;
    } catch (err) {
      setError(err.message || 'Failed to save changes');
      return false;
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
    if (!name) return 'TC';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className="w-full max-w-[1480px] mx-auto space-y-5 pt-1 sm:pt-2 text-left select-none antialiased"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Toast Alert Notifications */}
      {error && (
        <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl text-xs sm:text-sm text-red-700 font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-700 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-700 font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-700 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <button
          type="button"
          onClick={() => navigate('/dashboard/admin')}
          className="hover:text-black font-medium transition-colors cursor-pointer"
        >
          Workspace
        </button>
        <span className="text-gray-300 font-normal">›</span>
        <span className="text-gray-400 font-medium">Organization Profile</span>
      </div>

      {/* Page Title & Subtitle */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-[1.85rem] font-extrabold text-gray-900 tracking-tight leading-tight">
          Company & Admin Settings
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1">
          Manage your enterprise details, brand identity, admin contact, and security settings.
        </p>
      </div>

      {/* Main Two-Column Layout (Sidebar + Content) */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Left Sidebar Navigation Card (Glassmorphic) */}
        <div className="w-full md:w-56 lg:w-60 bg-white/40 hover:bg-white/50 backdrop-blur-2xl border border-white/70 rounded-2xl p-2 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] shrink-0 flex flex-col gap-1.5 transition-all">
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'company'
                ? 'bg-black text-white shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-black hover:bg-white/60 hover:backdrop-blur-md font-medium'
            }`}
          >
            <Building2 size={15} />
            <span>Company Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-black text-white shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-black hover:bg-white/60 hover:backdrop-blur-md font-medium'
            }`}
          >
            <User size={15} />
            <span>Admin Contact</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-black text-white shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-black hover:bg-white/60 hover:backdrop-blur-md font-medium'
            }`}
          >
            <Lock size={15} />
            <span>Password & Security</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bots')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'bots'
                ? 'bg-black text-white shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-black hover:bg-white/60 hover:backdrop-blur-md font-medium'
            }`}
          >
            <Bot size={15} />
            <span>Bot Integrations</span>
          </button>
        </div>

        {/* Right Main Content Area */}
        <div className="flex-1 min-w-0 w-full space-y-3.5">
          {loading ? (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-10 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
              <Loader2 size={20} className="animate-spin text-gray-600" />
              <span>Loading company settings...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: COMPANY PROFILE */}
              {activeTab === 'company' && (
                <div className="space-y-3.5">
                  {/* CARD 1: Company Profile (Basic Info & Logo) */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-3xs shrink-0">
                          <Building2 size={15} />
                        </div>
                        <div>
                          <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 leading-tight">Company Profile</h2>
                          <p className="text-[11px] text-gray-500 mt-0.5">Basic information about your organization.</p>
                        </div>
                      </div>

                      {editingBasicInfo ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingBasicInfo(false)}
                            className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-600 transition-all cursor-pointer shadow-3xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              const ok = await saveProfileData();
                              if (ok) setEditingBasicInfo(false);
                            }}
                            className="px-3 py-1 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            <span>Save</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingBasicInfo(true)}
                          className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-700 flex items-center gap-1.5 shadow-3xs transition-all cursor-pointer"
                        >
                          <Edit3 size={11} className="text-gray-500" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="pt-3.5 flex flex-col lg:flex-row gap-5 items-start">
                      {/* Logo Section */}
                      <div className="flex items-center gap-3.5 shrink-0 pr-0 lg:pr-5 border-b lg:border-b-0 lg:border-r border-black/[0.04] pb-3.5 lg:pb-0 w-full lg:w-auto">
                        <div className="w-16 h-16 rounded-xl bg-[#181a1d] text-white flex items-center justify-center font-bold text-lg tracking-wider shrink-0 shadow-2xs overflow-hidden p-1.5">
                          {companyForm.logo_url ? (
                            <img
                              src={companyForm.logo_url}
                              alt={companyForm.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span>{getCompanyInitials(companyForm.name)}</span>
                          )}
                        </div>

                        <div>
                          <div className="text-xs sm:text-[13px] font-bold text-gray-900 leading-tight">Company Logo</div>
                          <div className="text-[10.5px] text-gray-400 mt-0.5">PNG, JPG, SVG (max 3MB)</div>

                          <div className="flex items-center gap-1.5 mt-1.5">
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
                              className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/70 hover:bg-white backdrop-blur-md text-gray-800 text-[11px] font-semibold shadow-3xs flex items-center gap-1 cursor-pointer disabled:opacity-60 transition-all"
                            >
                              {uploadingLogo ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Upload size={11} />
                              )}
                              <span>Upload Logo</span>
                            </button>

                            {companyForm.logo_url && (
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                title="Remove Logo"
                                className="p-1 rounded-lg border border-white/80 bg-white/70 hover:bg-red-50 text-gray-400 hover:text-red-600 backdrop-blur-md transition-colors cursor-pointer shadow-3xs"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2x2 Info Grid */}
                      <div className="flex-1 w-full">
                        {editingBasicInfo ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">Company Name</label>
                              <input
                                type="text"
                                value={companyForm.name}
                                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                                placeholder="Company name"
                                className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                              />
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">Industry Sector</label>
                              <select
                                value={companyForm.industry}
                                onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                                className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                              >
                                {INDUSTRY_OPTIONS.map((ind) => (
                                  <option key={ind} value={ind}>
                                    {ind}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">Company Size</label>
                              <select
                                value={companyForm.size}
                                onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })}
                                className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                              >
                                {COMPANY_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">Headquarters</label>
                              <input
                                type="text"
                                value={companyForm.location}
                                onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
                                placeholder="City, Country"
                                className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 py-0.5">
                            {/* Field: Name */}
                            <div className="flex flex-col justify-center">
                              <span className="text-[10.5px] text-gray-400 font-medium leading-none">Company Name</span>
                              <span className="text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                                {companyForm.name || 'TCS'}
                              </span>
                            </div>

                            {/* Field: Industry */}
                            <div className="flex flex-col justify-center">
                              <span className="text-[10.5px] text-gray-400 font-medium leading-none">Industry Sector</span>
                              <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                                <Building2 size={13} className="text-gray-400 shrink-0" />
                                <span className="truncate">{companyForm.industry || 'Information Technology'}</span>
                              </div>
                            </div>

                            {/* Field: Size */}
                            <div className="flex flex-col justify-center">
                              <span className="text-[10.5px] text-gray-400 font-medium leading-none">Company Size</span>
                              <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                                <Users size={13} className="text-gray-400 shrink-0" />
                                <span>{companyForm.size || '201–500 employees'}</span>
                              </div>
                            </div>

                            {/* Field: Location */}
                            <div className="flex flex-col justify-center">
                              <span className="text-[10.5px] text-gray-400 font-medium leading-none">Headquarters</span>
                              <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                                <MapPin size={13} className="text-gray-400 shrink-0" />
                                <span className="truncate">{companyForm.location || 'Bangalore, India'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: Company Overview */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-3xs shrink-0">
                          <FileText size={15} />
                        </div>
                        <div>
                          <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 leading-tight">Company Overview</h2>
                          <p className="text-[11px] text-gray-500 mt-0.5">A brief description about your company, vision, and culture.</p>
                        </div>
                      </div>

                      {editingOverview ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingOverview(false)}
                            className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-600 transition-all cursor-pointer shadow-3xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              const ok = await saveProfileData();
                              if (ok) setEditingOverview(false);
                            }}
                            className="px-3 py-1 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            <span>Save</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingOverview(true)}
                          className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-700 flex items-center gap-1.5 shadow-3xs transition-all cursor-pointer"
                        >
                          <Edit3 size={11} className="text-gray-500" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="pt-3">
                      {editingOverview ? (
                        <textarea
                          rows={3}
                          value={companyForm.notes}
                          onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                          placeholder="Describe your organization mission, vision, and engineering culture..."
                          className="w-full p-2.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black leading-relaxed shadow-3xs transition-all resize-none"
                        />
                      ) : (
                        <p className="text-xs sm:text-[13px] text-gray-600 leading-relaxed font-normal py-0.5">
                          {companyForm.notes || 'TCS is a global leader in IT services, consulting, and business solutions. We help organizations build a more secure, scalable, and innovative future through technology and talent.'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CARD 3: Primary Technology Stack */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-3xs shrink-0">
                          <Layers size={15} />
                        </div>
                        <div>
                          <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 leading-tight">Primary Technology Stack</h2>
                          <p className="text-[11px] text-gray-500 mt-0.5">Helps us match the right candidates and vendor consultants for your requirements.</p>
                        </div>
                      </div>

                      {editingTechStack ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTechStack(false)}
                            className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-600 transition-all cursor-pointer shadow-3xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              const ok = await saveProfileData();
                              if (ok) setEditingTechStack(false);
                            }}
                            className="px-3 py-1 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            <span>Save</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingTechStack(true)}
                          className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-700 flex items-center gap-1.5 shadow-3xs transition-all cursor-pointer"
                        >
                          <Edit3 size={11} className="text-gray-500" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="pt-3">
                      {editingTechStack ? (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2 p-2 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus-within:bg-white focus-within:ring-1 focus-within:ring-black shadow-3xs transition-all">
                            {companyForm.tech_stack.map((tech) => (
                              <span
                                key={tech}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-gray-800 border border-gray-200 text-xs font-semibold shadow-2xs"
                              >
                                <span>{tech}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTech(tech)}
                                  className="text-gray-400 hover:text-black transition-colors cursor-pointer"
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
                              placeholder="Type tech & press Enter..."
                              className="flex-1 min-w-[150px] bg-transparent outline-none text-xs text-gray-900 py-0.5"
                            />
                          </div>

                          {/* Quick suggestions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-gray-400 font-medium">Quick suggestions:</span>
                            {DEFAULT_TECH_SUGGESTIONS.filter((s) => !companyForm.tech_stack.includes(s)).slice(0, 6).map((tech) => (
                              <button
                                key={tech}
                                type="button"
                                onClick={() => handleAddSpecificTech(tech)}
                                className="px-2 py-0.5 rounded-full bg-white/70 hover:bg-white backdrop-blur-md border border-white/80 text-gray-700 text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                              >
                                <Plus size={10} />
                                <span>{tech}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(companyForm.tech_stack && companyForm.tech_stack.length > 0
                            ? companyForm.tech_stack
                            : ['React', 'Python', 'AWS', 'Node.js', 'Docker', 'Kubernetes', 'PostgreSQL']
                          ).map((tech) => (
                            <span
                              key={tech}
                              className="px-3 py-1 rounded-full bg-white/70 backdrop-blur-md text-gray-800 text-xs font-semibold border border-white/80 shadow-3xs"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ADMIN CONTACT DETAILS */}
              {activeTab === 'admin' && (
                <div className="space-y-3.5">
                  {/* Administrator Contact Details Card */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-3xs shrink-0">
                          <User size={15} />
                        </div>
                        <div>
                          <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 leading-tight">Admin Contact Information</h2>
                          <p className="text-[11px] text-gray-500 mt-0.5">Primary administrator credentials and contact details.</p>
                        </div>
                      </div>

                      {editingAdminInfo ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingAdminInfo(false)}
                            className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-600 transition-all cursor-pointer shadow-3xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              const ok = await saveProfileData();
                              if (ok) setEditingAdminInfo(false);
                            }}
                            className="px-3 py-1 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            <span>Save</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingAdminInfo(true)}
                          className="px-2.5 py-1 rounded-lg border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-[11px] font-semibold text-gray-700 flex items-center gap-1.5 shadow-3xs transition-all cursor-pointer"
                        >
                          <Edit3 size={11} className="text-gray-500" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="pt-3.5">
                      {editingAdminInfo ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">
                              Admin Full Name *
                            </label>
                            <input
                              type="text"
                              value={adminForm.admin_name}
                              onChange={(e) => setAdminForm({ ...adminForm, admin_name: e.target.value })}
                              placeholder="Full name"
                              className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">
                              Login Email Address *
                            </label>
                            <input
                              type="email"
                              value={adminForm.admin_email}
                              onChange={(e) => setAdminForm({ ...adminForm, admin_email: e.target.value })}
                              placeholder="admin@company.com"
                              className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1">
                              Direct Phone Number
                            </label>
                            <input
                              type="tel"
                              value={adminForm.admin_phone}
                              onChange={(e) => setAdminForm({ ...adminForm, admin_phone: e.target.value })}
                              placeholder="+91 98765 43210"
                              className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3.5 py-0.5">
                          <div className="flex flex-col justify-center">
                            <span className="text-[10.5px] text-gray-400 font-medium leading-none">Administrator Name</span>
                            <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                              <User size={13} className="text-gray-400 shrink-0" />
                              <span className="truncate">{adminForm.admin_name || 'Admin'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col justify-center">
                            <span className="text-[10.5px] text-gray-400 font-medium leading-none">Login Email Address</span>
                            <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                              <Mail size={13} className="text-gray-400 shrink-0" />
                              <span className="truncate">{adminForm.admin_email || 'Not configured'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col justify-center">
                            <span className="text-[10.5px] text-gray-400 font-medium leading-none">Direct Phone</span>
                            <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                              <Phone size={13} className="text-gray-400 shrink-0" />
                              <span>{adminForm.admin_phone || 'Not specified'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tenant Workspace Identity Card */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-black/[0.04]">
                      <div className="w-8 h-8 rounded-lg bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-3xs shrink-0">
                        <Shield size={15} />
                      </div>
                      <div>
                        <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 leading-tight">Workspace Governance & Tenant Info</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Enterprise tenant ID, organization type, and authority level.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3.5 pt-3.5 py-0.5">
                      <div className="flex flex-col justify-center">
                        <span className="text-[10.5px] text-gray-400 font-medium leading-none">Tenant ID</span>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <span className="font-mono text-xs sm:text-[13px] font-semibold text-gray-900 truncate">
                            {tenantInfo.tenant_id ? `${tenantInfo.tenant_id.slice(0, 14)}...` : 'Assigned'}
                          </span>
                          {tenantInfo.tenant_id && (
                            <button
                              type="button"
                              onClick={handleCopyTenantId}
                              title="Copy Tenant ID"
                              className="p-1 rounded-md hover:bg-white/80 text-gray-500 hover:text-black transition-colors cursor-pointer shrink-0"
                            >
                              {copiedTenantId ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col justify-center">
                        <span className="text-[10.5px] text-gray-400 font-medium leading-none">Tenant Architecture</span>
                        <span className="text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                          {tenantInfo.tenant_type === 'client' ? 'Client Enterprise Tenant' : 'Consulting Partner'}
                        </span>
                      </div>

                      <div className="flex flex-col justify-center">
                        <span className="text-[10.5px] text-gray-400 font-medium leading-none">Governance Authority</span>
                        <span className="text-xs sm:text-[13.5px] font-semibold text-gray-900 mt-1">
                          {tenantInfo.admin_role || 'Company Administrator'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PASSWORD & SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-3.5">
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 pb-3 border-b border-black/[0.04]">
                      <div className="w-8 h-8 rounded-lg bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-3xs shrink-0">
                        <Lock size={15} />
                      </div>
                      <div>
                        <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 leading-tight">Password & Security</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Update your account password and review security settings.</p>
                      </div>
                    </div>

                    {/* Alerts */}
                    {passwordError && (
                      <div className="mt-3.5 p-3 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shadow-xs">
                        <AlertCircle size={14} className="shrink-0 text-red-500" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="mt-3.5 p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2 shadow-xs">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        <span>{passwordSuccess}</span>
                      </div>
                    )}

                    {/* Password Form */}
                    <form onSubmit={handleChangePassword} className="pt-3.5 space-y-3 max-w-md">
                      <div>
                        <label className="block text-[10.5px] font-semibold text-gray-600 mb-1">
                          Current Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            required
                            value={passwordForm.current_password}
                            onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                            placeholder="Enter current password"
                            className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black pr-9 shadow-3xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                            tabIndex={-1}
                          >
                            {showCurrentPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-semibold text-gray-600 mb-1">
                          New Password * <span className="text-gray-400 font-normal">(min 8 characters)</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={passwordForm.new_password}
                            onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                            placeholder="Enter new secure password"
                            className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black pr-9 shadow-3xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                            tabIndex={-1}
                          >
                            {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-semibold text-gray-600 mb-1">
                          Confirm New Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={passwordForm.confirm_password}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                            placeholder="Confirm new password"
                            className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black pr-9 shadow-3xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={changingPassword}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {changingPassword ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Updating Password...</span>
                            </>
                          ) : (
                            <>
                              <KeyRound size={12} />
                              <span>Update Password</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 4: BOT INTEGRATIONS */}
              {activeTab === 'bots' && (
                <div className="space-y-4">
                  {/* Status Banner / Feedback */}
                  {botMessage.text && (
                    <div
                      className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-all ${
                        botMessage.type === 'success'
                          ? 'bg-emerald-50/90 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50/90 text-red-800 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {botMessage.type === 'success' ? (
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle size={15} className="text-red-600 shrink-0" />
                        )}
                        <span>{botMessage.text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBotMessage({ type: '', text: '' })}
                        className="text-gray-400 hover:text-black cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {/* Card 1: Telegram Bot Integration */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                          <Send size={16} className="-translate-x-0.5 -translate-y-0.5" />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-[13px] font-bold text-gray-900">
                            Telegram Hiring Assistant Bot
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            Configure your company's dedicated Telegram bot for Hiring Managers.
                          </p>
                        </div>
                      </div>

                      <div>
                        {botConfig.telegram.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected {botConfig.telegram.bot_username ? `@${botConfig.telegram.bot_username}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Bot Username
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">@</span>
                            <input
                              type="text"
                              value={botConfig.telegram.bot_username}
                              onChange={(e) =>
                                setBotConfig({
                                  ...botConfig,
                                  telegram: { ...botConfig.telegram, bot_username: e.target.value.replace(/^@/, '') }
                                })
                              }
                              placeholder="AcmeHiringBot"
                              className="w-full pl-7 pr-3 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Telegram Bot Token
                          </label>
                          <div className="relative">
                            <input
                              type={showTelegramToken ? 'text' : 'password'}
                              value={botConfig.telegram.bot_token}
                              onChange={(e) =>
                                setBotConfig({
                                  ...botConfig,
                                  telegram: { ...botConfig.telegram, bot_token: e.target.value }
                                })
                              }
                              placeholder="7123456789:AAH..."
                              className="w-full pl-2.5 pr-8 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                            />
                            <button
                              type="button"
                              onClick={() => setShowTelegramToken(!showTelegramToken)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                            >
                              {showTelegramToken ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Webhook URL */}
                      {botConfig.telegram.webhook_url && (
                        <div className="bg-sky-50/50 border border-sky-200/60 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                              Dynamic Telegram Webhook Endpoint
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(botConfig.telegram.webhook_url);
                                setCopiedTgWebhook(true);
                                setTimeout(() => setCopiedTgWebhook(false), 2000);
                              }}
                              className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedTgWebhook ? (
                                <>
                                  <Check size={12} className="text-emerald-600" />
                                  <span className="text-emerald-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy URL</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-gray-700 break-all select-all">
                            {botConfig.telegram.webhook_url}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSaveTelegram}
                          disabled={savingBots}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {savingBots ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Verify & Register Webhook</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTestTelegram}
                          disabled={testingTelegram}
                          className="px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-800 border border-gray-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {testingTelegram ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                          <span>Test Token</span>
                        </button>

                        {botConfig.telegram.bot_token && (
                          <button
                            type="button"
                            onClick={() => handleDisconnectBot('telegram')}
                            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
                          >
                            <Trash2 size={13} />
                            <span>Disconnect</span>
                          </button>
                        )}
                      </div>

                      {/* Setup Instructions */}
                      <div className="bg-gray-50/80 rounded-xl p-3 text-[11px] text-gray-600 space-y-1 border border-gray-200/50">
                        <div className="font-bold text-gray-800">Quick Setup Instructions:</div>
                        <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
                          <li>Open Telegram and search for <b>@BotFather</b>.</li>
                          <li>Send <code>/newbot</code> and follow instructions to name your bot.</li>
                          <li>Copy the provided <b>HTTP API Token</b> and paste it in the field above.</li>
                          <li>Click <b>Verify & Register Webhook</b>. TermJobs will automatically configure the endpoint.</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Zoho Cliq Bot Integration */}
                  <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                          <MessageSquare size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-[13px] font-bold text-gray-900">
                            Zoho Cliq Bot Integration
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            Connect your workspace's Zoho Cliq channel to receive proactive notifications and manage candidates.
                          </p>
                        </div>
                      </div>

                      <div>
                        {botConfig.zoho_cliq.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Bot Name in Zoho Cliq
                          </label>
                          <input
                            type="text"
                            value={botConfig.zoho_cliq.bot_name}
                            onChange={(e) =>
                              setBotConfig({
                                ...botConfig,
                                zoho_cliq: { ...botConfig.zoho_cliq, bot_name: e.target.value }
                              })
                            }
                            placeholder="TermJobs Assistant"
                            className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                            Incoming Webhook URL
                          </label>
                          <input
                            type="text"
                            value={botConfig.zoho_cliq.incoming_webhook_url}
                            onChange={(e) =>
                              setBotConfig({
                                ...botConfig,
                                zoho_cliq: { ...botConfig.zoho_cliq, incoming_webhook_url: e.target.value }
                              })
                            }
                            placeholder="https://cliq.zoho.in/api/v2/bots/your_bot/incoming"
                            className="w-full px-2.5 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                          />
                        </div>
                      </div>

                      {/* Zoho Cliq Message Handler URL to configure in Zoho Developer Console */}
                      {botConfig.zoho_cliq.webhook_url && (
                        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                              Zoho Cliq Bot Message Handler URL
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(botConfig.zoho_cliq.webhook_url);
                                setCopiedCliqWebhook(true);
                                setTimeout(() => setCopiedCliqWebhook(false), 2000);
                              }}
                              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedCliqWebhook ? (
                                <>
                                  <Check size={12} className="text-emerald-600" />
                                  <span className="text-emerald-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy URL</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-gray-700 break-all select-all">
                            {botConfig.zoho_cliq.webhook_url}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSaveCliq}
                          disabled={savingBots}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {savingBots ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Save Zoho Cliq Config</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTestCliq}
                          disabled={testingCliq || !botConfig.zoho_cliq.incoming_webhook_url}
                          className="px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-800 border border-gray-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {testingCliq ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          <span>Send Test Message</span>
                        </button>

                        {botConfig.zoho_cliq.incoming_webhook_url && (
                          <button
                            type="button"
                            onClick={() => handleDisconnectBot('zoho_cliq')}
                            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
                          >
                            <Trash2 size={13} />
                            <span>Disconnect</span>
                          </button>
                        )}
                      </div>

                      {/* Setup Instructions */}
                      <div className="bg-gray-50/80 rounded-xl p-3 text-[11px] text-gray-600 space-y-1 border border-gray-200/50">
                        <div className="font-bold text-gray-800">Zoho Developer Console Setup:</div>
                        <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
                          <li>Go to <b>Zoho Cliq Developer Console</b> &gt; <b>Bots</b> &gt; Create Bot.</li>
                          <li>In Bot Details, copy the <b>Incoming Webhook URL</b> into the field above.</li>
                          <li>Under <b>Bot Handlers</b>, select <i>Message Handler</i> and paste the <b>Message Handler URL</b> shown above.</li>
                          <li>Click Save in both Zoho Cliq Console and on this page.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
