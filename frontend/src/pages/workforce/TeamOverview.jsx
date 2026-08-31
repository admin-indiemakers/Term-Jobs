import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Users, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import CandidateDetailPanel from './CandidateDetailPanel';

export default function TeamOverview() {
  const { token } = useAuth();

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const loadTeam = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/workforce/team', { token });
      setTeam(data?.team || []);
    } catch (err) {
      console.error('Failed to load team:', err);
      setError(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeam(); }, [token]);

  const filtered = team.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.candidate_name?.toLowerCase().includes(q) ||
      m.candidate_id?.toLowerCase().includes(q) ||
      m.requisition_title?.toLowerCase().includes(q) ||
      m.vendor_name?.toLowerCase().includes(q)
    );
  });

  const activeCount = team.filter((m) => m.status === 'ACTIVE').length;
  const onboardingCount = team.filter((m) => m.status === 'ONBOARDING').length;

  const statusColor = (s) => {
    if (s === 'ACTIVE') return { bg: '#dcfce7', text: '#166534' };
    if (s === 'ONBOARDING') return { bg: '#fef3c7', text: '#92400e' };
    return { bg: '#e5e7eb', text: '#374151' };
  };

  const tsStatusColor = (s) => {
    if (s === 'APPROVED') return { bg: '#dcfce7', text: '#166534' };
    if (s === 'SUBMITTED') return { bg: '#fef3c7', text: '#92400e' };
    if (s === 'REJECTED') return { bg: '#fee2e2', text: '#991b1b' };
    return { bg: '#f3f4f6', text: '#6b7280' };
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Hero */}
      <div className="bg-[#1a1a1a] text-white px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#a0a09a] mb-1">
              <span>WORKFORCE</span>
              <span>›</span>
              <span className="text-white">Team Overview</span>
            </div>
            <h1 className="text-[1.35rem] font-bold tracking-tight">Team Overview</h1>
            <p className="text-[0.82rem] text-[#a0a09a] mt-0.5">
              All active employees and their current status
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadTeam} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-[0.82rem] font-medium hover:bg-white/15 transition">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                <Users size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Total Team</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{team.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#16a34a] flex items-center justify-center">
                <CheckCircle size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Active</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{activeCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center">
                <Clock size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Onboarding</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{onboardingCount}</div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-[#eaeae6] mb-6">
          <div className="p-4 border-b border-[#eaeae6]">
            <input
              type="text"
              placeholder="Search by name, ID, role, or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[0.68rem] tracking-[0.14em] text-[#8a8a85] uppercase font-semibold">
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Vendor</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Onboarding</th>
                  <th className="px-5 py-3 font-semibold">Timesheet</th>
                  <th className="px-5 py-3 font-semibold">Start Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-[0.88rem] text-[#8a8a85]">
                      Loading team data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <AlertCircle size={28} className="mx-auto mb-2 text-[#dc2626]" />
                      <div className="text-[0.92rem] text-[#dc2626] font-medium">{error}</div>
                      <button onClick={loadTeam} className="mt-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-[0.82rem] rounded-lg">Retry</button>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <AlertCircle size={28} className="mx-auto mb-2 text-[#d1d5cc]" />
                      <div className="text-[0.92rem] text-[#8a8a85] font-medium">No team members found</div>
                      <div className="text-[0.78rem] text-[#b0b0aa] mt-1">Accepted candidates with active work orders will appear here</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr
                      key={m.candidate_id}
                      className="border-t border-[#f0f0ec] hover:bg-[#fafaf8] transition cursor-pointer"
                      onClick={() => setSelectedCandidate(m.candidate_id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="text-[0.88rem] font-semibold text-[#1a1a1a]">{m.candidate_name || '—'}</div>
                        <div className="text-[0.72rem] text-[#8a8a85] font-mono">{m.candidate_id}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[0.85rem] text-[#4a4a45]">{m.requisition_title || '—'}</td>
                      <td className="px-5 py-3.5 text-[0.85rem] text-[#4a4a45]">{m.vendor_name || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-semibold"
                          style={{ backgroundColor: statusColor(m.status).bg, color: statusColor(m.status).text }}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {m.status === 'ONBOARDING' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#f59e0b] rounded-full transition-all"
                                style={{ width: `${m.onboarding_pct}%` }}
                              />
                            </div>
                            <span className="text-[0.72rem] text-[#8a8a85]">{m.onboarding_pct}%</span>
                          </div>
                        ) : (
                          <span className="text-[0.78rem] text-[#16a34a] font-medium">Complete</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {m.latest_timesheet_status ? (
                          <span
                            className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-semibold"
                            style={{ backgroundColor: tsStatusColor(m.latest_timesheet_status).bg, color: tsStatusColor(m.latest_timesheet_status).text }}
                          >
                            {m.latest_timesheet_status}
                          </span>
                        ) : (
                          <span className="text-[0.78rem] text-[#b0b0aa]">No timesheet</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[0.85rem] text-[#4a4a45]">
                        {m.start_date || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Candidate Detail Panel */}
      {selectedCandidate && (
        <CandidateDetailPanel
          candidateId={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
