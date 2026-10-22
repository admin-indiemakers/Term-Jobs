import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Flag, CheckCircle2, AlertCircle, Loader2, RefreshCw, Search, Eye, X } from 'lucide-react';

export default function ReportedIssues() {
  const { user, token } = useAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingIssue, setViewingIssue] = useState(null);

  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const userName = user?.name || 'HR';
  const tenantName = user?.tenant_name || 'Bearitt';

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await request('/api/onboarding/issues', { token }).catch(() => []);
      const list = Array.isArray(data) ? data : data?.issues || [];
      const sorted = [...list].sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return 0;
      });
      setIssues(sorted);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [token]);

  const handleResolveIssue = async (issueId) => {
    setResolvingId(issueId);
    try {
      await request(`/api/onboarding/issues/${issueId}/resolve`, {
        method: 'POST',
        token,
      });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status: 'fixed', resolved_at: new Date().toISOString() } : i)));
    } catch (err) {
      // ignore
    } finally {
      setResolvingId('');
    }
  };

  const openCount = useMemo(() => issues.filter((i) => i.status === 'open').length, [issues]);
  const resolvedCount = useMemo(() => issues.filter((i) => i.status !== 'open').length, [issues]);

  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues;
    const q = searchQuery.toLowerCase().trim();
    return issues.filter((i) => {
      const cat = (i.category_label || i.category || '').toLowerCase();
      const cand = (i.candidate_name || i.candidate_id || '').toLowerCase();
      const desc = (i.description || '').toLowerCase();
      return cat.includes(q) || cand.includes(q) || desc.includes(q);
    });
  }, [issues, searchQuery]);

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
            TERM JOBS • ONBOARDING SUPPORT
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Candidate Reported Issues
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Review and resolve access or onboarding blockers submitted by candidates in their portal.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadIssues}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP 3 GLASSMORHPIC METRIC CARDS ── */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">TOTAL REPORTED</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{issues.length}</div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ACTION REQUIRED (OPEN)</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-red-600 tracking-tight mt-1">{openCount}</div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">RESOLVED ISSUES</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{resolvedCount}</div>
        </div>
      </div>

      {/* ── 3. MAIN GLASSMORHPIC ISSUES CONTAINER ── */}
      <div className="flex-1 min-h-[360px] md:min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
        {/* Top Controls: Search Bar + Count */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/[0.04]">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search category, candidate, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{filteredIssues.length}</span> issues
          </div>
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-y-auto custom-cand-scroll pr-1 pt-2">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-xs font-medium flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin text-gray-400" />
              <span>Loading issues...</span>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="py-16 px-4 text-center bg-white/50 backdrop-blur-md rounded-2xl border border-white/80 max-w-md mx-auto my-auto">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <div className="text-sm font-extrabold text-gray-900 mb-1">
                {searchQuery ? 'No Matching Issues' : 'All Issues Resolved!'}
              </div>
              <p className="text-xs text-gray-500">
                {searchQuery
                  ? 'No issues match your current search query.'
                  : 'There are currently no outstanding issues reported by onboarding hires.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    issue.status === 'open'
                      ? 'bg-white/80 border-red-200/80 shadow-[0_4px_16px_rgba(239,68,68,0.06)]'
                      : 'bg-white/50 border-white/80 shadow-3xs opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-[13px] font-extrabold text-gray-900">
                          {issue.category_label || issue.category || 'Issue'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            issue.status === 'open'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {issue.status === 'open' ? 'Open' : 'Resolved'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        <strong className="text-gray-800">{issue.candidate_name || issue.candidate_id || 'Candidate'}</strong>
                        {issue.vendor_name && <span> · via {issue.vendor_name}</span>}
                      </div>
                    </div>

                    {issue.status === 'open' && (
                      <button
                        type="button"
                        disabled={resolvingId === issue.id}
                        onClick={() => handleResolveIssue(issue.id)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-black hover:bg-gray-900 text-white rounded-xl transition shadow-xs cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {resolvingId === issue.id ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" />
                            <span>Resolving...</span>
                          </>
                        ) : (
                          <span>Mark Resolved</span>
                        )}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-700 bg-white/70 p-3 rounded-xl border border-white/90 leading-relaxed mt-2.5 line-clamp-2">
                    {issue.description || 'Candidate reported an issue.'}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-black/[0.04]">
                    <button
                      type="button"
                      onClick={() => setViewingIssue(issue)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-700 text-xs font-bold transition shadow-3xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye size={12} />
                      <span>View Full Report</span>
                    </button>
                    {issue.status === 'open' && (
                      <button
                        type="button"
                        disabled={resolvingId === issue.id}
                        onClick={() => handleResolveIssue(issue.id)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-black hover:bg-gray-900 text-white rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {resolvingId === issue.id ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" />
                            <span>Resolving...</span>
                          </>
                        ) : (
                          <span>Mark Resolved</span>
                        )}
                      </button>
                    )}
                  </div>

                  {issue.resolved_at && (
                    <div className="text-[10.5px] text-emerald-700 font-medium mt-2 flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span>Resolved on {new Date(issue.resolved_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FULL ISSUE REPORT DETAILS MODAL ── */}
      {viewingIssue && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingIssue(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  viewingIssue.status === 'open' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {viewingIssue.status === 'open' ? 'Open Issue' : 'Resolved'}
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-1">
                  {viewingIssue.category_label || viewingIssue.category || 'Issue Report'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Reported by <strong className="text-gray-800">{viewingIssue.candidate_name || viewingIssue.candidate_id || 'Candidate'}</strong>
                  {viewingIssue.vendor_name && ` via ${viewingIssue.vendor_name}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingIssue(null)}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black flex items-center justify-center transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Full Report Details */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Complete Issue Description</div>
              <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-200/70 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                {viewingIssue.description || 'No detailed description provided.'}
              </div>
            </div>

            {/* Timestamps */}
            {viewingIssue.created_at && (
              <div className="text-[11px] text-gray-400 font-medium">
                Reported on {new Date(viewingIssue.created_at).toLocaleString()}
              </div>
            )}
            {viewingIssue.resolved_at && (
              <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Resolved on {new Date(viewingIssue.resolved_at).toLocaleString()}</span>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setViewingIssue(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              {viewingIssue.status === 'open' && (
                <button
                  type="button"
                  disabled={resolvingId === viewingIssue.id}
                  onClick={async () => {
                    await handleResolveIssue(viewingIssue.id);
                    setViewingIssue((prev) => (prev ? { ...prev, status: 'fixed', resolved_at: new Date().toISOString() } : null));
                  }}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {resolvingId === viewingIssue.id ? 'Resolving...' : 'Mark Resolved'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
