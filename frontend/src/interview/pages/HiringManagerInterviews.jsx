import { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Plus,
  AlertCircle,
  Search,
  Award,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  Activity,
  Zap,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { interviewApi } from '../services/interviewApi';
import { RoundTimeline } from '../components/RoundTimeline';
import { CreateRoundModal } from '../components/CreateRoundModal';
import { InviteActionsModal } from '../components/InviteActionsModal';
import { EvaluationForm } from '../components/EvaluationForm';
import { CandidateRecordingPlayer } from '../components/CandidateRecordingPlayer';
import { EVALUATION_VERDICTS } from '../utils/interviewConstants';

export function HiringManagerInterviews() {
  const { token, user } = useAuth();

  const [candidatesSummary, setCandidatesSummary] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedRoundForDetails, setSelectedRoundForDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'ready_for_next' | 'in_progress' | 'completed'

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialData, setCreateModalInitialData] = useState({});
  const [activeInviteModalRound, setActiveInviteModalRound] = useState(null);
  const [activeEvaluationRound, setActiveEvaluationRound] = useState(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [roundCommAnalysis, setRoundCommAnalysis] = useState(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [loadingCommAnalysis, setLoadingCommAnalysis] = useState(false);

  // Shortlist dispatch & 48h countdown state
  const [shortlistStatus, setShortlistStatus] = useState(null);
  const [loadingShortlist, setLoadingShortlist] = useState(false);
  const [sendingShortlist, setSendingShortlist] = useState(false);
  const [shortlistSuccessMsg, setShortlistSuccessMsg] = useState('');
  const [generatingShortlist, setGeneratingShortlist] = useState(false);

  // Fetch 48h shortlist status for requisition
  const fetchShortlistStatus = useCallback(async (reqId) => {
    if (!reqId) {
      setShortlistStatus(null);
      return;
    }
    setLoadingShortlist(true);
    try {
      const res = await interviewApi.getShortlistStatus(reqId, token);
      if (res && !res.error) {
        setShortlistStatus(res);
      }
    } catch {
      // ignore
    } finally {
      setLoadingShortlist(false);
    }
  }, [token]);

  useEffect(() => {
    if (selectedCandidate?.requisition_id) {
      fetchShortlistStatus(selectedCandidate.requisition_id);
    } else {
      setShortlistStatus(null);
    }
    setShortlistSuccessMsg('');
  }, [selectedCandidate?.requisition_id, fetchShortlistStatus]);

  const handleInstantSendShortlist = async () => {
    if (!selectedCandidate?.requisition_id) return;
    setSendingShortlist(true);
    setShortlistSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await interviewApi.sendShortlistInstant(
        selectedCandidate.requisition_id,
        'Instant dispatch requested from Interviews & AI Scores dashboard',
        token
      );
      setShortlistSuccessMsg(
        res?.message || 'Candidate shortlist successfully sent to company hiring stakeholders!'
      );
      await fetchShortlistStatus(selectedCandidate.requisition_id);
      loadData();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to dispatch shortlist to company.');
    } finally {
      setSendingShortlist(false);
    }
  };

  const handleGenerateShortlist = async () => {
    if (!selectedCandidate?.requisition_id) return;
    setGeneratingShortlist(true);
    setErrorMsg('');
    try {
      await interviewApi.generateShortlist(selectedCandidate.requisition_id, token);
      await fetchShortlistStatus(selectedCandidate.requisition_id);
      loadData();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to re-generate candidate shortlist.');
    } finally {
      setGeneratingShortlist(false);
    }
  };

  // Sync communication analysis for selected round
  useEffect(() => {
    if (!selectedRoundForDetails?.id) {
      setRoundCommAnalysis(null);
      return;
    }

    if (
      selectedRoundForDetails.communication_analysis &&
      Object.keys(selectedRoundForDetails.communication_analysis).length > 0
    ) {
      setRoundCommAnalysis({
        analysis: selectedRoundForDetails.communication_analysis,
        metrics: selectedRoundForDetails.communication_metrics || {},
        transcript: selectedRoundForDetails.transcript || [],
      });
      return;
    }

    setLoadingCommAnalysis(true);
    interviewApi
      .getCommunicationAnalysis(selectedRoundForDetails.id)
      .then((res) => {
        if (res && res.analysis && Object.keys(res.analysis).length > 0) {
          setRoundCommAnalysis(res);
        } else {
          setRoundCommAnalysis(null);
        }
      })
      .catch(() => {
        setRoundCommAnalysis(null);
      })
      .finally(() => {
        setLoadingCommAnalysis(false);
      });
  }, [selectedRoundForDetails?.id, selectedRoundForDetails?.communication_analysis]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [summaryRes, roundsRes] = await Promise.all([
        interviewApi.getSummary(token).catch(() => []),
        interviewApi.listRounds({}, token).catch(() => []),
      ]);

      setCandidatesSummary(Array.isArray(summaryRes) ? summaryRes : []);
      setRounds(Array.isArray(roundsRes) ? roundsRes : []);

      if (Array.isArray(summaryRes) && summaryRes.length > 0) {
        const first = summaryRes[0];
        setSelectedCandidate(first);
        const candRounds = first.rounds || [];
        const latest = first.latest_round || (candRounds.length > 0 ? candRounds[candRounds.length - 1] : null);
        setSelectedRoundForDetails(latest);
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load interview workflows.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  // Quick action: Open Create Round modal pre-populated for a candidate
  const handleScheduleForCandidate = (cand) => {
    const existingRounds = cand.rounds || [];
    setCreateModalInitialData({
      candidate_submission_id: cand.candidate_submission_id,
      candidate_name: cand.candidate_name,
      candidate_email: cand.candidate_email,
      requisition_id: cand.requisition_id,
      requisition_title: cand.requisition_title,
      nextRoundNumber: existingRounds.length + 1,
    });
    setIsCreateModalOpen(true);
  };

  const handleRoundCreated = (newRound) => {
    loadData();
    setActiveInviteModalRound(newRound);
  };

  // Filter candidates
  const filteredCandidates = candidatesSummary.filter((c) => {
    const matchesSearch =
      (c.candidate_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.requisition_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.candidate_email || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ready_for_next') return c.ready_for_next_round || c.ready_for_round_1;
    if (statusFilter === 'in_progress') return c.in_progress_rounds > 0;
    if (statusFilter === 'completed') return c.completed_rounds === c.total_rounds && c.total_rounds > 0;

    return true;
  });

  // Overview metrics
  const totalInterviews = rounds.length;
  const inProgressCount = rounds.filter((r) => r.status === 'In Progress').length;
  const completedCount = rounds.filter((r) => r.status === 'Completed').length;
  const readyToScheduleCount = candidatesSummary.filter((c) => c.ready_for_next_round || c.ready_for_round_1).length;

  return (
    <div className="space-y-6 max-w-7xl w-full mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 mb-2">
              <Video size={13} /> Multi-Round Orchestration
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
              Interview Management
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Configure multi-round pipelines (Recruiter → Technical → Managerial → Final), monitor real-time rooms, and review evaluations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedCandidate) {
                handleScheduleForCandidate(selectedCandidate);
              } else {
                setCreateModalInitialData({});
                setIsCreateModalOpen(true);
              }
            }}
            className="px-5 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Schedule Interview Round</span>
          </button>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-100">
          <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/80">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Total Rounds</div>
            <div className="text-xl font-black text-zinc-950 mt-1">{totalInterviews}</div>
          </div>
          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80">
            <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">In Progress</div>
            <div className="text-xl font-black text-blue-900 mt-1">{inProgressCount}</div>
          </div>
          <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completed Rounds</div>
            <div className="text-xl font-black text-emerald-900 mt-1">{completedCount}</div>
          </div>
          <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Ready to Schedule</div>
            <div className="text-xl font-black text-amber-900 mt-1">{readyToScheduleCount}</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, requisition, email..."
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-zinc-200 rounded-2xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl border border-zinc-200 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            All Candidates ({candidatesSummary.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ready_for_next')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ready_for_next'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <Sparkles size={13} />
            <span>Ready to Schedule ({readyToScheduleCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              statusFilter === 'in_progress' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              statusFilter === 'completed' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* Main Two-Column Workflow Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Candidate List Column */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-400 bg-white rounded-3xl border border-zinc-200">
              Loading candidates and interview stages...
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 bg-white rounded-3xl border border-zinc-200">
              No candidates found matching the filter.
            </div>
          ) : (
            filteredCandidates.map((cand) => {
              const isSelected = (selectedCandidate?.candidate_submission_id && selectedCandidate?.candidate_submission_id === cand.candidate_submission_id) ||
                (selectedCandidate?.candidate_email && selectedCandidate?.candidate_email === cand.candidate_email);
              const candRounds = cand.rounds || [];
              const latest = cand.latest_round;
              const evalVerdict = latest?.evaluation?.result;
              const verdictMeta = EVALUATION_VERDICTS.find((v) => v.value === evalVerdict);

              return (
                <div
                  key={cand.candidate_submission_id || cand.candidate_email}
                  onClick={() => {
                    setSelectedCandidate(cand);
                    const candRounds = cand.rounds || [];
                    const latest = cand.latest_round || (candRounds.length > 0 ? candRounds[candRounds.length - 1] : null);
                    setSelectedRoundForDetails(latest || null);
                  }}
                  className={`p-5 rounded-3xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-lg'
                      : 'bg-white text-zinc-950 border-zinc-200 hover:border-zinc-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    {cand.total_rounds === 0 ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Sparkles size={11} /> Shortlisted · Ready for Round 1
                      </span>
                    ) : (
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {cand.total_rounds} Round{cand.total_rounds === 1 ? '' : 's'} Configured
                      </span>
                    )}

                    {cand.ready_for_next_round && (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                        <Sparkles size={11} /> Ready for Next Round
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="font-extrabold text-base tracking-tight">{cand.candidate_name}</h3>
                    {(() => {
                      const completedWithScore = candRounds.find(r => r.communication_analysis?.overall_score) || (cand.latest_round?.communication_analysis?.overall_score ? cand.latest_round : null);
                      const score = completedWithScore?.communication_analysis?.overall_score;
                      if (!score) return null;
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-zinc-950 flex items-center gap-1 shadow-sm shrink-0">
                          <Sparkles size={11} className="stroke-[3]" />
                          <span>AI: {score}/100</span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className={`text-xs truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {cand.requisition_title || 'Position'} {cand.vendor_name ? `· ${cand.vendor_name}` : ''}
                  </div>

                  {/* Round Stepper Preview */}
                  <div className="mt-3 pt-3 border-t border-zinc-200/30 flex items-center justify-between text-xs">
                    {cand.total_rounds === 0 ? (
                      <span className={`text-[11px] font-medium italic ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>
                        No rounds scheduled yet · Click to setup Round 1
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {candRounds.map((r, rIdx) => (
                          <span
                            key={r.id || rIdx}
                            title={`${r.round_name}: ${r.status}`}
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              r.status === 'Completed'
                                ? 'bg-emerald-500 text-white'
                                : r.status === 'In Progress'
                                ? 'bg-blue-500 text-white animate-pulse'
                                : isSelected
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {r.round_number || rIdx + 1}
                          </span>
                        ))}
                      </div>
                    )}

                    {evalVerdict && (
                      <span
                        className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
                          verdictMeta ? verdictMeta.badgeClass : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        {evalVerdict}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Candidate Pipeline & Rounds Detail */}
        <div className="lg:col-span-7">
          {selectedCandidate ? (
            <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs space-y-6 sticky top-20">
              {/* Candidate Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
                <div>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    <span>Active Pipeline Detail</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-zinc-950 tracking-tight">
                    {selectedCandidate.candidate_name}
                  </h2>
                  <div className="text-xs text-zinc-500 mt-1">
                    {selectedCandidate.candidate_email} · Requisition: <strong className="text-zinc-800">{selectedCandidate.requisition_title}</strong>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={() => handleScheduleForCandidate(selectedCandidate)}
                  className="px-5 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 transition shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <Plus size={15} />
                  <span>{selectedCandidate.total_rounds === 0 ? 'Schedule Round 1' : 'Add Next Round'}</span>
                </button>
              </div>

              {/* Highlight AI Communication Score Banner if Available */}
              {(() => {
                const candRounds = selectedCandidate.rounds || [];
                const completedWithScore = candRounds.find(r => r.communication_analysis?.overall_score) || (selectedCandidate.latest_round?.communication_analysis?.overall_score ? selectedCandidate.latest_round : null);
                const score = completedWithScore?.communication_analysis?.overall_score;
                if (!score) return null;
                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-zinc-950 font-black text-xl flex items-center justify-center shadow-md shrink-0">
                        {score}
                      </div>
                      <div>
                        <div className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={13} className="text-emerald-600" />
                          <span>AI Spoken Communication Score: {score} / 100</span>
                        </div>
                        <div className="text-[11px] text-emerald-800 mt-0.5">
                          {completedWithScore.communication_analysis?.summary || 'Spoken interview completed. Click below to inspect dimensional scores & transcript.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRoundForDetails(completedWithScore)}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
                    >
                      View AI Scorecard
                    </button>
                  </div>
                );
              })()}

              {/* Company Shortlist & 48-Hour Delivery Hub */}
              {selectedCandidate.requisition_id && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 text-white shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Status & Shortlist Count */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {shortlistStatus?.shortlist_dispatched ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            <span>Shortlist Delivered to Company</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                            <Clock size={13} className="text-amber-400 animate-pulse" />
                            <span>48h Automated Sourcing Window Active</span>
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-400 font-mono truncate">
                          {selectedCandidate.requisition_title}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                        <span>Company Shortlist (Algorithm Powered)</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                          {shortlistStatus?.shortlist_candidate_count ?? 1} Ranked
                        </span>
                      </h3>

                      <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl">
                        {shortlistStatus?.shortlist_dispatched ? (
                          <span>
                            ✓ Ranked candidate list has been delivered to the hiring company stakeholders{' '}
                            <strong className="text-white">
                              {shortlistStatus.shortlist_dispatched_at ? `on ${new Date(shortlistStatus.shortlist_dispatched_at).toLocaleString()}` : ''}
                            </strong>{' '}
                            via {shortlistStatus.shortlist_dispatched_by || 'Auto Window'}.
                          </span>
                        ) : (
                          <span>
                            Shortlisted candidates are auto-generated using our AI scoring algorithm.{' '}
                            <strong className="text-amber-300 font-bold">
                              Automatically sends to company after 48hrs
                            </strong>{' '}
                            ({shortlistStatus?.hours_remaining ? `${shortlistStatus.hours_remaining} hrs left` : 'Timer active'}).
                            Click Instant Send to deliver immediately.
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Instant Send Action Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleInstantSendShortlist}
                        disabled={sendingShortlist || shortlistStatus?.shortlist_dispatched}
                        className={`px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                          shortlistStatus?.shortlist_dispatched
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                            : 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-zinc-950 shadow-amber-500/20 hover:scale-102 active:scale-98'
                        }`}
                      >
                        <Zap size={16} className={shortlistStatus?.shortlist_dispatched ? 'text-zinc-500' : 'text-zinc-950 fill-current'} />
                        <span>
                          {sendingShortlist
                            ? 'Sending Shortlist...'
                            : shortlistStatus?.shortlist_dispatched
                            ? 'Shortlist Already Sent'
                            : '⚡ Instant Send Shortlist to Company'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateShortlist}
                        disabled={generatingShortlist}
                        title="Re-run algorithm to update candidate rankings from latest interview scores"
                        className="p-3 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/80"
                      >
                        <RefreshCw size={15} className={generatingShortlist ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Instant Send Success Banner */}
                  {shortlistSuccessMsg && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                      <span className="font-semibold">{shortlistSuccessMsg}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Ready For Round 1 Banner (Shortlisted Candidates) */}
              {selectedCandidate.total_rounds === 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        Shortlisted Candidate · Ready for Interview Round 1
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Candidate cleared resume screening. Schedule Round 1 (Technical, HR, or Managerial) to generate their access passcode and meeting room.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleScheduleForCandidate(selectedCandidate)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shrink-0 cursor-pointer shadow-xs"
                  >
                    Schedule Round 1
                  </button>
                </div>
              )}

              {/* Ready For Next Round Banner */}
              {selectedCandidate.ready_for_next_round && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={18} className="text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-900">
                        Passed Previous Round with Positive Verdict
                      </div>
                      <div className="text-[11px] text-amber-700">
                        Candidate successfully cleared the previous assessment and is ready to advance.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleScheduleForCandidate(selectedCandidate)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0 cursor-pointer"
                  >
                    Advance to Next Round
                  </button>
                </div>
              )}

              {/* Round Timeline Stepper */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-3">
                  Rounds Progression
                </h3>
                <RoundTimeline
                  rounds={selectedCandidate.rounds || []}
                  activeRoundId={selectedRoundForDetails?.id}
                  onSelectRound={(r) => setSelectedRoundForDetails(r)}
                />
              </div>

              {/* Detailed Breakdown of Selected Round */}
              {selectedRoundForDetails ? (
                <div className="p-5 bg-zinc-50 rounded-3xl border border-zinc-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Round {selectedRoundForDetails.round_number || 1}
                      </div>
                      <h4 className="text-lg font-bold text-zinc-950">{selectedRoundForDetails.round_name}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveInviteModalRound(selectedRoundForDetails)}
                        className="px-3.5 py-2 rounded-xl bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <LinkIcon size={14} />
                        <span>Share Links / Passcode</span>
                      </button>

                      {selectedRoundForDetails.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() => setActiveEvaluationRound(selectedRoundForDetails)}
                          className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Award size={14} />
                          <span>Record Evaluation</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Schedule Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-zinc-200">
                      <span className="text-[11px] text-zinc-400 font-semibold block">Date & Time</span>
                      <span className="font-bold text-zinc-900 mt-0.5 block">
                        {selectedRoundForDetails.scheduled_date || 'TBD'} · {selectedRoundForDetails.scheduled_time || '--:--'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-zinc-200">
                      <span className="text-[11px] text-zinc-400 font-semibold block">Duration</span>
                      <span className="font-bold text-zinc-900 mt-0.5 block">
                        {selectedRoundForDetails.duration_minutes || 45} mins
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-zinc-200 col-span-2 sm:col-span-1">
                      <span className="text-[11px] text-zinc-400 font-semibold block">Interviewer</span>
                      <span className="font-bold text-zinc-900 mt-0.5 block truncate">
                        {selectedRoundForDetails.interviewer_name} ({selectedRoundForDetails.interviewer_role})
                      </span>
                    </div>
                  </div>

                  {/* Candidate Passcode Pill */}
                  <div className="p-3 bg-white rounded-xl border border-zinc-200 flex items-center justify-between text-xs">
                    <span className="text-zinc-600 font-medium">Temporary Candidate Passcode:</span>
                    <span className="font-mono font-bold text-zinc-950 bg-zinc-100 px-2.5 py-1 rounded-md">
                      {selectedRoundForDetails.candidate_passcode}
                    </span>
                  </div>

                  {/* Evaluation Result if submitted */}
                  {selectedRoundForDetails.evaluation && selectedRoundForDetails.evaluation.result && (
                    <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 size={15} /> Evaluator Verdict
                        </span>
                        <span className="text-xs font-extrabold px-2.5 py-1 bg-emerald-600 text-white rounded-lg">
                          {selectedRoundForDetails.evaluation.result}
                        </span>
                      </div>

                      {selectedRoundForDetails.evaluation.notes && (
                        <p className="text-xs text-zinc-700 italic bg-white p-3 rounded-xl border border-emerald-200/60">
                          "{selectedRoundForDetails.evaluation.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Candidate Video Recording Player */}
                  <CandidateRecordingPlayer
                    round={selectedRoundForDetails}
                    candidateName={selectedCandidate?.candidate_name}
                  />

                  {/* AI Spoken Communication Assessment & Executive Scorecard for Admin */}
                  {roundCommAnalysis && roundCommAnalysis.analysis && Object.keys(roundCommAnalysis.analysis).length > 0 ? (
                    <div className="p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white rounded-3xl border border-zinc-800 space-y-4 shadow-xl animate-in fade-in duration-300">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>AI Spoken Communication Assessment</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                CONFIDENTIAL · ADMIN ONLY
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Automated linguistic, cadence, and response analysis for {selectedCandidate.candidate_name}
                            </div>
                          </div>
                        </div>

                        {/* Overall Score & Assessment Grade */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                              {roundCommAnalysis.analysis.assessment_grade || 'Overall Score'}
                            </span>
                            <span className={`text-xl font-black ${
                              (roundCommAnalysis.analysis.overall_score ?? 0) >= 75
                                ? 'text-emerald-400'
                                : (roundCommAnalysis.analysis.overall_score ?? 0) >= 50
                                ? 'text-sky-400'
                                : (roundCommAnalysis.analysis.overall_score ?? 0) >= 30
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}>
                              {roundCommAnalysis.analysis.overall_score ?? 0}
                              <span className="text-xs text-zinc-500 font-semibold"> / 100</span>
                            </span>
                          </div>
                          <div className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center font-black text-lg ${
                            (roundCommAnalysis.analysis.overall_score ?? 0) >= 75
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : (roundCommAnalysis.analysis.overall_score ?? 0) >= 50
                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                              : (roundCommAnalysis.analysis.overall_score ?? 0) >= 30
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}>
                            {roundCommAnalysis.analysis.overall_score ?? 0}
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      {roundCommAnalysis.analysis.summary && (
                        <div className="p-3 bg-zinc-900/90 rounded-2xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                          <span className="font-bold text-zinc-200 block mb-1">Executive Summary:</span>
                          {roundCommAnalysis.analysis.summary}
                        </div>
                      )}

                      {/* Linguistic Cadence & Metrics */}
                      <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                          <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center justify-center gap-1">
                            <Activity size={12} className="text-emerald-400" />
                            <span>Speaking Pace</span>
                          </div>
                          <div className="text-base font-black text-white mt-1">
                            {roundCommAnalysis.metrics?.words_per_minute || 140} <span className="text-xs font-normal text-zinc-400">WPM</span>
                          </div>
                          <div className="text-[10px] text-emerald-400 font-medium truncate mt-0.5">
                            {roundCommAnalysis.metrics?.pace_rating || 'Optimal Cadence'}
                          </div>
                        </div>

                        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                          <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center justify-center gap-1">
                            <Zap size={12} className="text-sky-400" />
                            <span>Filler Frequency</span>
                          </div>
                          <div className="text-base font-black text-white mt-1">
                            {roundCommAnalysis.metrics?.filler_percentage !== undefined ? `${roundCommAnalysis.metrics.filler_percentage}%` : '1.8%'}
                          </div>
                          <div className="text-[10px] text-sky-400 font-medium truncate mt-0.5">
                            {roundCommAnalysis.metrics?.filler_count || 0} filler words detected
                          </div>
                        </div>

                        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                          <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center justify-center gap-1">
                            <Award size={12} className="text-purple-400" />
                            <span>Lexical Variety</span>
                          </div>
                          <div className="text-base font-black text-white mt-1">
                            {roundCommAnalysis.metrics?.lexical_diversity || 0.54} <span className="text-xs font-normal text-zinc-400">TTR</span>
                          </div>
                          <div className="text-[10px] text-purple-400 font-medium truncate mt-0.5">
                            {roundCommAnalysis.metrics?.vocabulary_rating || 'Rich Lexicon'}
                          </div>
                        </div>
                      </div>

                      {/* 6 Core Dimensions */}
                      <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
                          Dimensional Competency Breakdown (1 - 10)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
                          {[
                            { label: 'Relevance', val: roundCommAnalysis.analysis.relevance_score ?? 7.5 },
                            { label: 'Substance', val: roundCommAnalysis.analysis.substance_score ?? 7.0 },
                            { label: 'Clarity', val: roundCommAnalysis.analysis.clarity_score ?? 7.5 },
                            { label: 'Structure', val: roundCommAnalysis.analysis.structure_score ?? 7.0 },
                            { label: 'Vocabulary', val: roundCommAnalysis.analysis.vocabulary_score ?? 7.5 },
                            { label: 'Confidence', val: roundCommAnalysis.analysis.confidence_score ?? 7.0 },
                          ].map((dim, idx) => (
                            <div key={idx} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80">
                              <div className="text-[11px] text-zinc-400">{dim.label}</div>
                              <div className={`text-sm font-black mt-0.5 ${
                                dim.val >= 7 ? 'text-emerald-400' : dim.val >= 4 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {dim.val} / 10
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Strengths & Growth Areas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {roundCommAnalysis.analysis.key_strengths && roundCommAnalysis.analysis.key_strengths.length > 0 && (
                          <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-900/40">
                            <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                              <CheckCircle2 size={13} />
                              <span>Key Strengths</span>
                            </div>
                            <ul className="space-y-1 text-zinc-300 list-disc list-inside text-[11px]">
                              {roundCommAnalysis.analysis.key_strengths.map((str, i) => (
                                <li key={i}>{str}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {roundCommAnalysis.analysis.areas_for_improvement && roundCommAnalysis.analysis.areas_for_improvement.length > 0 && (
                          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-900/40">
                            <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                              <AlertCircle size={13} />
                              <span>Areas for Growth</span>
                            </div>
                            <ul className="space-y-1 text-zinc-300 list-disc list-inside text-[11px]">
                              {roundCommAnalysis.analysis.areas_for_improvement.map((area, i) => (
                                <li key={i}>{area}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Full Transcript Accordion */}
                      {roundCommAnalysis.transcript && roundCommAnalysis.transcript.length > 0 && (
                        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                            className="w-full p-3 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-200 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <FileText size={14} className="text-zinc-400" />
                              <span>View Spoken Q&A Transcript ({roundCommAnalysis.transcript.length} turns)</span>
                            </span>
                            {isTranscriptExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isTranscriptExpanded && (
                            <div className="p-3 bg-zinc-950/90 space-y-2.5 max-h-72 overflow-y-auto border-t border-zinc-800 text-xs">
                              {roundCommAnalysis.transcript.map((t, idx) => {
                                const isAi = t.speaker === 'interviewer';
                                return (
                                  <div
                                    key={idx}
                                    className={`p-2.5 rounded-xl border ${
                                      isAi
                                        ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                                        : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-100'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 font-semibold">
                                      <span>{t.speaker_name || (isAi ? 'AI Interviewer (Aria)' : selectedCandidate.candidate_name)}</span>
                                      <span>{t.timestamp || ''}</span>
                                    </div>
                                    <div className="leading-relaxed">{t.text}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Evaluation Form quick trigger */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-zinc-400">
                          Transfer scores and insights to official evaluation record:
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveEvaluationRound(selectedRoundForDetails)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Award size={13} />
                          <span>Record Official Evaluation</span>
                        </button>
                      </div>
                    </div>
                  ) : loadingCommAnalysis ? (
                    <div className="p-4 bg-zinc-100 rounded-2xl border border-zinc-200 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin" />
                      <span>Loading AI Communication Analysis...</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-zinc-200">
                  Select a round from the timeline above to view full details and candidate credentials.
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-center p-8 bg-white rounded-3xl border border-zinc-200 text-zinc-400 text-xs">
              Select a candidate from the left panel to inspect interview progression and schedule rounds.
            </div>
          )}
        </div>
      </div>

      {/* Schedule Round Modal */}
      <CreateRoundModal
        isOpen={isCreateModalOpen}
        initialData={createModalInitialData}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleRoundCreated}
      />

      {/* Share Links & Passcode Modal */}
      <InviteActionsModal
        isOpen={Boolean(activeInviteModalRound)}
        round={activeInviteModalRound}
        onClose={() => setActiveInviteModalRound(null)}
      />

      {/* Evaluation Modal */}
      {activeEvaluationRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="max-w-2xl w-full my-8">
            <EvaluationForm
              round={activeEvaluationRound}
              defaultEvaluator={user?.name || user?.email || 'Hiring Manager'}
              onSuccess={(updated) => {
                setActiveEvaluationRound(null);
                loadData();
              }}
              onCancel={() => setActiveEvaluationRound(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
