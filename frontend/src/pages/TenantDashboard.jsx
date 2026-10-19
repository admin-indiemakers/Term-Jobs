import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { Building2, Users, Briefcase, Shield, ArrowLeft, LogOut, RefreshCw } from 'lucide-react';

export default function TenantDashboard() {
  const { tenantId } = useParams();
  const { token, logout } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/tenants', { token }),
      request('/api/auth/users', { token }),
      request('/api/requisitions', { token }),
    ]).then(([tenants, accounts, reqs]) => {
      setTenant((tenants || []).find((item) => item.id === tenantId) || null);
      setUsers((accounts || []).filter((item) => item.tenant_id === tenantId));
      setRequisitions((reqs || []).filter((item) => item.tenant_id === tenantId));
      setError('');
    }).catch((err) => {
      setError(err.message || 'Unable to load company details.');
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [tenantId, token]);

  const roleCounts = useMemo(() => {
    const counts = new Map();
    users.filter((user) => user.is_active !== false).forEach((user) => {
      const role = user.role || 'Other';
      counts.set(role, (counts.get(role) || 0) + 1);
    });
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-gray-900 px-2 sm:px-4">
      {/* Top Header: Unboxed, Transparent, Clean Big Typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <Link
            to="/dashboard/superadmin/accounts?tab=buyers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black mb-1 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Buyer Accounts</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            {tenant?.name || 'Company Dashboard'}
            {tenant && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                Buyer Organization
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-0.5">
            {users.length} associated accounts · {requisitions.length} requisitions configured
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <NotificationBell />

          <button
            type="button"
            onClick={loadData}
            className="p-2 sm:p-2.5 rounded-xl border border-white/70 bg-white/40 backdrop-blur-md hover:bg-white/70 text-gray-700 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={logout}
            className="p-2 sm:p-2.5 rounded-xl border border-red-200/80 bg-red-50/80 hover:bg-red-100 text-red-600 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl text-gray-500 font-medium">
          Loading company dashboard…
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl bg-red-50/80 border border-red-200 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : !tenant || tenant.tenant_type !== 'client' ? (
        <div role="alert" className="p-8 text-center bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl text-gray-600 font-medium">
          Buyer company not found.
        </div>
      ) : (
        <>
          {/* 4 KPI Role Metrics Cards */}
          <section aria-label="Users by role" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {['Finance', 'Director', 'Admin', 'Hiring Manager'].map((role) => {
              const aliases =
                role === 'Finance'
                  ? ['finance', 'finance team']
                  : role === 'Hiring Manager'
                  ? ['hiring manager', 'hr']
                  : [role.toLowerCase()];
              const count = users.filter(
                (user) => user.is_active !== false && aliases.includes((user.role || '').toLowerCase())
              ).length;
              return (
                <div
                  key={role}
                  className="rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl p-4.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{role}</p>
                    <div className="w-7 h-7 rounded-lg bg-gray-100/80 border border-gray-200/60 flex items-center justify-center text-gray-600">
                      <Users size={13} />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">{count}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Active assigned users</p>
                </div>
              );
            })}
          </section>

          {/* Active Roles Summary */}
          <section className="rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">Active Roles Distribution</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {roleCounts.length ? (
                roleCounts.map(([role, count]) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {role}: <strong className="text-gray-900">{count}</strong>
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">No active users</span>
              )}
            </div>
          </section>

          {/* Associated Users */}
          <section className="rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Associated Users ({users.length})</h2>
            </div>
            <div className="divide-y divide-gray-200/50">
              {users.length ? (
                users.map((user) => (
                  <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-linear-to-tr from-gray-700 to-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">{user.name || user.email}</span>
                        <span className="ml-2 text-xs font-medium text-gray-500 px-2 py-0.5 rounded-md bg-white/60 border border-gray-200/60">
                          {user.role}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{user.email}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-3">No users found for this company.</p>
              )}
            </div>
          </section>

          {/* Requisitions */}
          <section className="rounded-2xl border border-white/70 bg-white/40 backdrop-blur-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Company Requisitions ({requisitions.length})</h2>
            </div>
            <div className="divide-y divide-gray-200/50">
              {requisitions.length ? (
                requisitions.map((req) => (
                  <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-gray-400" />
                      <span className="font-semibold text-gray-900">{req.title}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {req.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-3">No requisitions found.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
