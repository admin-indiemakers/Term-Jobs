import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import { signInAndConnectTelegram } from '../utils/telegramLogin';
import logo from '../assets/termjobs-logo.png';
import './HiringManagerTelegramLogin.css';

const BOT_URL = 'https://t.me/HirMngerbot';

export default function HiringManagerTelegramLogin() {
  const [params] = useSearchParams();
  const state = params.get('state') || '';
  const { user, token, applySession, logout, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const session = await signInAndConnectTelegram(request, {
        state, session: user && token ? { user, access_token: token } : null, email, password,
      });
      applySession(session.access_token, session.user);
      setPassword(''); setConnected(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) { setError(err.message || 'Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  };
  return <main className="hm-telegram-page" data-no-field-requirements>
    <div className="hm-telegram-brand"><img src={logo} alt="" /><span>TermJobs</span></div>
    <section className="hm-telegram-card" aria-labelledby="telegram-title">
      <div className={`hm-telegram-icon ${connected ? 'is-connected' : ''}`}>{connected ? <CheckCircle2 size={26} /> : <Send size={25} />}</div>
      <p className="hm-telegram-eyebrow">HIRING MANAGER ASSISTANT</p>
      <h1 id="telegram-title">{connected ? 'You’re connected' : 'Connect with Telegram'}</h1>
      <p className="hm-telegram-description">{connected ? 'Your Hiring Manager workspace is ready in Telegram. Return to the bot to manage hiring tasks.' : 'Sign in with your TermJobs account to connect the Hiring Manager bot.'}</p>
      {connected ? <div className="hm-telegram-actions">
        <a className="hm-telegram-primary" href={BOT_URL}>Open Telegram <ArrowRight size={18} /></a>
        <Link className="hm-telegram-secondary" to="/dashboard/hiring-manager">Go to your dashboard</Link>
      </div> : !state ? <div className="hm-telegram-notice" role="alert"><strong>A sign-in link is required</strong><p>Open the bot and send <code>/login</code> to get a new link.</p><a className="hm-telegram-primary" href={BOT_URL}>Open Hiring Manager bot <ArrowRight size={18} /></a></div> : loading ? <p className="hm-telegram-description" role="status">Checking your session…</p> : <form onSubmit={submit} className="hm-telegram-form">
        {user ? <div className="hm-telegram-account"><strong>{user.name || user.email}</strong><span>{user.email} · {user.role}</span><button type="button" onClick={() => { logout(); setError(''); }} disabled={busy}>Use another account</button></div> : <>
          <div className="hm-telegram-field"><label htmlFor="telegram-email">Email or username</label><input id="telegram-email" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Enter your email or username" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
          <div className="hm-telegram-field"><label htmlFor="telegram-password">Password</label><div className="hm-telegram-password"><input id="telegram-password" name="password" required type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
        </>}
        {user && user.role !== 'Hiring Manager' && <p className="hm-telegram-error">Use a Hiring Manager account to connect this bot.</p>}
        {error && <p role="alert" className="hm-telegram-error">{error}</p>}
        <button className="hm-telegram-primary" type="submit" disabled={busy || (user && user.role !== 'Hiring Manager')}>{busy ? 'Connecting your account…' : user ? 'Connect Telegram' : 'Sign in & connect'}{!busy && <ArrowRight size={18} />}</button>
      </form>}
      <p className="hm-telegram-security"><LockKeyhole size={14} /> Secure, single-use link · Expires after 10 minutes</p>
    </section>
    <p className="hm-telegram-footer">Your workspace, connected.</p>
  </main>;
}
