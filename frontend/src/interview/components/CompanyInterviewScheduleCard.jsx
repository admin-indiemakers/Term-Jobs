import { useState } from 'react';
import { Calendar, Send } from 'lucide-react';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function CompanyInterviewScheduleCard({ proposal, timezone = 'Asia/Kolkata', onSaved }) {
  const { token } = useAuth();
  const today = new Date().toLocaleDateString('en-CA');
  const initialDate = proposal.scheduled_date || proposal.proposed_date || '';
  const [date, setDate] = useState(initialDate >= today ? initialDate : '');
  const [time, setTime] = useState(/^\d{2}:\d{2}$/.test(proposal.scheduled_time || proposal.proposed_time || '') ? proposal.scheduled_time || proposal.proposed_time : '');
  const [zone, setZone] = useState(proposal.scheduled_timezone || timezone);
  const [duration, setDuration] = useState(proposal.duration_minutes || 45);
  const [round, setRound] = useState(proposal.round_name || proposal.interview_type || proposal.round || 'Technical Round');
  const [saved, setSaved] = useState(proposal.id ? proposal : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const candidate = proposal.candidate || proposal.candidate_name;

  const dispatch = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await request('/api/interviews/company-round', { method: 'POST', token, timeout: 90000, body: {
        candidate_identifier: proposal.candidate_submission_id || proposal.candidate_email || candidate,
        requisition_id: proposal.requisition_id || null, round_id: saved?.id || null, round_name: round,
        scheduled_date: date, scheduled_time: time, scheduled_timezone: zone, duration_minutes: Number(duration),
      } });
      setSaved(result); onSaved?.(result);
    } catch (err) { setError(err.message || 'Unable to save the company interview.'); }
    finally { setBusy(false); }
  };

  return <form onSubmit={dispatch} className="mt-4 w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm">
    <div className="mb-4 flex items-start gap-3"><Calendar size={20} className="mt-1 text-zinc-700" /><div><h4 className="text-sm font-bold text-zinc-900">{saved ? 'Edit company interview' : 'Company interview proposal'}</h4><p className="mt-1 text-xs text-zinc-500">{candidate} · {proposal.requisition_title || proposal.requisition || 'Your requisition'}</p></div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-zinc-600">Date<input required type="date" min={today} value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold text-zinc-600">Start time<input required type="time" value={time} onChange={event => setTime(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold text-zinc-600">Timezone<input required value={zone} onChange={event => setZone(event.target.value)} placeholder="Asia/Kolkata" className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm" /><span className="mt-1 block text-[10px] font-normal">Use an IANA timezone, e.g. Asia/Kolkata or America/New_York.</span></label>
      <label className="text-xs font-semibold text-zinc-600">Duration (minutes)<input required type="number" min={15} max={240} value={duration} onChange={event => setDuration(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold text-zinc-600 sm:col-span-2">Round name<input required disabled={Boolean(saved)} value={round} onChange={event => setRound(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm disabled:bg-zinc-50" /></label>
    </div>
    <p className="mt-3 text-xs text-zinc-500">Saving sends the candidate a TermJobs company LiveKit interview link and syncs the event when Google Calendar is connected.</p>
    {saved && <div role="status" className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700"><p>Interview saved: {saved.scheduled_date} at {saved.scheduled_time} ({saved.scheduled_timezone}).</p><p className="mt-1">Google Calendar: {saved.calendar_sync?.status || 'Not synced'} · Email: {saved.email_delivery?.status || 'Not confirmed'}</p>{saved.calendar_sync?.message && <p className="mt-1">{saved.calendar_sync.message}</p>}{saved.email_delivery?.status !== 'success' && <p className="mt-1 text-amber-700">The interview is saved, but email delivery is not confirmed. Retry dispatch to send the invitation.</p>}<a className="mt-2 block underline" href={saved.meeting_link} target="_blank" rel="noopener noreferrer">Open company interview room</a></div>}
    {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    <button type="submit" disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Send size={14} />{busy ? 'Saving interview…' : saved ? 'Update time & resend invitation' : 'Dispatch Invitation'}</button>
  </form>;
}
