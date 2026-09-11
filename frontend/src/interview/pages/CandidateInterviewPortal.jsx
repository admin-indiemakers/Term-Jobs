import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  Briefcase,
  LogOut,
  Info,
} from 'lucide-react';
import { interviewApi } from '../services/interviewApi';
import { RoundTimeline } from '../components/RoundTimeline';

export function CandidateInterviewPortal() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('termjobs_candidate_session');
    if (!raw) {
      navigate('/interview/login', { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setSession(parsed);
      loadCandidateRounds(parsed);
    } catch (e) {
      navigate('/interview/login', { replace: true });
    }
  }, [navigate]);

  const loadCandidateRounds = async (sess) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await interviewApi.getCandidatePortal({
        token: sess.candidate_token,
        email: sess.candidate_email,
      });

      if (res && res.rounds) {
        setRounds(res.rounds);
        // Default to active or first round
        const active =
          res.rounds.find((r) => r.status === 'In Progress') ||
          res.rounds.find((r) => r.status === 'Scheduled') ||
          res.rounds[0];
        setSelectedRound(active);
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Could not load your interview schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('termjobs_candidate_session');
    navigate('/interview/login', { replace: true });
  };

  const handleJoinMeeting = (round) => {
    if (!round) return;
    navigate(`/interview/room/${round.id}?role=candidate&name=${encodeURIComponent(session?.candidate_name || 'Candidate')}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center text-sm font-semibold text-zinc-500">
        Loading your interview portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-zinc-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-zinc-200/80 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-xs font-black">
              TJ
            </div>
            <div>
              <span className="font-bold text-sm text-zinc-950">Term Jobs</span>
              <span className="text-zinc-400 mx-2">·</span>
              <span className="text-xs text-zinc-500">Candidate Interview Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{session?.candidate_name || 'Candidate'}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Job & Candidate Welcome Banner */}
        <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 mb-3">
                <Briefcase size={13} />
                <span>Job Requisition</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                {session?.requisition_title || selectedRound?.requisition_title || 'Software Engineering Role'}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                Candidate: <strong className="text-zinc-900">{session?.candidate_name}</strong> · {session?.candidate_email}
              </p>
            </div>

            <div className="sm:text-right">
              <div className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Interview Stages</div>
              <div className="text-lg font-extrabold text-zinc-950 mt-0.5">
                {rounds.filter((r) => r.status === 'Completed').length} of {rounds.length} Rounds Cleared
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Round Stepper & Timeline */}
        <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Interview Timeline & Rounds</h2>
            <span className="text-xs text-zinc-500">Click any round to view instructions</span>
          </div>

          <RoundTimeline
            rounds={rounds}
            activeRoundId={selectedRound?.id}
            onSelectRound={(r) => setSelectedRound(r)}
          />
        </div>

        {/* Selected Round Active Details & Join Card */}
        {selectedRound ? (
          <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-zinc-900 text-white">
                    Round {selectedRound.round_number || 1}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      selectedRound.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedRound.status === 'In Progress'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                        : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {selectedRound.status}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-950 tracking-tight">
                  {selectedRound.round_name}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 mt-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar size={14} className="text-zinc-400" />
                    <span>{selectedRound.scheduled_date || 'Date TBD'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock size={14} className="text-zinc-400" />
                    <span>
                      {selectedRound.scheduled_time || '--:--'} ({selectedRound.duration_minutes || 45} mins)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <User size={14} className="text-zinc-400" />
                    <span>
                      Interviewer: <strong>{selectedRound.interviewer_name || 'Assigned Lead'}</strong> ({selectedRound.interviewer_role || 'Staff'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Join Interview Button */}
              <div className="shrink-0">
                {selectedRound.status === 'Completed' ? (
                  <div className="px-5 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Round Completed</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleJoinMeeting(selectedRound)}
                    className="px-6 py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm flex items-center gap-2.5 transition shadow-md hover:shadow-lg cursor-pointer"
                  >
                    <Video size={18} />
                    <span>Join Live Interview Room</span>
                  </button>
                )}
              </div>
            </div>

            {/* Candidate Instructions & Preparation */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 mb-2">
                  <Info size={14} /> Candidate Instructions
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {selectedRound.instructions ||
                    'Please make sure you have a quiet environment with a working webcam, microphone, and stable internet connection.'}
                </p>
              </div>

              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 mb-2">
                  <ShieldCheck size={14} /> Audio/Video Preparation Check
                </div>
                <ul className="text-xs text-zinc-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Camera & microphone permissions will be prompted upon entry.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Screen sharing is supported directly inside the browser.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Real-time in-meeting chat is available for sharing code links.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-zinc-500 bg-white rounded-3xl border border-zinc-200">
            No active interview round selected.
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200/80 py-4 px-6 text-center text-xs text-zinc-400">
        Term Jobs Autonomous Workforce Platform · Encrypted Interview Session
      </footer>
    </div>
  );
}
