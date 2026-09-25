import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { interviewApi } from '../services/interviewApi';
import { InterviewRoom } from '../components/InterviewRoom';

export function InterviewMeetingRoomPage() {
  const { roundId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const queryRole = searchParams.get('role') || 'candidate';
  const queryName = searchParams.get('name') || (queryRole === 'candidate' ? 'Candidate' : 'Interviewer');

  useEffect(() => {
    if (!roundId) {
      setErrorMsg('No interview round ID provided.');
      setLoading(false);
      return;
    }

    interviewApi
      .getRoundDetail(roundId)
      .then((res) => {
        if (res) {
          if (res.status !== 'Completed' && res.is_expired) {
            setErrorMsg('This AI interview link has expired after 10 hours. Please request a new interview invitation.');
          } else {
            setRound(res);
          }
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
  }, [roundId]);

  const handleLeave = () => {
    if (queryRole === 'interviewer') {
      navigate(-1);
    } else {
      navigate('/interview/candidate');
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#0A0A0A] text-white flex items-center justify-center text-sm font-semibold">
        Connecting to encrypted interview room...
      </div>
    );
  }

  // Single-attempt security lock: If a candidate has already attended and completed the interview, lock re-entry
  const isAlreadyAttended = round?.status === 'Completed' && queryRole === 'candidate';

  if (isAlreadyAttended) {
    return (
      <div className="w-full min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans relative overflow-hidden">
        {/* Ambient subtle glow background */}
        <div className="absolute w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none -top-20 -left-20" />
        <div className="absolute w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none -bottom-20 -right-20" />

        <div className="max-w-md w-full bg-[#111113] border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-left">
          {/* Top Status Icon & Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.25)]">
              <CheckCircle2 size={30} />
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-wide uppercase">
              Submitted & Locked
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
            Interview Already Attended
          </h2>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            You have already completed and submitted your AI interview for this role. Under TermJobs verification security, <strong className="text-zinc-200">only one interview attempt is permitted</strong>.
          </p>

          {/* Details Card */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4.5 space-y-3 mb-6">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
              <span className="text-zinc-500">Candidate</span>
              <span className="font-semibold text-zinc-200">{round?.candidate_name || queryName}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
              <span className="text-zinc-500">Position</span>
              <span className="font-semibold text-zinc-200">{round?.requisition_title || round?.round_name || 'Assigned Role'}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
              <span className="text-zinc-500">Interview Status</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Submitted · Under Review
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Session Verification</span>
              <span className="font-mono text-[11px] text-zinc-400">Archived & Evaluated</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/interview/candidate')}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 cursor-pointer text-center"
            >
              Candidate Portal
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto py-3 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition cursor-pointer text-center"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = errorMsg?.toLowerCase().includes('expired') || (round?.is_expired && round?.status !== 'Completed');

  if (isExpired) {
    return (
      <div className="w-full h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <Clock size={28} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Interview Link Expired</h2>
        <p className="text-xs text-zinc-400 mb-6 max-w-sm leading-relaxed">
          AI interview links and passcodes are strictly valid for <strong>10 hours</strong> from delivery. This access window has ended.
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

  return (
    <InterviewRoom
      round={round}
      currentUserRole={queryRole}
      currentUserName={queryName}
      onLeave={handleLeave}
      onEvaluationComplete={(updated) => {
        setRound(updated);
      }}
    />
  );
}
