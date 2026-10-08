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
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Search
} from 'lucide-react';
import TeamChatDrawer from '../components/TeamChatDrawer';

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

  // Team Chat governance state
  const [chatSettings, setChatSettings] = useState({
    enabled: true,
    policy: 'all',
    restricted_user_ids: [],
    members: []
  });
  const [loadingChat, setLoadingChat] = useState(false);
  const [savingChat, setSavingChat] = useState(false);
  const [chatMemberFilter, setChatMemberFilter] = useState('');
  const [chatMessage, setChatMessage] = useState({ type: '', text: '' });
  const [isProfileChatOpen, setIsProfileChatOpen] = useState(false);

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
    zoho_cliq: { enabled: true, bot_name: '', incoming_webhook_url: '', bot_url: '', extension_install_url: '', webhook_url: '', is_verified: false },
    ms_teams: { enabled: true, app_id: '', app_password: '', bot_name: 'TermJobs Assistant', bot_endpoint: '', manifest_url: '', package_url: '', is_verified: false }
  });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingCliq, setTestingCliq] = useState(false);
  const [testingTeams, setTestingTeams] = useState(false);
  const [savingBots, setSavingBots] = useState(false);
  const [botMessage, setBotMessage] = useState({ type: '', text: '' });
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showTeamsPassword, setShowTeamsPassword] = useState(false);
  const [copiedTgWebhook, setCopiedTgWebhook] = useState(false);
  const [copiedCliqWebhook, setCopiedCliqWebhook] = useState(false);
  const [copiedTeamsEndpoint, setCopiedTeamsEndpoint] = useState(false);
  const [openTgGuide, setOpenTgGuide] = useState(false);
  const [openCliqGuide, setOpenCliqGuide] = useState(false);
  const [openTeamsGuide, setOpenTeamsGuide] = useState(false);

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
            bot_url: data.zoho_cliq?.bot_url || '',
            extension_install_url: data.zoho_cliq?.extension_install_url || '',
            webhook_url: data.zoho_cliq?.webhook_url || '',
            is_verified: data.zoho_cliq?.is_verified ?? false,
            last_synced_at: data.zoho_cliq?.last_synced_at
          },
          ms_teams: {
            enabled: data.ms_teams?.enabled ?? true,
            app_id: data.ms_teams?.app_id || '',
            app_password: data.ms_teams?.app_password_masked || '',
            bot_name: data.ms_teams?.bot_name || 'TermJobs Assistant',
            bot_endpoint: data.ms_teams?.bot_endpoint || '',
            manifest_url: data.ms_teams?.manifest_url || '',
            package_url: data.ms_teams?.package_url || '',
            is_verified: data.ms_teams?.is_verified ?? false,
            last_synced_at: data.ms_teams?.last_synced_at
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
            incoming_webhook_url: botConfig.zoho_cliq.incoming_webhook_url,
            bot_url: botConfig.zoho_cliq.bot_url,
            extension_install_url: botConfig.zoho_cliq.extension_install_url
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

  const handleSaveTeams = async () => {
    setSavingBots(true);
    setBotMessage({ type: '', text: '' });
    try {
      await request('/api/integrations/tenant-bots', {
        method: 'POST',
        token,
        body: {
          ms_teams: {
            enabled: botConfig.ms_teams.enabled,
            app_id: botConfig.ms_teams.app_id,
            app_password: botConfig.ms_teams.app_password,
            bot_name: botConfig.ms_teams.bot_name
          }
        }
      });
      setBotMessage({ type: 'success', text: 'Microsoft Teams configuration saved successfully!' });
      await loadBotConfig();
    } catch (err) {
      setBotMessage({ type: 'error', text: err.message || 'Failed to save Microsoft Teams config' });
    } finally {
      setSavingBots(false);
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

  const loadChatSettings = async () => {
    if (!token) return;
    setLoadingChat(true);
    try {
      const res = await request('/api/team-chat/permissions', { token });
      if (res) {
        setChatSettings({
          enabled: res.enabled ?? true,
          policy: res.policy || 'all',
          restricted_user_ids: res.restricted_user_ids || [],
          members: res.members || []
        });
      }
    } catch (err) {
      console.warn('Failed to load chat governance settings:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSaveChatSettings = async () => {
    if (!token) return;
    setSavingChat(true);
    setChatMessage({ type: '', text: '' });
    try {
      await request('/api/team-chat/permissions', {
        method: 'PUT',
        token,
        body: {
          enabled: chatSettings.enabled,
          policy: chatSettings.policy,
          restricted_user_ids: chatSettings.restricted_user_ids,
        }
      });
      setChatMessage({ type: 'success', text: 'Chat governance settings updated successfully!' });
      await loadChatSettings();
    } catch (err) {
      setChatMessage({ type: 'error', text: err.message || 'Failed to update chat permissions' });
    } finally {
      setSavingChat(false);
    }
  };

  const handleToggleMemberChat = (memberId) => {
    setChatSettings((prev) => {
      const isRestricted = prev.restricted_user_ids.includes(memberId);
      const updatedRestricted = isRestricted
        ? prev.restricted_user_ids.filter((id) => id !== memberId)
        : [...prev.restricted_user_ids, memberId];
      return {
        ...prev,
        restricted_user_ids: updatedRestricted,
        members: prev.members.map((m) =>
          m.id === memberId ? { ...m, can_chat: isRestricted } : m
        )
      };
    });
  };

  useEffect(() => {
    loadProfile();
    loadBotConfig();
    loadChatSettings();
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

      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1 shrink-0">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mb-1">
            <span className="hover:text-gray-700 cursor-pointer transition-colors" onClick={() => navigate('/dashboard')}>Workspace</span>
            <span className="text-gray-300">›</span>
            <span className="text-gray-600 font-semibold">Organization Profile</span>
          </div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight">
            Company & Admin Settings
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Manage your enterprise details, brand identity, admin credentials, and multi-channel bots.
          </p>
        </div>

        {/* Tenant Organization Pill Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-3xs shrink-0 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-gray-900 tracking-tight">
            {companyForm.name || user?.tenant_name || 'TCS'}
          </span>
          <span className="text-[11px] font-medium text-gray-400">• Admin Console</span>
        </div>
      </div>

      {/* Main Two-Column Layout (Sidebar + Content) */}
      <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-start pt-1 sm:pt-2">
        {/* Left Sidebar Navigation Card (Glassmorphic, Sticky) */}
        <div className="w-full md:w-60 lg:w-64 md:sticky md:top-4 self-start z-10 bg-white/40 hover:bg-white/50 backdrop-blur-2xl border border-white/70 rounded-2xl p-2.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] shrink-0 flex flex-col gap-1.5 transition-all">
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
              activeTab === 'company'
                ? 'bg-black text-white shadow-2xs'
                : 'text-gray-700 hover:text-black hover:bg-white/60 hover:backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'company' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-600'
              }`}>
                <Building2 size={15} />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold leading-tight truncate ${activeTab === 'company' ? 'text-white' : 'text-gray-900'}`}>
                  Company Profile
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 truncate ${activeTab === 'company' ? 'text-gray-300' : 'text-gray-400'}`}>
                  Brand identity & details
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
              activeTab === 'admin'
                ? 'bg-black text-white shadow-2xs'
                : 'text-gray-700 hover:text-black hover:bg-white/60 hover:backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'admin' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-600'
              }`}>
                <User size={15} />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold leading-tight truncate ${activeTab === 'admin' ? 'text-white' : 'text-gray-900'}`}>
                  Admin Contact
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 truncate ${activeTab === 'admin' ? 'text-gray-300' : 'text-gray-400'}`}>
                  Credentials & owner info
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
              activeTab === 'security'
                ? 'bg-black text-white shadow-2xs'
                : 'text-gray-700 hover:text-black hover:bg-white/60 hover:backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'security' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-600'
              }`}>
                <Lock size={15} />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold leading-tight truncate ${activeTab === 'security' ? 'text-white' : 'text-gray-900'}`}>
                  Password & Security
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 truncate ${activeTab === 'security' ? 'text-gray-300' : 'text-gray-400'}`}>
                  Credentials & protection
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bots')}
            className={`w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
              activeTab === 'bots'
                ? 'bg-black text-white shadow-2xs'
                : 'text-gray-700 hover:text-black hover:bg-white/60 hover:backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'bots' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-600'
              }`}>
                <Bot size={15} />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold leading-tight truncate ${activeTab === 'bots' ? 'text-white' : 'text-gray-900'}`}>
                  Bot Integrations
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 truncate ${activeTab === 'bots' ? 'text-gray-300' : 'text-gray-400'}`}>
                  Telegram, Cliq & Teams
                </div>
              </div>
            </div>
            {(botConfig.telegram.is_verified || botConfig.zoho_cliq.is_verified || botConfig.ms_teams.app_id) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shrink-0" title="Active bot integration" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
              activeTab === 'chat'
                ? 'bg-black text-white shadow-2xs'
                : 'text-gray-700 hover:text-black hover:bg-white/60 hover:backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'chat' ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-600'
              }`}>
                <MessageSquare size={15} />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold leading-tight truncate ${activeTab === 'chat' ? 'text-white' : 'text-gray-900'}`}>
                  Team Chat & Messaging
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 truncate ${activeTab === 'chat' ? 'text-gray-300' : 'text-gray-400'}`}>
                  Control who can message
                </div>
              </div>
            </div>
            {chatSettings.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shrink-0" title="Team chat active" />
            )}
          </button>
        </div>

        {/* Right Main Content Area (Scrollable Portion) */}
        <div
          className="flex-1 min-w-0 w-full space-y-3.5 max-h-[calc(100vh-190px)] sm:max-h-[calc(100vh-175px)] overflow-y-auto pr-1.5 sm:pr-2.5 pb-16 sm:pb-12 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/15 hover:[&::-webkit-scrollbar-thumb]:bg-black/30 [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0, 0, 0, 0.15) transparent',
          }}
        >
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Company Name</label>
                              <input
                                type="text"
                                value={companyForm.name}
                                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                                placeholder="Company name"
                                className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Industry Sector</label>
                              <select
                                value={companyForm.industry}
                                onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                                className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all cursor-pointer"
                              >
                                {INDUSTRY_OPTIONS.map((ind) => (
                                  <option key={ind} value={ind}>
                                    {ind}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Company Size</label>
                              <select
                                value={companyForm.size}
                                onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })}
                                className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all cursor-pointer"
                              >
                                {COMPANY_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">Headquarters</label>
                              <input
                                type="text"
                                value={companyForm.location}
                                onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
                                placeholder="City, Country"
                                className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
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
                          className="w-full p-3 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black leading-relaxed shadow-3xs transition-all resize-none"
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
                          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/70 hover:bg-white focus-within:bg-white backdrop-blur-md border border-gray-200/80 focus-within:border-black rounded-xl focus-within:ring-1 focus-within:ring-black shadow-3xs transition-all">
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
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                              Admin Full Name *
                            </label>
                            <input
                              type="text"
                              value={adminForm.admin_name}
                              onChange={(e) => setAdminForm({ ...adminForm, admin_name: e.target.value })}
                              placeholder="Full name"
                              className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                              Login Email Address *
                            </label>
                            <input
                              type="email"
                              value={adminForm.admin_email}
                              onChange={(e) => setAdminForm({ ...adminForm, admin_email: e.target.value })}
                              placeholder="admin@company.com"
                              className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                              Direct Phone Number
                            </label>
                            <input
                              type="tel"
                              value={adminForm.admin_phone}
                              onChange={(e) => setAdminForm({ ...adminForm, admin_phone: e.target.value })}
                              placeholder="+91 98765 43210"
                              className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
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
                    <form onSubmit={handleChangePassword} className="pt-3.5 space-y-3.5 max-w-md">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Current Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            required
                            value={passwordForm.current_password}
                            onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                            placeholder="Enter current password"
                            className="w-full pl-3 pr-10 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer p-0.5"
                            tabIndex={-1}
                          >
                            {showCurrentPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          New Password * <span className="text-gray-400 font-normal lowercase">(min 8 characters)</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={passwordForm.new_password}
                            onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                            placeholder="Enter new secure password"
                            className="w-full pl-3 pr-10 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer p-0.5"
                            tabIndex={-1}
                          >
                            {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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
                            className="w-full pl-3 pr-10 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer p-0.5"
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
                      className={`p-3.5 rounded-2xl text-xs sm:text-[13px] flex items-center justify-between gap-3 shadow-2xs transition-all ${
                        botMessage.type === 'success'
                          ? 'bg-emerald-50/90 text-emerald-800 border border-emerald-200/80'
                          : 'bg-red-50/90 text-red-800 border border-red-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 font-medium">
                        {botMessage.type === 'success' ? (
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle size={16} className="text-red-600 shrink-0" />
                        )}
                        <span>{botMessage.text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBotMessage({ type: '', text: '' })}
                        className="p-1 rounded-lg hover:bg-black/5 text-gray-500 hover:text-black transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Card 1: Telegram Bot Integration */}
                  <div className="bg-white/40 hover:bg-white/50 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20 flex items-center justify-center shrink-0 shadow-3xs">
                          <Send size={16} className="-translate-x-0.5 -translate-y-0.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                              Telegram Hiring Assistant Bot
                            </h3>
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/80 hidden sm:inline">
                              Hiring Channel
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Configure your company's dedicated Telegram bot for Hiring Managers to review talent alerts.
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 self-start sm:self-auto">
                        {botConfig.telegram.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-3xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected {botConfig.telegram.bot_username ? `@${botConfig.telegram.bot_username}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-semibold bg-gray-100/90 text-gray-500 border border-gray-200/60 shadow-3xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                            Bot Username
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold select-none">@</span>
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
                              className="w-full pl-7.5 pr-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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
                              className="w-full pl-3 pr-9 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowTelegramToken(!showTelegramToken)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer p-0.5"
                            >
                              {showTelegramToken ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Webhook URL */}
                      {botConfig.telegram.webhook_url && (
                        <div className="bg-black/[0.02] border border-black/[0.06] rounded-xl p-3.5 text-xs space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                                Dynamic Telegram Webhook Endpoint
                              </span>
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
                                POST Webhook
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(botConfig.telegram.webhook_url);
                                setCopiedTgWebhook(true);
                                setTimeout(() => setCopiedTgWebhook(false), 2000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-gray-200/90 text-[11px] font-semibold text-gray-700 hover:text-black flex items-center gap-1.5 shadow-3xs cursor-pointer transition-all active:scale-98"
                            >
                              {copiedTgWebhook ? (
                                <>
                                  <Check size={11} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Copied URL!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} className="text-gray-500" />
                                  <span>Copy URL</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-gray-800 break-all select-all bg-white/90 p-2.5 rounded-lg border border-black/[0.04] shadow-3xs">
                            {botConfig.telegram.webhook_url}
                          </div>
                          <div className="text-[10.5px] text-gray-400">
                            Automatically registered with Telegram when you click Verify & Register Webhook.
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSaveTelegram}
                          disabled={savingBots}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
                        >
                          {savingBots ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Verify & Register Webhook</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTestTelegram}
                          disabled={testingTelegram}
                          className="px-3.5 py-2 rounded-xl bg-white/80 hover:bg-white text-gray-800 border border-gray-200/90 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
                        >
                          {testingTelegram ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                          <span>Test Token</span>
                        </button>

                        {botConfig.telegram.bot_token && (
                          <button
                            type="button"
                            onClick={() => handleDisconnectBot('telegram')}
                            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/70 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                          >
                            <Trash2 size={13} />
                            <span>Disconnect</span>
                          </button>
                        )}
                      </div>

                      {/* Setup Instructions (Collapsible Accordion) */}
                      <div className="border border-black/[0.06] rounded-xl bg-white/40 overflow-hidden transition-all">
                        <button
                          type="button"
                          onClick={() => setOpenTgGuide(!openTgGuide)}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">Telegram Bot Setup Guide</span>
                            <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">(4 steps to configure @BotFather)</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                            <span>{openTgGuide ? 'Hide Instructions' : 'Show Instructions'}</span>
                            {openTgGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </div>
                        </button>
                        {openTgGuide && (
                          <div className="p-3.5 pt-1 border-t border-black/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-600 animate-in fade-in duration-200">
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                              <span>Open Telegram and search for <b className="font-mono text-gray-900">@BotFather</b>.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                              <span>Send <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-900 font-bold font-mono">/newbot</code> and follow instructions to name your bot.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                              <span>Copy the provided <b>HTTP API Token</b> and paste it into the token field above.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                              <span>Click <b>Verify & Register Webhook</b>. TermJobs will automatically configure the endpoint.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Zoho Cliq Bot Integration */}
                  <div className="bg-white/40 hover:bg-white/50 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-3xs">
                          <MessageSquare size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                              Zoho Cliq Bot Integration
                            </h3>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 hidden sm:inline">
                              Workplace Chat
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Connect your workspace's Zoho Cliq channel to receive proactive notifications and manage candidates.
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 self-start sm:self-auto">
                        {botConfig.zoho_cliq.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-3xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-semibold bg-gray-100/90 text-gray-500 border border-gray-200/60 shadow-3xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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
                            className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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
                            className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                          />
                        </div>
                      </div>

                      {/* Direct Bot Chat URL or Marketplace Link */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Direct Bot Chat URL / Invite Link (Optional)
                        </label>
                        <input
                          type="text"
                          value={botConfig.zoho_cliq.bot_url || ''}
                          onChange={(e) =>
                            setBotConfig({
                              ...botConfig,
                              zoho_cliq: { ...botConfig.zoho_cliq, bot_url: e.target.value }
                            })
                          }
                          placeholder="https://cliq.zoho.in/#chat:bot:hiringmanagerterm or Marketplace URL"
                          className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          If left blank, defaults to <code>https://cliq.zoho.in/#chat:bot:{'{bot_name}'}</code>.
                        </p>
                      </div>

                      {/* Universal Extension Installation URL (For External Organizations) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                            Universal Extension Install Link (For Cross-Organization Access)
                          </label>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Recommended for External Users
                          </span>
                        </div>
                        <input
                          type="text"
                          value={botConfig.zoho_cliq.extension_install_url || ''}
                          onChange={(e) =>
                            setBotConfig({
                              ...botConfig,
                              zoho_cliq: { ...botConfig.zoho_cliq, extension_install_url: e.target.value }
                            })
                          }
                          placeholder="https://cliq.zoho.in/install/extension?key=... or Marketplace URL"
                          className="w-full px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                        />
                        <p className="text-[10.5px] text-gray-500 mt-1">
                          Zoho Cliq bots are organization-private by default. If you package your bot as an <b>Extension</b> in Zoho Developer Console, paste the generated installation link here so external hiring partners can install it in 1 click.
                        </p>
                      </div>

                      {/* Zoho Cliq Message Handler URL to configure in Zoho Developer Console */}
                      {/* Zoho Cliq Message Handler URL */}
                      {botConfig.zoho_cliq.webhook_url && (
                        <div className="bg-black/[0.02] border border-black/[0.06] rounded-xl p-3.5 text-xs space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                                Zoho Cliq Bot Message Handler URL
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                Handler Endpoint
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(botConfig.zoho_cliq.webhook_url);
                                setCopiedCliqWebhook(true);
                                setTimeout(() => setCopiedCliqWebhook(false), 2000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-gray-200/90 text-[11px] font-semibold text-gray-700 hover:text-black flex items-center gap-1.5 shadow-3xs cursor-pointer transition-all active:scale-98"
                            >
                              {copiedCliqWebhook ? (
                                <>
                                  <Check size={11} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Copied URL!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} className="text-gray-500" />
                                  <span>Copy URL</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-gray-800 break-all select-all bg-white/90 p-2.5 rounded-lg border border-black/[0.04] shadow-3xs">
                            {botConfig.zoho_cliq.webhook_url}
                          </div>
                          <div className="text-[10.5px] text-gray-400">
                            Paste this URL under Message Handler in Zoho Developer Console.
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSaveCliq}
                          disabled={savingBots}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
                        >
                          {savingBots ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Save Zoho Cliq Config</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTestCliq}
                          disabled={testingCliq || !botConfig.zoho_cliq.incoming_webhook_url}
                          className="px-3.5 py-2 rounded-xl bg-white/80 hover:bg-white text-gray-800 border border-gray-200/90 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
                        >
                          {testingCliq ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          <span>Send Test Message</span>
                        </button>

                        {botConfig.zoho_cliq.incoming_webhook_url && (
                          <button
                            type="button"
                            onClick={() => handleDisconnectBot('zoho_cliq')}
                            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/70 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                          >
                            <Trash2 size={13} />
                            <span>Disconnect</span>
                          </button>
                        )}
                      </div>

                      {/* Setup Instructions (Collapsible Accordion) */}
                      <div className="border border-black/[0.06] rounded-xl bg-white/40 overflow-hidden transition-all">
                        <button
                          type="button"
                          onClick={() => setOpenCliqGuide(!openCliqGuide)}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">Zoho Developer Console Setup Guide</span>
                            <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">(Bot creation & message handler)</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                            <span>{openCliqGuide ? 'Hide Instructions' : 'Show Instructions'}</span>
                            {openCliqGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </div>
                        </button>
                        {openCliqGuide && (
                          <div className="p-3.5 pt-1 border-t border-black/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-600 animate-in fade-in duration-200">
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                              <span>Go to <b>Zoho Cliq Developer Console</b> &gt; <b>Bots</b> &gt; Create Bot.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                              <span>In Bot Details, copy the <b>Incoming Webhook URL</b> into the field above.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                              <span>Under <b>Bot Handlers</b>, select <i>Message Handler</i> and paste the handler URL shown above.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                              <span>Click Save in both Zoho Cliq Console and on this page.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Microsoft Teams Bot Card */}
                  <div className="bg-white/40 hover:bg-white/50 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-black/[0.04] gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-3xs">
                          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.5 7.5a2.5 2.5 0 1 0-2.45-3h-1.55a3.5 3.5 0 0 1 3.5 3.5v.5h.5zm-3.5 1h-8A2.5 2.5 0 0 0 5.5 11v6a2.5 2.5 0 0 0 2.5 2.5h8a2.5 2.5 0 0 0 2.5-2.5v-6a2.5 2.5 0 0 0-2.5-2.5zm-5 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z"/>
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">Microsoft Teams Hiring Assistant</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 hidden sm:inline">
                              Teams Bot & Adaptive Cards
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Enable Hiring Managers to approve requisitions and review candidate match cards right inside Microsoft Teams.
                          </p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0 self-start sm:self-auto">
                        <input
                          type="checkbox"
                          checked={botConfig.ms_teams.enabled}
                          onChange={(e) => setBotConfig({
                            ...botConfig,
                            ms_teams: { ...botConfig.ms_teams, enabled: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Microsoft App ID */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                            Microsoft App ID (Bot Client ID)
                          </label>
                          <input
                            type="text"
                            value={botConfig.ms_teams.app_id}
                            onChange={(e) => setBotConfig({
                              ...botConfig,
                              ms_teams: { ...botConfig.ms_teams, app_id: e.target.value }
                            })}
                            placeholder="e.g. 7b3f9c6d-5a82-4f2c-b173-e38db0fa4b12"
                            className="w-full px-3 py-2 text-xs font-mono text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                          />
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            From Azure Bot Service or Microsoft Teams Developer Portal.
                          </span>
                        </div>

                        {/* Microsoft App Password */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                            Microsoft App Password (Client Secret)
                          </label>
                          <div className="relative">
                            <input
                              type={showTeamsPassword ? 'text' : 'password'}
                              value={botConfig.ms_teams.app_password}
                              onChange={(e) => setBotConfig({
                                ...botConfig,
                                ms_teams: { ...botConfig.ms_teams, app_password: e.target.value }
                              })}
                              placeholder="Azure Bot Client Secret"
                              className="w-full pl-3 pr-9 py-2 text-xs font-mono text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowTeamsPassword(!showTeamsPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer p-0.5"
                            >
                              {showTeamsPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            Used to authenticate outbound Adaptive Card replies back to Teams.
                          </span>
                        </div>
                      </div>

                      {/* Bot Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Bot Display Name in Teams
                        </label>
                        <input
                          type="text"
                          value={botConfig.ms_teams.bot_name}
                          onChange={(e) => setBotConfig({
                            ...botConfig,
                            ms_teams: { ...botConfig.ms_teams, bot_name: e.target.value }
                          })}
                          placeholder="e.g. TermJobs Assistant"
                          className="w-full sm:w-1/2 px-3 py-2 text-xs text-gray-900 bg-white/70 hover:bg-white focus:bg-white backdrop-blur-md border border-gray-200/80 focus:border-black rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs transition-all"
                        />
                      </div>

                      {/* Bot Messaging Endpoint URL */}
                      <div className="bg-black/[0.02] border border-black/[0.06] rounded-xl p-3.5 text-xs space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10.5px] font-bold text-gray-700 uppercase tracking-wider">
                              Bot Messaging Endpoint URL
                            </span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                              Azure Bot Service
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(botConfig.ms_teams.bot_endpoint || `${window.location.origin}/api/teams/messages`);
                              setCopiedTeamsEndpoint(true);
                              setTimeout(() => setCopiedTeamsEndpoint(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-gray-200/90 text-[11px] font-semibold text-gray-700 hover:text-black flex items-center gap-1.5 shadow-3xs cursor-pointer transition-all active:scale-98"
                          >
                            {copiedTeamsEndpoint ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="text-gray-500" />}
                            <span>{copiedTeamsEndpoint ? 'Copied URL!' : 'Copy Endpoint'}</span>
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-gray-800 break-all select-all bg-white/90 p-2.5 rounded-lg border border-black/[0.04] shadow-3xs">
                          {botConfig.ms_teams.bot_endpoint || `${window.location.origin}/api/teams/messages`}
                        </div>
                        <p className="text-[10.5px] text-gray-400">
                          In Azure Portal &gt; Bot Services &gt; Configuration, set this URL as your <b>Messaging Endpoint</b>.
                        </p>
                      </div>

                      {/* Sideload App Package Download */}
                      <div className="p-3.5 bg-white/70 rounded-xl border border-black/[0.06] flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-xs font-bold text-gray-900">Microsoft Teams App Package (.zip)</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Pre-packaged with manifest.json and icons. Sideload into Microsoft Teams or upload to Teams Admin Center.
                          </div>
                        </div>
                        <a
                          href={botConfig.ms_teams.package_url || '/api/teams/package'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-200/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-98"
                        >
                          <ExternalLink size={13} />
                          <span>Download Teams App (.zip)</span>
                        </a>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSaveTeams}
                          disabled={savingBots}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
                        >
                          {savingBots ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Save Microsoft Teams Config</span>
                        </button>

                        {botConfig.ms_teams.app_id && (
                          <button
                            type="button"
                            onClick={() => handleDisconnectBot('ms_teams')}
                            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/70 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                          >
                            <Trash2 size={13} />
                            <span>Disconnect</span>
                          </button>
                        )}
                      </div>

                      {/* Step-by-Step Instructions (Collapsible Accordion) */}
                      <div className="border border-black/[0.06] rounded-xl bg-white/40 overflow-hidden transition-all">
                        <button
                          type="button"
                          onClick={() => setOpenTeamsGuide(!openTeamsGuide)}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">Microsoft Teams Bot Setup Guide</span>
                            <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">(Azure Bot Service & Manifest)</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                            <span>{openTeamsGuide ? 'Hide Instructions' : 'Show Instructions'}</span>
                            {openTeamsGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </div>
                        </button>
                        {openTeamsGuide && (
                          <div className="p-3.5 pt-1 border-t border-black/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-600 animate-in fade-in duration-200">
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                              <span>Register an Azure Bot in <b>Azure Portal</b> &gt; <b>Azure Bot</b> (or Teams Developer Portal).</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                              <span>Copy the <b>Microsoft App ID</b> and create a <b>Client Secret</b>, then paste them above.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                              <span>Copy the <b>Bot Messaging Endpoint URL</b> and paste it into the Azure Bot Configuration.</span>
                            </div>
                            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-black/[0.04]">
                              <span className="w-4.5 h-4.5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                              <span>Click <b>Download Teams App (.zip)</b> and upload it to <b>Teams Admin Center</b> &gt; <i>Manage apps</i>.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Team Chat & Messaging Governance */}
              {activeTab === 'chat' && (
                <div className="space-y-4">
                  {/* Toast Alert */}
                  {chatMessage.text && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-xs ${
                        chatMessage.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {chatMessage.type === 'success' ? (
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle size={15} className="text-red-600 shrink-0" />
                        )}
                        <span>{chatMessage.text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChatMessage({ type: '', text: '' })}
                        className="text-gray-400 hover:text-gray-700 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Header Card */}
                  <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-2xl p-4 sm:p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                            Team Chat Governance
                          </h2>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              chatSettings.enabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {chatSettings.enabled ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 max-w-xl">
                          Manage internal communications, enable or restrict messaging for hiring managers and team members, and ensure company-wide communication governance.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsProfileChatOpen(true)}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                          title="Open team messages drawer"
                        >
                          <MessageSquare size={13} />
                          <span>Open Messages</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveChatSettings}
                          disabled={savingChat}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-98"
                        >
                          {savingChat ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Save Settings</span>
                        </button>
                      </div>
                    </div>

                    {/* Master Controls Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-black/[0.05]">
                      {/* Master Enable/Disable Switch */}
                      <div className="p-3.5 rounded-xl bg-white/80 border border-black/[0.06] flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-gray-900">Enable Team Chat</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Turn off to temporarily pause messaging across the entire organization.
                          </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={chatSettings.enabled}
                            onChange={(e) =>
                              setChatSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                        </label>
                      </div>

                      {/* Messaging Policy Mode */}
                      <div className="p-3.5 rounded-xl bg-white/80 border border-black/[0.06] flex flex-col justify-between gap-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-gray-900">Permission Policy</div>
                          <span className="text-[10px] font-mono uppercase text-gray-400 font-semibold">
                            {chatSettings.policy === 'all' ? 'All Members' : 'Restricted List'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setChatSettings((prev) => ({ ...prev, policy: 'all' }))}
                            className={`py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              chatSettings.policy === 'all'
                                ? 'bg-white text-gray-900 shadow-3xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            All Members
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatSettings((prev) => ({ ...prev, policy: 'restricted' }))}
                            className={`py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              chatSettings.policy === 'restricted'
                                ? 'bg-white text-gray-900 shadow-3xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            Restricted
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Member Permissions Table */}
                  <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                          Member Messaging Access Control
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          Toggle messaging permissions individually for hiring managers, interviewers, and team staff.
                        </p>
                      </div>

                      {/* Search members */}
                      <div className="relative w-full sm:w-64">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={chatMemberFilter}
                          onChange={(e) => setChatMemberFilter(e.target.value)}
                          placeholder="Search members..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    </div>

                    {loadingChat ? (
                      <div className="py-12 flex items-center justify-center text-xs text-gray-400 gap-2">
                        <Loader2 size={15} className="animate-spin text-gray-500" />
                        <span>Loading team members...</span>
                      </div>
                    ) : chatSettings.members.length === 0 ? (
                      <div className="py-10 text-center text-xs text-gray-400">
                        No team members registered under this tenant yet.
                      </div>
                    ) : (
                      <div className="border border-black/[0.06] rounded-xl overflow-hidden bg-white/70">
                        <div className="divide-y divide-black/[0.05]">
                          {chatSettings.members
                            .filter((m) => {
                              const q = chatMemberFilter.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                (m.name || '').toLowerCase().includes(q) ||
                                (m.email || '').toLowerCase().includes(q) ||
                                (m.role || '').toLowerCase().includes(q) ||
                                (m.department || '').toLowerCase().includes(q)
                              );
                            })
                            .map((member) => {
                              const isRestricted = chatSettings.restricted_user_ids.includes(member.id);
                              const canMessage = !isRestricted && chatSettings.enabled;

                              return (
                                <div
                                  key={member.id}
                                  className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-white/80 transition-colors"
                                >
                                  {/* Member Info */}
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center shrink-0">
                                      {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-900 truncate">
                                          {member.name}
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/80 shrink-0">
                                          {member.role || 'Member'}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                        {member.email} {member.department ? `• ${member.department}` : ''}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Permission Toggle */}
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span
                                      className={`text-[11px] font-semibold hidden sm:inline ${
                                        canMessage ? 'text-emerald-700' : 'text-gray-400'
                                      }`}
                                    >
                                      {canMessage ? 'Can Message' : 'Restricted'}
                                    </span>

                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!isRestricted}
                                        onChange={() => handleToggleMemberChat(member.id)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Bottom Save Reminder */}
                    <div className="pt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>Restricted members will be unable to send or receive team messages.</span>
                      <button
                        type="button"
                        onClick={handleSaveChatSettings}
                        disabled={savingChat}
                        className="text-xs font-bold text-black hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {savingChat ? 'Saving...' : 'Save permissions'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Team Chat Drawer instance */}
      <TeamChatDrawer
        isOpen={isProfileChatOpen}
        onClose={() => setIsProfileChatOpen(false)}
        currentUserName={user?.name || 'Company Admin'}
      />
    </div>
  );
}
