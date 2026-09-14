import { useState } from 'react';
import { Star, CheckCircle2, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { EVALUATION_VERDICTS, EVAL_CRITERIA } from '../utils/interviewConstants';
import { interviewApi } from '../services/interviewApi';

export function EvaluationForm({ round, onSuccess, onCancel, defaultEvaluator = '' }) {
  const existingEval = round?.evaluation || {};

  const [verdict, setVerdict] = useState(existingEval.result || 'Yes');
  const [scores, setScores] = useState(
    existingEval.scores || {
      technical: 4,
      communication: 4,
      problem_solving: 4,
      culture: 4,
    }
  );
  const [strengths, setStrengths] = useState(existingEval.strengths || '');
  const [weaknesses, setWeaknesses] = useState(existingEval.weaknesses || '');
  const [notes, setNotes] = useState(existingEval.notes || '');
  const [evaluatorName, setEvaluatorName] = useState(existingEval.evaluated_by || defaultEvaluator || round?.interviewer_name || '');
  const [evaluatorEmail, setEvaluatorEmail] = useState(existingEval.evaluator_email || round?.interviewer_email || '');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleScoreChange = (criteriaKey, val) => {
    setScores((prev) => ({
      ...prev,
      [criteriaKey]: val,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!verdict) {
      setErrorMsg('Please choose an overall verdict for the candidate.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        result: verdict,
        scores,
        strengths: strengths.trim(),
        weaknesses: weaknesses.trim(),
        notes: notes.trim(),
        evaluator_name: evaluatorName.trim(),
        evaluator_email: evaluatorEmail.trim(),
      };

      const updated = await interviewApi.submitEvaluation(round.id, payload);
      if (updated && onSuccess) {
        onSuccess(updated);
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Interview Assessment & Feedback
          </div>
          <h3 className="text-lg font-bold text-zinc-950 mt-0.5">
            {round?.round_name || 'Interview Round'} · {round?.candidate_name}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Requisition</div>
          <div className="text-xs font-semibold text-zinc-800">{round?.requisition_title || 'Position'}</div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-sm text-rose-700">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Overall Verdict Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-2">
            Overall Hiring Decision / Verdict
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {EVALUATION_VERDICTS.map((opt) => {
              const isSelected = verdict === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVerdict(opt.value)}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    isSelected
                      ? `${opt.color} shadow-md ring-2 ring-zinc-950/20`
                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800'
                  }`}
                >
                  <div className="font-bold text-xs leading-tight">{opt.label}</div>
                  <div className={`text-[10px] mt-1 leading-snug ${isSelected ? 'text-white/90' : 'text-zinc-500'}`}>
                    {opt.value === 'Strong Yes' ? 'Top Tier' : opt.value === 'Yes' ? 'Recommended' : opt.value}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Competency Ratings */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-2">
            Competency Ratings (1 - 5 Stars)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EVAL_CRITERIA.map((crit) => {
              const currentVal = scores[crit.key] || 3;
              return (
                <div key={crit.key} className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-zinc-800">{crit.label}</span>
                    <span className="text-xs font-mono font-bold text-zinc-900">{currentVal} / 5</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-2.5">{crit.hint}</div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleScoreChange(crit.key, star)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          star <= currentVal
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-zinc-300 hover:text-zinc-400'
                        }`}
                      >
                        <Star size={18} fill={star <= currentVal ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1.5 flex items-center gap-1">
              <ThumbsUp size={13} className="text-emerald-600" /> Key Strengths Observed
            </label>
            <textarea
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="What impressed you about the candidate's responses or architecture decisions?"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1.5 flex items-center gap-1">
              <ThumbsDown size={13} className="text-rose-600" /> Areas for Improvement / Concerns
            </label>
            <textarea
              rows={3}
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              placeholder="Any gaps in technical depth, communication, or framework knowledge?"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-xs"
            />
          </div>
        </div>

        {/* Detailed Feedback Notes */}
        <div>
          <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
            Comprehensive Interviewer Notes & Recommendation
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detailed notes to help the Hiring Manager make the final call..."
            className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950 text-xs"
          />
        </div>

        {/* Evaluator Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Evaluator Name</label>
            <input
              type="text"
              value={evaluatorName}
              onChange={(e) => setEvaluatorName(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-white rounded-xl border border-zinc-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Evaluator Email</label>
            <input
              type="email"
              value={evaluatorEmail}
              onChange={(e) => setEvaluatorEmail(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-white rounded-xl border border-zinc-300 text-xs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 size={15} />
            <span>{submitting ? 'Submitting...' : 'Submit Assessment & Complete Round'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
