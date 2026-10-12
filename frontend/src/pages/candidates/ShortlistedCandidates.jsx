import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Filter, AlertCircle, Sparkles, ArrowRight, Trash2, RefreshCw, Search, Briefcase, Building2 } from 'lucide-react';
import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';

export default function ShortlistedCandidates() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [schedulingCandidate, setSchedulingCandidate] = useState(null);

  // Time-aware greeting
  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const tenantName = user?.tenant_name || 'Bearitt';
  const userName = user?.name || 'HR';

  // Fetch real shortlisted candidates and accepted count
  const loadShortlistedData = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, acceptedData] = await Promise.all([
        request('/candidates/shortlisted', { token }).catch(() => []),
        request('/candidates?status=Accepted', { token }).catch(() => []),
      ]);
      const list = Array.isArray(data) ? data : data?.shortlisted_candidates || [];
      const acceptedList = Array.isArray(acceptedData) ? acceptedData : acceptedData?.candidates || [];
      setAcceptedCount(acceptedList.length);

      // Sort by match score descending (best first)
      const sorted = [...list].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

      // Client-side safety deduplication
      const seenIds = new Set();
      const seenKeys = new Set();
      const deduped = [];
      for (const cand of sorted) {
        const idKey = cand.id || cand.submission_id;
        const nameKey = (cand.candidate_email || cand.candidate_name || cand.full_name || cand.name || '').toLowerCase().trim();
        const reqKey = String(cand.requisition_id || '');
        const compKey = nameKey ? `${nameKey}::${reqKey}` : null;

        if (idKey && seenIds.has(idKey)) continue;
        if (compKey && seenKeys.has(compKey)) continue;

        if (idKey) seenIds.add(idKey);
        if (compKey) seenKeys.add(compKey);
        deduped.push(cand);
      }

      setCandidates(deduped);
    } catch (err) {
      console.error('Failed to load shortlisted candidates:', err);
      setError(err.message || 'Unable to load shortlisted candidates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShortlistedData();
  }, [token]);

  const handleDeleteCandidate = async (e, cand) => {
    e.stopPropagation();
    const candName = cand.candidate_name || cand.full_name || cand.name || 'this candidate';
    if (!window.confirm(`Are you sure you want to remove ${candName}?`)) {
      return;
    }
    const candId = cand.id || cand.submission_id;
    // Optimistically update list
    setCandidates((prev) => prev.filter((c) => (c.id || c.submission_id) !== candId));

    try {
      await request(`/candidates/${encodeURIComponent(candId)}`, {
        method: 'DELETE',
        token,
      }).catch(async () => {
        await request(`/candidates/submissions/${encodeURIComponent(candId)}`, {
          method: 'DELETE',
          token,
        });
      });
    } catch (err) {
      console.error('Failed to delete candidate:', err);
    }
  };

  // Derived real KPI metrics
  const stats = useMemo(() => {
    const count = candidates.length;
    const strong = candidates.filter((c) => (c.match_score || 0) >= 70).length;
    const moderate = candidates.filter((c) => (c.match_score || 0) >= 50 && (c.match_score || 0) < 70).length;

    let avg = 0;
    if (count > 0) {
      const sum = candidates.reduce((acc, c) => acc + (c.match_score || 0), 0);
      avg = Math.round(sum / count);
    }

    return {
      shortlisted: count,
      strong,
      moderate,
      avgMatch: avg,
    };
  }, [candidates]);

  // Display candidate list with search filtering
  const displayCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase().trim();
    return candidates.filter((c) => {
      const name = (c.candidate_name || c.full_name || c.name || '').toLowerCase();
      const role = (c.requisition_title || '').toLowerCase();
      const vendor = (c.vendor_name || '').toLowerCase();
      const ref = (c.requisition_ref || '').toLowerCase();
      return name.includes(q) || role.includes(q) || vendor.includes(q) || ref.includes(q);
    });
  }, [candidates, searchQuery]);

  const handleOpenWorkspace = (cand) => {
    if (cand.requisition_id && cand.id) {
      navigate(`/dashboard/requisitions/${cand.requisition_id}/candidates/${cand.id}`);
    } else {
      setSchedulingCandidate(cand);
    }
  };

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-cand-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
      `}</style>

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • CANDIDATE POOL
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Shortlisted Candidates
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Candidates curated by recruiters across open requisitions for interview scheduling.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadShortlistedData}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP 4 GLASSMORHPIC METRIC CARDS ── */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* SHORTLISTED */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">SHORTLISTED</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{stats.shortlisted}</div>
        </div>

        {/* STRONG MATCHES */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">STRONG MATCHES (≥70%)</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{stats.strong}</div>
        </div>

        {/* MODERATE MATCHES */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">MODERATE MATCHES</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{stats.moderate}</div>
        </div>

        {/* AVG MATCH SCORE */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">AVG MATCH SCORE</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{stats.avgMatch}%</div>
        </div>
      </div>

      {/* ── 3. NAVIGATION PILL TABS ── */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates')}
          className="px-4 py-1.5 rounded-full text-xs font-bold bg-black text-white shadow-xs transition-all cursor-pointer"
        >
          Shortlisted
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/accepted')}
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 backdrop-blur-md shadow-3xs transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Accepted</span>
          {acceptedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {acceptedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/onboarding')}
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 backdrop-blur-md shadow-3xs transition-all cursor-pointer"
        >
          Onboarding
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/interviews')}
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 backdrop-blur-md shadow-3xs transition-all cursor-pointer"
        >
          Interviews
        </button>
      </div>

      {/* ── 4. MAIN GLASSMORHPIC CANDIDATES CONTAINER ── */}
      <div className="flex-1 min-h-[360px] md:min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
        {/* Top Controls: Search + Count */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/[0.04]">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, role, or vendor..."
              className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{displayCandidates.length}</span> candidates
          </div>
        </div>

        {error && (
          <div className="shrink-0 my-2.5 p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 flex items-center gap-2 shadow-2xs">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Candidate Cards Grid (Scrollable inside container) */}
        <div className="flex-1 overflow-y-auto custom-cand-scroll pr-1 pt-3">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-xs font-medium flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin text-gray-400" />
              <span>Loading shortlisted candidates...</span>
            </div>
          ) : displayCandidates.length === 0 ? (
            <div className="py-16 px-4 text-center bg-white/50 backdrop-blur-md rounded-2xl border border-white/80 max-w-lg mx-auto my-auto">
              <div className="text-sm font-extrabold text-gray-900 mb-1">
                No Shortlisted Candidates Found
              </div>
              <p className="text-xs text-gray-500">
                {searchQuery
                  ? 'No candidates match your current search query.'
                  : 'Candidates shortlisted by vendor recruiters for your open requisitions will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pb-2">
              {displayCandidates.map((cand, idx) => {
                const reqCode = cand.requisition_ref || (cand.requisition_id ? `REQ-${String(cand.requisition_id).slice(0, 6).toUpperCase()}` : 'REQ-F7F406');
                const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
                const vendorName = cand.vendor_name || 'Vendor';
                const roleTitle = cand.requisition_title || 'Contract Role';
                const score = cand.match_score != null ? Math.round(cand.match_score) : 0;

                return (
                  <div
                    key={cand.id || idx}
                    className="bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-black/30 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gray-100/90 text-gray-700 border border-gray-200/60 rounded-md">
                          {reqCode}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 text-[10.5px] font-extrabold rounded-md shadow-3xs flex items-center gap-1 ${
                            score >= 70
                              ? 'bg-emerald-500 text-white'
                              : score >= 50
                              ? 'bg-amber-500 text-white'
                              : 'bg-black text-white'
                          }`}>
                            ⚡ {score}%
                          </span>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteCandidate(e, cand)}
                            title="Delete candidate"
                            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Name & Subtitle */}
                      <div>
                        <h3 className="text-[13.5px] font-extrabold text-gray-900 tracking-tight uppercase leading-snug group-hover:text-black truncate">
                          {candName}
                        </h3>
                        <p className="text-xs text-gray-700 font-semibold mt-1 flex items-center gap-1 truncate">
                          <Briefcase size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate">{roleTitle}</span>
                        </p>
                        <p className="text-[11px] text-gray-500 font-medium mt-1 flex items-center justify-between">
                          <span className="truncate">🏢 {cand.company_name || tenantName}</span>
                          <span className="text-gray-400 truncate">via {vendorName}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenWorkspace(cand)}
                      className="w-full mt-3 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Interview Modal */}
      {schedulingCandidate && (
        <ScheduleInterviewModal
          candidate={schedulingCandidate}
          onClose={() => setSchedulingCandidate(null)}
          onScheduled={() => {
            setSchedulingCandidate(null);
            loadShortlistedData();
          }}
        />
      )}
    </div>
  );
}
