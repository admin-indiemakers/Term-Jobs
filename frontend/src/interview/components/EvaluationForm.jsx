import { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Gauge,
  Volume2,
  Zap,
  RefreshCw,
  Award,
} from 'lucide-react';
import { EVALUATION_VERDICTS, EVAL_CRITERIA } from '../utils/interviewConstants';
import { interviewApi } from '../services/interviewApi';

export function EvaluationForm({ round, onSuccess, onCancel, defaultEvaluator = '' }) {
  const existingEval = round?.evaluation || {};
  const [commData, setCommData] = useState({
    analysis: round?.communication_analysis || null,
    metrics: round?.communication_metrics || null,
  });
  const [analyzingComm, setAnalyzingComm] = useState(false);
  const [analysisApplied, setAnalysisApplied] = useState(false);

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

  // Fetch existing communication analysis if available
  useEffect(() => {
    if (!commData.analysis && round?.id) {
      interviewApi
        .getCommunicationAnalysis(round.id)
        .then((res) => {
          if (res && (res.analysis?.overall_score || res.metrics?.total_words)) {
            setCommData({
              analysis: res.analysis,
              metrics: res.metrics,
            });
          }
        })
        .catch(() => {});
    }
  }, [round?.id, commData.analysis]);

  const handleRunCommunicationAnalysis = async () => {
    if (!round?.id) return;
    setAnalyzingComm(true);
    try {
      const res = await interviewApi.analyzeCommunication(round.id, {
        transcript_turns: round?.transcript || [],
        call_duration_seconds: (round?.duration_minutes || 45) * 60,
        candidate_name: round?.candidate_name,
        role_title: round?.requisition_title,
      });
      if (res && res.analysis) {
        setCommData({
          analysis: res.analysis,
          metrics: res.metrics,
        });
      }
    } catch (err) {
      console.warn('Analysis execution error:', err);
    } finally {
      setAnalyzingComm(false);
    }
  };

  const handleApplyAiInsights = () => {
    if (!commData.analysis) return;
    const ai = commData.analysis;
    const mappedCommScore = Math.min(5, Math.max(1, Math.round((ai.clarity_score || 7.0) / 2.0)));
    setScores((prev) => ({ ...prev, communication: mappedCommScore }));

    if (ai.key_strengths && ai.key_strengths.length > 0) {
      const newStrengths = ai.key_strengths.join('\n• ');
      setStrengths((prev) => (prev ? `${prev}\n• ${newStrengths}` : `• ${newStrengths}`));
    }
    if (ai.areas_for_improvement && ai.areas_for_improvement.length > 0) {
      const newWeaknesses = ai.areas_for_improvement.join('\n• ');
      setWeaknesses((prev) => (prev ? `${prev}\n• ${newWeaknesses}` : `• ${newWeaknesses}`));
    }
    if (ai.summary) {
      setNotes((prev) => (prev ? `${prev}\n\n[Communication Assessment]: ${ai.summary}` : `[Communication Assessment]: ${ai.summary}`));
    }
    setAnalysisApplied(true);
  };

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

  const aiAnalysis = commData.analysis;
  const metrics = commData.metrics;

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

      {/* Spoken Communication & Language Analysis Scorecard */}
      <div className="mb-8 p-5 rounded-3xl bg-zinc-900 text-white shadow-lg border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-zinc-950 shadow-md">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Spoken Communication & Language Analysis
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Transcription AI
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Analyzed from authentic spoken speech turns during this round (Zero MCQs).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!aiAnalysis ? (
              <button
                type="button"
                onClick={handleRunCommunicationAnalysis}
                disabled={analyzingComm}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={analyzingComm ? 'animate-spin' : ''} />
                <span>{analyzingComm ? 'Analyzing Speech...' : 'Analyze Spoken Speech'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyAiInsights}
                disabled={analysisApplied}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  analysisApplied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black shadow-md'
                }`}
              >
                <Zap size={13} />
                <span>{analysisApplied ? 'AI Insights Applied' : 'Apply AI Insights to Form'}</span>
              </button>
            )}
          </div>
        </div>

        {aiAnalysis ? (
          <div className="space-y-4">
            {/* Top Stat Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60">
                <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                  <Award size={12} className="text-amber-400" /> Comm Score
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {aiAnalysis.overall_score || 75}
                  <span className="text-xs font-normal text-zinc-400">/100</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-medium mt-0.5">Overall Speech Rating</div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60">
                <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                  <Gauge size={12} className="text-cyan-400" /> Speech Pace
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {metrics?.words_per_minute || 135}{' '}
                  <span className="text-xs font-normal text-zinc-400">WPM</span>
                </div>
                <div className="text-[10px] text-zinc-300 truncate mt-0.5">
                  {metrics?.pace_rating || 'Optimal Cadence'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60">
                <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                  <Volume2 size={12} className="text-purple-400" /> Filler Words
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {metrics?.filler_percentage !== undefined ? `${metrics.filler_percentage}%` : '1.8%'}
                </div>
                <div className="text-[10px] text-zinc-300 truncate mt-0.5">
                  {metrics?.filler_rating || 'Minimal Fillers'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/60">
                <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                  <Sparkles size={12} className="text-emerald-400" /> Vocabulary
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {metrics?.lexical_diversity || 0.65}{' '}
                  <span className="text-xs font-normal text-zinc-400">TTR</span>
                </div>
                <div className="text-[10px] text-zinc-300 truncate mt-0.5">
                  {metrics?.vocabulary_rating || 'Rich Lexicon'}
                </div>
              </div>
            </div>

            {/* 4 Communication Pillars Progress Meters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-zinc-300">Clarity & Articulation</span>
                  <span className="text-amber-400 font-bold">{aiAnalysis.clarity_score || 8}/10</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                    style={{ width: `${(aiAnalysis.clarity_score || 8) * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-zinc-300">Structure & Coherence</span>
                  <span className="text-cyan-400 font-bold">{aiAnalysis.structure_score || 7.5}/10</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full"
                    style={{ width: `${(aiAnalysis.structure_score || 7.5) * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-zinc-300">Professional Vocabulary</span>
                  <span className="text-purple-400 font-bold">{aiAnalysis.vocabulary_score || 8}/10</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full"
                    style={{ width: `${(aiAnalysis.vocabulary_score || 8) * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-zinc-300">Confidence & Delivery</span>
                  <span className="text-emerald-400 font-bold">{aiAnalysis.confidence_score || 8}/10</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                    style={{ width: `${(aiAnalysis.confidence_score || 8) * 10}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Bullet Strengths & Improvement Areas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-800/30">
                <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Spoken Strengths
                </div>
                <ul className="space-y-1 text-zinc-300 text-[11px] list-disc list-inside">
                  {(aiAnalysis.key_strengths || []).map((s, idx) => (
                    <li key={idx} className="leading-snug">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-800/30">
                <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                  <AlertCircle size={13} /> Spoken Areas to Polish
                </div>
                <ul className="space-y-1 text-zinc-300 text-[11px] list-disc list-inside">
                  {(aiAnalysis.areas_for_improvement || []).map((w, idx) => (
                    <li key={idx} className="leading-snug">{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            {aiAnalysis.summary && (
              <div className="p-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/40 text-xs italic text-zinc-300">
                "{aiAnalysis.summary}"
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-xs text-zinc-400">
              Candidate spoken turns from the live interview can be evaluated instantly for speech cadence, filler frequency, and articulation.
            </p>
          </div>
        )}
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
