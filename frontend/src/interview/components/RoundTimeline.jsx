import { CheckCircle2, Clock, PlayCircle, XCircle, ChevronRight, User, Calendar } from 'lucide-react';
import { EVALUATION_VERDICTS } from '../utils/interviewConstants';

export function RoundTimeline({ rounds = [], activeRoundId, onSelectRound }) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-zinc-500 bg-zinc-50 rounded-2xl border border-zinc-200">
        No interview rounds have been scheduled yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4 no-scrollbar">
        {rounds.map((round, idx) => {
          const isSelected = activeRoundId === round.id;
          const isCompleted = round.status === 'Completed';
          const isInProgress = round.status === 'In Progress';
          const isCancelled = round.status === 'Cancelled';
          const isNoShow = round.status === 'No Show';

          const evalResult = round.evaluation?.result;
          const verdictMeta = EVALUATION_VERDICTS.find((v) => v.value === evalResult);

          return (
            <div key={round.id || idx} className="flex items-center flex-1 min-w-[200px]">
              <button
                type="button"
                onClick={() => onSelectRound && onSelectRound(round)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                    : isCompleted
                    ? 'bg-emerald-50/60 text-zinc-900 border-emerald-200 hover:border-emerald-300'
                    : isInProgress
                    ? 'bg-blue-50/60 text-zinc-900 border-blue-200 hover:border-blue-300'
                    : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-zinc-800 text-zinc-300'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isInProgress
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    Round {round.round_number || idx + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    {isCompleted ? (
                      <CheckCircle2 size={16} className={isSelected ? 'text-emerald-400' : 'text-emerald-600'} />
                    ) : isInProgress ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                      </span>
                    ) : isCancelled ? (
                      <XCircle size={16} className="text-rose-500" />
                    ) : (
                      <Clock size={15} className={isSelected ? 'text-zinc-400' : 'text-zinc-400'} />
                    )}
                  </div>
                </div>

                <div className="font-semibold text-sm truncate mb-1" title={round.round_name}>
                  {round.round_name}
                </div>

                <div className={`text-xs flex items-center gap-1.5 truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  <Calendar size={12} />
                  <span>{round.scheduled_date || 'TBD'} · {round.scheduled_time || '--:--'}</span>
                </div>

                {/* Verdict Badge if completed */}
                {isCompleted && evalResult && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200/60 flex items-center justify-between">
                    <span className="text-[10.5px] font-medium text-zinc-500">Verdict:</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        verdictMeta ? verdictMeta.badgeClass : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      {evalResult}
                    </span>
                  </div>
                )}
              </button>

              {idx < rounds.length - 1 && (
                <div className="px-1 text-zinc-300 hidden sm:block">
                  <ChevronRight size={18} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
