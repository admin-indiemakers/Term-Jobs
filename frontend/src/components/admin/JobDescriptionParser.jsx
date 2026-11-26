import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { request } from '../../api/client';
import { buildJobPrefill } from '../../utils/jobDescriptionPrefill';

export default function JobDescriptionParser({ token, onFill }) {
  const [source, setSource] = useState('');
  const [result, setResult] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [filled, setFilled] = useState(false);

  async function parse() {
    if (parsing || !source.trim()) return;
    setParsing(true);
    setError('');
    setResult(null);
    setFilled(false);
    try {
      const data = await request('/api/superadmin/requisitions/parse-description', {
        method: 'POST', token, body: { source }, timeout: 35000,
      });
      setResult(buildJobPrefill(data));
    } catch (failure) {
      setError(failure.message || 'Could not parse the job description.');
    } finally {
      setParsing(false);
    }
  }

  return (
    <details className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-violet-950">
        <Sparkles size={16} aria-hidden="true" className="mr-2 inline" /> Fill from a job description
      </summary>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium" htmlFor="requisition-jd-source">Paste a job listing</label>
        <textarea
          id="requisition-jd-source"
          className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"
          rows={7}
          maxLength={30000}
          disabled={parsing}
          placeholder="Paste the Naukri listing or raw description. Include the company, title, and any other details you have."
          value={source}
          onChange={event => { setSource(event.target.value); setResult(null); setError(''); setFilled(false); }}
        />
        <button type="button" onClick={parse} disabled={parsing || !source.trim()} className="rounded-lg bg-violet-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {parsing ? 'Parsing listing…' : 'Parse listing'}
        </button>
        {parsing && <p role="status" className="text-sm text-gray-600">Extracting details from the pasted text…</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {result && (
          <div className="space-y-3 rounded-lg border border-violet-100 bg-white p-4">
            <h3 className="text-sm font-bold">Review extracted details</h3>
            {result.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
              {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>}
            {result.description && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 font-sans text-sm">{result.description}</pre>}
            {Object.keys(result.values).length === 0 && <p className="text-sm text-gray-600">No supported details were found in the pasted text.</p>}
            <details>
              <summary className="cursor-pointer text-sm font-medium text-violet-900">View structured result</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-gray-50 p-3 text-xs">{JSON.stringify(result.job, null, 2)}</pre>
            </details>
            <button type="button" disabled={!Object.keys(result.values).length || filled} className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-950 disabled:opacity-50" onClick={() => {
              onFill(result.values);
              setFilled(true);
            }}>Fill requisition form</button>
            {filled && <p role="status" className="text-sm text-emerald-800">Details filled. Review them before publishing.</p>}
          </div>
        )}
      </div>
    </details>
  );
}
