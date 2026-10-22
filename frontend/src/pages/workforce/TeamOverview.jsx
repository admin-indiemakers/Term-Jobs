import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Users, RefreshCw, Clock, CheckCircle, AlertCircle, Search } from 'lucide-react';
import CandidateDetailPanel from './CandidateDetailPanel';

let teamOverviewMemoryCache = null;

export default function TeamOverview() {
  const { token } = useAuth();

  const [team, setTeam] = useState(() => teamOverviewMemoryCache?.team || []);
  const [loading, setLoading] = useState(() => !teamOverviewMemoryCache);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const loadTeam = async (force = false) => {
    if (!teamOverviewMemoryCache || force) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await request('/api/workforce/dashboard', { token, forceRefresh: force });
      const list = data?.team || [];
      setTeam(list);
      teamOverviewMemoryCache = { team: list, token };
    } catch (err) {
      console.error('Failed to load team:', err);
      if (!teamOverviewMemoryCache) {
        setError(err.message || 'Failed to load team data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam(false);

    const handleRefresh = () => {
      loadTeam(true);
    };

    window.addEventListener('refresh-hm-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-hm-data', handleRefresh);
    };
  }, [token]);

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

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1 font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-cand-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-cand-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 4px; }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
      `}</style>

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • WORKFORCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Team Overview
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            All active contract employees, onboarding status, and recent timesheet records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadTeam}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP 3 GLASSMORHPIC METRIC CARDS ── */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">TOTAL TEAM</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{team.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ACTIVE WORKERS</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-xs">
            <CheckCircle size={18} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">IN ONBOARDING</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{onboardingCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* ── 3. MAIN GLASSMORHPIC TABLE CONTAINER ── */}
      <div className="flex-1 min-h-[360px] md:min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
        {/* Top Controls: Search Bar + Count */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/[0.04]">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, role, or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{filtered.length}</span> members
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto custom-cand-scroll pt-2">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-black/[0.04] text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">
                <th className="py-3 pl-3 pr-3">Candidate</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Vendor</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Onboarding</th>
                <th className="py-3 px-3">Timesheet</th>
                <th className="py-3 pr-3 pl-3">Start Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 pl-3 pr-3"><div className="h-4 w-28 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-32 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-20 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-5 w-16 bg-gray-200/80 rounded-full" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-16 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-5 w-20 bg-gray-200/80 rounded-full" /></td>
                      <td className="py-3 pr-3 pl-3"><div className="h-4 w-20 bg-gray-200/80 rounded" /></td>
                    </tr>
                  ))}
                </>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <AlertCircle size={28} className="mx-auto mb-2 text-red-500" />
                    <div className="text-xs text-red-600 font-medium">{error}</div>
                    <button onClick={loadTeam} className="mt-2.5 px-3.5 py-1.5 bg-black text-white text-xs font-bold rounded-xl cursor-pointer">Retry</button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400 text-xs">
                    <AlertCircle size={24} className="mx-auto mb-2 text-gray-300" />
                    <div className="font-medium text-gray-700">No team members found</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Accepted candidates with active work orders will appear here</div>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.candidate_id}
                    className="hover:bg-white/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedCandidate(m.candidate_id)}
                  >
                    <td className="py-3 pl-3 pr-3">
                      <div className="text-xs sm:text-[13px] font-extrabold text-gray-900">{m.candidate_name || '—'}</div>
                      <div className="text-[10.5px] text-gray-400 font-mono font-medium">{m.candidate_id}</div>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-700 font-medium">{m.requisition_title || '—'}</td>
                    <td className="py-3 px-3 text-xs text-gray-500">{m.vendor_name || '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        m.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : m.status === 'ONBOARDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {m.status === 'ONBOARDING' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${m.onboarding_pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 font-bold">{m.onboarding_pct}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold">Complete ✓</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {m.latest_timesheet_status ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          m.latest_timesheet_status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : m.latest_timesheet_status === 'SUBMITTED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : m.latest_timesheet_status === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {m.latest_timesheet_status}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">No timesheet</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 pl-3 text-xs text-gray-500 font-medium">
                      {m.start_date || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
