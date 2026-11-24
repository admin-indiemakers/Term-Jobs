import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Share2, Users, UserPlus, Eye, ExternalLink, RefreshCw, Link2 } from 'lucide-react';
import SEOHead from '../components/SEOHead';

const EMPTY = {
  total_candidates: 0,
  joined_today: 0,
  joined_last_7_days: 0,
  recent_joiners: [],
  total_visitors: 0,
  today_visitors: 0,
  page_hits: 0,
  top_pages: [],
};

export default function TermJobsStatistics() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/public/statistics', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load statistics.');
      setData(await response.json());
    } catch (loadError) {
      setError(loadError.message || 'Could not load statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const shareUrl = useMemo(() => `${window.location.origin}/statistics`, []);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this share link:', shareUrl);
    }
  };

  const metrics = [
    { label: 'Total candidates', value: data.total_candidates, icon: Users, tone: 'bg-neutral-950 text-white' },
    { label: 'Joined today', value: data.joined_today, icon: UserPlus, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Last 7 days', value: data.joined_last_7_days, icon: BarChart3, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Website visitors', value: data.total_visitors, icon: Eye, tone: 'bg-blue-50 text-blue-700' },
  ];

  return (
    <main className="min-h-dvh bg-[#f4f4f1] text-neutral-950">
      <SEOHead title="TermJobs Admin Statistics" noindex />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">TermJobs</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Admin statistics</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copyShareLink} className="flex h-10 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-xs font-bold shadow-sm">
              {copied ? <Link2 size={15} /> : <Share2 size={15} />}
              {copied ? 'Link copied' : 'Share link'}
            </button>
            <button type="button" onClick={load} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full border border-neutral-300 bg-white shadow-sm" aria-label="Refresh statistics">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="rounded-[20px] border border-neutral-200 bg-white p-4 sm:p-5">
              <div className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={17} /></div>
              <p className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{loading ? '—' : value.toLocaleString()}</p>
              <p className="mt-1 text-xs font-medium text-neutral-500">{label}</p>
            </article>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_.75fr]">
          <article className="rounded-[22px] border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">New candidates</h2>
                <p className="mt-1 text-xs text-neutral-500">Daily joiners and names</p>
              </div>
              <UserPlus size={17} className="text-neutral-400" />
            </div>
            <div className="mt-5 divide-y divide-neutral-100">
              {loading ? (
                <p className="py-8 text-sm text-neutral-400">Loading candidate activity…</p>
              ) : data.recent_joiners.length === 0 ? (
                <p className="py-8 text-sm text-neutral-400">No candidate joins in the last 30 days.</p>
              ) : data.recent_joiners.slice(0, 12).map((day) => (
                <div key={day.date} className="py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-neutral-700">{day.date}</p>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold">{day.count} joined</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">{day.names.join(', ')}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[22px] border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Top pages</h2>
                <p className="mt-1 text-xs text-neutral-500">Most visited routes</p>
              </div>
              <Eye size={17} className="text-neutral-400" />
            </div>
            <div className="mt-5 space-y-2">
              {loading ? (
                <p className="py-8 text-sm text-neutral-400">Loading page activity…</p>
              ) : data.top_pages.length === 0 ? (
                <p className="py-8 text-sm text-neutral-400">No page visits recorded yet.</p>
              ) : data.top_pages.map((row, index) => (
                <div key={row.page} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[11px] font-bold">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.page}</span>
                  <span className="text-xs font-bold text-neutral-500">{row.visits}</span>
                  <ExternalLink size={12} className="text-neutral-300" />
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
