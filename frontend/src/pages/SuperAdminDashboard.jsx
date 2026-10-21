import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import OnboardCompanyModal from '../components/OnboardCompanyModal';
import OnboardVendorModal from '../components/OnboardVendorModal';
import {
  Building2,
  Users,
  Layers,
  Plus,
  Edit3,
  ArrowRight,
  UserCheck,
  FileText,
  Mail,
  Sparkles,
  Database,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Activity,
  Briefcase
} from 'lucide-react';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Recent';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recent';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 45) return 'Just now';
  if (diffInSeconds < 90) return '1 min ago';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SuperAdminDashboard() {
  const { token, logout } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showOnboardVendorModal, setShowOnboardVendorModal] = useState(false);
  const [poolStats, setPoolStats] = useState({ total: 0, portal_applicants: 0, vendor_candidates: 0 });
  const [outreachStats, setOutreachStats] = useState({ total_outreach_sent: 0, interested_count: 0, response_rate_percent: 0 });

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/tenants', { token }),
      request('/api/superadmin/agent/stats', { token }).catch(() => null),
      request('/api/superadmin/candidate-pool', { token }).catch(() => null),
      request('/api/superadmin/outreach/stats', { token }).catch(() => null),
    ])
      .then(([tenantsRes, statsRes, poolRes, outreachRes]) => {
        setTenants(tenantsRes || []);
        if (statsRes) {
          setStats(statsRes);
        }
        if (poolRes?.stats) {
          setPoolStats(poolRes.stats);
        } else if (poolRes?.total_count !== undefined) {
          setPoolStats({ total: poolRes.total_count, portal_applicants: 0, vendor_candidates: poolRes.total_count });
        }
        if (outreachRes) {
          setOutreachStats(outreachRes);
        }
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/backup/sql', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to download database backup');
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `termjob_db_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`Database backup successfully downloaded as ${filename}`);
    } catch (err) {
      console.error('Database backup error:', err);
      setError(err.message || 'Failed to download database backup.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  useEffect(() => {
    load();
    const handleRefresh = () => load();
    window.addEventListener('refresh-superadmin-data', handleRefresh);
    return () => window.removeEventListener('refresh-superadmin-data', handleRefresh);
  }, [token]);

  // Auto-dismiss notification after 2 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const clientTenants = useMemo(() => tenants.filter((t) => t.tenant_type === 'client'), [tenants]);
  const consultancyTenants = useMemo(() => tenants.filter((t) => t.tenant_type === 'consultancy'), [tenants]);
  const guestClients = useMemo(() => {
    return tenants.filter(
      (t) =>
        t.is_guest ||
        t.vendor_type === 'guest' ||
        t.client_type === 'guest' ||
        (t.tenant_type === 'client' && t.is_guest)
    );
  }, [tenants]);
  const guestClientsCount = useMemo(() => {
    if (stats?.guest_clients !== undefined) return stats.guest_clients;
    return guestClients.length;
  }, [stats, guestClients]);
  const totalAdmins = useMemo(() => {
    if (stats?.total_admin_accounts !== undefined) {
      return stats.total_admin_accounts;
    }
    const baseCount = (stats?.company_admins !== undefined && stats?.vendor_admins !== undefined)
      ? stats.company_admins + stats.vendor_admins
      : clientTenants.length + consultancyTenants.length;
    return baseCount + (guestClientsCount || 0);
  }, [stats, clientTenants, consultancyTenants, guestClientsCount]);

  // Generate dynamic platform activity events based on actual DB records
  const platformActivities = useMemo(() => {
    if (stats?.platform_activities && stats.platform_activities.length > 0) {
      return stats.platform_activities.map((act) => {
        let IconComp = Building2;
        if (act.type === 'vendor') IconComp = Layers;
        else if (act.type === 'admin') IconComp = ShieldCheck;
        else if (act.type === 'recruiter') IconComp = Users;
        else if (act.type === 'candidate') IconComp = UserCheck;
        else if (act.type === 'requisition') IconComp = Briefcase;

        return {
          id: act.id,
          icon: IconComp,
          title: act.title,
          desc: act.desc,
          date: formatRelativeTime(act.created_at),
          badge: act.badge || 'Active',
          badgeTone: act.tone === 'green' ? 'green' : act.tone === 'blue' ? 'blue' : act.tone === 'purple' ? 'purple' : 'gray',
        };
      });
    }

    const list = [];
    tenants.slice(-4).reverse().forEach((t) => {
      const isClient = t.tenant_type === 'client';
      list.push({
        id: `tenant-${t.id}`,
        icon: isClient ? Building2 : Layers,
        title: isClient ? 'Buyer company onboarded' : 'Vendor consultancy onboarded',
        desc: `${t.name} • ${isClient ? 'Tenant and admin provisioned' : 'Recruiter access provisioned'}`,
        date: formatRelativeTime(t.created_at),
        badge: isClient ? 'Completed' : 'Active',
        badgeTone: 'green',
      });
    });

    return list;
  }, [stats, tenants]);

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area: Unboxed, Transparent, Clean Big Typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-extrabold text-emerald-800 tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Platform Command
            </span>
            <span className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
            Super Admin Console
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            Multi-tenant infrastructure, staffing agencies, candidate pipeline orchestration, and system logs.
          </p>
        </div>

        {/* Top Right Actions: Notification Bell, + Vendor, + Buyer, Backup DB, Refresh, Signout */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
          <NotificationBell />

          <button
            type="button"
            onClick={() => load()}
            title="Refresh platform telemetry"
            className="p-2 rounded-xl bg-white/70 hover:bg-white text-gray-700 border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setShowOnboardVendorModal(true)}
            className="px-3 py-1.5 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-gray-800 text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            + Vendor
          </button>

          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            + Buyer
          </button>

          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="px-3 py-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-95"
            title="Export and download complete database backup (.sql)"
          >
            {downloadingBackup ? (
              <Loader2 size={13} className="animate-spin text-indigo-600" />
            ) : (
              <Database size={13} className="text-indigo-600" />
            )}
            <span className="hidden sm:inline">Backup</span>
          </button>

          <button
            onClick={logout}
            type="button"
            title="Sign out of Super Admin Console"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold shadow-2xs">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Two-Column Layout: Stat Cards (Top on Mobile, Right on Desktop) + Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3.5 sm:gap-4 items-stretch pt-2">
        {/* Metric Stat Cards: comes FIRST on mobile (order-1, swipeable strip), and on the RIGHT on desktop (order-2) */}
        <div className="order-1 lg:order-2 w-full lg:w-44 xl:w-48 shrink-0 flex flex-row lg:flex-col gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 snap-x">
          {/* Card 1: Buyer Clients */}
          <Link
            to="/dashboard/superadmin/accounts"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[96px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Building2 size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                Buyers
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {clientTenants.length}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Buyer Companies
              </div>
            </div>
          </Link>

          {/* Card 2: Vendor Agencies */}
          <Link
            to="/dashboard/superadmin/vendors"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[96px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Layers size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                Vendors
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {consultancyTenants.length}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Staffing Agencies
              </div>
            </div>
          </Link>

          {/* Card 3: Admin Accounts */}
          <Link
            to="/dashboard/superadmin/accounts"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[96px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <Users size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-800 border border-purple-200/80">
                Admins
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {totalAdmins}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Admin Accounts
              </div>
            </div>
          </Link>

          {/* Card 4: Talent Pool */}
          <Link
            to="/dashboard/superadmin/candidates"
            className="snap-start shrink-0 w-[122px] sm:w-[136px] lg:w-full h-[66px] sm:h-[72px] lg:h-[96px] p-2 sm:p-2.5 lg:p-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl flex flex-col justify-between text-left transition-all cursor-pointer group shadow-[0_4px_20px_0_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/70 active:scale-95"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 rounded-lg lg:rounded-xl bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-gray-700 shadow-3xs shrink-0 group-hover:scale-105 transition-transform">
                <FileText size={13} className="lg:w-[15px] lg:h-[15px]" />
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-800 border border-teal-200/80">
                Pool
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {poolStats.total}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5 truncate">
                Talent Pool
              </div>
            </div>
          </Link>
        </div>

        {/* Main Content Area: Left / Center (order-2 on mobile, order-1 on desktop) */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 space-y-4">
          {/* Glassmorphic Navigation Tabs */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Link
              to="/dashboard/superadmin/candidate-management"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-gray-700 hover:text-black hover:bg-white/70"
            >
              <UserCheck size={14} className="text-emerald-600" />
              <span>Candidate Selections</span>
            </Link>
            <Link
              to="/dashboard/superadmin/candidates"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-gray-700 hover:text-black hover:bg-white/70"
            >
              <FileText size={14} className="text-teal-600" />
              <span>Talent Pool</span>
            </Link>
            <Link
              to="/dashboard/superadmin/outreach"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-gray-700 hover:text-black hover:bg-white/70"
            >
              <Mail size={14} className="text-purple-600" />
              <span>AI Outreach</span>
            </Link>
            <Link
              to="/dashboard/superadmin/accounts"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-gray-700 hover:text-black hover:bg-white/70"
            >
              <Building2 size={14} className="text-blue-600" />
              <span>Buyer Companies</span>
            </Link>
            <Link
              to="/dashboard/superadmin/vendors"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-gray-700 hover:text-black hover:bg-white/70"
            >
              <Layers size={14} className="text-amber-600" />
              <span>Vendor Agencies</span>
            </Link>
            <Link
              to="/dashboard/superadmin/accounts"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 text-gray-700 hover:text-black hover:bg-white/70"
            >
              <Users size={14} className="text-indigo-600" />
              <span>Admin Accounts</span>
            </Link>
          </div>

          {/* Platform Activity Card */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-gray-100/90 mb-3">
                <div>
                  <h2 className="text-base font-black text-gray-900 tracking-tight">Platform Activity</h2>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Live onboarding and tenant administration telemetry.</p>
                </div>
                <Link to="/dashboard/superadmin/accounts" className="text-xs font-bold text-gray-900 hover:text-black flex items-center gap-1 transition-colors">
                  View all <ArrowRight size={13} />
                </Link>
              </div>

              <div
                className="divide-y divide-gray-100/90 overflow-y-auto max-h-[228px] sm:max-h-[236px] pr-1"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0, 0, 0, 0.15) transparent',
                }}
              >
                {platformActivities.map((act) => {
                  const IconComp = act.icon;
                  return (
                    <div key={act.id} className="py-2.5 sm:py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white/80 border border-white/90 text-gray-700 flex items-center justify-center shrink-0 shadow-2xs">
                          <IconComp size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">{act.title}</div>
                          <div className="text-[11px] text-gray-500 truncate">{act.desc}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-[11px] text-gray-500 font-semibold whitespace-nowrap">
                          {act.date}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            act.badgeTone === 'green'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : act.badgeTone === 'blue'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                              : act.badgeTone === 'purple'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/80'
                              : 'bg-gray-100 text-gray-700 border border-gray-200/80'
                          }`}
                        >
                          {act.badge}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100/90 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight">Quick Actions</h2>
                <span className="text-[10px] text-gray-400 hidden sm:inline">• Common provisioning & access</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setShowOnboardModal(true)}
                className="p-2 sm:p-2.5 bg-white/70 hover:bg-white backdrop-blur-md border border-white/80 hover:border-gray-300 rounded-xl flex items-center justify-between gap-2 transition-all shadow-3xs cursor-pointer active:scale-95 text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Building2 size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">Buyer Company</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-500 truncate">Provision tenant</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-gray-900 group-hover:bg-black text-white text-[10px] font-bold shrink-0 shadow-2xs">
                  Onboard
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowOnboardVendorModal(true)}
                className="p-2 sm:p-2.5 bg-white/70 hover:bg-white backdrop-blur-md border border-white/80 hover:border-gray-300 rounded-xl flex items-center justify-between gap-2 transition-all shadow-3xs cursor-pointer active:scale-95 text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Layers size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">Vendor Agency</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-500 truncate">Recruiter access</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-gray-900 group-hover:bg-black text-white text-[10px] font-bold shrink-0 shadow-2xs">
                  Onboard
                </span>
              </button>

              <Link
                to="/dashboard/superadmin/candidates"
                className="p-2 sm:p-2.5 bg-white/70 hover:bg-white backdrop-blur-md border border-white/80 hover:border-teal-300 rounded-xl flex items-center justify-between gap-2 transition-all shadow-3xs cursor-pointer active:scale-95 text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <FileText size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">Candidate Pool</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-500 truncate">Applicant talent</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200/80 group-hover:bg-gray-100 text-gray-800 text-[10px] font-bold shadow-2xs shrink-0">
                  Open
                </span>
              </Link>

              <Link
                to="/dashboard/superadmin/outreach"
                className="p-2 sm:p-2.5 bg-purple-50/70 hover:bg-purple-100/70 backdrop-blur-md border border-purple-200/70 hover:border-purple-300 rounded-xl flex items-center justify-between gap-2 transition-all shadow-3xs cursor-pointer active:scale-95 text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-900 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Mail size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs font-bold text-purple-950 flex items-center gap-1 truncate">
                      AI Outreach
                      <Sparkles size={10} className="text-amber-500 shrink-0" />
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-purple-700/80 truncate">Candidate RSVP</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white border border-purple-200 group-hover:bg-purple-50 text-purple-900 text-[10px] font-bold shadow-2xs shrink-0">
                  Manage
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Onboard Vendor Modal Popup */}
      <OnboardVendorModal
        isOpen={showOnboardVendorModal}
        onClose={() => setShowOnboardVendorModal(false)}
        onSuccess={() => {
          load();
          setSuccess('Vendor onboarded successfully!');
        }}
      />

      {/* Onboard Company Modal Popup */}
      <OnboardCompanyModal
        isOpen={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
        onSuccess={() => {
          load();
          setSuccess('Company onboarded successfully!');
        }}
      />
    </div>
  );
}
