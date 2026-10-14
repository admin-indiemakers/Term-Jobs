import { useState } from 'react';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import { API_BASE_URL } from '../api/client';
import CandidateProfileAuth from './CandidateProfileAuth';

export default function CandidateTelegramLogin() {
  const { candidateToken, candidateUser, candidateLoading, logout } = useCandidateAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const state = new URLSearchParams(window.location.search).get('state');
  if (candidateLoading) return <main role="status" className="min-h-dvh bg-gray-50 text-gray-900 flex items-center justify-center p-6">Loading your candidate account…</main>;
  if (!candidateToken || !candidateUser) return <CandidateProfileAuth onBackToHome={() => { window.location.href = '/'; }} />;
  return <main className="min-h-dvh bg-gray-50 text-gray-900 flex items-center justify-center p-6" style={{ color: '#111827' }}><section className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow">
    <h1 className="text-xl font-bold">Connect TermJobs job notifications</h1>
    <p>{candidateUser?.candidate_email || candidateUser?.email}</p>
    {!connected && <button type="button" onClick={logout} className="text-sm text-gray-700 underline">Sign in with a different candidate account</button>}
    <p>{connected ? 'Connected. You will receive your job and interview notifications in Telegram. Use /logout in the bot to disconnect.' : 'Connect this candidate account to the Telegram chat that requested this link.'}</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!connected && <button disabled={busy || !state} className="bg-black text-white rounded-xl px-4 py-3 disabled:opacity-50" onClick={async () => {
      setBusy(true); setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/candidate-profile/telegram/connect`, { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Connection failed.');
        setConnected(true); window.history.replaceState({}, '', window.location.pathname);
      } catch (error) { setError(error.message); } finally { setBusy(false); }
    }}>{busy ? 'Connecting…' : 'Connect job notifications'}</button>}
    {!state && !connected && <p>Send /login to the Telegram bot to get a new connection link.</p>}
  </section></main>;
}
