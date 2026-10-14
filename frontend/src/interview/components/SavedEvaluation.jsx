export function SavedEvaluation({ evaluation = {} }) {
  const hasFeedback = evaluation.result || Object.keys(evaluation.scores || {}).length || evaluation.notes || evaluation.strengths || evaluation.weaknesses;
  if (!hasFeedback) return null;
  return <section aria-label="Saved interviewer evaluation" className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
    <h3 className="font-bold text-gray-900">Interviewer Evaluation</h3>
    {evaluation.result && <p className="font-semibold text-emerald-700">Recommendation: {evaluation.result}</p>}
    <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(evaluation.scores || {}).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt className="capitalize text-gray-600">{key.replaceAll('_', ' ')}</dt><dd className="font-bold text-gray-900">{value}/5</dd></div>)}</dl>
    {[['Strengths', evaluation.strengths], ['Areas for improvement', evaluation.weaknesses], ['About candidate / feedback', evaluation.notes]].map(([label, text]) => text ? <div key={label}><h4 className="font-semibold text-gray-900">{label}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{text}</p></div> : null)}
    {(evaluation.evaluated_by || evaluation.evaluated_at) && <p className="text-xs text-gray-500">{[evaluation.evaluated_by, evaluation.evaluator_email, evaluation.evaluated_at ? new Date(evaluation.evaluated_at).toLocaleString() : null].filter(Boolean).join(' · ')}</p>}
  </section>;
}
