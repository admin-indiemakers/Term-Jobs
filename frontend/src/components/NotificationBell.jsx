import { createPortal } from 'react-dom';
import { notificationDestination } from '../utils/notificationNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  UserCheck,
  FileCheck,
  CheckCheck,
  Sparkles,
  Clock,
  X,
  AlertCircle,
  Users,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

function getNotificationIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('requisition')) {
    return {
      icon: Briefcase,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200/80',
    };
  }
  if (t.includes('candidate.selected') || t.includes('shortlist')) {
    return {
      icon: Sparkles,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200/80',
    };
  }
  if (t.includes('offer') || t.includes('agreement')) {
    return {
      icon: FileCheck,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200/80',
    };
  }
  if (t.includes('team') || t.includes('user') || t.includes('director')) {
    return {
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200/80',
    };
  }
  return {
    icon: Bell,
    color: 'text-gray-700',
    bg: 'bg-gray-100 border-gray-200/80',
  };
}

function timeAgo(iso) {
  if (!iso) return '';
  try {
    const then = new Date(iso);
    const diff = Date.now() - then.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const panelRef = useRef(null);
  const requestVersion = useRef(0);
  const savingRead = useRef(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!token || savingRead.current) return;
      const version = ++requestVersion.current;
      if (!quiet) setLoading(true);
      try {
        const list = await request('/api/notifications', { token, noCache: true });
        if (!Array.isArray(list)) throw new Error('Invalid notification response');
        if (version !== requestVersion.current) return;
        setItems(list);
        setError('');
      } catch (err) {
        if (!quiet) setError(err.message || 'Unable to load notifications.');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;
  const filteredItems = activeTab === 'unread' ? items.filter((n) => !n.read) : items;

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  const markRead = async (n) => {
    if (savingRead.current) return;
    savingRead.current = true;
    ++requestVersion.current;
    try {
      await request(`/api/notifications/${encodeURIComponent(n.id)}/read`, { method: 'POST', token });
      setItems((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
    } catch (err) {
      setError(err.message || 'Unable to save notification read status.');
      return;
    } finally {
      savingRead.current = false;
    }
    setOpen(false);

    const link = notificationDestination(n, user?.role);
    if (link) navigate(link);
    else setDetail(n);

  };

  const markAllRead = async () => {
    if (savingRead.current) return;
    savingRead.current = true;
    ++requestVersion.current;
    try {
      await request('/api/notifications/read-all', { method: 'POST', token });
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to save notification read status.');
    } finally {
      savingRead.current = false;
    }
  };

  if (!user) return null;

  return (
    <div className="relative inline-flex items-center" ref={panelRef}>
      {/* Bell Button styled identically to portal header buttons */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        title="Notifications"
        className={`relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center group ${
          open
            ? 'bg-black text-white border-black shadow-xs'
            : 'bg-white hover:bg-[#F7F7F5] border-gray-200/90 text-gray-800 shadow-2xs hover:shadow-xs'
        }`}
      >
        <Bell
          size={15}
          strokeWidth={2.1}
          className={`${open ? 'text-white' : 'text-gray-800 group-hover:scale-105'} transition-transform`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono ring-2 ring-white animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {detail && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Notification details" className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white text-gray-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-bold text-lg">{detail.title}</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap">{detail.body || 'No additional details available.'}</p>
            <button type="button" autoFocus onClick={() => setDetail(null)} className="mt-5 rounded-lg bg-black text-white px-4 py-2">Close</button>
          </div>
        </div>, document.body
      )}

      {/* Glassmorphic Notification Panel Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-[380px] bg-white/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.14)] overflow-hidden z-50 flex flex-col max-h-[490px] animate-in fade-in zoom-in-95 duration-150 text-left select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-white/60">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-[13px] font-bold text-gray-900 tracking-tight">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-bold text-gray-500 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck size={12} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-black rounded-lg transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filter Tabs (All / Unread) */}
          <div className="px-4 py-2 border-b border-black/[0.04] flex items-center justify-between bg-black/[0.015] shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-black text-white shadow-2xs'
                    : 'text-gray-500 hover:text-black hover:bg-black/5'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeTab === 'unread'
                    ? 'bg-black text-white shadow-2xs'
                    : 'text-gray-500 hover:text-black hover:bg-black/5'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => load()}
              className="p-1 text-gray-400 hover:text-black rounded-md transition-colors cursor-pointer"
              title="Refresh notifications"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error && items.length > 0 && <p role="alert" className="p-3 text-xs text-red-800 bg-red-50">{error}</p>}
          {/* Panel Body / Notifications List */}
          <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-black/[0.03]">
            {loading && items.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-xl bg-white/40 animate-pulse">
                    <div className="w-7 h-7 rounded-lg bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-1.5 text-left">
                      <div className="h-3 w-3/4 bg-gray-200 rounded" />
                      <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error && items.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <AlertCircle size={22} className="mx-auto text-amber-500" />
                <p className="text-xs text-gray-600 font-medium">Unable to load notifications</p>
                <button
                  type="button"
                  onClick={() => load()}
                  className="px-3 py-1 text-[11px] font-bold bg-black text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-1.5 text-gray-400">
                <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200/70 flex items-center justify-center text-gray-400 mb-1">
                  <Bell size={16} />
                </div>
                <span className="text-xs font-bold text-gray-700">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </span>
                <span className="text-[10.5px] text-gray-400 max-w-[220px]">
                  {activeTab === 'unread'
                    ? 'All pending notifications have been marked as read.'
                    : 'System alerts, candidate submissions, and approval requests will appear here.'}
                </span>
              </div>
            ) : (
              filteredItems.map((n) => {
                const iconMeta = getNotificationIcon(n.type);
                const IconComponent = iconMeta.icon;

                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={`p-3 transition-colors flex items-start gap-2.5 group cursor-pointer ${
                      !n.read ? 'bg-blue-50/25 hover:bg-blue-50/40' : 'bg-transparent hover:bg-black/[0.02]'
                    }`}
                  >
                    {/* Notification Type Icon */}
                    <div
                      className={`w-7.5 h-7.5 rounded-xl border flex items-center justify-center shrink-0 shadow-3xs mt-0.5 ${iconMeta.bg} ${iconMeta.color}`}
                    >
                      <IconComponent size={13} />
                    </div>

                    {/* Notification Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <div
                          className={`text-xs font-bold leading-tight truncate group-hover:text-blue-600 transition-colors ${
                            !n.read ? 'text-gray-900 font-extrabold' : 'text-gray-800'
                          }`}
                        >
                          {n.title}
                        </div>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1" />
                        )}
                      </div>

                      {n.body && (
                        <p className="text-[11px] text-gray-500 font-normal leading-snug line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 mt-1 text-[9.5px] text-gray-400 font-medium">
                        <Clock size={10} />
                        <span>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
