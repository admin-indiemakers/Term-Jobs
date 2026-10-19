import { useEffect, useRef, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function GoogleCalendarConnect({ onStatus, onConnected, compact = false }) {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const callbacks = useRef({ onStatus, onConnected });
  callbacks.current = { onStatus, onConnected };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    request('/api/calendar/google/status', { token, noCache: true })
      .then(data => {
        if (cancelled) return;
        setStatus(data); callbacks.current.onStatus?.(data);
        const params = new URLSearchParams(window.location.search);
        const result = params.get('calendar');
        if (result) {
          if (result === 'connected' && data.connected) callbacks.current.onConnected?.(data);
          else setError(result === 'cancelled' ? 'Google Calendar connection was cancelled.' : 'Google Calendar connection failed. Please retry.');
          params.delete('calendar');
          window.history.replaceState(null, '', window.location.pathname + (params.size ? '?' + params.toString() : ''));
        }
      }).catch(err => { if (!cancelled) setError(err.message || 'Unable to load calendar status.'); });
    return () => { cancelled = true; };
  }, [token]);

  const connect = async () => {
    setBusy(true); setError('');
    try {
      const data = await request(`/api/calendar/google/connect?return_origin=${encodeURIComponent(window.location.origin)}`, { method: 'POST', token });
      const url = new URL(data.authorization_url);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('Invalid Google authorization URL.');
      window.location.assign(url.href);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  if (compact) return <div className="hm-calendar-connection">
    <button type="button" onClick={connect} disabled={busy}
      aria-label={status?.connected ? `Google Calendar connected${status.email ? ` as ${status.email}` : ''}. Reconnect` : 'Connect Google Calendar'}
      title={status?.connected ? `${status.email || 'Connected'} · ${status.timezone || ''} · Reconnect` : 'Connect Google Calendar'}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
      <span>{busy ? 'Connecting…' : status?.connected ? 'Calendar connected' : 'Connect calendar'}</span>
      {status?.connected && <span className="hm-connection-dot" aria-hidden="true" />}
    </button>
    {error && <p role="alert">{error}</p>}
  </div>;

  return <div className="flex flex-col items-start gap-1">
    <button type="button" onClick={connect} disabled={busy} title={status?.email || 'Connect your Google Calendar for company interviews'} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
      {status?.connected ? 'Google Calendar connected · Reconnect' : 'Connect Google Calendar'}
    </button>
    {status?.connected && <span className="text-[10px] text-zinc-500">{status.email} · {status.timezone}</span>}
    {error && <p role="alert" className="max-w-md text-xs text-red-600">{error}</p>}
  </div>;
}
