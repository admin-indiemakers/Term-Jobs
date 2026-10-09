import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TenantDashboard() {
  const { tenantId } = useParams();
  const { token } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      request('/api/auth/tenants', { token }),
      request('/api/auth/users', { token }),
      request('/api/requisitions', { token }),
    ]).then(([tenants, accounts, reqs]) => {
      if (cancelled) return;
      setTenant((tenants || []).find((item) => item.id === tenantId) || null);
      setUsers((accounts || []).filter((item) => item.tenant_id === tenantId));
      setRequisitions((reqs || []).filter((item) => item.tenant_id === tenantId));
      setError('');
    }).catch((err) => { if (!cancelled) setError(err.message || 'Unable to load company details.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, token]);

  const roleCounts = useMemo(() => {
    const counts = new Map();
    users.filter((user) => user.is_active !== false).forEach((user) => {
      const role = user.role || 'Other';
      counts.set(role, (counts.get(role) || 0) + 1);
    });
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-7 text-gray-900">
    <Link to="/dashboard/superadmin/accounts?tab=buyers" className="text-xs font-semibold text-gray-600 hover:underline">← Buyer Accounts</Link>
    {loading ? <p role="status">Loading company dashboard…</p>
      : error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      : !tenant || tenant.tenant_type !== 'client' ? <p role="alert">Buyer company not found.</p>
      : <>
        <header className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-bold uppercase text-gray-500">Buyer Company Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold">{tenant.name}</h1>
          <p className="mt-2 text-sm text-gray-600">{users.length} associated users · {requisitions.length} requisitions</p>
        </header>
        <section aria-label="Users by role" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['Finance', 'Director', 'Admin', 'Hiring Manager'].map((role) => {
            const aliases = role === 'Finance' ? ['finance', 'finance team'] : role === 'Hiring Manager' ? ['hiring manager', 'hr'] : [role.toLowerCase()];
            const count = users.filter((user) => user.is_active !== false && aliases.includes((user.role || '').toLowerCase())).length;
            return <div key={role} className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold text-gray-500">{role}</p><p className="mt-2 text-3xl font-bold">{count}</p>
            </div>;
          })}
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold">All active roles</h2>
          <div className="mt-3 flex flex-wrap gap-2">{roleCounts.length ? roleCounts.map(([role, count]) =>
            <span key={role} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{role}: {count}</span>
          ) : <span className="text-sm text-gray-500">No active users</span>}</div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold">Associated users</h2>
          <div className="mt-3 divide-y divide-gray-100">{users.length ? users.map((user) =>
            <div key={user.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span>{user.name || user.email} <span className="text-gray-500">({user.role})</span></span>
              <span className="text-gray-500">{user.email}</span>
            </div>
          ) : <p className="text-sm text-gray-500">No users found for this company.</p>}</div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold">Requisitions ({requisitions.length})</h2>
          <div className="mt-3 divide-y divide-gray-100">{requisitions.length ? requisitions.map((req) =>
            <div key={req.id} className="flex justify-between gap-2 py-2 text-sm"><span>{req.title}</span><span className="text-gray-500">{req.status}</span></div>
          ) : <p className="text-sm text-gray-500">No requisitions found.</p>}</div>
        </section>
      </>}
  </div>;
}
