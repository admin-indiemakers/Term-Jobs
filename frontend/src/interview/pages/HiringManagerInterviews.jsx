import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  UserCheck,
  UserX,
  ExternalLink,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { interviewApi } from '../services/interviewApi';
import { RoundTimeline } from '../components/RoundTimeline';
import { CreateRoundModal } from '../components/CreateRoundModal';
import { InviteActionsModal } from '../components/InviteActionsModal';
import { EvaluationForm } from '../components/EvaluationForm';
import { CandidateRecordingPlayer } from '../components/CandidateRecordingPlayer';
import { EVALUATION_VERDICTS } from '../utils/interviewConstants';
import { getMeetingRoomLink } from '../utils/credentialGenerator';

function formatShortlistCountdown(totalSecs) {
  if (totalSecs == null || totalSecs <= 0) return '00h 00m 00s';
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

export function HiringManagerInterviews() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [candidatesSummary, setCandidatesSummary] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedRoundForDetails, setSelectedRoundForDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'accepted' | 'ready_for_next' | 'in_progress' | 'completed'

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialData, setCreateModalInitialData] = useState({});
  const [activeInviteModalRound, setActiveInviteModalRound] = useState(null);
  const [activeEvaluationRound, setActiveEvaluationRound] = useState(null);

  // Final Decision (Accept & Onboard / Reject) State
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState('Accepted'); // 'Accepted' | 'Rejected'
  const [decisionCandidate, setDecisionCandidate] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionSuccessMsg, setDecisionSuccessMsg] = useState('');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [roundCommAnalysis, setRoundCommAnalysis] = useState(null);
  const [candidateAiAnalysis, setCandidateAiAnalysis] = useState(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [loadingCommAnalysis, setLoadingCommAnalysis] = useState(false);

  // Shortlist dispatch & 48h countdown state
  const [shortlistStatus, setShortlistStatus] = useState(null);
  const [loadingShortlist, setLoadingShortlist] = useState(false);
  const [sendingShortlist, setSendingShortlist] = useState(false);
  const [shortlistSuccessMsg, setShortlistSuccessMsg] = useState('');
  const [generatingShortlist, setGeneratingShortlist] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [showInstantNotesModal, setShowInstantNotesModal] = useState(false);
  const [instantNotes, setInstantNotes] = useState('');

  // Extract all distinct requisitions from loaded candidates
  const availableRequisitions = useMemo(() => {
    const map = new Map();
    for (const c of candidatesSummary) {
      if (c.requisition_id && !map.has(c.requisition_id)) {
        map.set(c.requisition_id, {
          id: c.requisition_id,
          title: c.requisition_title || 'Requisition',
        });
      }
    }
    return Array.from(map.values());
  }, [candidatesSummary]);

  // Active requisition ID & title for shortlist operations
  const activeReqId =
    selectedReqId ||
    selectedCandidate?.requisition_id ||
    (availableRequisitions.length > 0 ? availableRequisitions[0].id : null);

  const activeReqTitle =
    availableRequisitions.find((r) => r.id === activeReqId)?.title ||
    selectedCandidate?.requisition_title ||
    'Active Requisition';

  // Fetch 48h shortlist status for requisition
  const fetchShortlistStatus = useCallback(async (reqId) => {
    if (!reqId) {
      setShortlistStatus(null);
      setSecondsRemaining(null);
      return;
    }
    setLoadingShortlist(true);
    try {
      const res = await interviewApi.getShortlistStatus(reqId, token);
      if (res && !res.error) {
        setShortlistStatus(res);
        if (res.seconds_remaining != null) {
          setSecondsRemaining(res.seconds_remaining);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingShortlist(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeReqId) {
      fetchShortlistStatus(activeReqId);
    } else {
      setShortlistStatus(null);
      setSecondsRemaining(null);
    }
    setShortlistSuccessMsg('');
  }, [activeReqId, fetchShortlistStatus]);

  // Live countdown ticker (ticks every second for real-time 48h tracking)
  useEffect(() => {
    if (secondsRemaining == null || secondsRemaining <= 0 || shortlistStatus?.shortlist_dispatched) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining, shortlistStatus?.shortlist_dispatched]);

  const handleInstantSendShortlist = async (customNotes = '') => {
    const targetReqId = activeReqId || selectedCandidate?.requisition_id;
    if (!targetReqId) return;
    setSendingShortlist(true);
    setShortlistSuccessMsg('');
    setErrorMsg('');
    try {
      const notesToSend =
        typeof customNotes === 'string' && customNotes.trim()
          ? customNotes.trim()
          : (instantNotes.trim() || 'Instant dispatch requested from Interviews & AI Scores dashboard');
      const res = await interviewApi.sendShortlistInstant(
        targetReqId,
        notesToSend,
        token
      );
      setShortlistSuccessMsg(
        res?.message || 'Candidate shortlist successfully sent to Hiring Manager shortlist!'
      );
      setShowInstantNotesModal(false);
      setInstantNotes('');
      await fetchShortlistStatus(targetReqId);
      loadData();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to dispatch shortlist to Hiring Manager.');
    } finally {
      setSendingShortlist(false);
    }
  };

  const handleGenerateShortlist = async () => {
    const targetReqId = activeReqId || selectedCandidate?.requisition_id;
    if (!targetReqId) return;
    setGeneratingShortlist(true);
    setErrorMsg('');
    try {
      await interviewApi.generateShortlist(targetReqId, token);
      await fetchShortlistStatus(targetReqId);
      loadData();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to re-generate candidate shortlist rankings.');
    } finally {
      setGeneratingShortlist(false);
    }
  };

  const handleOpenDecisionModal = (cand, type) => {
    setDecisionCandidate(cand);
    setDecisionType(type);
    setDecisionNotes('');
    setDecisionSuccessMsg('');
    setErrorMsg('');
    setIsDecisionModalOpen(true);
  };

  const handleConfirmDecision = async () => {
    if (!decisionCandidate) return;
    const candIdent = decisionCandidate.candidate_submission_id || decisionCandidate.candidate_id || decisionCandidate.candidate_email;
    setSubmittingDecision(true);
    setErrorMsg('');
    try {
      const res = await interviewApi.recordCandidateDecision(
        candIdent,
        decisionType,
        decisionNotes,
        decisionCandidate.requisition_id,
        token
      );
      const assignedId = res?.candidate_id || decisionCandidate.candidate_id || '';
      setDecisionSuccessMsg(
        res?.message ||
        (decisionType === 'Accepted'
          ? `Candidate ${decisionCandidate.candidate_name} has been formally accepted & onboarded${assignedId ? ` with Candidate ID ${assignedId}` : ''}. Super Admin notified.`
          : `Candidate ${decisionCandidate.candidate_name} has been rejected. Super Admin notified.`)
      );
      setIsDecisionModalOpen(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err?.message || `Failed to record ${decisionType} decision.`);
    } finally {
      setSubmittingDecision(false);
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

  // Candidate's baseline AI screening round (so AI scores/transcript are always available)
  const candidateAiRound = useMemo(() => {
    if (!selectedCandidate) return null;
    const candRounds = selectedCandidate.rounds || [];
    return (
      candRounds.find(
        (r) =>
          r.communication_analysis?.overall_score ||
          (r.round_name || '').startsWith('AI') ||
          r.round_type === 'AI_Screening'
      ) || null
    );
  }, [selectedCandidate]);

  // Sync candidate AI screening analysis so it is always accessible to Hiring Manager
  useEffect(() => {
    if (!candidateAiRound?.id) {
      setCandidateAiAnalysis(null);
      return;
    }
    if (
      candidateAiRound.communication_analysis &&
      Object.keys(candidateAiRound.communication_analysis).length > 0
    ) {
      setCandidateAiAnalysis({
        analysis: candidateAiRound.communication_analysis,
        metrics: candidateAiRound.communication_metrics || {},
        transcript: candidateAiRound.transcript || [],
      });
      return;
    }

    interviewApi
      .getCommunicationAnalysis(candidateAiRound.id)
      .then((res) => {
        if (res && res.analysis && Object.keys(res.analysis).length > 0) {
          setCandidateAiAnalysis(res);
        } else {
          setCandidateAiAnalysis(null);
        }
      })
      .catch(() => setCandidateAiAnalysis(null));
  }, [candidateAiRound?.id, candidateAiRound?.communication_analysis]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [summaryRes, roundsRes] = await Promise.all([
        interviewApi.getSummary(token).catch(() => []),
        interviewApi.listRounds({}, token).catch(() => []),
      ]);

      const sumList = Array.isArray(summaryRes) ? summaryRes : [];
      setCandidatesSummary(sumList);
      setRounds(Array.isArray(roundsRes) ? roundsRes : []);

      if (sumList.length > 0) {
        setSelectedCandidate((prev) => {
          if (prev) {
            const match = sumList.find(
              (c) =>
                (c.candidate_submission_id && c.candidate_submission_id === prev.candidate_submission_id) ||
                (c.candidate_email && c.candidate_email === prev.candidate_email) ||
                (c.candidate_id && c.candidate_id === prev.candidate_id)
            );
            if (match) return match;
          }
          return sumList[0];
        });
        const candRounds = sumList[0].rounds || [];
        const latest = sumList[0].latest_round || (candRounds.length > 0 ? candRounds[candRounds.length - 1] : null);
        setSelectedRoundForDetails((prev) => prev || latest);
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

  // Quick action: Open Create Round modal pre-populated for a candidate's next company round
  const handleScheduleForCandidate = (cand) => {
    if (!cand) return;
    const existingRounds = cand.rounds || [];
    const companyRounds = existingRounds.filter((r) => !(r.round_name || '').startsWith('AI'));
    const nextRoundNum = companyRounds.length + 1;
    let defaultType = 'Technical_1';
    let defaultName = 'Technical Round 1';
    if (nextRoundNum === 2) {
      defaultType = 'Technical_2';
      defaultName = 'Technical Round 2';
    } else if (nextRoundNum === 3) {
      defaultType = 'Manager';
      defaultName = 'Managerial Round';
    } else if (nextRoundNum >= 4) {
      defaultType = 'Final';
      defaultName = 'Executive / Final Round';
    }

    setCreateModalInitialData({
      candidate_submission_id: cand.candidate_submission_id,
      candidate_name: cand.candidate_name,
      candidate_email: cand.candidate_email,
      requisition_id: cand.requisition_id,
      requisition_title: cand.requisition_title,
      round_type: defaultType,
      round_name: defaultName,
      nextRoundNumber: nextRoundNum,
      interviewer_name: user?.name || 'Hiring Manager',
      interviewer_email: user?.email || '',
    });
    setIsCreateModalOpen(true);
  };

  const handleRoundCreated = (newRound) => {
    loadData();
    setActiveInviteModalRound(newRound);
  };

  // Only candidates whose AI interview has ended and was accepted are shown to the Hiring Manager
  const acceptedCandidates = useMemo(() => {
    return candidatesSummary.filter((cand) => {
      const candRounds = cand.rounds || [];
      const hasCompleted = cand.completed_rounds > 0 || candRounds.some((r) => r.status === 'Completed');
      if (!hasCompleted) return false;

      const subStatus = (cand.submission_status || '').toLowerCase();
      if (subStatus === 'rejected') return false;

      const latestEval = cand.latest_round?.evaluation?.result;
      if (latestEval === 'No' && subStatus !== 'shortlisted' && subStatus !== 'accepted') {
        return false;
      }
      return true;
    });
  }, [candidatesSummary]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return acceptedCandidates.filter((c) => {
      const matchesSearch =
        (c.candidate_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.requisition_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.candidate_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.candidate_email || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'accepted') {
        const s = (c.submission_status || '').toLowerCase();
        return s === 'accepted' || s === 'hired';
      }
      if (statusFilter === 'ready_for_next') return c.ready_for_round_1 || c.ready_for_next_round;
      if (statusFilter === 'in_progress') return c.in_progress_rounds > 0;
      if (statusFilter === 'completed') return c.completed_rounds > 0;

      return true;
    });
  }, [acceptedCandidates, searchQuery, statusFilter]);

  // Overview metrics
  const totalAcceptedCandidates = acceptedCandidates.length;
  const acceptedHiredCount = acceptedCandidates.filter((c) => {
    const s = (c.submission_status || '').toLowerCase();
    return s === 'accepted' || s === 'hired';
  }).length;
  const inProgressCount = rounds.filter((r) => r.status === 'In Progress').length;
  const completedCount = rounds.filter((r) => r.status === 'Completed').length;
  const readyToScheduleCount = acceptedCandidates.filter((c) => c.ready_for_round_1 || c.ready_for_next_round).length;

  return (
    <div className="space-y-6 max-w-7xl w-full mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 mb-2">
              <Video size={13} className="text-emerald-600" />
              <span>Company Live Interview Hub · LiveKit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
              Company Interviews & AI Scores
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Candidates who cleared AI screening with accepted scores. Review AI results, schedule multi-round live company interviews (Technical, Managerial, HR, Final), and join encrypted LiveKit meeting rooms.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedCandidate) {
                handleScheduleForCandidate(selectedCandidate);
              } else {
                setCreateModalInitialData({
                  interviewer_name: user?.name || 'Hiring Manager',
                  interviewer_email: user?.email || '',
                });
                setIsCreateModalOpen(true);
              }
            }}
            className="px-5 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Schedule Company Interview</span>
          </button>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-zinc-100">
          <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/80">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">AI Cleared Pipeline</div>
            <div className="text-xl font-black text-zinc-950 mt-1">{totalAcceptedCandidates}</div>
          </div>
          <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-300 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span>Accepted Candidates</span>
            </div>
            <div className="text-xl font-black text-emerald-950 mt-1">{acceptedHiredCount}</div>
          </div>
          <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Ready to Schedule</div>
            <div className="text-xl font-black text-amber-900 mt-1">{readyToScheduleCount}</div>
          </div>
          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80">
            <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">In Progress Live</div>
            <div className="text-xl font-black text-blue-900 mt-1">{inProgressCount}</div>
          </div>
          <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200/80">
            <div className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Completed Rounds</div>
            <div className="text-xl font-black text-purple-900 mt-1">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* 48-Hour Shortlist Automation & Instant Dispatch Hub */}
      {activeReqId && (
        <div className="rounded-3xl bg-gradient-to-br from-zinc-950 via-slate-900 to-zinc-950 border border-zinc-800 text-white p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-zinc-800/80">
            {/* Title & Active Requisition Selector */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {shortlistStatus?.shortlist_dispatched ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-wider shadow-xs">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>Shortlist Delivered to Hiring Manager</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider shadow-xs">
                    <Clock size={13} className="text-amber-400 animate-pulse" />
                    <span>48h Automated Sourcing Window Active</span>
                  </span>
                )}

                {availableRequisitions.length > 1 ? (
                  <div className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-zinc-400 font-medium">Requisition:</span>
                    <select
                      value={activeReqId}
                      onChange={(e) => setSelectedReqId(e.target.value)}
                      className="bg-transparent text-white font-bold outline-none cursor-pointer"
                    >
                      {availableRequisitions.map((r) => (
                        <option key={r.id} value={r.id} className="bg-zinc-900 text-white">
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300">
                    {activeReqTitle}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                  <span>Candidate Shortlist Automation</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                    {shortlistStatus?.shortlist_candidate_count ?? 0} Best Ranked
                  </span>
                </h2>
                <p className="text-xs text-zinc-300 leading-relaxed mt-1 max-w-3xl">
                  {shortlistStatus?.shortlist_dispatched ? (
                    <span>
                      ✓ The ranked shortlist has been dispatched to the Hiring Manager{' '}
                      <strong className="text-white">
                        {shortlistStatus.shortlist_dispatched_at ? `on ${new Date(shortlistStatus.shortlist_dispatched_at).toLocaleString()}` : ''}
                      </strong>{' '}
                      via {shortlistStatus.shortlist_dispatched_by || 'Auto-Window'}. All shortlisted candidates are active in the Hiring Manager dashboard.
                    </span>
                  ) : (
                    <span>
                      Candidates who completed the AI screening interview are algorithmically ranked (60% AI interview score + 40% resume match score). Once 48 hours elapse, the best candidates are <strong className="text-amber-300 font-bold">automatically delivered to the Hiring Manager's shortlist</strong>. Click <strong className="text-white">Instant Send</strong> to bypass the 48-hour wait and deliver immediately.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Countdown Clock Box */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-4 shrink-0 shadow-inner">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 font-black text-2xl shadow-md">
                ⏱
              </div>
              <div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {shortlistStatus?.shortlist_dispatched ? 'Window Result' : '48h Window Countdown'}
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                  {shortlistStatus?.shortlist_dispatched
                    ? 'Dispatched'
                    : formatShortlistCountdown(secondsRemaining ?? shortlistStatus?.seconds_remaining)}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {shortlistStatus?.shortlist_dispatched
                    ? 'Shortlist received by HM'
                    : 'Auto-sends to HM at zero'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInstantNotesModal(true)}
                disabled={sendingShortlist}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-102 active:scale-98"
              >
                <Zap size={16} className="text-zinc-950 fill-current" />
                <span>
                  {sendingShortlist
                    ? 'Dispatching Shortlist...'
                    : shortlistStatus?.shortlist_dispatched
                    ? '⚡ Re-Send Shortlist Update to Hiring Manager'
                    : '⚡ Instant Send Shortlist to Hiring Manager'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleGenerateShortlist}
                disabled={generatingShortlist}
                title="Re-run scoring algorithm to calculate composite scores (60% AI interview score + 40% resume match)"
                className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer border border-zinc-700 shadow-xs"
              >
                <RefreshCw size={14} className={generatingShortlist ? 'animate-spin' : ''} />
                <span>{generatingShortlist ? 'Ranking Candidates…' : '🔄 Run Shortlist Ranking Algorithm'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard/candidates')}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <span>View Hiring Manager Shortlist</span>
              <ExternalLink size={13} />
            </button>
          </div>

          {/* Success Banner */}
          {shortlistSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span className="font-semibold">{shortlistSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/candidates')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1 transition cursor-pointer"
              >
                <span>Open HM Shortlist</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>
      )}

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
            placeholder="Search candidate name, ID, requisition, email..."
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-zinc-200 rounded-2xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl border border-zinc-200 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
              statusFilter === 'all' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            All Candidates ({totalAcceptedCandidates})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('accepted')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'accepted'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Accepted ({acceptedHiredCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ready_for_next')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilter === 'ready_for_next'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            <Sparkles size={13} />
            <span>Ready for Next Round ({readyToScheduleCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
              statusFilter === 'in_progress' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
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
              const companyRounds = candRounds.filter((r) => !(r.round_name || '').startsWith('AI'));
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
                    {((cand.submission_status || '').toLowerCase() === 'accepted' || (cand.submission_status || '').toLowerCase() === 'hired') ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500 text-zinc-950 flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 size={11} className="stroke-[3]" /> Accepted & Onboarded
                      </span>
                    ) : companyRounds.length === 0 ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Sparkles size={11} /> AI Cleared · Ready for Round 1
                      </span>
                    ) : (
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        Company Round {companyRounds.length} Active
                      </span>
                    )}

                    {cand.candidate_id && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-zinc-800 text-emerald-300' : 'bg-zinc-100 text-zinc-600 font-semibold'
                      }`}>
                        {cand.candidate_id}
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
                    {candRounds.length === 0 ? (
                      <span className={`text-[11px] font-medium italic ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>
                        AI Cleared · No company rounds yet
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

                  {/* Quick Action: If Accepted, view in Accepted Candidates, else Schedule Next Round */}
                  {((cand.submission_status || '').toLowerCase() === 'accepted' || (cand.submission_status || '').toLowerCase() === 'hired') ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/dashboard/candidates/accepted');
                      }}
                      className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 hover:bg-emerald-400 font-extrabold shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      <span>Onboarded · View in Accepted</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCandidate(cand);
                        handleScheduleForCandidate(cand);
                      }}
                      className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-white text-zinc-950 border-white/20 hover:bg-zinc-100'
                          : 'bg-zinc-950 text-white border-zinc-900 hover:bg-zinc-800'
                      }`}
                    >
                      <Plus size={12} strokeWidth={2.5} />
                      <span>{companyRounds.length === 0 ? 'Schedule Company Round 1' : `Schedule Round ${companyRounds.length + 1}`}</span>
                    </button>
                  )}
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
              {(() => {
                const isCandAccepted = (selectedCandidate.submission_status || '').toLowerCase() === 'accepted' || (selectedCandidate.submission_status || '').toLowerCase() === 'hired';
                return (
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                          Active Pipeline Detail
                        </span>
                        {isCandAccepted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                            <CheckCircle2 size={11} className="text-emerald-700" />
                            <span>Accepted & Onboarded</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-2xl font-extrabold text-zinc-950 tracking-tight">
                          {selectedCandidate.candidate_name}
                        </h2>
                        {selectedCandidate.candidate_id && (
                          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-zinc-900 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
                            <span className="text-zinc-400 text-[10px] font-sans uppercase font-medium">Candidate ID:</span>
                            <span>{selectedCandidate.candidate_id}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-zinc-500">
                        {selectedCandidate.candidate_email} · Requisition: <strong className="text-zinc-800">{selectedCandidate.requisition_title}</strong>
                      </div>
                    </div>

                    {/* Primary Actions: Final Accept, Final Reject, Schedule Next Round */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isCandAccepted ? (
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/candidates/accepted')}
                          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center gap-2 transition shadow-md hover:shadow-lg cursor-pointer"
                        >
                          <CheckCircle2 size={15} />
                          <span>View in Accepted Candidates</span>
                          <ExternalLink size={13} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionModal(selectedCandidate, 'Accepted')}
                            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center gap-2 transition shadow-md hover:shadow-lg cursor-pointer"
                            title="Formally accept candidate, assign Candidate ID, initialize company onboarding & notify Super Admin"
                          >
                            <UserCheck size={16} strokeWidth={2.5} />
                            <span>Final Accept & Onboard</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDecisionModal(selectedCandidate, 'Rejected')}
                            className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            title="Reject candidate and notify Super Admin"
                          >
                            <UserX size={15} />
                            <span>Final Reject</span>
                          </button>
                        </>
                      )}

                      {/* Primary Action: Schedule Company LiveKit Round */}
                      <button
                        type="button"
                        onClick={() => handleScheduleForCandidate(selectedCandidate)}
                        className="px-4 py-2.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 transition shadow-md cursor-pointer self-start sm:self-auto"
                      >
                        <Plus size={15} />
                        <span>
                          {(() => {
                            const coRounds = (selectedCandidate.rounds || []).filter(r => !(r.round_name || '').startsWith('AI'));
                            return coRounds.length === 0 ? 'Schedule Company Round 1' : `Schedule Next Round (${coRounds.length + 1})`;
                          })()}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Success Notification Banner for Decision */}
              {decisionSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{decisionSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/candidates/accepted')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>Open Accepted Candidates</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              )}

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
                      View AI Scorecard & Results
                    </button>
                  </div>
                );
              })()}

              {/* Requisition Shortlist & 48-Hour Delivery Hub */}
              {selectedCandidate.requisition_id && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 text-white shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Status & Shortlist Count */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {shortlistStatus?.shortlist_dispatched ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            <span>Shortlist Delivered to Hiring Manager</span>
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
                        <span>Hiring Manager Shortlist (Algorithm Powered)</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                          {shortlistStatus?.shortlist_candidate_count ?? 1} Best Ranked
                        </span>
                      </h3>

                      <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl">
                        {shortlistStatus?.shortlist_dispatched ? (
                          <span>
                            ✓ Ranked candidate list has been delivered to the Hiring Manager{' '}
                            <strong className="text-white">
                              {shortlistStatus.shortlist_dispatched_at ? `on ${new Date(shortlistStatus.shortlist_dispatched_at).toLocaleString()}` : ''}
                            </strong>{' '}
                            via {shortlistStatus.shortlist_dispatched_by || 'Auto Window'}.
                          </span>
                        ) : (
                          <span>
                            Shortlists the best candidates who completed AI screening within 48 hours and sends directly to the Hiring Manager's shortlist.{' '}
                            <strong className="text-amber-300 font-bold">
                              Automatically delivers after 48hrs
                            </strong>{' '}
                            ({secondsRemaining != null ? formatShortlistCountdown(secondsRemaining) : (shortlistStatus?.hours_remaining ? `${shortlistStatus.hours_remaining} hrs left` : 'Timer active')}). Click Instant Send to deliver immediately.
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Instant Send Action Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowInstantNotesModal(true)}
                        disabled={sendingShortlist}
                        className="px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-zinc-950 shadow-amber-500/20 hover:scale-102 active:scale-98"
                      >
                        <Zap size={16} className="text-zinc-950 fill-current" />
                        <span>
                          {sendingShortlist
                            ? 'Sending Shortlist...'
                            : shortlistStatus?.shortlist_dispatched
                            ? '⚡ Re-Send Shortlist Update to Hiring Manager'
                            : '⚡ Instant Send Shortlist to Hiring Manager'}
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

              {/* Company Live Interview Workflow Banner */}
              {(() => {
                const coRounds = (selectedCandidate.rounds || []).filter(r => !(r.round_name || '').startsWith('AI'));
                const hasCompanyRounds = coRounds.length > 0;
                return (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-950">
                          {hasCompanyRounds
                            ? `${coRounds.length} Company Live Interview Round${coRounds.length > 1 ? 's' : ''} Configured`
                            : 'AI Screening Cleared & Accepted · Ready for Company Round 1'}
                        </div>
                        <div className="text-[11px] text-emerald-800">
                          {hasCompanyRounds
                            ? 'Conduct company interviews in encrypted LiveKit video rooms, share access links, and record evaluation verdicts below.'
                            : 'This candidate has successfully cleared AI screening. Schedule Technical Round 1 or Managerial interview with your company team.'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleScheduleForCandidate(selectedCandidate)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} />
                      <span>{hasCompanyRounds ? `Schedule Round ${coRounds.length + 1}` : 'Schedule Technical Round 1'}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Round Timeline Stepper */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                    <Video size={14} className="text-zinc-500" />
                    <span>Company Interview Pipeline & Rounds (LiveKit)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleScheduleForCandidate(selectedCandidate)}
                    className="text-xs font-bold text-zinc-700 hover:text-zinc-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Round</span>
                  </button>
                </div>
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
                      {selectedRoundForDetails.status !== 'Completed' && (
                        <a
                          href={`${getMeetingRoomLink(selectedRoundForDetails.id)}?role=interviewer&name=${encodeURIComponent(user?.name || 'Interviewer')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                          <Video size={14} />
                          <span>Join Live Meeting (LiveKit)</span>
                        </a>
                      )}

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
                    round={selectedRoundForDetails?.video_recording_url || selectedRoundForDetails?.recording_metadata ? selectedRoundForDetails : candidateAiRound}
                    candidateName={selectedCandidate?.candidate_name}
                  />

                  {/* AI Spoken Communication Assessment & Executive Scorecard for Admin */}
                  {(() => {
                    const activeAnalysis = roundCommAnalysis || candidateAiAnalysis;
                    const isViewingAiBaseline = !roundCommAnalysis && !!candidateAiAnalysis;

                    if (!activeAnalysis || !activeAnalysis.analysis || Object.keys(activeAnalysis.analysis).length === 0) {
                      if (loadingCommAnalysis) {
                        return (
                          <div className="p-4 bg-zinc-100 rounded-2xl border border-zinc-200 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin" />
                            <span>Loading AI Communication Analysis...</span>
                          </div>
                        );
                      }
                      return null;
                    }

                    return (
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
                                  {isViewingAiBaseline ? 'AI SCREENING BASELINE · ACCEPTED' : 'CONFIDENTIAL · ADMIN ONLY'}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {isViewingAiBaseline
                                  ? `Pre-screening linguistic & communication scores for ${selectedCandidate.candidate_name} (Round 1: AI Screening)`
                                  : `Automated linguistic, cadence, and response analysis for ${selectedCandidate.candidate_name}`}
                              </div>
                            </div>
                          </div>

                          {/* Overall Score & Assessment Grade */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                {activeAnalysis.analysis.assessment_grade || 'Overall Score'}
                              </span>
                              <span className={`text-xl font-black ${
                                (activeAnalysis.analysis.overall_score ?? 0) >= 75
                                  ? 'text-emerald-400'
                                  : (activeAnalysis.analysis.overall_score ?? 0) >= 50
                                  ? 'text-sky-400'
                                  : (activeAnalysis.analysis.overall_score ?? 0) >= 30
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}>
                                {activeAnalysis.analysis.overall_score ?? 0}
                                <span className="text-xs text-zinc-500 font-semibold"> / 100</span>
                              </span>
                            </div>
                            <div className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center font-black text-lg ${
                              (activeAnalysis.analysis.overall_score ?? 0) >= 75
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : (activeAnalysis.analysis.overall_score ?? 0) >= 50
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                : (activeAnalysis.analysis.overall_score ?? 0) >= 30
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            }`}>
                              {activeAnalysis.analysis.overall_score ?? 0}
                            </div>
                          </div>
                        </div>

                        {/* Summary */}
                        {activeAnalysis.analysis.summary && (
                          <div className="p-3 bg-zinc-900/90 rounded-2xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                            <span className="font-bold text-zinc-200 block mb-1">Executive Summary:</span>
                            {activeAnalysis.analysis.summary}
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
                              {activeAnalysis.metrics?.words_per_minute || 140} <span className="text-xs font-normal text-zinc-400">WPM</span>
                            </div>
                            <div className="text-[10px] text-emerald-400 font-medium truncate mt-0.5">
                              {activeAnalysis.metrics?.pace_rating || 'Optimal Cadence'}
                            </div>
                          </div>

                          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                            <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center justify-center gap-1">
                              <Zap size={12} className="text-sky-400" />
                              <span>Filler Frequency</span>
                            </div>
                            <div className="text-base font-black text-white mt-1">
                              {activeAnalysis.metrics?.filler_percentage !== undefined ? `${activeAnalysis.metrics.filler_percentage}%` : '1.8%'}
                            </div>
                            <div className="text-[10px] text-sky-400 font-medium truncate mt-0.5">
                              {activeAnalysis.metrics?.filler_count || 0} filler words detected
                            </div>
                          </div>

                          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                            <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center justify-center gap-1">
                              <Award size={12} className="text-purple-400" />
                              <span>Lexical Variety</span>
                            </div>
                            <div className="text-base font-black text-white mt-1">
                              {activeAnalysis.metrics?.lexical_diversity || 0.54} <span className="text-xs font-normal text-zinc-400">TTR</span>
                            </div>
                            <div className="text-[10px] text-purple-400 font-medium truncate mt-0.5">
                              {activeAnalysis.metrics?.vocabulary_rating || 'Rich Lexicon'}
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
                              { label: 'Relevance', val: activeAnalysis.analysis.relevance_score ?? 7.5 },
                              { label: 'Substance', val: activeAnalysis.analysis.substance_score ?? 7.0 },
                              { label: 'Clarity', val: activeAnalysis.analysis.clarity_score ?? 7.5 },
                              { label: 'Structure', val: activeAnalysis.analysis.structure_score ?? 7.0 },
                              { label: 'Vocabulary', val: activeAnalysis.analysis.vocabulary_score ?? 7.5 },
                              { label: 'Confidence', val: activeAnalysis.analysis.confidence_score ?? 7.0 },
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
                          {activeAnalysis.analysis.key_strengths && activeAnalysis.analysis.key_strengths.length > 0 && (
                            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-900/40">
                              <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                                <CheckCircle2 size={13} />
                                <span>Key Strengths</span>
                              </div>
                              <ul className="space-y-1 text-zinc-300 list-disc list-inside text-[11px]">
                                {activeAnalysis.analysis.key_strengths.map((str, i) => (
                                  <li key={i}>{str}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {activeAnalysis.analysis.areas_for_improvement && activeAnalysis.analysis.areas_for_improvement.length > 0 && (
                            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-900/40">
                              <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                                <AlertCircle size={13} />
                                <span>Areas for Growth</span>
                              </div>
                              <ul className="space-y-1 text-zinc-300 list-disc list-inside text-[11px]">
                                {activeAnalysis.analysis.areas_for_improvement.map((area, i) => (
                                  <li key={i}>{area}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Full Transcript Accordion */}
                        {activeAnalysis.transcript && activeAnalysis.transcript.length > 0 && (
                          <div className="border border-zinc-800 rounded-2xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                              className="w-full p-3 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-200 transition cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <FileText size={14} className="text-zinc-400" />
                                <span>View Spoken Q&A Transcript ({activeAnalysis.transcript.length} turns)</span>
                              </span>
                              {isTranscriptExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isTranscriptExpanded && (
                              <div className="p-3 bg-zinc-950/90 space-y-2.5 max-h-72 overflow-y-auto border-t border-zinc-800 text-xs">
                                {activeAnalysis.transcript.map((t, idx) => {
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
                    );
                  })()}
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

      {/* Final Hiring Decision Modal (Accept & Onboard / Reject) */}
      {isDecisionModalOpen && decisionCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-zinc-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
                    decisionType === 'Accepted'
                      ? 'bg-emerald-500 text-zinc-950 font-black'
                      : 'bg-rose-500 text-white font-bold'
                  }`}
                >
                  {decisionType === 'Accepted' ? (
                    <UserCheck size={24} strokeWidth={2.5} />
                  ) : (
                    <UserX size={24} strokeWidth={2.5} />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-950 tracking-tight">
                    {decisionType === 'Accepted' ? 'Final Accept & Onboard Candidate' : 'Confirm Candidate Rejection'}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {decisionType === 'Accepted'
                      ? 'Onboard candidate to company & notify Super Admin'
                      : 'Super Admin will be notified of this hiring decision'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDecisionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center cursor-pointer transition shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Candidate Card Summary */}
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-zinc-900">{decisionCandidate.candidate_name}</span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-zinc-200/80 text-zinc-800 font-semibold">
                  {decisionCandidate.candidate_id || 'ID will be generated'}
                </span>
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-1.5 truncate">
                <span>{decisionCandidate.candidate_email}</span>
                <span>·</span>
                <strong className="text-zinc-700 font-semibold">{decisionCandidate.requisition_title}</strong>
              </div>
            </div>

            {/* For Accepted: Show Automated Onboarding Sequence */}
            {decisionType === 'Accepted' && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-emerald-600" />
                  <span>Automated Onboarding Sequence</span>
                </div>
                <ul className="text-xs space-y-1.5 text-emerald-900">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Assigns formal Candidate ID (<code className="font-mono font-bold text-emerald-800">{decisionCandidate.candidate_id || 'CND-XXXX'}</code>)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Initializes 8-gate activation checklist (PAN/Aadhaar/Bank, NDA/IP, BGV, Laptop)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Generates draft Work Order agreement</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Dispatches instant notification to Super Admin</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Candidate immediately surfaces under Accepted Candidates</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Remarks / Notes textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">
                {decisionType === 'Accepted' ? 'Hiring Remarks / Offer Notes (Optional)' : 'Rejection Reason / Notes (Optional)'}
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionType === 'Accepted'
                    ? 'e.g. Recommended for immediate onboarding. Cleared AI and company rounds with high communication ratings.'
                    : 'e.g. Not a cultural fit / skills gap.'
                }
                className="w-full p-3 rounded-2xl bg-white border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 resize-none shadow-2xs"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDecisionModalOpen(false)}
                disabled={submittingDecision}
                className="px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={submittingDecision}
                className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50 ${
                  decisionType === 'Accepted'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                }`}
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Processing Decision...</span>
                  </>
                ) : decisionType === 'Accepted' ? (
                  <>
                    <UserCheck size={15} />
                    <span>Confirm & Onboard to Company</span>
                  </>
                ) : (
                  <>
                    <UserX size={15} />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Instant Send Notes Modal */}
      {showInstantNotesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full text-white shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Instant Shortlist Dispatch</h3>
                  <p className="text-[11px] text-zinc-400">Bypass 48-hour wait & deliver to Hiring Manager</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstantNotesModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="text-[11px] font-bold text-zinc-400 uppercase">Target Requisition</div>
                <div className="text-sm font-black text-white">{activeReqTitle}</div>
                <div className="text-[11px] text-emerald-400 font-medium">
                  {shortlistStatus?.shortlist_candidate_count ?? 1} candidates qualified by AI screening score
                </div>
              </div>
              <p className="leading-relaxed">
                Dispatching will immediately send in-app notifications and email summaries to the company hiring team and place the shortlisted candidates directly into their active review queue.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                Optional Notes for Hiring Manager
              </label>
              <textarea
                value={instantNotes}
                onChange={(e) => setInstantNotes(e.target.value)}
                placeholder="e.g. Here are the top candidates who cleared the technical AI screening interview with 80+ scores..."
                rows={3}
                className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowInstantNotesModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleInstantSendShortlist(instantNotes)}
                disabled={sendingShortlist}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Zap size={14} className="fill-current" />
                <span>{sendingShortlist ? 'Dispatching…' : '⚡ Dispatch to Hiring Manager Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
