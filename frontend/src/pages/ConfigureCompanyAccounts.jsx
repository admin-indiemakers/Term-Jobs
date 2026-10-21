import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import EditAccountModal from '../components/EditAccountModal';
import OnboardCompanyModal from '../components/OnboardCompanyModal';
import OnboardVendorModal from '../components/OnboardVendorModal';
import {
  Users,
  Building2,
  Layers,
  Search,
  ArrowLeft,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ConfigureAccounts({ defaultTab }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || defaultTab || 'all';

  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(tabFromUrl); // 'all' | 'buyers' | 'vendors'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTarget, setEditingTarget] = useState(null); // { userAccount, tenant }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showOnboardVendorModal, setShowOnboardVendorModal] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }),
      request('/api/auth/tenants', { token }),
    ])
      .then(([usersRes, tenantsRes]) => {
        const tList = tenantsRes || [];
        // Include Admin, Recruiter, and all Guest accounts for Super Admin management
        const filteredUsers = (usersRes || []).filter(
          (u) => {
            const tObj = tList.find((t) => t.id === u.tenant_id);
            const isGuest = tObj?.is_guest || tObj?.vendor_type === 'guest' || tObj?.client_type === 'guest' || u.is_guest;
            return u.role === 'Admin' || u.role === 'Recruiter' || isGuest;
          }
        );

        // Also ensure any guest tenants without a separate user entry appear as manageable accounts
        const existingTenantIds = new Set(filteredUsers.map((u) => u.tenant_id));
        const guestTenantsWithoutUsers = tList.filter(
          (t) => (t.is_guest || t.vendor_type === 'guest' || t.client_type === 'guest') && !existingTenantIds.has(t.id)
        );
        guestTenantsWithoutUsers.forEach((gt) => {
          filteredUsers.push({
            id: `guest-${gt.id}`,
            name: gt.name,
            email: gt.email || `${gt.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@guest.termjobs.com`,
            role: gt.tenant_type === 'client' ? 'Guest Client' : 'Guest Recruiter',
            tenant_id: gt.id,
            tenant_name: gt.name,
            tenant_type: gt.tenant_type,
            is_guest: true,
            is_active: !gt.is_deleted,
            created_at: gt.created_at,
          });
        });

        setUsers(filteredUsers);
        setAllUsers(Array.isArray(usersRes) ? usersRes : []);
        setTenants(tList);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const buyerAdmins = useMemo(() => users.filter((u) => u.role === 'Admin'), [users]);
  const vendorRecruiters = useMemo(() => users.filter((u) => u.role === 'Recruiter'), [users]);
  const guestUsers = useMemo(() => {
    return users.filter((u) => {
      const tenantObj = tenants.find((t) => t.id === u.tenant_id);
      return tenantObj?.is_guest || tenantObj?.vendor_type === 'guest' || tenantObj?.client_type === 'guest' || u.is_guest;
    });
  }, [users, tenants]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (activeTab === 'buyers' && u.role !== 'Admin') return false;
      if (activeTab === 'vendors' && u.role !== 'Recruiter') return false;
      if (activeTab === 'guest') {
        const tenantObj = tenants.find((t) => t.id === u.tenant_id);
        const isGuest = tenantObj?.is_guest || tenantObj?.vendor_type === 'guest' || tenantObj?.client_type === 'guest' || u.is_guest;
        if (!isGuest) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchCompany = (u.tenant_name || '').toLowerCase().includes(q);
      const matchRole = (u.role || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchCompany || matchRole;
    });
  }, [users, activeTab, searchQuery]);

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Account "${confirmDelete.email}" archived.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete account');
    }
  };

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-5 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header: Unboxed, Transparent, Clean Big Typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Dashboard</span>
            </button>
            <span className="text-gray-300">•</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Platform Access Control
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
            Account Management
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl leading-relaxed">
            Manage administrator credentials, roles, and candidate submission limits across buyer companies and vendor consultancies.
          </p>
        </div>

        {/* Top Right Actions: Notification Bell, + Vendor, + Company & Sign out */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          <NotificationBell />

          <button
            type="button"
            onClick={() => setShowOnboardVendorModal(true)}
            className="px-3 py-1.5 rounded-xl border border-white/80 bg-white/70 hover:bg-white text-gray-800 text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            + Onboard Vendor
          </button>
          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            + Onboard Company
          </button>

          <button
            onClick={logout}
            type="button"
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Strip (Mobile Swipeable / Desktop Grid) */}
      <div className="flex flex-row overflow-x-auto snap-x no-scrollbar lg:grid lg:grid-cols-4 gap-2.5 sm:gap-3.5 pb-1 lg:pb-0">
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`w-[155px] sm:w-[175px] lg:w-full shrink-0 snap-start text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] ${
            activeTab === 'all'
              ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
              : 'bg-white/40 border-white/70 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>All Accounts</span>
            <Users size={13} className="text-gray-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {users.length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
            Total registered logins
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('buyers')}
          className={`w-[155px] sm:w-[175px] lg:w-full shrink-0 snap-start text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] ${
            activeTab === 'buyers'
              ? 'bg-white/85 border-blue-400/60 ring-1 ring-blue-400/30 shadow-sm'
              : 'bg-white/40 border-white/70 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Buyer Admins</span>
            <Building2 size={13} className="text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {buyerAdmins.length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
            Client company managers
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('vendors')}
          className={`w-[155px] sm:w-[175px] lg:w-full shrink-0 snap-start text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] ${
            activeTab === 'vendors'
              ? 'bg-white/85 border-purple-400/60 ring-1 ring-purple-400/30 shadow-sm'
              : 'bg-white/40 border-white/70 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Vendors</span>
            <Layers size={13} className="text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {vendorRecruiters.length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
            Consultancy recruiters
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('guest')}
          className={`w-[155px] sm:w-[175px] lg:w-full shrink-0 snap-start text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] ${
            activeTab === 'guest'
              ? 'bg-white/85 border-emerald-400/60 ring-1 ring-emerald-400/30 shadow-sm'
              : 'bg-white/40 border-white/70 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Guest Accounts</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {guestUsers.length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
            Ad-hoc guest access
          </div>
        </button>
      </div>

      {error && (
        <div className="p-3.5 sm:p-4 bg-red-50/90 border border-red-200/90 rounded-2xl text-xs text-red-700 flex items-center gap-2.5 backdrop-blur-xs shadow-xs">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 sm:p-4 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200 backdrop-blur-xs">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Table & Card Container */}
      <div className="rounded-3xl bg-white/40 backdrop-blur-2xl border border-white/70 p-4 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
        {/* Filter Pills + Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100/80">
          {/* Glassmorphic Tabs */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] p-1 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-black text-white shadow-md'
                  : 'text-gray-600 hover:text-black hover:bg-white/50'
              }`}
            >
              All ({users.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('buyers')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'buyers'
                  ? 'bg-black text-white shadow-md'
                  : 'text-gray-600 hover:text-black hover:bg-white/50'
              }`}
            >
              Buyers ({buyerAdmins.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('vendors')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'vendors'
                  ? 'bg-black text-white shadow-md'
                  : 'text-gray-600 hover:text-black hover:bg-white/50'
              }`}
            >
              Vendors ({vendorRecruiters.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('guest')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'guest'
                  ? 'bg-black text-white shadow-md'
                  : 'text-gray-600 hover:text-black hover:bg-white/50'
              }`}
            >
              Guests ({guestUsers.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, company..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white/80 border border-gray-200/90 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black transition-all placeholder:text-gray-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-400 font-medium">Loading accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400 font-medium">
            No accounts found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Dedicated Modern Cards (< md) */}
            <div className="block md:hidden space-y-3">
              {filteredUsers.map((u) => {
                const isRecruiter = u.role === 'Recruiter';
                const tenantObj = tenants.find((t) => t.id === u.tenant_id);
                const tenantUsers = allUsers.filter((member) => member.tenant_id === u.tenant_id && member.is_active !== false);
                const roleCount = (roles) => tenantUsers.filter((member) => roles.includes((member.role || '').toLowerCase())).length;

                return (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl bg-white/80 border border-gray-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-3"
                  >
                    {/* Header: Avatar, Name, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-gray-900 to-gray-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-gray-900 truncate">
                            {u.name || '—'}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.is_active !== false ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                        {u.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {isRecruiter ? 'Vendor Recruiter' : (u.is_guest ? (u.role || 'Guest') : 'Buyer Admin')}
                      </span>

                      {(tenantObj?.is_guest || tenantObj?.vendor_type === 'guest' || u.is_guest) && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">
                          Guest
                        </span>
                      )}

                      <span className="text-[10px] text-gray-400 font-medium ml-auto">
                        Joined {formatDate(u.created_at)}
                      </span>
                    </div>

                    {/* Company / Organization Section */}
                    <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100/90 text-xs">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        TENANT / COMPANY
                      </div>
                      <div className="font-semibold text-gray-900 truncate">
                        {u.tenant_id && u.role === 'Admin' && tenantObj?.tenant_type === 'client' ? (
                          <Link
                            to={`/dashboard/superadmin/tenants/${encodeURIComponent(u.tenant_id)}`}
                            className="hover:underline focus:underline text-indigo-600 font-bold"
                          >
                            {u.tenant_name || '—'}
                          </Link>
                        ) : (
                          u.tenant_name || '—'
                        )}
                      </div>
                      {u.role === 'Admin' && tenantUsers.length > 0 && (
                        <div className="mt-1 text-[10px] text-gray-500 leading-tight">
                          {roleCount(['finance', 'finance team'])} Fin · {roleCount(['director'])} Dir · {roleCount(['hiring manager', 'hr'])} HM/HR · {tenantUsers.length} total
                        </div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-gray-100/80">
                      <button
                        type="button"
                        onClick={() => setEditingTarget({ userAccount: u, tenant: tenantObj })}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                      >
                        Edit Credentials
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(u)}
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div
              className="hidden md:block overflow-x-auto overflow-y-auto pr-1"
              style={{
                maxHeight: '520px',
                minHeight: '360px',
              }}
            >
              <table className="w-full text-left text-xs border-collapse relative">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10 shadow-2xs">
                  <tr className="border-b border-gray-200/80 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-3">ACCOUNT</th>
                    <th className="py-3 px-3">ROLE</th>
                    <th className="py-3 px-3">COMPANY / TENANT</th>
                    <th className="py-3 px-3">JOINED</th>
                    <th className="py-3 px-3">STATUS</th>
                    <th className="py-3 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/90">
                  {filteredUsers.map((u) => {
                    const isRecruiter = u.role === 'Recruiter';
                    const tenantObj = tenants.find((t) => t.id === u.tenant_id);
                    const tenantUsers = allUsers.filter((member) => member.tenant_id === u.tenant_id && member.is_active !== false);
                    const roleCount = (roles) => tenantUsers.filter((member) => roles.includes((member.role || '').toLowerCase())).length;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Name & Email with Avatar */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{u.name || '—'}</div>
                              <div className="text-[11px] text-gray-500">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Pill */}
                        <td className="py-3.5 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            {isRecruiter ? 'Vendor Recruiter' : (u.is_guest ? (u.role || 'Guest') : 'Buyer Admin')}
                          </span>
                        </td>

                        {/* Company Name */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.tenant_id && u.role === 'Admin' && tenantObj?.tenant_type === 'client' ? (
                              <Link to={`/dashboard/superadmin/tenants/${encodeURIComponent(u.tenant_id)}`}
                                className="font-semibold text-gray-900 hover:underline focus:underline"
                                aria-label={`Open ${u.tenant_name || 'company'} dashboard`}>
                                {u.tenant_name || '—'}
                              </Link>
                            ) : <span className="font-semibold text-gray-900">{u.tenant_name || '—'}</span>}
                            {(tenantObj?.is_guest || tenantObj?.vendor_type === 'guest' || u.is_guest) && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">
                                Guest
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 capitalize">
                            {(tenantObj?.is_guest || tenantObj?.vendor_type === 'guest' || u.is_guest) ? 'Guest Consultancy' : (u.tenant_type || 'Consultancy')}
                          </div>
                          {u.role === 'Admin' && <div className="mt-1 text-[10px] text-gray-600">
                            {roleCount(['finance', 'finance team'])} Finance · {roleCount(['director'])} Directors · {roleCount(['hiring manager', 'hr'])} Hiring/HR · {tenantUsers.length} total users
                          </div>}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-3">
                          <span className="text-gray-500 font-medium">{formatDate(u.created_at)}</span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_active !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${u.is_active !== false ? 'bg-emerald-500' : 'bg-gray-400'
                                }`}
                            />
                            {u.is_active !== false ? 'Active' : 'Not Active'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingTarget({ userAccount: u, tenant: tenantObj })}
                              className="font-bold text-gray-900 hover:text-black text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(u)}
                              className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>


      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-sm w-full text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Archive account?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently archive and remove access for <strong>{confirmDelete.email}</strong>.
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors"
              >
                Archive Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal Popup */}
      <EditAccountModal
        isOpen={!!editingTarget}
        onClose={() => setEditingTarget(null)}
        userAccount={editingTarget?.userAccount}
        tenant={editingTarget?.tenant}
        onSuccess={() => {
          load();
          setSuccess('Account updated successfully!');
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

      {/* Onboard Vendor Modal Popup */}
      <OnboardVendorModal
        isOpen={showOnboardVendorModal}
        onClose={() => setShowOnboardVendorModal(false)}
        onSuccess={() => {
          load();
          setSuccess('Vendor onboarded successfully!');
        }}
      />
    </div>
  );
}
