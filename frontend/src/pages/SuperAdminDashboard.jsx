import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import OnboardCompanyModal from '../components/OnboardCompanyModal';
import OnboardVendorModal from '../components/OnboardVendorModal';
import EditAccountModal from '../components/EditAccountModal';
import {
  Building2,
  Users,
  Layers,
  Search,
  Plus,
  Edit3,
  Archive,
  ArrowRight
} from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showOnboardVendorModal, setShowOnboardVendorModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null); // { userAccount, tenant }
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'buyers' | 'vendors'
  const [searchQuery, setSearchQuery] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }),
      request('/api/auth/tenants', { token }),
    ])
      .then(([usersRes, tenantsRes]) => {
        setUsers(usersRes || []);
        setTenants(tenantsRes || []);
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

  const handleDeleteCompany = async (tenant) => {
    setConfirmDelete(null);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/tenants/${tenant.id}`, { method: 'DELETE', token });
      setSuccess(`Company "${tenant.name}" archived (accounts removed).`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const clientTenants = useMemo(() => tenants.filter((t) => t.tenant_type === 'client'), [tenants]);
  const consultancyTenants = useMemo(() => tenants.filter((t) => t.tenant_type === 'consultancy'), [tenants]);
  const adminAccounts = useMemo(() => users.filter((u) => u.role === 'Admin' || u.role === 'Recruiter'), [users]);

  const tenantAdminsMap = useMemo(() => {
    const map = {};
    adminAccounts.forEach((a) => {
      if (!a.tenant_id) return;
      if (!map[a.tenant_id]) map[a.tenant_id] = { admins: [], recruiters: [] };
      if (a.role === 'Admin') map[a.tenant_id].admins.push(a);
      if (a.role === 'Recruiter') map[a.tenant_id].recruiters.push(a);
    });
    return map;
  }, [adminAccounts]);

  // Filtered tenants for Company Workspace table
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (activeTab === 'buyers' && t.tenant_type !== 'client') return false;
      if (activeTab === 'vendors' && t.tenant_type !== 'consultancy') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = (t.name || '').toLowerCase().includes(q);
      const tenantAdmins = users.filter((u) => u.tenant_id === t.id);
      const matchAdmin = tenantAdmins.some((a) => (a.email || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q));
      return matchName || matchAdmin;
    });
  }, [tenants, users, activeTab, searchQuery]);

  // Generate dynamic platform activity events based on actual DB records
  const platformActivities = useMemo(() => {
    const list = [];
    tenants.slice(-2).reverse().forEach((t, idx) => {
      const isClient = t.tenant_type === 'client';
      list.push({
        id: `tenant-${t.id}`,
        icon: Plus,
        title: isClient ? 'Buyer company onboarded' : 'Vendor consultancy onboarded',
        desc: `${t.name} • ${isClient ? 'Tenant and admin created' : 'Recruiter access provisioned'}`,
        date: idx === 0 ? 'Today' : 'Yesterday',
        badge: isClient ? 'Completed' : 'Active',
        badgeTone: 'green',
      });
    });

    if (adminAccounts.length > 0) {
      const recentAdmin = adminAccounts[0];
      const adminTenant = tenants.find((t) => t.id === recentAdmin.tenant_id);
      list.push({
        id: `user-${recentAdmin.id}`,
        icon: Edit3,
        title: 'Company admin updated',
        desc: `${adminTenant?.name || recentAdmin.name || 'Account'} • Administrator account active`,
        date: '29 Aug',
        badge: 'Updated',
        badgeTone: 'gray',
      });
    }

    list.push({
      id: 'archive-status',
      icon: Archive,
      title: 'Archive reviewed',
      desc: 'No archived records currently need action',
      date: '28 Aug',
      badge: 'Review',
      badgeTone: 'gray',
    });

    return list.slice(0, 4);
  }, [tenants, adminAccounts]);

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
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {tenants.length} companies
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {adminAccounts.length} admin accounts
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowOnboardVendorModal(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors"
          >
            + Onboard Vendor
          </button>
          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            + Onboard Buyer Company
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading workspace...</p>
      ) : (
        <>
          <div className="glass-panel table-card">
            <div className="table-head" style={{ padding: '18px 24px' }}>
              <div>
                <h2 className="card-title">Companies</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>{tenants.length} total</p>
              </div>
            </div>
            {tenants.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No companies onboarded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Admins</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const group = tenantAdminsMap[t.id] || { admins: [], recruiters: [] };
                    const admins = group.admins;
                    const recruiters = group.recruiters;
                    return (
                      <tr key={t.id}>
                        <td className="td-title">{t.name}</td>
                        <td>
                          <span className={`type-pill ${t.tenant_type === 'client' ? 'type-client' : 'type-consultancy'}`}>
                            {t.tenant_type === 'client' ? 'Client (Buyer)' : 'Consultancy (Vendor)'}
                          </span>
                        </td>
                        <td className="td-company">
                          {admins.length === 0 && recruiters.length === 0 ? '—' : (
                            <>
                              {admins.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <strong style={{ fontSize: '0.75rem', color: '#64748b' }}>Admins:</strong>
                                  {' '}
                                  {admins.map((a) => a.email).join(', ')}
                                </div>
                              )}
                              {recruiters.length > 0 && (
                                <div>
                                  <strong style={{ fontSize: '0.75rem', color: '#64748b' }}>Recruiters:</strong>
                                  {' '}
                                  {recruiters.map((a) => a.email).join(', ')}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="td-action">
                          <div className="row-actions">
                            <span
                              className="row-action row-action-danger"
                              onClick={() => setConfirmDelete(t)}
                              style={{ cursor: 'pointer' }}
                            >
                              Delete
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {tenants.length}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Buyer & vendor tenants
          </div>
        </div>

      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          BUYER COMPANIES
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
          {clientTenants.length}
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Client tenants
        </div>
      </div>

      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          VENDOR CONSULTANCIES
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
          {consultancyTenants.length}
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Sourcing partners
        </div>
      </div>

      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          VENDOR ADMINS
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
          {vendorAdmins.length}
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Recruiter accounts
        </div>
      </div>

      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          COMPANY ADMINS
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
          {companyAdmins.length}
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Buyer administrators
        </div>
      </div>
    </div>

      { error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div> }
  {
    success && (
      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span>{success}</span>
      </div>
    )
  }

  {/* Middle Section: Platform Activity (Left) + Quick Actions (Right) */ }
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
              className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-2xs transition-colors shrink-0"
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
              className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-2xs transition-colors shrink-0"
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

          <div className="p-3 bg-gray-50/70 border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Archive size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900">Archives</div>
                <div className="text-[11px] text-gray-500 truncate">Review deleted records</div>
              </div>
            </div>
            <Link
              to="/dashboard/superadmin/archives"
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-bold shadow-2xs transition-colors shrink-0"
            >
              Review
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Edit Account Modal Popup (Buyer Admin / Vendor Recruiter) */ }
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

  {/* Onboard Vendor Modal Popup */ }
  <OnboardVendorModal
    isOpen={showOnboardVendorModal}
    onClose={() => setShowOnboardVendorModal(false)}
    onSuccess={() => {
      load();
      setSuccess('Vendor onboarded successfully!');
    }}
  />

  {/* Onboard Company Modal Popup */ }
  <OnboardCompanyModal
    isOpen={showOnboardModal}
    onClose={() => setShowOnboardModal(false)}
    onSuccess={() => {
      load();
      setSuccess('Company onboarded successfully!');
    }}
  />
    </div >
  );
}
