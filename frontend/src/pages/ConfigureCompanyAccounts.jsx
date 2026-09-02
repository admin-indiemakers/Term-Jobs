import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  AlertCircle
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
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || defaultTab || 'all';

  const [users, setUsers] = useState([]);
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
        // Only include Admin and Recruiter accounts for Super Admin management
        const filteredUsers = (usersRes || []).filter(
          (u) => u.role === 'Admin' || u.role === 'Recruiter'
        );
        setUsers(filteredUsers);
        setTenants(tenantsRes || []);
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (activeTab === 'buyers' && u.role !== 'Admin') return false;
      if (activeTab === 'vendors' && u.role !== 'Recruiter') return false;

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
      {/* Header Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={13} />
              Dashboard
            </button>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              PLATFORM ACCESS CONTROL
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Account Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Manage administrator credentials, roles, and candidate submission limits across buyer companies and vendor consultancies.
          </p>


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
            + Onboard Company
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* Filter Pills + Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'all'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All Accounts ({users.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('buyers')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'buyers'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Buyer Admins ({buyerAdmins.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('vendors')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'vendors'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Vendor Recruiters ({vendorRecruiters.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, company..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No accounts found matching your criteria.
          </div>
        ) : (
          <div
            className="overflow-x-auto overflow-y-auto pr-1"
            style={{
              maxHeight: '520px',
              minHeight: '360px',
            }}
          >
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-3 px-3">ACCOUNT</th>
                  <th className="py-3 px-3">ROLE</th>
                  <th className="py-3 px-3">COMPANY / TENANT</th>
                  {activeTab !== 'buyers' && <th className="py-3 px-3">LIMIT</th>}
                  <th className="py-3 px-3">JOINED</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => {
                  const isRecruiter = u.role === 'Recruiter';
                  const tenantObj = tenants.find((t) => t.id === u.tenant_id);

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Name & Email with Avatar */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
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
                          {isRecruiter ? 'Vendor Recruiter' : 'Buyer Admin'}
                        </span>
                      </td>

                      {/* Company Name */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-gray-900">{u.tenant_name || '—'}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{u.tenant_type || 'Client'}</div>
                      </td>

                      {/* Candidate Limit */}
                      {activeTab !== 'buyers' && (
                        <td className="py-3.5 px-3">
                          {isRecruiter ? (
                            <span className="font-bold text-gray-900">
                              {u.candidate_limit != null ? `${u.candidate_limit} / req` : '3 / req (default)'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}

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
                            className="font-bold text-gray-900 hover:text-black text-xs transition-colors underline-offset-2 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(u)}
                            className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline"
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
