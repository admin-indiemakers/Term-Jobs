import { useEffect, useRef, useState } from 'react';
import { Award, Download, FileText, RefreshCw, Video } from 'lucide-react';
import { interviewApi } from '../services/interviewApi';
import { assertReviewRound, isAuditableAssessment } from '../utils/reviewAssessment';

export function InterviewReviewPanel({ round, candidateName = 'Candidate' }) {
  const [report, setReport] = useState(null);
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

  const analysis = report?.analysis || round.communication_analysis || {};
  const scored = isAuditableAssessment(analysis);
  const savedScore = Number.isFinite(analysis.overall_score) ? analysis.overall_score : null;
  const turns = report?.transcript || round.transcript || [];
  const dictionary = analysis.competency_dictionary || {};
  const criteria = analysis.competencies || [];
  const questions = report?.questions || [];
  const recordingUrl = report?.recording_url || round.recording_url;
  const filteredTurns = turns.filter(turn => String(turn.text || '').toLowerCase().includes(search.toLowerCase()));

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
      </div>
    </header>
    <section aria-label="Interview remarks" className="border-b border-zinc-200 p-5"><h3 className="text-sm font-semibold">Remarks</h3><p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{report?.remarks || report?.evaluation?.notes || round.evaluation?.notes || analysis.summary || 'No remarks have been saved.'}</p></section>

    {error && <div role="alert" className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 inline-flex items-center gap-2 font-semibold underline"><RefreshCw size={14} /> Retry review</button></div>}
    <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-label="Interview video" className="overflow-hidden rounded-2xl border border-zinc-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-4"><h3 className="flex items-center gap-2 font-semibold text-zinc-900"><Video size={17} /> Session video</h3>{recordingUrl && <a href={interviewApi.getRecordingStreamUrl(round.id, true)} className="flex items-center gap-1 text-xs font-semibold text-zinc-600"><Download size={14} /> Download video</a>}</div>
          {recordingUrl && !videoError ? <video key={round.id} controls playsInline preload="metadata" onError={() => setVideoError(true)} className="aspect-video w-full bg-zinc-950" aria-label={`Interview recording for ${candidateName}`} src={interviewApi.getRecordingStreamUrl(round.id)} /> : <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-zinc-950 p-6 text-center text-sm text-zinc-300"><Video size={28} /><p>{videoError ? 'The recording could not be played. Retry or download the video.' : loading ? 'Loading recording…' : 'No recording is available for this round.'}</p>{videoError && <button type="button" onClick={() => setVideoError(false)} className="underline">Retry playback</button>}</div>}
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
