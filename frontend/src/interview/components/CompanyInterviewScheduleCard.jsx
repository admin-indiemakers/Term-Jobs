import { interviewTime } from '../utils/interviewTime';
import { useState, useEffect } from 'react';
import { Calendar, Send } from 'lucide-react';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getInterviewerAvailability } from '../../components/ScheduleInterviewModal';

export default function CompanyInterviewScheduleCard({ proposal, timezone = 'Asia/Kolkata', onSaved }) {
  const { token } = useAuth();
  const today = new Date().toLocaleDateString('en-CA');
  const initialDate = proposal.scheduled_date || proposal.proposed_date || '';
  const [date, setDate] = useState(initialDate >= today ? initialDate : '');
  const [time, setTime] = useState(interviewTime(proposal.scheduled_time || proposal.proposed_time));
  const [zone, setZone] = useState(proposal.scheduled_timezone || timezone);
  const [duration, setDuration] = useState(proposal.duration_minutes || 45);
  const [round, setRound] = useState(proposal.round_name || proposal.interview_type || proposal.round || 'Technical Round');
  const [saved, setSaved] = useState(proposal.id ? proposal : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [interviewers, setInterviewers] = useState([]);
  const [interviewer, setInterviewer] = useState('');
  useEffect(() => {
    request('/api/interviews/interviewers', { token, noCache: true })
      .then(result => setInterviewers(result.interviewers || []))
      .catch(err => setError(err.message));
  }, [token]);
  const candidate = proposal.candidate || proposal.candidate_name;

  const selectedInterviewerObj = interviewers.find(p => p.email === interviewer);
  const interviewerConflict = selectedInterviewerObj && date && time
    ? getInterviewerAvailability(selectedInterviewerObj, date, time, duration, -1, [])
    : { isAvailable: true, conflict: null };

  const checkSlot = async () => {
    setChecking(true); setAvailability(null); setError('');
    try {
      const result = await request('/api/calendar/google/availability', { method: 'POST', token, body: {
        scheduled_date: date, scheduled_time: time, scheduled_timezone: zone, duration_minutes: Number(duration), round_id: saved?.id || null,
      } });
      setAvailability({ ...result, checkedSlot: `${date}:${time}:${zone}:${duration}` });
    } catch (err) { setError(err.message || 'Unable to verify calendar availability.'); }
    finally { setChecking(false); }
  };

  const dispatch = async event => {
    event.preventDefault();
    if (proposal.application_required) {
      setError('Select a candidate application linked to your requisition before dispatching.');
      return;
    }
    setBusy(true);
    setError('');
    if (!interviewerConflict.isAvailable) {
      setError(`Selected interviewer is already booked during this time: ${interviewerConflict.conflict?.reason || 'Schedule overlap'}. Please choose another interviewer or time.`);
      setBusy(false);
      return;
    }
    try {
      const result = await request('/api/interviews/company-round', { method: 'POST', token, timeout: 90000, body: {
        candidate_identifier: proposal.candidate_submission_id || proposal.candidate_email || candidate,
        requisition_id: proposal.requisition_id || null, round_id: saved?.id || null, round_name: round,
        scheduled_date: date, scheduled_time: time, scheduled_timezone: zone, duration_minutes: Number(duration),
        round_type: proposal.round_type || 'Technical', interviewer_email: interviewer || null,
        interviewer_name: interviewers.find(person => person.email === interviewer)?.name || null,
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
    <label className="mt-3 block text-xs font-semibold">
      Interviewer
      <select value={interviewer} onChange={e => setInterviewer(e.target.value)} className="mt-1 w-full rounded border p-2">
        <option value="">My account</option>
        {interviewers.map(person => {
          const avail = (date && time)
            ? getInterviewerAvailability(person, date, time, duration, -1, [])
            : { isAvailable: true };
          return (
            <option
              key={person.id || person.email}
              value={person.email}
              disabled={!avail.isAvailable}
              className={!avail.isAvailable ? 'text-gray-400 bg-gray-50' : ''}
            >
              {person.name} &bull; {person.email}{!avail.isAvailable ? ` (Unavailable - ${avail.conflict?.timeRange || 'Booked'})` : ''}
            </option>
          );
        })}
      </select>
    </label>
    {!interviewerConflict.isAvailable && (
      <p className="mt-1.5 text-xs text-rose-600 font-medium">
        Conflict: {interviewerConflict.conflict?.reason}. Please select an available interviewer or different time.
      </p>
    )}
    <p className="mt-3 text-xs text-zinc-500">Booking checks your primary Google Calendar for conflicts, reserves the slot as busy, sends the company LiveKit invitation, and schedules candidate email reminders 60 and 10 minutes before the interview.</p>
    <button type="button" disabled={checking || !date || !time} onClick={checkSlot} className="mt-3 rounded-lg border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-xs font-semibold disabled:opacity-50">{checking ? 'Checking Google Calendar…' : 'Check availability'}</button>
    {availability?.checkedSlot === `${date}:${time}:${zone}:${duration}` && <div role="status" className={`mt-2 text-xs ${availability.available ? 'text-emerald-700' : 'text-red-600'}`}>
      {availability.available ? 'This slot is currently free. Availability will be checked again when you book.' : 'This slot overlaps another meeting. Choose a different time.'}
      {availability.conflicts.map((conflict, index) => <p key={index}>{conflict.title} · {conflict.start?.dateTime || conflict.start?.date}</p>)}
    </div>}
    {saved && <div role="status" className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700"><p>Interview saved: {saved.scheduled_date} at {saved.scheduled_time} ({saved.scheduled_timezone}).</p><p className="mt-1">Google Calendar: {saved.calendar_sync?.status || 'Not synced'} · Email: {saved.email_delivery?.status || 'Not confirmed'}</p>{saved.reminders && <p className="mt-1">Candidate reminders: {saved.reminders.status === 'scheduled' ? '60 and 10 minutes before the interview' : 'pending calendar sync'}</p>}{saved.calendar_sync?.message && <p className="mt-1">{saved.calendar_sync.message}</p>}{saved.email_delivery?.status !== 'success' && <p className="mt-1 text-amber-700">{saved.email_delivery?.code === 'sender_limit_exceeded'
        ? 'The interview is saved, but Gmail has reached its daily sending limit. Wait for the sender quota to reset or configure another sender before resending.'
        : saved.email_delivery?.reason || 'The interview is saved, but email delivery is not confirmed. Check the delivery status before resending.'}</p>}<p className="mt-1">Telegram: {saved.telegram_delivery?.status || 'Not sent'} {saved.telegram_delivery?.reason || ''}</p><a className="mt-2 block underline" href={`/interview/room/${saved.id}?role=interviewer`} target="_blank" rel="noopener noreferrer">Open company interview room</a></div>}
    {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    {proposal.application_required && <p role="alert" className="mt-3 text-xs text-zinc-700">This proposal is not linked to a unique candidate application. Ask the assistant to schedule using the candidate’s full name, email, or application ID from your requisition.</p>}
    <button type="submit" disabled={busy || proposal.application_required} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Send size={14} />{busy ? 'Saving interview…' : saved ? 'Update time & resend invitation' : 'Dispatch Invitation'}</button>
  </form>;
}
