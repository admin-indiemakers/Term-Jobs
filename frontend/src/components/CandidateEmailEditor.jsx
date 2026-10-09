import { useState } from 'react';
import { useCandidateAuth } from '../context/CandidateAuthContext';

export default function CandidateEmailEditor() {
  const { candidateUser, requestEmailChange, confirmEmailChange } = useCandidateAuth();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function sendCode() {
    setBusy(true);
    setError('');
    try {
      await requestEmailChange(email.trim());
      setPending(true);
      setMessage('Verification code sent to your new email.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    setBusy(true);
    setError('');
    try {
      await confirmEmailChange(code.trim());
      setEditing(false);
      setPending(false);
      setCode('');
      setMessage('Login email updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <label className="block text-[11px] font-bold uppercase text-neutral-600">Login Email</label>
        <p className="truncate text-xs font-medium text-neutral-900">{candidateUser?.candidate_email || 'No email on profile'}</p>
      </div>
      {!editing && <button type="button" onClick={() => { setEditing(true); setEmail(candidateUser?.candidate_email || ''); setMessage(''); }}
        className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800">Edit Email</button>}
    </div>
    {editing && <div className="mt-3 space-y-2">
      <input type="email" aria-label="New login email" value={email} onChange={(e) => setEmail(e.target.value)}
        disabled={pending} placeholder="New email address" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900" />
      {pending && <input type="text" inputMode="numeric" autoComplete="one-time-code" aria-label="Email verification code"
        value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit verification code"
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900" />}
      <div className="flex gap-2">
        <button type="button" disabled={busy || (!pending && !email.trim()) || (pending && !code.trim())}
          onClick={pending ? verifyCode : sendCode}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? 'Please wait…' : pending ? 'Verify & Update' : 'Send Verification Code'}
        </button>
        <button type="button" onClick={() => { setEditing(false); setPending(false); setCode(''); setError(''); }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs">Cancel</button>
      </div>
      <p className="text-[11px] text-neutral-500">Google sign-in remains linked to your Google account.</p>
    </div>}
    {message && <p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
