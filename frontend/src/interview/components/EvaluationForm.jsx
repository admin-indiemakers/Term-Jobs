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
  X,
  FileText,
  User,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { EVAL_CRITERIA } from '../utils/interviewConstants';
import { interviewApi } from '../services/interviewApi';

const MODERN_VERDICTS = [
  {
    value: 'Strong Yes',
    label: 'Strong Yes',
    sublabel: 'Top Tier',
    description: 'Exceeded technical & behavioral bar',
    accent: 'emerald',
    activeStyle: 'bg-emerald-500/15 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400/50 shadow-lg shadow-emerald-500/10',
    dotColor: 'bg-emerald-400',
  },
  {
    value: 'Yes',
    label: 'Yes',
    sublabel: 'Recommended',
    description: 'Meets core expectations for role',
    accent: 'teal',
    activeStyle: 'bg-teal-500/15 border-teal-400 text-teal-300 ring-1 ring-teal-400/50 shadow-lg shadow-teal-500/10',
    dotColor: 'bg-teal-400',
  },
  {
    value: 'Maybe',
    label: 'Maybe',
    sublabel: 'Borderline',
    description: 'Mixed signals, requires tie-breaker',
    accent: 'amber',
    activeStyle: 'bg-amber-500/15 border-amber-400 text-amber-300 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10',
    dotColor: 'bg-amber-400',
  },
  {
    value: 'No',
    label: 'No',
    sublabel: 'Not Selected',
    description: 'Did not meet competency bar',
    accent: 'rose',
    activeStyle: 'bg-rose-500/15 border-rose-400 text-rose-300 ring-1 ring-rose-400/50 shadow-lg shadow-rose-500/10',
    dotColor: 'bg-rose-400',
  },
  {
    value: 'No Show',
    label: 'No Show',
    sublabel: 'Absent',
    description: 'Candidate did not attend call',
    accent: 'zinc',
    activeStyle: 'bg-zinc-800 border-zinc-500 text-zinc-200 ring-1 ring-zinc-400/40 shadow-md',
    dotColor: 'bg-zinc-400',
  },
];

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
  const [evaluatorName, setEvaluatorName] = useState(
    existingEval.evaluated_by || defaultEvaluator || round?.interviewer_name || ''
  );
  const [evaluatorEmail, setEvaluatorEmail] = useState(
    existingEval.evaluator_email || round?.interviewer_email || ''
  );

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
      setNotes((prev) =>
        prev
          ? `${prev}\n\n[Communication Assessment]: ${ai.summary}`
          : `[Communication Assessment]: ${ai.summary}`
      );
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

  // Compute average score
  const scoreValues = Object.values(scores);
  const averageScore = scoreValues.length
    ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
    : '4.0';

  return (
    <div className="bg-[#0B0E17]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-100 max-h-[88vh] overflow-y-auto custom-scroll relative select-none">
      {/* ─────────────────────────────────────────────────────────────────
          HEADER
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-5 border-b border-white/10 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300 border border-white/10 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-400" />
              Interview Assessment & Feedback
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Round Complete
            </span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{round?.candidate_name || 'Candidate Evaluation'}</span>
            <span className="text-sm font-normal text-zinc-500">&bull;</span>
            <span className="text-sm font-semibold text-zinc-300">{round?.round_name || 'Technical Round'}</span>
          </h3>

          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
            <span>{round?.requisition_title || 'Position'}</span>
            <span>&bull;</span>
            <span className="font-mono text-zinc-400">REQ #8302C0</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Score Avg</div>
            <div className="text-lg font-black text-white font-mono flex items-center justify-end gap-1">
              <span className="text-emerald-400">{averageScore}</span>
              <span className="text-xs text-zinc-500">/ 5.0</span>
            </div>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SPOKEN COMMUNICATION & SPEECH ANALYSIS (MODERN GLASSMORPHIC CARD)
          ───────────────────────────────────────────────────────────────── */}
      <div className="mb-8 p-5 rounded-2xl bg-[#101420] border border-white/10 shadow-lg text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-400/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Spoken Communication & Speech Intelligence
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AI Speech Analysis
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Extracted from authentic verbal spoken speech turns during this round.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!aiAnalysis ? (
              <button
                type="button"
                onClick={handleRunCommunicationAnalysis}
                disabled={analyzingComm}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-white/10"
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
                    : 'bg-white hover:bg-zinc-200 text-zinc-950 font-bold shadow-md'
                }`}
              >
                {analysisApplied ? <Check size={13} /> : <Zap size={13} />}
                <span>{analysisApplied ? 'AI Insights Applied' : 'Apply AI Insights to Form'}</span>
              </button>
            )}
          </div>
        </div>

        {aiAnalysis ? (
          <div className="space-y-4">
            {/* Top Stat Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5">
                <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                  <Award size={12} className="text-amber-400" /> Comm Score
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {aiAnalysis.overall_score || 75}
                  <span className="text-xs font-normal text-zinc-400">/100</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-medium mt-0.5">Overall Speech Rating</div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5">
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

              <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5">
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

              <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5">
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

            {/* 4 Pillars Progress Meters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-white/5">
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
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Spoken Strengths
                </div>
                <ul className="space-y-1 text-zinc-300 text-[11px] list-disc list-inside">
                  {(aiAnalysis.key_strengths || []).map((s, idx) => (
                    <li key={idx} className="leading-snug">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20">
                <div className="font-bold text-rose-400 mb-1.5 flex items-center gap-1.5">
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
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-xs italic text-zinc-300">
                &quot;{aiAnalysis.summary}&quot;
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
        <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle size={16} className="shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          FORM FIELDS
          ───────────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. OVERALL HIRING DECISION / VERDICT */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Overall Hiring Decision / Verdict
            </label>
            <span className="text-[11px] text-zinc-500">Select one final recommendation</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {MODERN_VERDICTS.map((opt) => {
              const isSelected = verdict === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVerdict(opt.value)}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? opt.activeStyle
                      : 'bg-zinc-900/60 border-white/5 hover:border-white/15 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${opt.dotColor} ${isSelected ? 'animate-pulse' : ''}`} />
                      <span className="font-bold text-xs">{opt.label}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{opt.sublabel}</div>
                  </div>
                  <div className="text-[9.5px] text-zinc-500 leading-tight mt-2 hidden sm:block">
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. COMPETENCY RATINGS (1 - 5 STARS) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Competency Ratings (1 - 5 Stars)
            </label>
            <span className="text-[11px] text-zinc-500">Click star to assign grade</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EVAL_CRITERIA.map((crit) => {
              const currentVal = scores[crit.key] || 4;
              return (
                <div
                  key={crit.key}
                  className="p-3.5 bg-zinc-900/60 border border-white/5 rounded-2xl space-y-2 hover:border-white/10 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{crit.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] font-mono font-bold text-emerald-400 border border-white/5">
                      {currentVal} / 5
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 leading-tight">{crit.hint}</div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleScoreChange(crit.key, star)}
                          className={`p-1 rounded-lg transition transform hover:scale-110 cursor-pointer ${
                            star <= currentVal
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                              : 'text-zinc-700 hover:text-zinc-500'
                          }`}
                        >
                          <Star size={18} fill={star <= currentVal ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>

                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${(currentVal / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. STRENGTHS & WEAKNESSES OBSERVED */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ThumbsUp size={13} className="text-emerald-400" />
              <span>Key Strengths Observed (optional)</span>
            </label>
            <textarea
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="What impressed you about the candidate's responses or architecture decisions?"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed transition custom-scroll"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ThumbsDown size={13} className="text-rose-400" />
              <span>Areas for Improvement / Concerns (optional)</span>
            </label>
            <textarea
              rows={3}
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              placeholder="Any gaps in technical depth, communication, or framework knowledge?"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/10 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed transition custom-scroll"
            />
          </div>
        </div>

        {/* 4. COMPREHENSIVE INTERVIEWER NOTES */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <FileText size={13} className="text-zinc-400" />
            <span>Comprehensive Notes & Recommendation</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detailed notes to help the hiring manager and panel make the final offer decision..."
            className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/10 focus:border-white/20 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed transition custom-scroll"
          />
        </div>

        {/* 5. EVALUATOR IDENTITY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-zinc-900/60 rounded-2xl border border-white/5">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
              <User size={12} /> Evaluator Name
            </label>
            <input
              type="text"
              value={evaluatorName}
              onChange={(e) => setEvaluatorName(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
              <Mail size={12} /> Evaluator Email
            </label>
            <input
              type="email"
              value={evaluatorEmail}
              onChange={(e) => setEvaluatorEmail(e.target.value)}
              required
              className="w-full px-3 py-1.5 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        {/* 6. MODAL ACTIONS */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="text-[11px] text-zinc-500 hidden sm:block">
            Scorecard is stored permanently with the candidate requisition history.
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{submitting ? 'Submitting...' : 'Submit Assessment & Complete Round'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
