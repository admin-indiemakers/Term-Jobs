import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  Sparkles
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { token } = useAuth();
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
      return stats.platform_activities.map((act) => ({
        id: act.id,
        icon: act.type === 'buyer' ? Building2 : act.type === 'vendor' ? Layers : Edit3,
        title: act.title,
        desc: act.desc,
        date: 'Recent',
        badge: act.badge || 'Active',
        badgeTone: act.tone === 'green' ? 'green' : 'gray',
      }));
    }

    const list = [];
    tenants.slice(-3).reverse().forEach((t, idx) => {
      const isClient = t.tenant_type === 'client';
      list.push({
        id: `tenant-${t.id}`,
        icon: isClient ? Building2 : Layers,
        title: isClient ? 'Buyer company onboarded' : 'Vendor consultancy onboarded',
        desc: `${t.name} • ${isClient ? 'Tenant and admin provisioned' : 'Recruiter access provisioned'}`,
        date: idx === 0 ? 'Today' : 'Yesterday',
        badge: isClient ? 'Completed' : 'Active',
        badgeTone: 'green',
      });
    });

    return list.slice(0, 4);
  }, [stats, tenants]);

  return (
    <div className="w-full min-w-0 pb-12 space-y-5 text-left" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Main Header Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • PLATFORM CONTROL
          </div>
          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Super Admin Console
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Manage buyer companies, vendor consultancies, administrator accounts and archived records from one central workspace.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Super Admin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            to="/dashboard/superadmin/candidate-management"
            className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <UserCheck size={14} className="text-emerald-600" />
            Candidate Management
          </Link>
          <Link
            to="/dashboard/superadmin/candidates"
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <FileText size={14} />
            Candidate Pool
          </Link>
          <button
            type="button"
            onClick={() => setShowOnboardVendorModal(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            + Onboard Vendor
          </button>
          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            + Onboard Buyer Company
          </button>
        </div>
      </div>

      {/* 6 Core Platform Metric Cards: Buyers, Guest Clients, Vendors, Admin Accounts, Candidate Pool, AI Outreach */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Buyer Companies */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                BUYER CLIENTS
              </span>
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-800 flex items-center justify-center">
                <Building2 size={16} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight my-1">
              {clientTenants.length}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Active enterprise client tenants
            </div>
          </div>
        </div>

        {/* Card 2: Guest Clients */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                GUEST CLIENTS
              </span>
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-800 flex items-center justify-center">
                <UserCheck size={16} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight my-1">
              {guestClientsCount}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              External & guest partner accounts
            </div>
          </div>
        </div>

        {/* Card 3: Vendor Consultancies */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                VENDOR PARTNERS
              </span>
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-800 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight my-1">
              {consultancyTenants.length}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Approved staffing & sourcing agencies
            </div>
          </div>
        </div>

        {/* Card 4: Admin Accounts */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:border-gray-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                ADMIN ACCOUNTS
              </span>
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-800 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight my-1">
              {totalAdmins}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Configured buyer, vendor & guest administrators
            </div>
          </div>
        </div>

        {/* Card 5: Candidate Pool */}
        <Link
          to="/dashboard/superadmin/candidates"
          className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer block text-left"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-black transition-colors">
                CANDIDATE POOL
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <FileText size={16} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 tracking-tight my-1">
              {poolStats.total}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Direct portal applicants & vendor talent
            </div>
          </div>
          <div className="mt-3 text-xs font-bold text-black group-hover:underline flex items-center gap-1">
            Open Pool <ArrowRight size={12} />
          </div>
        </Link>

        {/* Card 6: AI Email Outreach */}
        <Link
          to="/dashboard/superadmin/outreach"
          className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between group hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer block text-left"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider group-hover:text-purple-800 transition-colors flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" /> AI OUTREACH
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Mail size={16} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-purple-700 tracking-tight my-1">
              {outreachStats.total_outreach_sent}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Top 20 candidate match emails sent ({outreachStats.response_rate_percent}% RSVP)
            </div>
          </div>
          <div className="mt-3 text-xs font-bold text-purple-700 group-hover:underline flex items-center gap-1">
            Control Panel <ArrowRight size={12} />
          </div>
        </Link>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Middle Section: Platform Activity (Left) + Quick Actions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Platform Activity */}
        <div className="lg:col-span-7 bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 tracking-tight">Platform Activity</h2>
                <p className="text-xs text-gray-500 mt-0.5">Recent onboarding and account events.</p>
              </div>
              <Link to="/dashboard/superadmin/accounts" className="text-xs font-bold text-gray-900 hover:text-black flex items-center gap-1 transition-colors">
                View all <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {platformActivities.map((act) => {
                const IconComp = act.icon;
                return (
                  <div key={act.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                        <IconComp size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{act.title}</div>
                        <div className="text-[11px] text-gray-500 truncate">{act.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[11px] text-gray-400 font-medium">{act.date}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${act.badgeTone === 'green'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
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

        {/* Right: Quick Actions */}
        <div className="lg:col-span-5 bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-gray-100 mb-3">
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Quick Actions</h2>
              <p className="text-xs text-gray-500 mt-0.5">Common platform administration tasks.</p>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-gray-50/70 border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Building2 size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900">Buyer company</div>
                    <div className="text-[11px] text-gray-500 truncate">Create tenant + first admin</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  Onboard
                </button>
              </div>

              <div className="p-3 bg-gray-50/70 border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Layers size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900">Vendor consultancy</div>
                    <div className="text-[11px] text-gray-500 truncate">Create vendor + recruiter</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnboardVendorModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  Onboard
                </button>
              </div>

              <div className="p-3 bg-gray-50/70 border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Users size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900">Account management</div>
                    <div className="text-[11px] text-gray-500 truncate">Review administrator access</div>
                  </div>
                </div>
                <Link
                  to="/dashboard/superadmin/accounts"
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-bold shadow-2xs transition-colors shrink-0"
                >
                  Open
                </Link>
              </div>

              <Link
                to="/dashboard/superadmin/candidates"
                className="p-3 bg-gray-50/70 border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-gray-100/80 hover:border-gray-300 transition-all cursor-pointer block"
              >
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-xs font-bold text-gray-900">Candidate Pool</div>
                      <div className="text-[11px] text-gray-500 truncate">All portal & vendor resumes</div>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-bold shadow-2xs transition-colors shrink-0">
                    Open
                  </span>
                </div>
              </Link>

              <Link
                to="/dashboard/superadmin/outreach"
                className="p-3 bg-purple-50/50 border border-purple-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-purple-100/60 hover:border-purple-300 transition-all cursor-pointer block"
              >
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Mail size={15} />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-xs font-bold text-purple-950 flex items-center gap-1">
                        AI Outreach Engine
                        <Sparkles size={12} className="text-amber-500" />
                      </div>
                      <div className="text-[11px] text-purple-700/80 truncate">Top 20 match & interactive email RSVP</div>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 text-xs font-bold shadow-2xs transition-colors shrink-0">
                    Manage
                  </span>
                </div>
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
