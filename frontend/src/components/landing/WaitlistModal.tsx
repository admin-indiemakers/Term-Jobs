import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, Check, Loader2 } from 'lucide-react';
import { request } from '../../api/client';

export function WaitlistModal({ onClose, talent = false }: { onClose: () => void; talent?: boolean }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      if (talent) {
        const resume = form.get('resume');
        if (!(resume instanceof File) || !resume.size) throw new Error('Please upload your résumé.');
        if (resume.size > 2 * 1024 * 1024) throw new Error('Please choose a résumé smaller than 2 MB.');
        await request('/api/waitlist/talent-pool', { method: 'POST', body: form });
      } else await request('/api/waitlist', { method: 'POST', body: {
        name: String(form.get('name') || '').trim(), company_name: String(form.get('company_name') || '').trim(),
        email: String(form.get('email') || '').trim(), phone_number: String(form.get('phone_number') || '').trim(),
        requirements: String(form.get('requirements') || '').trim(),
        referral_source: String(form.get('referral_source') || '').trim(),
      } });
      setJoined(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to join right now. Please try again.'); }
    finally { setBusy(false); }
  }
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center overflow-y-auto bg-zinc-950/55 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="waitlist-title" onClick={event => event.stopPropagation()}
        className="relative my-auto max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/80 bg-[#fafafa] p-6 text-zinc-900 shadow-2xl sm:p-9">
        <button type="button" onClick={onClose} aria-label={talent ? "Close talent pool form" : "Close waiting list"} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full hover:bg-zinc-100 focus-visible:outline-2"><X size={18} /></button>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">Early access · TermJobs</p>
        <h2 id="waitlist-title" className="font-display text-3xl font-bold tracking-tight">{joined ? (talent ? 'You’re in the talent pool.' : 'You’re on the list.') : (talent ? 'Your next opportunity starts here.' : 'Your next chapter starts here.')}</h2>
        {joined ? <div role="status" className="mt-6"><Check size={24} /><p className="mt-3 text-sm leading-relaxed text-zinc-600">{talent ? 'Thanks for joining. We’ll contact you about relevant opportunities.' : 'Thanks for joining. We’ll email you when early access is available.'}</p><button type="button" onClick={onClose} className="mt-6 rounded-full bg-zinc-950 px-6 py-3 text-sm text-white">Done</button></div> : <>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">{talent ? 'Share your details and résumé to join the TermJobs talent pool.' : 'Join the waiting list for a better way to build contract teams.'}</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-semibold">Name <span className="text-zinc-500">*</span><input ref={nameRef} name="name" required maxLength={100} autoComplete="name" placeholder="Your full name" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-500" /></label>
            {!talent && <label className="block text-xs font-semibold">Company name <span className="font-normal text-zinc-400">(optional)</span><input name="company_name" maxLength={160} autoComplete="organization" placeholder="Your company" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-500" /></label>}
            <label className="block text-xs font-semibold">Email <span className="text-zinc-500">*</span><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@company.com" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-500" /></label>
            {!talent && <label className="block text-xs font-semibold">Phone number <span className="font-normal text-zinc-400">(optional)</span><input name="phone_number" type="tel" maxLength={40} autoComplete="tel" placeholder="+91" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-500" /></label>}
            {!talent && <>
              <label className="block text-xs font-semibold">Your requirements <span className="font-normal text-zinc-400">(optional)</span><textarea name="requirements" rows={3} maxLength={2000} placeholder="Tell us about the roles, skills, team size or hiring timeline you need." className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-500" /></label>
              <label className="block text-xs font-semibold">How did you find us? <span className="font-normal text-zinc-400">(optional)</span><input name="referral_source" maxLength={160} placeholder="e.g. Google, LinkedIn or a referral" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-500" /></label>
            </>}
            {talent && <label className="block text-xs font-semibold">Résumé <span className="text-zinc-500">*</span><input name="resume" type="file" required accept=".pdf,.doc,.docx" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-2" /><span className="mt-2 block font-normal text-zinc-500">PDF, DOC or DOCX · up to 2 MB</span></label>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={busy} type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">{busy ? <><Loader2 size={16} className="animate-spin" /> Joining…</> : <>{talent ? "Join talent pool" : "Join waiting list"} <ArrowRight size={16} /></>}</button>
            <p className="text-center text-[11px] leading-relaxed text-zinc-400">{talent ? "Your details and résumé will be used to contact you about TermJobs opportunities." : "Name and email are required. We’ll only contact you about TermJobs."}</p>
          </form>
        </>}
      </div>
    </div>, document.body,
  );
}
