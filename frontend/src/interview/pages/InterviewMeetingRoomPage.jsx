import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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

  if (errorMsg || !round) {
    return (
      <div className="w-full h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-rose-500 mb-2">Room Error</h2>
        <p className="text-xs text-zinc-400 mb-6 max-w-sm">{errorMsg || 'Could not join interview room.'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition"
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
