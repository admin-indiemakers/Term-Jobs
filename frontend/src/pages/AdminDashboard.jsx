import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Building2,
  Briefcase,
  Layers,
  Calendar,
  KeyRound,
  UserPlus,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  X,
  Loader2,
  Lock,
  ChevronRight,
  MoreHorizontal,
  FileText,
  FilePlus,
  Zap,
  TrendingUp,
  Eye,
  Trash2,
  Check,
  Activity,
  Bell,
  MessageSquare,
  User
} from 'lucide-react';
import TeamChatDrawer from '../components/TeamChatDrawer';

function formatDate(iso) {
  if (!iso) return 'Sep 25, 2026';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function timeAgo(iso) {
  if (!iso) return 'Just now';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Just now';
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Just now';
  }
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'open' || s === 'published' || s === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-200/80">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
        {status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Published'}
      </span>
    );
  }
  if (s === 'pending_approval' || s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending Approval
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      {status || 'Draft'}
    </span>
  );
}

const EMPTY_INVITE = {
  role: 'Hiring Manager',
  name: '',
  email: '',
  password: '',
  department: '',
};

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState(() => {
    try {
      const cached = sessionStorage.getItem('tj_cached_admin_users');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [requisitions, setRequisitions] = useState(() => {
    try {
      const cached = sessionStorage.getItem('tj_cached_admin_reqs');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [notifications, setNotifications] = useState(() => {
    try {
      const cached = sessionStorage.getItem('tj_cached_admin_notifs');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [calConfig, setCalConfig] = useState({ provider: null, status: 'disconnected', connected_email: null });
  const [loading, setLoading] = useState(() => users.length === 0 && requisitions.length === 0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Main Card Tabs & Activity Filter
  const [activeMainTab, setActiveMainTab] = useState('requisitions');
  const [activityFilter, setActivityFilter] = useState('all');

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCalModal, setShowCalModal] = useState(false);
  const [isTeamChatOpen, setIsTeamChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Invite Form
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // Password Form
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '' });
  const [changingPwd, setChangingPwd] = useState(false);

  // Cal.com Form
  const [calForm, setCalForm] = useState({
    cal_link: '',
    cal_username: '',
    event_slug: '30min',
    default_duration: 60,
    default_timezone: 'Asia/Kolkata',
    instructions: '',
  });
  const [savingCal, setSavingCal] = useState(false);

  const load = () => {
    if (users.length === 0 && requisitions.length === 0) {
      setLoading(true);
    }
    setError('');

    const fetchUsers = request('/api/auth/users?compact=true', { token })
      .then((usersRes) => {
        if (Array.isArray(usersRes)) {
          setUsers(usersRes);
          try {
            sessionStorage.setItem('tj_cached_admin_users', JSON.stringify(usersRes));
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn('Failed to load users:', err);
      });

    // The console only renders a small requisition summary. Request the compact
    // representation instead of full JD/intake documents for every role.
    const fetchReqs = request('/requisitions?dashboard=true', { token })
      .then((reqsRes) => {
        if (Array.isArray(reqsRes)) {
          setRequisitions(reqsRes);
          try {
            sessionStorage.setItem('tj_cached_admin_reqs', JSON.stringify(reqsRes));
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn('Failed to load requisitions:', err);
      });

    // Activity is supplemental; keep it small and do not make the primary
    // requisitions/team view wait for it.
    const fetchNotifs = request('/api/notifications?compact=true&limit=12', { token })
      .then((notifsRes) => {
        const notifList = Array.isArray(notifsRes) ? notifsRes : (notifsRes?.notifications || []);
        setNotifications(notifList);
        try {
          sessionStorage.setItem('tj_cached_admin_notifs', JSON.stringify(notifList));
        } catch (e) {}
      })
      .catch(() => {});

    Promise.allSettled([fetchUsers, fetchReqs]).finally(() => {
      setLoading(false);
    });
  };

  // Fetch Cal.com config on-demand when calendar modal opens
  useEffect(() => {
    if (showCalModal && token && !calConfig.provider) {
      request('/api/calendar/config', { token })
        .then((calConfigRes) => {
          if (calConfigRes) {
            setCalConfig(calConfigRes);
            setCalForm({
              cal_link: calConfigRes.cal_link || '',
              cal_username: calConfigRes.cal_username || '',
              event_slug: calConfigRes.event_slug || '30min',
              default_duration: calConfigRes.default_duration || 60,
              default_timezone: calConfigRes.default_timezone || 'Asia/Kolkata',
              instructions: calConfigRes.instructions || '',
            });
          }
        })
        .catch(() => {});
    }
  }, [showCalModal, token, calConfig.provider]);

  useEffect(() => {
    load();
  }, [token]);

  // Periodic polling for team chat unread messages
  useEffect(() => {
    if (!token) return;
    const fetchUnread = () => {
      request('/api/team-chat/unread-count', { token, noCache: true, forceRefresh: true })
        .then((res) => {
          if (res && typeof res.unread_count === 'number') {
            setUnreadChatCount(res.unread_count);
          }
        })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 8000);
    return () => clearInterval(interval);
  }, [token]);

  // 2-second auto-dismiss timer for success notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Close popup menus on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const hiringManagers = useMemo(() => users.filter((u) => u.role === 'Hiring Manager'), [users]);
  const directors = useMemo(() => users.filter((u) => u.role === 'Director'), [users]);
  const procurementUsers = useMemo(() => users.filter((u) => u.role === 'Procurement' || u.role === 'Procurement Team'), [users]);
  const financeUsers = useMemo(() => users.filter((u) => u.role === 'Finance' || u.role === 'Finance Team'), [users]);
  const teamMembers = useMemo(() => users.filter((u) => u.role !== 'Candidate'), [users]);
  const pendingApprovals = useMemo(
    () => requisitions.filter((r) => (r.status || '').toLowerCase() === 'pending_approval'),
    [requisitions]
  );
  const activePublished = useMemo(
    () =>
      requisitions.filter(
        (r) =>
          (r.status || '').toLowerCase() === 'open' ||
          (r.status || '').toLowerCase() === 'published' ||
          (r.status || '').toLowerCase() === 'active'
      ),
    [requisitions]
  );
  const draftRequisitions = useMemo(
    () =>
      requisitions.filter((r) =>
        ['draft', 'drafted', 'intake', 'structuring'].includes((r.status || '').toLowerCase())
      ),
    [requisitions]
  );

  // Unified chronological activities feed
  const activities = useMemo(() => {
    const list = [];

    // 1. Live notifications
    (notifications || []).forEach((n) => {
      const isReq = n.type?.includes('requisition') || n.type?.includes('candidate');
      list.push({
        id: `notif-${n.id || Math.random()}`,
        type: 'notification',
        category: isReq ? 'requisitions' : 'system',
        title: n.title || 'System Notification',
        description: n.body || 'New notification received',
        timestamp: n.created_at,
        link: null,
        icon: Bell,
        color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
        badge: 'Notification',
      });
    });

    // 2. Requisitions
    (requisitions || []).forEach((r) => {
      list.push({
        id: `req-${r.id}`,
        type: 'requisition',
        category: 'requisitions',
        title: `${r.title || 'Requisition'} - ${r.status || 'Active'}`,
        description: `${r.department || 'General'} department • Created for ${r.experience_range || 'experienced talent'}`,
        timestamp: r.created_at || r.updated_at,
        link: null,
        icon: Briefcase,
        color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
        badge: 'Requisition',
      });
    });

    // 3. Team Members
    (teamMembers || []).forEach((u) => {
      list.push({
        id: `user-${u.id}`,
        type: 'team',
        category: 'team',
        title: `${u.name || u.email} provisioned`,
        description: `Role: ${u.role} ${u.department ? `(${u.department})` : ''} • Status: Active`,
        timestamp: u.created_at,
        link: `/dashboard/admin/hiring-managers`,
        icon: UserPlus,
        color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
        badge: 'Team',
      });
    });

    // Seed fallbacks if empty
    if (list.length === 0) {
      list.push(
        {
          id: 'seed-1',
          type: 'requisition',
          category: 'requisitions',
          title: 'DevSecOps Engineer requisition published',
          description: 'General department • Active for partner matching and candidate dispatch',
          timestamp: new Date().toISOString(),
          link: null,
          icon: Briefcase,
          color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
          badge: 'Requisition',
        },
        {
          id: 'seed-2',
          type: 'team',
          category: 'team',
          title: 'Team provisioned & synchronized',
          description: 'Hiring manager and Director roles established with company policy',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          link: '/dashboard/admin/hiring-managers',
          icon: UserPlus,
          color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
          badge: 'Team',
        }
      );
    }

    return list.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [notifications, requisitions, users]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return activities;
    return activities.filter((a) => a.category === activityFilter);
  }, [activities, activityFilter]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmittingInvite(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          role: inviteForm.role,
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          password: inviteForm.password,
          department: (inviteForm.role === 'Hiring Manager' || inviteForm.role === 'Finance Team' || inviteForm.role === 'Finance')
            ? inviteForm.department.trim() || undefined
            : undefined,
        },
      });
      setSuccess(`${inviteForm.role} account created for ${inviteForm.email}.`);
      setInviteForm(EMPTY_INVITE);
      setShowInviteModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to create team member');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangingPwd(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        token,
        body: pwdForm,
      });
      setSuccess('Password updated successfully.');
      setPwdForm({ current_password: '', new_password: '' });
      setShowPasswordModal(false);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleSaveCalConfig = async (e) => {
    e?.preventDefault();
    setSavingCal(true);
    setError('');
    setSuccess('');
    try {
      const updated = await request('/api/calendar/config', {
        method: 'PUT',
        token,
        body: {
          provider: 'cal',
          status: 'connected',
          cal_link: calForm.cal_link || 'https://cal.com/',
          cal_username: calForm.cal_username || '',
          event_slug: calForm.event_slug || '30min',
          default_duration: Number(calForm.default_duration) || 60,
          default_timezone: calForm.default_timezone || 'Asia/Kolkata',
          instructions: calForm.instructions || '',
        },
      });
      setCalConfig(updated);
      setSuccess('Cal.com scheduling settings updated successfully.');
      setShowCalModal(false);
    } catch (err) {
      setError(err.message || 'Failed to save scheduling configuration.');
    } finally {
      setSavingCal(false);
    }
  };

  const companyName = user?.tenant_name || 'TCS';
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="w-full max-w-[1580px] mx-auto space-y-4 sm:space-y-4.5 pt-1 sm:pt-2 text-left select-none antialiased font-inter"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Toast Alert Messages */}
      {error && (
        <div className="p-3 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Header Area (Fixed at top) */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-0.5 shrink-0">
        <div className="pl-2.5 sm:pl-2.5 pt-1 sm:pt-2">
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • COMPANY GOVERNANCE
          </div>
          <h1
            className="text-2xl sm:text-3xl lg:text-[2.15rem] font-extrabold text-gray-900 tracking-tight leading-none mb-1.5"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {companyName} Admin Console
          </h1>
          <p className="text-[11.5px] sm:text-xs text-gray-500 font-normal leading-normal max-w-xl">
            Oversee team member provisioning, vendor consultancy partnerships, and candidate scheduling.
          </p>
        </div>

        {/* Top Header Action Cluster: Top Right Icon-Only Action Buttons */}
        <div className="flex items-center gap-2 pt-0.5 sm:pt-1.5 pr-1 shrink-0 self-end sm:self-start">
          {/* Date Stamp */}
          <div className="hidden lg:block text-right text-[11px] font-semibold text-gray-400 mr-1">
            {currentDateFormatted}
          </div>

          {/* Message Icon-Only Button */}
          <button
            type="button"
            onClick={() => setIsTeamChatOpen((prev) => !prev)}
            className="relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-white hover:bg-[#F7F7F5] border border-gray-200/90 text-gray-900 shadow-2xs hover:shadow-xs flex items-center justify-center transition-all cursor-pointer active:scale-95 group"
            title="Team Messages"
          >
            <MessageSquare size={15} strokeWidth={2.1} className="text-gray-800 group-hover:scale-105 transition-transform" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center font-mono ring-2 ring-white">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Profile Icon-Only Button */}
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/profile')}
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-[#000000] hover:bg-[#111111] text-white text-[10px] font-bold shadow-2xs hover:shadow-xs flex items-center justify-center transition-all cursor-pointer active:scale-95 uppercase tracking-tight"
            title="Company & Admin Profile"
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
          </button>
        </div>
      </div>

      {/* Main Content Grid: Left Column (7 cols) & Right Column (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch min-h-0 pt-2 sm:pt-4">
        {/* Left Column (7 cols): 4 Stat Metric Cards + Recent Requisitions */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5 sm:gap-3 h-[520px] sm:h-[500px] min-h-0 pt-1 sm:pt-2">
          {/* 4 Metric Stat Cards Grid (Only on top of Recent Requisitions) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
            {/* Stat Card 1: Active Requisitions */}
            <div
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <FileText size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {activePublished.length}
                </div>
              </div>
              <div className="text-[10.5px] font-medium text-gray-500 truncate">
                Active Requisitions
              </div>
            </div>

            {/* Stat Card 2: Hiring Managers */}
            <div
              onClick={() => navigate('/dashboard/admin/hiring-managers')}
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <Users size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {hiringManagers.length}
                </div>
              </div>
              <div className="text-[10.5px] font-medium text-gray-500 truncate">
                Hiring Managers
              </div>
            </div>

            {/* Stat Card 3: Draft Requisitions */}
            <div
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <FilePlus size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {draftRequisitions.length}
                </div>
              </div>
              <div className="text-[10.5px] font-medium text-gray-500 truncate">
                Draft Requisitions
              </div>
            </div>

            {/* Stat Card 4: Pending Approvals */}
            <div
              className="bg-white/80 hover:bg-white/95 backdrop-blur-2xl border border-white/85 hover:border-white rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_0_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-xl bg-white/70 backdrop-blur-md border border-white flex items-center justify-center text-gray-700 shadow-3xs group-hover:scale-105 transition-transform">
                  <Clock size={14} />
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {pendingApprovals.length}
                </div>
              </div>
              <div className="text-[10.5px] font-medium text-gray-500 truncate">
                Pending Approvals
              </div>
            </div>
          </div>

          {/* Dedicated Recent Requisitions Glassmorphic Card (Roomy & Less Compact) */}
          <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-2xl border border-white/85 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.04] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-800 shadow-2xs">
                  <FileText size={15} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 tracking-tight">Recent Requisitions</h2>
                  <p className="text-[10px] text-gray-400">Latest hiring demands</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-500">
                  {requisitions.length} total
                </span>
              </div>
            </div>

            {/* Requisitions Table with Hidden Scroller */}
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 mt-2 no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-transparent border-b border-black/[0.04] z-10">
                  <tr className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2 px-3">TITLE</th>
                    <th className="py-2 px-3">STATUS</th>
                    <th className="py-2 px-3">CREATED</th>
                    <th className="py-2 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-2.5 px-3">
                          <div className="h-3.5 w-32 bg-gray-200/70 rounded mb-1"></div>
                          <div className="h-2.5 w-16 bg-gray-200/50 rounded"></div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="h-5 w-16 bg-gray-200/60 rounded-full"></div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="h-3 w-20 bg-gray-200/60 rounded"></div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="h-3 w-12 bg-gray-200/50 rounded ml-auto"></div>
                        </td>
                      </tr>
                    ))
                  ) : requisitions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <FileText size={18} className="text-gray-300" />
                          <span className="text-xs font-medium">No requisitions created yet</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    requisitions.map((r) => (
                      <tr key={r.id} className="bg-transparent hover:bg-white/35 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-xs sm:text-[13px] truncate">
                              {r.title || 'DevSecOps Engineer'}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {r.department || 'General'}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={r.status || 'Published'} />
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium text-xs sm:text-[12.5px]">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                        <span className="text-[11px] font-semibold text-gray-400">
                          REQ #{r.id?.slice(0, 6)}
                        </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Team Members + Recent Activity */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 sm:gap-3 h-[520px] sm:h-[500px] min-h-0 pt-1 sm:pt-2">
          {/* Card 1: Team Members Glassmorphic Card */}
          <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-2xl border border-white/85 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-800 shadow-2xs">
                  <Users size={14} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 tracking-tight">Team Members</h2>
                  <p className="text-[10px] text-gray-400">Managers and Directors</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-black text-white hover:bg-gray-800 shadow-xs transition-all cursor-pointer"
                >
                  <span>+ Invite</span>
                </button>
                <Link
                  to="/dashboard/admin/hiring-managers"
                  className="text-[11.5px] font-bold text-gray-600 hover:text-black flex items-center gap-1 transition-colors group cursor-pointer pl-1"
                >
                  <span>View all</span>
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Members Rows with Hidden Scroller */}
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0 mt-2 no-scrollbar">
              {loading ? (
                <div className="space-y-2 py-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/20 animate-pulse">
                      <div className="space-y-1">
                        <div className="h-3.5 w-24 bg-gray-200/70 rounded"></div>
                        <div className="h-2.5 w-14 bg-gray-200/50 rounded"></div>
                      </div>
                      <div className="h-3 w-32 bg-gray-200/60 rounded hidden sm:block"></div>
                      <div className="h-5 w-14 bg-gray-200/60 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center text-gray-400">
                  <Users size={20} className="mb-1 text-gray-300" />
                  <span className="text-xs font-medium">No team members yet</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Use + Invite to add team members</span>
                </div>
              ) : (
                teamMembers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-transparent hover:bg-white/35 border border-transparent hover:border-black/[0.03] transition-all">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-xs sm:text-[12.5px] leading-tight truncate">
                        {u.name || 'Team Member'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {u.department || u.role}
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 font-normal px-2 truncate hidden sm:block">
                      {u.email}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-gray-100/90 text-gray-700 border border-gray-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        Active
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/admin/hiring-managers')}
                        className="p-1 text-gray-400 hover:text-black cursor-pointer"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: Recent Activity Glassmorphic Card */}
          <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-2xl border border-white/85 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-800 shadow-2xs">
                  <Activity size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-[13.5px] font-bold text-gray-900 tracking-tight">Recent Activity</h2>
                  </div>
                  <p className="text-[10px] text-gray-400">Live platform updates</p>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {['all', 'requisitions', 'team'].map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setActivityFilter(tabKey)}
                    className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-bold capitalize transition-all cursor-pointer ${activityFilter === tabKey
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-transparent text-gray-500 hover:text-black hover:bg-white/40 border border-transparent hover:border-black/[0.05]'
                      }`}
                  >
                    {tabKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Feed Rows with Hidden Scroller */}
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0 mt-2 no-scrollbar">
              {filteredActivities.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-400 font-medium">
                  No recent activity found.
                </div>
              ) : (
                filteredActivities.map((act) => {
                  return (
                    <div
                      key={act.id}
                      onClick={() => act.link && navigate(act.link)}
                      className={`p-2 rounded-xl bg-transparent hover:bg-white/35 border border-transparent hover:border-black/[0.03] transition-all flex items-center justify-between gap-2.5 ${act.link ? 'cursor-pointer group' : ''
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-xs sm:text-[12.5px] truncate">
                            {act.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {act.description}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] font-medium text-gray-400">
                          {timeAgo(act.timestamp)}
                        </span>
                        {act.link && (
                          <ChevronRight
                            size={12}
                            className="text-gray-400 group-hover:text-black group-hover:translate-x-0.5 transition-all"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Team Member Modal Popup */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="relative w-full max-w-[520px] bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100/80 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Invite Team Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Provision an account for {companyName}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3.5" autoComplete="off">
              {/* Role Select */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Account Role *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role: 'Hiring Manager' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${inviteForm.role === 'Hiring Manager'
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-white/50 text-gray-700 border border-white/80 hover:bg-white/80'
                      }`}
                  >
                    Hiring Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role: 'Director' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${inviteForm.role === 'Director'
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-white/50 text-gray-700 border border-white/80 hover:bg-white/80'
                      }`}
                  >
                    Director
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role: 'Procurement Team' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${inviteForm.role === 'Procurement Team' || inviteForm.role === 'Procurement'
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-white/50 text-gray-700 border border-white/80 hover:bg-white/80'
                      }`}
                  >
                    Procurement
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role: 'Finance Team', department: prev.department || 'Finance & Accounts' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${inviteForm.role === 'Finance Team' || inviteForm.role === 'Finance'
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-white/50 text-gray-700 border border-white/80 hover:bg-white/80'
                      }`}
                  >
                    Finance
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="e.g. Maya Patel"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="invite_user_email"
                  autoComplete="off"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="maya@company.com"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  name="invite_user_password"
                  autoComplete="new-password"
                  required
                  minLength={4}
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              {/* Department (for HM and Finance) */}
              {(inviteForm.role === 'Hiring Manager' || inviteForm.role === 'Finance Team' || inviteForm.role === 'Finance') && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Department {inviteForm.role === 'Hiring Manager' ? '(Optional)' : ''}
                  </label>
                  <input
                    type="text"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    placeholder={inviteForm.role === 'Hiring Manager' ? 'e.g. Engineering, Product, Marketing' : 'e.g. Finance & Accounts, Invoicing'}
                    className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100/80">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  disabled={submittingInvite}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white/70 border border-white/80 rounded-xl hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvite}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingInvite && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="relative w-full max-w-[460px] bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100/80 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Change Password</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials for {user?.email}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5" autoComplete="off">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  name="user_current_password"
                  autoComplete="current-password"
                  required
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  name="user_new_password"
                  autoComplete="new-password"
                  required
                  minLength={4}
                  value={pwdForm.new_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100/80">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={changingPwd}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white/70 border border-white/80 rounded-xl hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPwd}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {changingPwd && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cal.com Scheduling Modal */}
      {showCalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setShowCalModal(false)}
        >
          <div
            className="relative w-full max-w-[560px] bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/90 p-6 sm:p-7 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100/80 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Cal.com Scheduling Integration</h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect scheduling link to generate live candidate booking slots.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCalModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCalConfig} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Cal.com / Cal.diy Base URL or Handle *
                </label>
                <input
                  type="text"
                  required
                  value={calForm.cal_username}
                  onChange={(e) => setCalForm({ ...calForm, cal_username: e.target.value })}
                  placeholder="e.g. cal.com/mohammed-hashil"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Default Event Slug
                  </label>
                  <input
                    type="text"
                    value={calForm.event_slug}
                    onChange={(e) => setCalForm({ ...calForm, event_slug: e.target.value })}
                    placeholder="30min"
                    className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Interview Duration
                  </label>
                  <select
                    value={calForm.default_duration}
                    onChange={(e) => setCalForm({ ...calForm, default_duration: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={90}>90 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company Timezone
                </label>
                <input
                  type="text"
                  value={calForm.default_timezone}
                  onChange={(e) => setCalForm({ ...calForm, default_timezone: e.target.value })}
                  placeholder="Asia/Kolkata (IST - UTC+5:30)"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white/70 border border-white/80 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-3xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100/80">
                <button
                  type="button"
                  onClick={() => setShowCalModal(false)}
                  disabled={savingCal}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white/70 border border-white/80 rounded-xl hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCal}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingCal && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Chat Drawer (Chat with Hiring Managers) */}
      <TeamChatDrawer
        isOpen={isTeamChatOpen}
        onClose={() => setIsTeamChatOpen(false)}
        currentUserName={user?.name || 'Company Admin'}
      />
    </div>
  );
}
