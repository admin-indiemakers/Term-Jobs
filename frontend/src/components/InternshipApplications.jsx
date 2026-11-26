import { useEffect, useState } from 'react';

export default function InternshipApplications({ token, heading = "Internship applications" }) {
  const [page, setPage] = useState(null);
  const [history, setHistory] = useState([null]);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const cursor = history.at(-1);

  useEffect(() => {
    const controller = new AbortController();
    const path = token ? '/api/superadmin/internship/applications' : '/api/public/internship/applications';
    const url = cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;

    async function loadApplications() {
      try {
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Could not load internship applications.');
        const result = await response.json();
        if (!controller.signal.aborted) setPage(result);
      } catch {
        if (!controller.signal.aborted) setError('Could not load internship applications.');
      }
    }

    loadApplications();
    return () => controller.abort();
  }, [cursor, refresh, token]);

  function changePage(nextHistory) {
    setPage(null);
    setError('');
    setHistory(nextHistory);
  }

  return (
    <section className="mt-4 rounded-[22px] border border-neutral-200 bg-white p-5 sm:p-6" aria-labelledby="internship-applications-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="internship-applications-heading" className="text-sm font-bold">{heading}</h2>
          {page && <p className="mt-1 text-xs text-neutral-600">{page.total.toLocaleString()} total applications</p>}
        </div>
        <button type="button" className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold" onClick={() => {
          changePage([null]);
          setRefresh((value) => value + 1);
        }}>Refresh applications</button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {!error && !page && <p role="status" className="mt-4 text-sm text-neutral-600">Loading applications…</p>}
      {page?.applications.length === 0 && <p className="mt-4 text-sm text-neutral-600">No applications yet.</p>}
      {page?.applications.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-600">
              <tr><th scope="col" className="p-2">Name</th><th scope="col" className="p-2">Phone number</th>{token && <th scope="col" className="p-2">Submitted</th>}</tr>
            </thead>
            <tbody>
              {page.applications.map((entry) => (
                <tr key={entry.id} className="border-t border-neutral-100">
                  <td className="p-2 break-words">{entry.name}</td>
                  <td className="p-2 whitespace-nowrap"><a className="underline" href={`tel:${entry.phone}`}>{entry.phone}</a></td>
                  {token && <td className="p-2 whitespace-nowrap">{new Date(entry.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(history.length > 1 || page?.next_cursor) && (
        <div className="mt-4 flex gap-2">
          <button type="button" className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-40" disabled={history.length === 1} onClick={() => changePage(history.slice(0, -1))}>Previous</button>
          <button type="button" className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-40" disabled={!page?.next_cursor} onClick={() => changePage([...history, page.next_cursor])}>Next</button>
        </div>
      )}
    </section>
  );
}
