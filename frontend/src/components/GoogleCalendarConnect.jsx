import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCw, Check, AlertCircle, Plus, ChevronDown, Mail, Globe, X } from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

function GoogleCalendarLogo({ size = 26, className = '' }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="0.8" />
      <path d="M2 8C2 4.68629 4.68629 2 8 2H24C27.3137 2 30 4.68629 30 8V9H2V8Z" fill="#1A73E8" />
      <path d="M24 2H22V9H30V8C30 4.68629 27.3137 2 24 2Z" fill="#EA4335" />
      <path d="M2 24C2 27.3137 4.68629 30 8 30H10V23H2V24Z" fill="#34A853" />
      <path d="M30 24C30 27.3137 27.3137 30 24 30H22V23H30V24Z" fill="#FBBC04" />
      <text x="16" y="21.5" textAnchor="middle" fill="#1A73E8" fontSize="11" fontWeight="800" fontFamily="system-ui, -apple-system, sans-serif">31</text>
    </svg>
  );
}

export default function GoogleCalendarConnect({ onStatus, onConnected, variant = 'compact', className = '' }) {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef(null);
  const callbacks = useRef({ onStatus, onConnected });
  callbacks.current = { onStatus, onConnected };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    request('/api/calendar/google/status', { token, noCache: true })
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        callbacks.current.onStatus?.(data);
        const params = new URLSearchParams(window.location.search);
        const result = params.get('calendar');
        if (result) {
          if (result === 'connected' && data.connected) {
            callbacks.current.onConnected?.(data);
          } else {
            setError(
              result === 'cancelled'
                ? 'Google Calendar connection was cancelled.'
                : 'Google Calendar connection failed. Please retry.'
            );
          }
          params.delete('calendar');
          window.history.replaceState(null, '', window.location.pathname + (params.size ? '?' + params.toString() : ''));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load calendar status.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Handle click outside to close popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsPopoverOpen(false);
      }
    }
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPopoverOpen]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await request(`/api/calendar/google/connect?return_origin=${encodeURIComponent(window.location.origin)}`, {
        method: 'POST',
        token,
      });
      const url = new URL(data.authorization_url);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') {
        throw new Error('Invalid Google authorization URL.');
      }
      window.location.assign(url.href);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const isConnected = Boolean(status?.connected);

  // ── 1. COMPACT SMALL TAB (for Header / Top Toolbar) ──
  if (variant === 'compact') {
    return (
      <div className={`relative inline-block ${className}`} ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsPopoverOpen((prev) => !prev)}
          className={`flex items-center gap-1 sm:gap-2 h-6.5 sm:h-7.5 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl transition-all cursor-pointer select-none text-left border ${
            isPopoverOpen
              ? 'bg-white border-black/30 shadow-xs ring-1 ring-black/10'
              : 'bg-white hover:bg-gray-50 border-gray-200/80 shadow-3xs hover:shadow-2xs'
          }`}
          title={status?.email ? `${status.email} (${status.timezone || 'Asia/Kolkata'})` : 'Google Calendar'}
        >
          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center shrink-0">
            <GoogleCalendarLogo size={13} className="sm:hidden" />
            <GoogleCalendarLogo size={15} className="hidden sm:block" />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-[11.5px] font-bold text-gray-800 tracking-tight whitespace-nowrap">
              Google Calendar
            </span>

            {isConnected ? (
              <span className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 sm:py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[9px] sm:text-[10px] font-semibold border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 sm:py-0.2 rounded-full bg-gray-100 text-gray-500 text-[9px] sm:text-[10px] font-medium">
                Connect
              </span>
            )}
          </div>

          <ChevronDown
            size={10}
            className={`text-gray-400 transition-transform duration-150 ${isPopoverOpen ? 'rotate-180 text-black' : ''}`}
          />
        </button>

        {/* Floating Detail Popover matching 2nd image UI */}
        {isPopoverOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-2xl shadow-xl p-3 sm:p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50/70 border border-blue-100/60 flex items-center justify-center shrink-0 shadow-3xs">
                  <GoogleCalendarLogo size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-[13px] font-bold text-gray-900 tracking-tight">
                    Google Calendar
                  </div>
                  <div className="text-[10.5px] text-gray-400 truncate">
                    {isConnected ? 'Calendar sync active' : 'Not linked yet'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-semibold border border-emerald-100">
                    <Check size={10} strokeWidth={3} />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10.5px] font-medium">
                    Offline
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsPopoverOpen(false)}
                  className="w-5 h-5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={11} />
                </button>
              </div>
            </div>

            {/* Account Details */}
            {isConnected ? (
              <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={12} className="text-gray-400 shrink-0" />
                  <span className="font-semibold text-gray-800 truncate text-[11.5px]">{status?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <Globe size={12} className="text-gray-400 shrink-0" />
                  <span>{status?.timezone || 'Asia/Kolkata'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 leading-normal">
                Connect your account to sync company interview schedules, detect conflicting appointments, and dispatch calendar invites.
              </p>
            )}

            {/* Action Button */}
            <div>
              {isConnected ? (
                <button
                  type="button"
                  onClick={connect}
                  disabled={busy}
                  className="w-full py-1.5 px-3 rounded-xl border border-gray-200/90 hover:bg-gray-50 text-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 size={12} className="animate-spin text-gray-500" /> : <RotateCw size={12} strokeWidth={2.2} className="text-gray-700" />}
                  <span>{busy ? 'Connecting…' : 'Reconnect'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connect}
                  disabled={busy}
                  className="w-full py-1.5 px-3 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.4} />}
                  <span>{busy ? 'Connecting…' : 'Connect Google Calendar'}</span>
                </button>
              )}
            </div>

            {error && (
              <p role="alert" className="text-[10.5px] text-rose-600 font-medium flex items-center gap-1 pt-0.5">
                <AlertCircle size={11} className="shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 2. FULL CARD VIEW (e.g. for modal banners or full headers) ──
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full bg-white border border-gray-200/90 rounded-2xl p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 sm:gap-4 shadow-3xs">
        {/* Left Side: Icon & Details */}
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50/70 border border-blue-100/60 flex items-center justify-center shrink-0 shadow-3xs">
            <GoogleCalendarLogo size={26} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <span className="text-sm sm:text-[15px] font-bold text-gray-900 tracking-tight">
                Google Calendar
              </span>

              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100/80">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check size={9} strokeWidth={3} />
                  </span>
                  <span>Connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                  Not Connected
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 font-normal truncate mt-0.5">
              {isConnected
                ? `${status?.email || ''}${status?.email && status?.timezone ? ' · ' : ''}${status?.timezone || 'Asia/Kolkata'}`
                : 'Connect your Google Calendar to sync interviews and detect conflicts.'}
            </p>
          </div>
        </div>

        {/* Right Side: Reconnect / Connect Action Button */}
        <div>
          {isConnected ? (
            <button
              type="button"
              onClick={connect}
              disabled={busy}
              className="px-3 sm:px-3.5 py-1.5 rounded-xl border border-gray-200/90 hover:bg-gray-50 text-gray-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin text-gray-500" />
              ) : (
                <RotateCw size={13} strokeWidth={2.2} className="text-gray-700" />
              )}
              <span>{busy ? 'Connecting…' : 'Reconnect'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={busy}
              className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Plus size={13} strokeWidth={2.4} />
              )}
              <span>{busy ? 'Connecting…' : 'Connect'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
