import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { interviewApi } from '../services/interviewApi';
import { InterviewRoom } from '../components/InterviewRoom';
import { AiInterviewRoom } from '../components/AiInterviewRoom';
import { InterviewReviewPanel } from '../components/InterviewReviewPanel';
import { InterviewCompletedCard } from '../components/InterviewCompletedCard';
import { mergeInterviewResult, isAiInterviewRound } from '../utils/interviewMode';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';

export function InterviewMeetingRoomPage() {
  const { roundId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [candidateLeft, setCandidateLeft] = useState(false);
  const { token: accountToken, loading: authLoading, user } = useAuth();
  const [joinIdentity, setJoinIdentity] = useState(null);

  const loggedInUser = user || (() => {
    try {
      const s = localStorage.getItem('auth_user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })();

  const queryRole = joinIdentity?.role || searchParams.get('role') || (loggedInUser?.role ? 'interviewer' : 'candidate');
  const queryName =
    joinIdentity?.name ||
    searchParams.get('name') ||
    (queryRole === 'candidate'
      ? round?.candidate_name || 'Candidate'
      : loggedInUser?.name || round?.interviewer_name || 'Interviewer');
  const invitationToken = searchParams.get('token') || '';

  useEffect(() => {
    const isAi =
      window.location.pathname.startsWith('/interview/ai') ||
      isAiInterviewRound(round) ||
      round?.round_type === 'AI' ||
      /AI/i.test(String(round?.round_name || ''));
    if (round?.status === 'Completed' || candidateLeft) {
      document.title = isAi ? 'AI Interview Completed · TermJobs' : 'Interview Completed · TermJobs';
    } else if (isAi) {
      document.title = 'AI Interview · TermJobs';
    } else {
      document.title = 'Interview Room · TermJobs';
    }
  }, [round, candidateLeft]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setErrorMsg('');
    setRound(null);
    setJoinIdentity(null);
    if (!roundId) {
      setErrorMsg('No interview round ID provided.');
      setLoading(false);
      return;
    }

    interviewApi
      .getRoundDetail(roundId)
      .then(async (res) => {
        if (res) {
          const isLiveOrActive = res.status === 'In Progress' || res.status === 'Live' || res.status === 'Upcoming' || res.round_type === 'AI';
          if (accountToken || invitationToken || searchParams.get('role') === 'interviewer') {
            try {
              const identity = await request(`/api/interviews/rounds/${roundId}/join-identity?token=${encodeURIComponent(invitationToken)}`, { token: accountToken, noCache: true });
              setJoinIdentity(identity);
              if (res.is_expired && !isLiveOrActive && res.status !== 'Completed' && identity?.role !== 'interviewer') {
                setErrorMsg('This interview link has expired. Please request a new interview invitation.');
              }
            } catch (idErr) {
              // If join-identity check fails, fallback to query role
              console.warn('[Meeting Room] Identity resolution fallback:', idErr);
            }
          } else if (res.is_expired && !isLiveOrActive && res.status !== 'Completed') {
            setErrorMsg('This interview link has expired. Please request a new interview invitation.');
          }
          setRound(res);
        } else {
          setErrorMsg('Interview round not found.');
        }
      })
      .catch((err) => {
        setErrorMsg(err?.message || 'Failed to load interview room.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [roundId, accountToken, invitationToken, authLoading]);

  const handleLeave = () => {
    if (queryRole === 'interviewer') {
      navigate(-1);
    } else {
      setCandidateLeft(true);
      if (round?.id && round?.status !== 'Completed') {
        interviewApi.updateRoundStatus(round.id, 'Completed').catch(() => {});
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#0A0A0A] text-white flex items-center justify-center text-sm font-semibold">
        Connecting to encrypted interview room...
      </div>
    );
  }

  // Display Interview Completed screen matching Image 2
  const isAlreadyAttended = round?.status === 'Completed' && queryRole === 'candidate';

  if (isAlreadyAttended || candidateLeft) {
    return <InterviewCompletedCard round={round} invitationToken={invitationToken} />;
  }

  if (!errorMsg && round && joinIdentity?.role === 'interviewer' && (round.status === 'Completed' || round.is_expired)) {
    return <main className="min-h-screen bg-gray-50 p-6"><button className="mb-4 text-sm underline" onClick={() => navigate(-1)}>Back to interviews</button><InterviewReviewPanel round={round} candidateName={round.candidate_name} /></main>;
  }
  const isLiveOrActiveRound = round?.status === 'In Progress' || round?.status === 'Live' || round?.status === 'Upcoming' || round?.round_type === 'AI';
  const isExpired = !isLiveOrActiveRound && (errorMsg?.toLowerCase().includes('expired') || (round?.is_expired && round?.status !== 'Completed' && joinIdentity?.role !== 'interviewer'));

  if (isExpired) {
    return (
      <div className="w-full h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <Clock size={28} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Interview Link Expired</h2>
        <p className="text-xs text-zinc-400 mb-6 max-w-sm leading-relaxed">
          Interview links and access passcodes are valid for <strong>10 hours</strong> from delivery. This access window has ended.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/interview/candidate')}
            className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Go to Candidate Portal
          </button>
        </div>
      </div>
    );
  }

  if (errorMsg || !round) {
    return (
      <div className="w-full h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-xl font-bold text-rose-500 mb-2">Room Error</h2>
        <p className="text-xs text-zinc-400 mb-6 max-w-sm">{errorMsg || 'Could not join interview room.'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isAiRoute = window.location.pathname.startsWith('/interview/ai');
  const isPeerRoute = window.location.pathname.startsWith('/interview/room');
  const Room = isAiRoute ? AiInterviewRoom : isPeerRoute ? InterviewRoom : (isAiInterviewRound(round) ? AiInterviewRoom : InterviewRoom);
  return (
    <Room
      round={round}
      currentUserRole={queryRole}
      currentUserName={queryName}
      onLeave={handleLeave}
      onEvaluationComplete={(updated) => {
        setRound(previous => mergeInterviewResult(previous, updated));
      }}
    />
  );
}
