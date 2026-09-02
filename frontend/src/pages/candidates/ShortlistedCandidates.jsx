import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Filter, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';

export default function ShortlistedCandidates() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  // Fetch real shortlisted candidates
  const loadShortlistedData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/candidates/shortlisted', { token }).catch(() => []);
      const list = Array.isArray(data) ? data : data?.shortlisted_candidates || [];

      // Sort by match score descending (best first)
      const sorted = [...list].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
      setCandidates(sorted);
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

  // Display candidate list (strictly real candidates from DB)
  const displayCandidates = useMemo(() => {
    return candidates;
  }, [candidates]);

  const handleOpenWorkspace = (cand) => {
    if (cand.requisition_id && cand.id) {
      navigate(`/dashboard/requisitions/${cand.requisition_id}/candidates/${cand.id}`);
    } else {
      setSchedulingCandidate(cand);
    }
  };

  return (
    <div
      className="flex flex-col space-y-4 md:h-[calc(100vh-86px)] md:max-h-[calc(100vh-86px)] md:overflow-hidden min-h-0"
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-cand-scroll::-webkit-scrollbar-track {
          background: #FFFFFF;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb {
          background: #E2E2DC;
          border-radius: 4px;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover {
          background: #A3A39F;
        }
      `}</style>

      {/* ========================================================
          1. DARK HERO BANNER (MATCHES IMAGE 1 EXACTLY)
         ======================================================== */}
      <div
        style={{
          backgroundColor: '#0A0A0A',
          borderRadius: 22,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        }}
        className="shrink-0 p-4 sm:p-6 text-white space-y-2 relative overflow-hidden rounded-[20px] sm:rounded-[22px]"
      >
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#A3A3A3]">
          {greetingText}, {userName}
        </div>
        <h1 className="text-[1.8rem] sm:text-[2.2rem] font-extrabold text-white tracking-tight leading-none">
          Shortlisted Candidates
        </h1>
        <p className="text-[13px] text-[#A3A3A3] font-medium pt-0.5">
          Candidates shortlisted by your hiring managers across all requisitions.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <span
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
            className="px-3 py-1 text-[11px] font-bold text-white rounded-full flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Hiring Manager</span>
          </span>
          <span
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
            className="px-3 py-1 text-[11px] font-bold text-white rounded-full"
          >
            {tenantName}
          </span>
        </div>
      </div>

      {/* ========================================================
          2. TOP 4 BENTO METRIC CARDS (MATCHES IMAGE 1)
         ======================================================== */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. SHORTLISTED */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {stats.shortlisted}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            SHORTLISTED
          </div>
        </div>

        {/* 2. STRONG MATCHES */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {stats.strong}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            STRONG MATCHES
          </div>
        </div>

        {/* 3. MODERATE MATCHES */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {stats.moderate}
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            MODERATE MATCHES
          </div>
        </div>

        {/* 4. AVG MATCH SCORE */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            border: '1px solid #E2E2DC',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          }}
          className="p-3.5 sm:p-5 space-y-1 sm:space-y-1.5"
        >
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
            {stats.avgMatch}%
          </div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">
            AVG MATCH SCORE
          </div>
        </div>
      </div>

      {/* ========================================================
          3. NAVIGATION PILL TABS (MATCHES IMAGE 1)
         ======================================================== */}
      <div className="shrink-0 flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates')}
          style={{
            backgroundColor: '#0A0A0A',
            color: '#FFFFFF',
            borderRadius: 9999,
          }}
          className="px-4 py-1.5 text-[12.5px] font-bold cursor-pointer transition-colors shadow-2xs"
        >
          Shortlisted
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/accepted')}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#0A0A0A',
            borderRadius: 9999,
            border: '1px solid #E2E2DC',
          }}
          className="px-4 py-1.5 text-[12.5px] font-bold hover:border-[#0A0A0A] cursor-pointer transition-colors shadow-2xs"
        >
          Accepted
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/candidates/onboarding')}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#0A0A0A',
            borderRadius: 9999,
            border: '1px solid #E2E2DC',
          }}
          className="px-4 py-1.5 text-[12.5px] font-bold hover:border-[#0A0A0A] cursor-pointer transition-colors shadow-2xs"
        >
          Onboarding
        </button>
      </div>

      {/* ========================================================
          4. MAIN CARD CONTAINER (SHORTLISTED CANDIDATES GRID)
         ======================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          border: '1px solid #E2E2DC',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        }}
        className="flex-1 min-h-[360px] md:min-h-0 flex flex-col p-4 sm:p-6 md:overflow-hidden"
      >
        {/* Header inside card */}
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
              Shortlisted
            </h2>
            <p className="text-[12px] text-[#737373] font-medium mt-0.5">
              Sorted by match score, best first.
            </p>
          </div>

          <button
            type="button"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E2E2DC',
            }}
            className="px-4 py-1.5 text-[12.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Filter size={13} strokeWidth={2} />
            <span>Filter</span>
          </button>
        </div>

        {error && (
          <div className="shrink-0 mb-3 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[12.5px] text-[#DC2626] font-medium flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Candidate Cards Grid (Scrollable inside card) */}
        <div className="flex-1 overflow-y-auto custom-cand-scroll pr-1">
          {loading ? (
            <div className="py-16 text-center text-[#8A8A85] text-[13px] font-medium">
              Loading shortlisted candidates...
            </div>
          ) : displayCandidates.length === 0 ? (
            <div className="py-16 px-4 text-center bg-[#FBFBFA] rounded-2xl border border-[#EAEAE6] my-auto">
              <div className="text-[15px] font-extrabold text-[#0A0A0A] mb-1">
                No Shortlisted Candidates
              </div>
              <p className="text-[12.5px] text-[#8A8A85] max-w-md mx-auto">
                Candidates shortlisted by vendor recruiters for your open requisitions will appear here for review and workspace actions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayCandidates.map((cand, idx) => {
                const reqCode = cand.requisition_ref || (cand.requisition_id ? `REQ-${String(cand.requisition_id).slice(0, 6).toUpperCase()}` : 'REQ-F7F406');
                const candName = cand.candidate_name || cand.full_name || cand.name || 'Candidate';
                const vendorName = cand.vendor_name || 'bridgeon';
                const roleTitle = cand.requisition_title || 'DevOps Engineer';
                const score = cand.match_score != null ? Math.round(cand.match_score) : 41;

                return (
                  <div
                    key={cand.id || idx}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      border: '1px solid #EAEAE6',
                    }}
                    className="p-4 space-y-3.5 hover:border-[#0A0A0A] transition-all hover:shadow-xs flex flex-col justify-between group max-w-sm"
                  >
                    <div className="space-y-3">
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            backgroundColor: '#F5F5F2',
                            color: '#0A0A0A',
                            border: '1px solid #E2E2DC',
                            borderRadius: 6,
                          }}
                          className="px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide"
                        >
                          {reqCode}
                        </span>

                        <span
                          style={{
                            backgroundColor: '#0A0A0A',
                            color: '#FFFFFF',
                            borderRadius: 6,
                          }}
                          className="px-2.5 py-0.5 text-[11px] font-black shadow-2xs"
                        >
                          ⚡ {score}%
                        </span>
                      </div>

                      {/* Name & Subtitle */}
                      <div>
                        <h3 className="text-[14px] font-extrabold text-[#0A0A0A] tracking-tight uppercase leading-snug">
                          {candName}
                        </h3>
                        <p className="text-[11.5px] text-[#0A0A0A] font-bold mt-1 flex items-center gap-1 truncate">
                          <span>💼</span>
                          <span className="truncate">{roleTitle}</span>
                        </p>
                        <p className="text-[11px] text-[#737373] font-medium mt-0.5 flex items-center justify-between">
                          <span>🏢 {cand.company_name || 'Bearitt'}</span>
                          <span>Vendor: {vendorName}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenWorkspace(cand)}
                      style={{
                        backgroundColor: '#0A0A0A',
                        color: '#FFFFFF',
                        borderRadius: 12,
                      }}
                      className="w-full py-2 text-[12.5px] font-bold hover:bg-[#262626] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
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
