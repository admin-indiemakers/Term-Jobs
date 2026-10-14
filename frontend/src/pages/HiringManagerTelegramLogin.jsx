import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

export default function HiringManagerTelegramLogin() {
  const [params] = useSearchParams();
  const state = params.get('state') || '';
  const { user, token, login, logout, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const connect = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request('/api/integrations/telegram/complete-login', { method: 'POST', token, body: { state } });
      setConnected(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) { setError(err.message || 'Unable to connect Telegram.'); }
    finally { setBusy(false); }
  };
  const signIn = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const account = await login(email, password);
      setPassword('');
      if (account.role !== 'Hiring Manager') setError('Use a Hiring Manager account to connect this bot.');
    } catch (err) { setError(err.message || 'Unable to sign in.'); }
    finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Hiring Manager Telegram login</h1>
      {connected ? <><p>Your Telegram account is connected. Return to the bot to start hiring tasks.</p><Link className="underline" to="/dashboard/hiring-manager">Open your dashboard</Link></> : <>
        <p className="text-sm text-gray-600">Sign in to TermJobs, then connect this Telegram chat to your Hiring Manager account.</p>
        {!state ? <p role="alert">Open the sign-in link sent by the bot after typing /login.</p> : loading ? <p>Checking session…</p> : user ? <>
          <p className="text-sm">Signed in as {user.name || user.email} ({user.role}).</p>
          {user.role === 'Hiring Manager' && <form onSubmit={connect}><button disabled={busy} className="w-full rounded-xl bg-black p-3 text-white disabled:opacity-50">{busy ? 'Connecting…' : 'Connect Telegram'}</button></form>}
          <button className="text-sm underline" onClick={logout}>Sign out and use another account</button>
        </> : <form onSubmit={signIn} className="space-y-3">
          <label className="block text-sm">Email or username<input required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          <label className="block text-sm">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-black p-3 text-white disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>}
      </>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  </main>;
}
