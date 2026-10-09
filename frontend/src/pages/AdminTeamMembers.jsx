import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminTeamMembers() {
  const { user, token } = useAuth();
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    request('/api/auth/users', { token })
      .then((rows) => {
        if (!cancelled) {
          setMembers((Array.isArray(rows) ? rows : []).filter((row) =>
            row.role !== 'Candidate' && row.tenant_id === user?.tenant_id
          ));
          setError('');
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Unable to load team members.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, user?.tenant_id]);

  const filtered = useMemo(() => members.filter((member) => {
    const term = search.toLowerCase().trim();
    return !term || [member.name, member.email, member.role, member.department]
      .some((value) => String(value || '').toLowerCase().includes(term));
  }), [members, search]);

  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-7 text-gray-900">
    <Link to="/dashboard/admin" className="text-xs font-semibold text-gray-600 hover:underline">← Admin Dashboard</Link>
    <header className="rounded-2xl border border-gray-200 bg-white p-5">
      <h1 className="text-2xl font-bold">Team Members</h1>
      <p className="mt-1 text-sm text-gray-600">{user?.tenant_name || 'Company'} · {members.length} members across all staff roles</p>
    </header>
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <label htmlFor="team-search" className="block text-xs font-semibold text-gray-600">Search team members</label>
      <input id="team-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
        placeholder="Name, email, role, or department"
        className="mt-2 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      {loading ? <p role="status" className="py-6 text-sm text-gray-500">Loading team members…</p>
        : error ? <p role="alert" className="py-6 text-sm text-red-700">{error}</p>
        : filtered.length === 0 ? <p className="py-6 text-sm text-gray-500">No team members found.</p>
        : <div className="mt-4 divide-y divide-gray-100">
            {filtered.map((member) => <div key={member.id} className="grid gap-2 py-3 text-sm sm:grid-cols-4">
              <div className="font-semibold">{member.name || 'Unnamed member'}</div>
              <div className="break-all text-gray-600">{member.email}</div>
              <div className="text-gray-600">{member.role}</div>
              <div className="text-gray-600">{member.department || '—'}</div>
            </div>)}
          </div>}
    </section>
  </div>;
}
