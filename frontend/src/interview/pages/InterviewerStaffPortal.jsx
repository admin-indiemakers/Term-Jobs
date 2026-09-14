import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Video,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  Award,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { interviewApi } from '../services/interviewApi';
import { EvaluationForm } from '../components/EvaluationForm';
import { EVALUATION_VERDICTS } from '../utils/interviewConstants';

export function InterviewerStaffPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [staffToken, setStaffToken] = useState(searchParams.get('token') || '');
  const [staffEmail, setStaffEmail] = useState(searchParams.get('email') || '');
  const [rounds, setRounds] = useState([]);
  const [activeFilter, setActiveFilter] = useState('upcoming'); // 'upcoming' | 'in_progress' | 'completed' | 'all'
  const [selectedRound, setSelectedRound] = useState(null);
  const [evaluatingRound, setEvaluatingRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const t = searchParams.get('token');
    const e = searchParams.get('email');
    if (t) setStaffToken(t);
    if (e) setStaffEmail(e);

    loadStaffRounds(t, e);
  }, [searchParams]);

  const loadStaffRounds = async (tokenVal, emailVal) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await interviewApi.getStaffPortal({
        token: tokenVal || undefined,
        email: emailVal || undefined,
      });

      if (res && res.rounds) {
        setRounds(res.rounds);
        if (res.rounds.length > 0) {
          setSelectedRound(res.rounds[0]);
        }
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Could not load your assigned interviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (round) => {
    if (!round) return;
    const interviewerName = round.interviewer_name || staffEmail || 'Interviewer';
    navigate(`/interview/room/${round.id}?role=interviewer&name=${encodeURIComponent(interviewerName)}`);
  };

  // Filter rounds according to tab
  const filteredRounds = rounds.filter((r) => {
    if (activeFilter === 'upcoming') return r.status === 'Scheduled';
    if (activeFilter === 'in_progress') return r.status === 'In Progress';
    if (activeFilter === 'completed') return r.status === 'Completed' || r.status === 'No Show';
    return true;
  });

  const counts = {
    upcoming: rounds.filter((r) => r.status === 'Scheduled').length,
    in_progress: rounds.filter((r) => r.status === 'In Progress').length,
    completed: rounds.filter((r) => r.status === 'Completed' || r.status === 'No Show').length,
    all: rounds.length,
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-zinc-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-zinc-200/80 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-xs font-black">
              TJ
            </div>
            <div>
              <span className="font-bold text-sm text-zinc-950">Term Jobs</span>
              <span className="text-zinc-400 mx-2">·</span>
              <span className="text-xs text-zinc-500 font-medium">Interviewer & Staff Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-full">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>{rounds[0]?.interviewer_name || staffEmail || 'Interviewer'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Card */}
        <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 mb-2">
                <User size={13} /> Staff Queue
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
                Assigned Candidate Interviews
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                Conduct live video rounds, communicate via encrypted chat, and record candidate assessments.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
              <button
                type="button"
                onClick={() => setActiveFilter('upcoming')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeFilter === 'upcoming' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                Upcoming ({counts.upcoming})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('in_progress')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeFilter === 'in_progress' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                In Progress ({counts.in_progress})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeFilter === 'completed' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                Completed ({counts.completed})
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Two-Column Queue & Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Candidate List (Queue) */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-400 bg-white rounded-3xl border border-zinc-200">
                Loading assigned interviews...
              </div>
            ) : filteredRounds.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 bg-white rounded-3xl border border-zinc-200">
                No interviews in this queue.
              </div>
            ) : (
              filteredRounds.map((round) => {
                const isSelected = selectedRound?.id === round.id;
                const isCompleted = round.status === 'Completed';
                const evalVerdict = round.evaluation?.result;
                const verdictMeta = EVALUATION_VERDICTS.find((v) => v.value === evalVerdict);

                return (
                  <div
                    key={round.id}
                    onClick={() => setSelectedRound(round)}
                    className={`p-5 rounded-3xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-lg'
                        : 'bg-white text-zinc-950 border-zinc-200 hover:border-zinc-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        Round {round.round_number || 1} · {round.round_type || 'Tech'}
                      </span>

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-zinc-800 text-zinc-200'
                            : isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : round.status === 'In Progress'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {round.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-base leading-tight mb-1">{round.candidate_name}</h3>
                    <div className={`text-xs truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {round.requisition_title || 'Software Engineering Role'}
                    </div>

                    <div className="mt-3 pt-3 border-t border-zinc-200/30 flex items-center justify-between text-xs">
                      <div className={`flex items-center gap-1.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        <Calendar size={13} />
                        <span>{round.scheduled_date || 'TBD'} · {round.scheduled_time || '--:--'}</span>
                      </div>

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

          {/* Selected Candidate & Action Panel */}
          <div className="lg:col-span-7">
            {selectedRound ? (
              <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs space-y-6 sticky top-24">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      {selectedRound.round_name} · Round {selectedRound.round_number || 1}
                    </div>
                    <h2 className="text-2xl font-extrabold text-zinc-950 tracking-tight">
                      {selectedRound.candidate_name}
                    </h2>
                    <div className="text-xs text-zinc-500 mt-1">
                      Candidate Email: <span className="text-zinc-900 font-medium">{selectedRound.candidate_email}</span>
                    </div>
                  </div>

                  {/* Primary Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleJoinRoom(selectedRound)}
                      className="px-5 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                    >
                      <Video size={16} />
                      <span>Join Room</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEvaluatingRound(selectedRound)}
                      className="px-4 py-3 rounded-2xl border border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Award size={16} className="text-amber-500" />
                      <span>Evaluate</span>
                    </button>
                  </div>
                </div>

                {/* Session Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200">
                    <div className="text-[11px] text-zinc-400 font-semibold">Scheduled Date</div>
                    <div className="text-xs font-bold text-zinc-900 mt-0.5">{selectedRound.scheduled_date || 'TBD'}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200">
                    <div className="text-[11px] text-zinc-400 font-semibold">Scheduled Time</div>
                    <div className="text-xs font-bold text-zinc-900 mt-0.5">{selectedRound.scheduled_time || '--:--'}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200">
                    <div className="text-[11px] text-zinc-400 font-semibold">Duration</div>
                    <div className="text-xs font-bold text-zinc-900 mt-0.5">{selectedRound.duration_minutes || 45} mins</div>
                  </div>
                </div>

                {/* Internal Notes / Instructions */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <FileText size={14} /> Internal Interviewer Notes & Rubric
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {selectedRound.internal_notes ||
                      'Please evaluate the candidate across problem-solving depth, architecture clarity, code quality, and team culture alignment.'}
                  </p>
                </div>

                {/* Completed Evaluation Summary (if evaluated) */}
                {selectedRound.evaluation && selectedRound.evaluation.result && (
                  <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 size={15} /> Submitted Evaluation
                      </span>
                      <span className="text-xs font-black px-2.5 py-1 bg-emerald-600 text-white rounded-lg">
                        {selectedRound.evaluation.result}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mb-3">
                      {selectedRound.evaluation.scores &&
                        Object.entries(selectedRound.evaluation.scores).map(([k, v]) => (
                          <div key={k} className="p-2 bg-white rounded-xl border border-emerald-200">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold truncate">{k}</div>
                            <div className="text-sm font-black text-zinc-900">{v} / 5</div>
                          </div>
                        ))}
                    </div>

                    {selectedRound.evaluation.notes && (
                      <p className="text-xs text-zinc-700 italic bg-white p-3 rounded-xl border border-emerald-200">
                        "{selectedRound.evaluation.notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-center p-8 bg-white rounded-3xl border border-zinc-200 text-zinc-400 text-xs">
                Select a candidate from the queue to view details and launch the interview room.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Post-Interview Evaluation Modal */}
      {evaluatingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="max-w-2xl w-full my-8">
            <EvaluationForm
              round={evaluatingRound}
              defaultEvaluator={evaluatingRound.interviewer_name || staffEmail}
              onSuccess={(updated) => {
                setEvaluatingRound(null);
                loadStaffRounds(staffToken, staffEmail);
              }}
              onCancel={() => setEvaluatingRound(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
