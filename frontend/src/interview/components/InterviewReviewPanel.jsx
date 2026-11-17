import { SavedEvaluation } from './SavedEvaluation';
import { useEffect, useRef, useState } from 'react';
import { Award, Download, FileText, RefreshCw, Video, Eye, AlertTriangle, ShieldCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
import { interviewApi } from '../services/interviewApi';
import { assertReviewRound, isAuditableAssessment } from '../utils/reviewAssessment';

export function InterviewReviewPanel({ round, candidateName = 'Candidate' }) {
  const [report, setReport] = useState(null);
  const [mediaToken, setMediaToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [focusedQuestion, setFocusedQuestion] = useState(null);
  const transcriptRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null); setLoading(true); setError(''); setSearch(''); setVideoError(false); setFocusedQuestion(null);
    interviewApi.getCommunicationAnalysis(round.id)
      .then(data => {
        assertReviewRound(round.id, data);
        if (!cancelled) setReport(data);
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Unable to load interview review.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [round.id, retry]);

  useEffect(() => {
    let cancelled = false;
    setMediaToken('');
    const load = () => interviewApi.getRecordingAccess(round.id)
      .then(data => { if (!cancelled) setMediaToken(data.media_token); })
      .catch(() => { if (!cancelled) setMediaToken(''); });
    load();
    const refresh = setInterval(load, 8 * 60 * 1000);
    return () => { cancelled = true; clearInterval(refresh); };
  }, [round.id, retry]);

  const analysis = report?.analysis || round.communication_analysis || {};
  const scored = isAuditableAssessment(analysis);
  const savedScore = Number.isFinite(analysis.overall_score) ? analysis.overall_score : null;
  const turns = report?.transcript || round.transcript || [];
  const dictionary = analysis.competency_dictionary || {};
  const criteria = analysis.competencies || [];
  const questions = report?.questions || [];
  const recordingUrl = report?.recording_url || round.recording_url;
  const filteredTurns = turns.filter(turn => String(turn.text || '').toLowerCase().includes(search.toLowerCase()));
  const focusSummary = report?.focus_monitoring_summary || round.focus_monitoring_summary || {};
  const focusEvents = report?.focus_monitoring_events || round.focus_monitoring_events || [];
  const focusConsent = report?.focus_monitoring_consent || round.focus_monitoring_consent || {};

  const showEvidence = questionId => {
    setSearch(''); setFocusedQuestion(questionId);
    requestAnimationFrame(() => {
      const answer = [...(transcriptRef.current?.querySelectorAll('[data-question-id]') || [])]
        .find(element => element.dataset.questionId === questionId);
      (answer || transcriptRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const downloadTranscript = () => {
    const text = turns.map(turn => `${turn.speaker_name || turn.speaker}${turn.timestamp ? ` · ${turn.timestamp}` : ''}${turn.input_mode === 'typed_fallback' ? ' · Typed answer' : ''}\n${turn.text || ''}`).join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `interview-${round.id}-transcript.txt`; link.click();
    URL.revokeObjectURL(url);
  };

  return <section aria-label="Interview evidence and scoring review" className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-5 sm:p-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"><Award size={15} /> Interview review</div>
        <h2 className="text-xl font-bold text-zinc-950">{candidateName}</h2>
        <p className="mt-1 text-sm text-zinc-500">{round.round_name} · {round.requisition_title || report?.requisition_title || 'Interview round'}</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-right">
        <div className="text-xs font-medium text-zinc-500">{scored ? 'STAR & competency score' : savedScore !== null ? 'Saved assessment score' : 'Assessment status'}</div>
        <div className="mt-1 text-2xl font-bold text-zinc-950">{loading ? 'Loading…' : error ? 'Unavailable' : savedScore !== null ? <>{savedScore}<span className="text-sm font-normal text-zinc-500"> / 100</span></> : 'Pending review'}</div>
        {analysis.recommendation && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: analysis.recommendation.includes('strong') || analysis.recommendation === 'hire' ? '#dcfce7' : '#fef3c7',
              color: analysis.recommendation.includes('strong') || analysis.recommendation === 'hire' ? '#166534' : '#92400e',
            }}
          >
            <span>{analysis.recommendation.replace('_', ' ')}</span>
          </div>
        )}
      </div>
    </header>
    <div className="p-5"><SavedEvaluation evaluation={report?.evaluation || round.evaluation} /></div>
    <section aria-label="Interview remarks" className="border-b border-zinc-200 p-5">
      <h3 className="text-sm font-semibold">Remarks & Evaluation Summary</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{report?.remarks || report?.evaluation?.notes || round.evaluation?.notes || analysis.summary || 'No remarks have been saved.'}</p>
      {analysis.recommendation_rationale && (
        <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-700">
          <span className="font-semibold text-zinc-900 block mb-1">Recommendation Rationale:</span>
          {analysis.recommendation_rationale}
        </div>
      )}
      {(analysis.strengths?.length > 0 || analysis.development_areas?.length > 0) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {analysis.strengths?.length > 0 && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-900">
              <span className="font-bold text-emerald-950 block mb-1.5 uppercase text-[10px] tracking-wider">Candidate Strengths</span>
              <ul className="list-disc list-inside space-y-1">
                {analysis.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
              </ul>
            </div>
          )}
          {analysis.development_areas?.length > 0 && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-amber-900">
              <span className="font-bold text-amber-950 block mb-1.5 uppercase text-[10px] tracking-wider">Development Areas</span>
              <ul className="list-disc list-inside space-y-1">
                {analysis.development_areas.map((d, idx) => <li key={idx}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {analysis.claims_verified?.length > 0 && (
        <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-950">
          <span className="font-bold text-indigo-900 block mb-1.5 uppercase text-[10px] tracking-wider">Verified Resume Claims</span>
          <div className="space-y-1.5">
            {analysis.claims_verified.map((c, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${c.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>
                  {c.verified ? 'Verified' : 'Unconfirmed'}
                </span>
                <div>
                  <span className="font-semibold">{c.claim}</span>: <span className="text-zinc-600">{c.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>

    {/* Focus Monitoring Events Section for Recruiters */}
    <section aria-label="Focus monitoring events" className="border-b border-zinc-200 p-5 sm:p-6 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Eye size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              Focus Monitoring Events
              {focusSummary.flagged_for_review && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Flagged for Review
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500">
              Audit trail of browser focus changes and window state during the interview session.
            </p>
          </div>
        </div>

        {focusConsent?.consent_given && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Candidate Consent Granted ({new Date(focusConsent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
          </span>
        )}
      </div>

      {/* Mandatory Recruiter Guidance Disclaimer */}
      <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-amber-900 mb-4 flex items-start gap-2.5">
        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-normal">
          <strong>Review Guidance:</strong> These entries reflect browser focus changes (e.g., switching tabs, window blur, or exiting fullscreen). They provide context for recruiter review and <strong>do not constitute automatic proof of cheating</strong>. Evaluate against the session video and response quality.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Total Incidents</div>
          <div className="text-xl font-bold text-zinc-950 mt-1">
            {focusSummary.total_incidents || focusEvents.length}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Total Duration Away</div>
          <div className="text-xl font-bold text-zinc-950 mt-1">
            {focusSummary.total_lost_duration_seconds ? `${focusSummary.total_lost_duration_seconds}s` : '0s'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Focus Integrity</div>
          <div className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${
            focusSummary.flagged_for_review ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            {focusSummary.flagged_for_review ? (
              <>
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Needs Review</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Clean Session</span>
              </>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Interview Status</div>
          <div className="text-sm font-bold text-zinc-950 mt-1.5 capitalize">
            {round.status || 'Completed'}
          </div>
        </div>
      </div>

      {/* Incident Audit Table */}
      {focusEvents.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Question</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Policy Warning Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {focusEvents.map((evt, idx) => (
                <tr key={evt.id || idx} className="hover:bg-zinc-50/60 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">{evt.incident_sequence || idx + 1}</td>
                  <td className="py-2.5 px-3 font-medium">
                    <span className="capitalize">
                      {evt.event_type === 'tab_hidden' ? 'Tab Switched / Hidden' : evt.event_type === 'fullscreen_exit' ? 'Fullscreen Exited' : 'Window Blurred / Left'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium">Question {evt.question_number || 1}</td>
                  <td className="py-2.5 px-3 font-mono text-zinc-500">
                    {evt.start_time ? new Date(evt.start_time).toLocaleTimeString() : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">{evt.duration_seconds}s</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      evt.violation_level === 'critical_warning'
                        ? 'bg-rose-100 text-rose-800'
                        : evt.violation_level === 'strong_warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {evt.violation_level === 'critical_warning'
                        ? 'Level 3: Critical (Paused)'
                        : evt.violation_level === 'strong_warning'
                        ? 'Level 2: Strong Warning'
                        : 'Level 1: Warning'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
          <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
          <span>
            <strong>Clean Focus Session:</strong> No browser tab switching, window minimization, or focus loss incidents were recorded during this interview.
          </span>
        </div>
      )}
    </section>

    {error && <div role="alert" className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 inline-flex items-center gap-2 font-semibold underline"><RefreshCw size={14} /> Retry review</button></div>}
    <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-label="Interview video" className="overflow-hidden rounded-2xl border border-zinc-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-4"><h3 className="flex items-center gap-2 font-semibold text-zinc-900"><Video size={17} /> Session video</h3>{recordingUrl && mediaToken && <a href={interviewApi.getRecordingStreamUrl(round.id, true, mediaToken)} className="flex items-center gap-1 text-xs font-semibold text-zinc-600"><Download size={14} /> Download video</a>}</div>
          {recordingUrl && mediaToken && !videoError ? <video key={round.id} controls playsInline preload="metadata" onError={() => setVideoError(true)} className="aspect-video w-full bg-zinc-950" aria-label={`Interview recording for ${candidateName}`} src={interviewApi.getRecordingStreamUrl(round.id, false, mediaToken)} /> : <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-zinc-950 p-6 text-center text-sm text-zinc-300"><Video size={28} /><p>{videoError ? 'The recording could not be played. Retry or download the video.' : loading ? 'Loading recording…' : 'No recording is available for this round.'}</p>{videoError && <button type="button" onClick={() => setVideoError(false)} className="underline">Retry playback</button>}</div>}
          <p className="p-4 text-xs leading-relaxed text-zinc-500">Video, transcript, and assessment below belong to this selected round. Transcript timestamps are displayed as recorded; automatic video alignment is unavailable.</p>
        </section>

        <section ref={transcriptRef} aria-label="Interview transcript" className="rounded-2xl border border-zinc-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-4"><h3 className="flex items-center gap-2 font-semibold text-zinc-900"><FileText size={17} /> Transcript <span className="text-xs font-normal text-zinc-500">{turns.length} turns</span></h3><button type="button" disabled={!turns.length} onClick={downloadTranscript} className="flex items-center gap-1 text-xs font-semibold text-zinc-600 disabled:opacity-40"><Download size={14} /> Download</button></div>
          <div className="p-4"><label className="text-xs font-semibold text-zinc-600">Search transcript<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search answers or questions…" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" /></label></div>
          <div className="max-h-[600px] space-y-3 overflow-y-auto px-4 pb-4">
            {loading ? <p role="status" className="text-sm text-zinc-500">Loading transcript…</p> : !turns.length ? <p className="text-sm text-zinc-500">No transcript has been saved for this round.</p> : !filteredTurns.length ? <p className="text-sm text-zinc-500">No matching transcript text.</p> : filteredTurns.map((turn, index) => <article key={index} data-question-id={turn.question_id || undefined} className={`rounded-xl border p-3 ${focusedQuestion && turn.question_id === focusedQuestion ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-400' : turn.speaker === 'candidate' ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-200 bg-white'}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs font-semibold text-zinc-500"><span>{turn.speaker_name || (turn.speaker === 'candidate' ? candidateName : 'Interviewer')}</span><span>{turn.input_mode === 'typed_fallback' ? 'Typed answer · ' : ''}{turn.timestamp || ''}</span></div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{turn.text}</p>
            </article>)}
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
          <h3 className="font-semibold text-zinc-950">How this score is calculated</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">Each competency is rated from 1 to 5 using answer evidence and STAR: Situation, Task, Action, Result. The total is Σ ((rating − 1) ÷ 4 × weight × 100). Resume match and speech pace do not contribute to this score.</p>
          <p className="mt-2 text-xs text-zinc-500">Rubric: {analysis.rubric_version || 'Not recorded'} · AI assessment supports human review.</p>
          {Object.keys(analysis.rating_anchors || {}).length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-zinc-800">View rating criteria</summary><dl className="mt-3 space-y-2 text-sm text-zinc-600">{Object.entries(analysis.rating_anchors).map(([level, definition]) => <div key={level}><dt className="font-semibold text-zinc-900">Rating {level}</dt><dd>{definition}</dd></div>)}</dl></details>}
        </section>

        {loading ? <p role="status" className="text-sm text-zinc-500">Loading assessment…</p> : !scored ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><h3 className="font-semibold">No validated competency score available</h3><p className="mt-2">{analysis.summary || 'Scoring is pending, unavailable, or uses an older rubric without auditable criteria. Review the recording and transcript before making a decision.'}</p>{Number.isFinite(analysis.overall_score) && <p className="mt-2">Legacy score: {analysis.overall_score}/100. This is not a validated STAR competency score.</p>}</div> : <>
          <p className="text-sm leading-relaxed text-zinc-600">{analysis.summary}</p>
          {criteria.map(row => <article key={row.question_id} className="rounded-2xl border border-zinc-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-zinc-950">{dictionary[row.competency]?.name || row.competency}</h3><p className="mt-1 text-xs text-zinc-500">Weight: {Math.round(row.weight * 100)}% · Contribution: {(((row.rating - 1) / 4) * row.weight * 100).toFixed(1)} points</p></div><span className="whitespace-nowrap rounded-lg bg-zinc-950 px-3 py-2 text-sm font-bold text-white">{row.rating} / 5</span></div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">{row.rationale}</p>
            <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-zinc-800">Question and competency indicators</summary><p className="mt-2 text-zinc-600">{questions.find(question => question.id === row.question_id)?.prompt || 'Question text is available in the transcript.'}</p><ul className="mt-2 list-inside list-disc text-zinc-600">{(dictionary[row.competency]?.indicators || []).map(indicator => <li key={indicator}>{indicator}</li>)}</ul></details>
            <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">{['situation', 'task', 'action', 'result'].map(component => <div key={component} className="rounded-xl bg-zinc-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{component}</dt><dd className="mt-1 text-sm leading-relaxed text-zinc-700">{row.star?.[component] ? `“${row.star[component]}”` : 'Not demonstrated'}</dd></div>)}</dl>
            <div className="mt-4 border-t border-zinc-100 pt-3"><h4 className="text-xs font-semibold text-zinc-500">Transcript evidence</h4>{(row.evidence || []).map((quote, index) => <blockquote key={index} className="mt-2 border-l-2 border-cyan-400 pl-3 text-sm leading-relaxed text-zinc-700">“{quote}”</blockquote>)}<button type="button" onClick={() => showEvidence(row.question_id)} className="mt-3 text-xs font-semibold text-cyan-700 underline">Highlight answer in transcript</button></div>
          </article>)}
        </>}
      </div>
    </div>
  </section>;
}
