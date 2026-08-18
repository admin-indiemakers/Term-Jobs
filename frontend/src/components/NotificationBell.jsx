import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TYPE_ICON = {
  'requisition.published': '📢',
  'candidate.shortlisted': '⭐',
  'candidate.rejected': '🚫',
};

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setLoading(true);
      try {
        const list = await request('/api/notifications', { token });
        if (Array.isArray(list)) setItems(list);
      } catch {
        // ignore transient errors
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) load(true);
  };

  const markRead = async (n) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try {
      await request(`/api/notifications/${n.id}/read`, { method: 'POST', token });
    } catch {
      // ignore
    }
    const link = n.data?.link;
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try {
      await request('/api/notifications/read-all', { method: 'POST', token });
    } catch {
      // ignore
    }
  };

  if (!user) return null;

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button
        className={`notif-bell ${open ? 'active' : ''}`}
        onClick={handleOpen}
        aria-label="Notifications"
        title="Notifications"
      >
        <span className="notif-bell-icon">🔔</span>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <span className="notif-panel-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-read-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {loading && items.length === 0 ? (
              <div className="notif-empty muted">Loading notifications...</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">
                <p>No notifications yet</p>
                <p className="muted">
                  You'll be notified when a new requisition is published or a candidate is shortlisted or rejected.
                </p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => markRead(n)}
                >
                  <span className="notif-item-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="notif-item-main">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-body">{n.body}</span>
                    <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="notif-dot"></span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
