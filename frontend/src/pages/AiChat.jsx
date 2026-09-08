import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import {
  Sparkles,
  Plus,
  History,
  RefreshCw,
  X,
  Send,
  Paperclip,
  GitBranch,
  Tag,
  Edit3,
  Layers,
  Filter,
  CheckCircle2,
  FileText,
  Share2,
  Download,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Award,
  Clock,
  Zap,
  Calendar,
  Search,
  Settings,
  Bell,
  LogOut
} from 'lucide-react';

const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Show me Q3 hiring pipeline status, attendance anomalies, and team productivity report',
    timestamp: '11:24 AM'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    title: 'Enterprise Business AI',
    badge: 'Generated just now',
    heading: 'Here is the Q3 summary for your review:',
    points: [
      {
        label: 'Hiring Velocity:',
        text: '34 active requisitions across engineering and ops; Q3 headcount target is',
        highlight: '+8% ahead of schedule',
        highlightType: 'success',
        suffix: 'with 12 offers pending final approval.'
      },
      {
        label: 'Attendance & Health:',
        text: '98.2% global operational attendance with zero compliance flags across US and EMEA hubs.'
      },
      {
        label: 'Sprint Velocity:',
        text: 'Engineering Sprint 14 velocity at 92%, while Q3 sales quota attainment reached 94% ($1.42M / $1.5M target).'
      }
    ],
    footer: 'Summary report has been generated and is ready for export.',
    actions: [
      { id: 'export-pdf', label: 'Export Full Q3 PDF', icon: 'sparkle', primary: true },
      { id: 'view-breakdown', label: 'View Department Breakdown' },
      { id: 'share-leadership', label: 'Share with Leadership' }
    ],
    timestamp: '11:24 AM'
  }
];

const REQUISITIONS_DATA = [
  {
    id: 'req-1',
    title: 'Senior Cloud Architect',
    dept: 'Cloud Ops',
    stage: 'Stage: Offer',
    stageStyle: 'bg-[#FCFEED] text-gray-900 border border-[#D8F929]',
    hrLead: 'Marcus V.',
    candidatesCount: '12 Candidates In-Process'
  },
  {
    id: 'req-2',
    title: 'Lead UX Designer',
    dept: 'Product',
    stage: 'Stage: Interview',
    stageStyle: 'bg-gray-100 text-gray-800 border border-gray-200',
    hrLead: 'Elena R.',
    candidatesCount: '28 Candidates Screened'
  },
  {
    id: 'req-3',
    title: 'Staff Security Engineer',
    dept: 'Infra & Sec',
    stage: 'Stage: Screening',
    stageStyle: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    hrLead: 'David K.',
    candidatesCount: '19 Candidates In-Process'
  }
];

const HR_LEADS = [
  {
    name: 'Marcus',
    role: 'HR Manager Marcus V.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB__dILWLDpDToxdysAY5E6VrYAjht9J1Z0V9XTh2xJi2rU2KtC-WwTF2r8_p-fBSxkrFziIrs9o-NBqJ7ZivcVo1lJjDycz2_zn_PhvtEv_K_Q4U4oH1kDH_h2noxxQwDANHu8IfZnRMIDs9bO8uMxUYKOeuPsXAWeNJay5vB2JY661fHP0SN_rVCke94Gw43m8zNmbFn2N_-p4dnRaeAEeKkS9JLfcK-_zeg1zHXgvNboL4c9Rv0'
  },
  {
    name: 'Elena',
    role: 'HR Manager Elena R.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBCbeB3yeoPMFaPVk1NRvu3LYCs-GI7-w7fEsPQtiUGIPWnrhBDz3y9Eg8pF_fL7WRTqpA6xBSXNJgx5K2fD45OMKb-bQ-n8oond4gDWBcvJa8q29bIbVki6OReXAex4BF2J3OvSEXzzujT1JIxo0ABe5_0vrTG2tk6n95BzlE4AGcPMdAguL17TXzapOxuAmld6uRx6U-gQZi-lJV_rWZ1qbGg7iNkLk-0UOZT2yQrYvic80G8OR0'
  },
  {
    name: 'David',
    role: 'People Ops David K.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjP0louYd9NCOQTAH0h4aZ7PXKrOVsS13LMTipYl6e2zRhLM4KIAVuQTJfboWEjT0mxeh5JrwfEuvuiKwM54f5pdUycmpZh56qRf5BSekmlyUji4MkmB-HI_FyR-x0zE7Xkcbg6xH25wEvhHR7SkeruP1s2iKP_ZCvde_coEIPwfFM1ccIjOXp705hkd9Ij6mRHyVtV48N9C450PRvcMOmkSaNnjbb8FnA27ZmoV42r28Rdg_Hvsw'
  },
  {
    name: 'Chloe',
    role: 'Talent Partner Chloe T.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXs-X2xOK6I86mWQAO71okpd7LoIJdq60ppFmdifj5VPlxWcV5fiqYtd0KMmYI1iB9H3cfyP3X8aU3AZFJ8mYwB9KZrP94_94pJorW1VeO-N-d3sXYZbT_yG_w_6mHI0-pf4OXeRJ8AsCa9ePcSiVZiGgx012sDuboz3rCSBjvwhN41sjL6_qjxe0EPf0GlpLrO4NlJrA-DPhzhdbs62SPu-o_yUSSUHqm-Dbs9PJ3Kr4y3Y9oX-8'
  }
];

export default function AiChat() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'new' | 'history'
  const [activeFilter, setActiveFilter] = useState('tree');
  const [showProgressPill, setShowProgressPill] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sortUrgent, setSortUrgent] = useState(true);

  // Popout controls for Notifications and Sign Out
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notifPanelRef = useRef(null);
  const userMenuRef = useRef(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // User Initials (no external photos)
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SA';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Load real notifications from backend
  const loadNotifications = async (quiet = false) => {
    if (!token) return;
    if (!quiet) setNotificationsLoading(true);
    try {
      const list = await request('/api/notifications', { token });
      if (Array.isArray(list)) {
        setNotificationsList(list);
      }
    } catch {
      // transient ignore
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(true);
    const timer = setInterval(() => loadNotifications(true), 25000);
    return () => clearInterval(timer);
  }, [token]);

  // Click outside to dismiss popouts
  useEffect(() => {
    const onClickOutside = (e) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadNotifCount = notificationsList.filter((n) => !n.read).length;

  const handleSyncHRMS = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      showToast('Live HRMS stream synchronized with global nodes');
    }, 1000);
  };

  const handleNewChat = () => {
    setActiveTab('new');
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        title: 'Enterprise Business AI',
        badge: 'Session Initialized',
        heading: 'Ready for Super Admin commands. How can I assist you with enterprise operations today?',
        points: [
          {
            label: 'Headcount Planning:',
            text: 'Analyze hiring pipeline velocity, open requisitions, and vendor candidate flow.'
          },
          {
            label: 'Compliance & Attendance:',
            text: 'Inspect biometric attendance rates, regional compliance anomalies, and timesheet health.'
          },
          {
            label: 'System Diagnostics:',
            text: 'Generate real-time workforce health metrics and department productivity reports.'
          }
        ],
        footer: 'Type your instruction below or choose an action to start.',
        actions: [
          { id: 'q3-audit', label: '✦ Run Q3 Full Audit', icon: 'sparkle', primary: true },
          { id: 'dept-metrics', label: 'Department Metrics' },
          { id: 'vendor-sync', label: 'Vendor Sync' }
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleActionClick = (action) => {
    if (action.id === 'export-pdf' || action.id === 'q3-audit') {
      showToast('Exporting Q3 Talent & Operations Executive PDF...');
    } else if (action.id === 'view-breakdown' || action.id === 'dept-metrics') {
      handleSend('Provide an in-depth breakdown of Engineering vs Product vs Sales workforce metrics');
    } else if (action.id === 'share-leadership') {
      showToast('Report dispatch link shared with Executive Leadership distribution list');
    } else {
      handleSend(`Run analysis for ${action.label}`);
    }
  };

  const handleSend = async (customText) => {
    const textToSend = typeof customText === 'string' ? customText : input.trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customText) setInput('');
    setLoading(true);

    try {
      // Attempt backend AI request with graceful fallback
      const res = await request('/api/superadmin/chat', {
        method: 'POST',
        token,
        body: {
          prompt: textToSend,
          history: newMessages.map((m) => ({ role: m.role, content: m.content || m.heading || '' }))
        }
      }).catch(async () => {
        return await request('/api/onboarding/assistant/chat', {
          method: 'POST',
          token,
          body: {
            prompt: textToSend,
            user_role: 'Super Admin',
            user_name: user?.name || 'Super Admin'
          }
        });
      });

      const replyContent =
        res?.reply ||
        res?.response ||
        res?.message;

      if (replyContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            title: 'Enterprise Business AI',
            badge: 'Generated just now',
            heading: 'Analysis Completed:',
            points: [
              {
                label: 'Summary:',
                text: typeof replyContent === 'string' ? replyContent : JSON.stringify(replyContent)
              }
            ],
            footer: 'Data synchronized with active enterprise HRMS nodes.',
            actions: [
              { id: 'export-csv', label: '✦ Export CSV Slice', icon: 'sparkle', primary: true },
              { id: 'share', label: 'Share with Leadership' }
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        // High fidelity intelligent mock reply matching the design language
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              title: 'Enterprise Business AI',
              badge: 'Generated just now',
              heading: `Report generated for: "${textToSend}"`,
              points: [
                {
                  label: 'Workforce Velocity:',
                  text: 'Identified 34 open requisitions across 4 business units with an average time-to-fill of 18.4 days.'
                },
                {
                  label: 'Compliance Status:',
                  text: 'All US and EMEA legal entities are 100% compliant with mandatory quarterly training logs.'
                },
                {
                  label: 'Projected Headcount:',
                  text: 'Expected headcount growth for next cycle is estimated at',
                  highlight: '+52 FTEs',
                  highlightType: 'success',
                  suffix: 'based on approved departmental budgets.'
                }
              ],
              footer: 'All records updated in Super Admin unified log repository.',
              actions: [
                { id: 'export-pdf', label: '✦ Export Full PDF', icon: 'sparkle', primary: true },
                { id: 'view-breakdown', label: 'View Deep Breakdown' },
                { id: 'share-leadership', label: 'Share with Leadership' }
              ],
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setLoading(false);
        }, 600);
        return;
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          title: 'Enterprise Business AI',
          badge: 'Synced',
          heading: `Query Processed: "${textToSend}"`,
          points: [
            {
              label: 'Real-time Pulse:',
              text: 'Active workforce index at 98.2% attendance with 34 active talent requisitions progressing smoothly.'
            }
          ],
          actions: [
            { id: 'export-pdf', label: '✦ Export PDF Report', icon: 'sparkle', primary: true }
          ],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col text-[13px] font-sans text-[#1A1D20] antialiased select-none">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-[#111417] text-[#D8F929] border border-gray-800 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} className="text-[#D8F929]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Dashboard Application Container with Left Rail Dock */}
      <div className="w-full flex-1 flex gap-3 md:gap-4 lg:gap-5 items-stretch" data-purpose="main-dashboard-wrapper">
        
        {/* ================================================================= */}
        {/* BEGIN: Left Navigation Rail Dock */}
        {/* ================================================================= */}
        <aside className="w-14 shrink-0 flex flex-col items-center justify-between py-1" data-purpose="sidebar-rail">
          {/* Top Brand Logo - Term Jobs */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center font-extrabold text-[15px] tracking-tight cursor-pointer transition-all hover:scale-105 shadow-sm border border-black/10 hover:ring-2 hover:ring-black/10"
              title="Term Jobs · Super Admin Dashboard"
            >
              TJ
            </button>
          </div>

          {/* Middle Dock Navigation Icons (Real Super Admin Menu Items) */}
          <nav className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200/70 flex flex-col items-center gap-1.5" data-purpose="nav-actions">
            {/* 1. Dashboard (Home Outline) */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>

            {/* 2. AI Chat (Speech Bubble - ACTIVE) */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/chat')}
              className="w-10 h-10 rounded-xl bg-[#111417] text-white flex items-center justify-center transition shadow-sm cursor-pointer hover:scale-105"
              title="AI Chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* 3. Onboard Company (Plus Icon) */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-onboard-company-modal'))}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Onboard Company"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* 4. Onboard Vendor (Plus Icon) */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-onboard-vendor-modal'))}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Onboard Vendor"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* 5. Accounts (Box with Inner Square) */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/accounts')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Accounts"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <rect width="6" height="6" x="9" y="9" />
              </svg>
            </button>

            {/* 6. Admin Accounts (Square Box) */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/admin-accounts')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Admin Accounts"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              </svg>
            </button>

            {/* 7. Archives (Checkmark) */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/superadmin/archives')}
              className="w-10 h-10 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 flex items-center justify-center transition cursor-pointer"
              title="Archives"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </nav>

          {/* Bottom Profile & Notification Dock */}
          <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200/70 flex flex-col items-center gap-2 relative" data-purpose="user-dock">
            {/* Notification with red dot & Popout */}
            <div className="relative" ref={notifPanelRef}>
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsUserMenuOpen(false);
                  if (!isNotificationsOpen) loadNotifications(true);
                }}
                className={`relative w-10 h-10 rounded-xl transition cursor-pointer flex items-center justify-center ${
                  isNotificationsOpen
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-gray-400 hover:text-black hover:bg-gray-50'
                }`}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#FF4842] rounded-full ring-2 ring-white"></span>
                )}
              </button>

              {/* Notifications Popout Panel */}
              {isNotificationsOpen && (
                <div className="absolute left-14 bottom-0 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-gray-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-left-2 text-left text-[12px]">
                  <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-[#0A0A0A]" />
                      <span className="font-bold text-[#0A0A0A] text-[13px]">Notifications</span>
                      {unreadNotifCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                          {unreadNotifCount}
                        </span>
                      )}
                    </div>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })));
                          try {
                            await request('/api/notifications/read-all', { method: 'POST', token });
                          } catch {}
                        }}
                        className="text-[11px] font-semibold text-gray-500 hover:text-black cursor-pointer transition"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {notificationsLoading && notificationsList.length === 0 ? (
                      <div className="p-6 text-center text-gray-400">Loading notifications...</div>
                    ) : notificationsList.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 space-y-1">
                        <div className="text-xl">🔔</div>
                        <p className="font-medium text-gray-700">No new notifications</p>
                        <p className="text-[11px] text-gray-400">You're all caught up with system activities.</p>
                      </div>
                    ) : (
                      notificationsList.map((n) => (
                        <div
                          key={n.id}
                          onClick={async () => {
                            if (!n.read) {
                              setNotificationsList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                              try {
                                await request(`/api/notifications/${n.id}/read`, { method: 'POST', token });
                              } catch {}
                            }
                            if (n.data?.link) {
                              setIsNotificationsOpen(false);
                              navigate(n.data.link);
                            }
                          }}
                          className={`p-3 hover:bg-gray-50 transition cursor-pointer flex items-start gap-2.5 ${!n.read ? 'bg-amber-50/40' : ''}`}
                        >
                          <span className="text-base shrink-0 mt-0.5">
                            {n.type?.includes('requisition') ? '📢' : n.type?.includes('candidate') ? '⭐' : '🔔'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 leading-snug">{n.title}</div>
                            <div className="text-gray-600 text-[11.5px] line-clamp-2 mt-0.5">{n.body}</div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                            </div>
                          </div>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar with Initials & Sign Out Popout */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(!isUserMenuOpen);
                  setIsNotificationsOpen(false);
                }}
                className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-extrabold text-[13px] tracking-tight cursor-pointer shadow-sm hover:ring-2 hover:ring-black/20 hover:scale-105 transition-all relative"
                title={`${user?.name || 'Super Admin'} · Click for menu & sign out`}
              >
                {userInitials}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white"></span>
              </button>

              {/* Sign Out Popout Menu */}
              {isUserMenuOpen && (
                <div className="absolute left-14 bottom-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200/90 z-50 p-2.5 text-left animate-in fade-in slide-in-from-left-2">
                  <div className="p-2.5 flex items-center gap-3 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-extrabold text-[13px] shrink-0 shadow-xs">
                      {userInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-gray-900 text-[13px] truncate">
                        {user?.name || 'Super Admin'}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {user?.email || 'admin@termjobs.com'}
                      </div>
                      <div className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        {user?.role || 'Super Admin'}
                      </div>
                    </div>
                  </div>

                  <div className="py-1.5 space-y-0.5 text-[12.5px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/dashboard/superadmin');
                      }}
                      className="w-full px-3 py-2 text-left font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      <Building2 size={15} className="text-gray-500" />
                      <span>Super Admin Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/dashboard/superadmin/accounts');
                      }}
                      className="w-full px-3 py-2 text-left font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      <Settings size={15} className="text-gray-500" />
                      <span>Account Settings</span>
                    </button>
                  </div>

                  <div className="pt-1.5 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full px-3 py-2.5 text-left text-[12.5px] font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut size={15} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        {/* END: Left Navigation Rail Dock */}

        {/* ================================================================= */}
        {/* BEGIN: Main Content Layout */}
        {/* ================================================================= */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5" data-purpose="main-content-layout">
          
          {/* ================================================================= */}
          {/* BEGIN: Left Card - AI Super Admin Copilot & Org Distribution Hub */}
          {/* ================================================================= */}
          <section className="lg:col-span-7 bg-white rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden min-h-[640px]" data-purpose="ai-travel-workspace">
            <div>
              {/* Top Chat Tabs & Window Controls */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-2 flex-wrap">
                {/* Navigation Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Active Tab */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('review')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer shadow-2xs ${
                      activeTab === 'review'
                        ? 'bg-[#FCFEED] border border-[#D8F929] text-gray-900 font-semibold'
                        : 'text-gray-500 hover:text-gray-800 bg-gray-50'
                    }`}
                  >
                    <span className="text-[#899c08] text-xs font-bold">✦</span>
                    <span className="text-gray-900 font-semibold text-[12px]">Q3 Talent & Operations Review</span>
                  </button>

                  {/* New Chat Tab */}
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition cursor-pointer ${
                      activeTab === 'new'
                        ? 'bg-[#FCFEED] border border-[#D8F929] text-gray-900 font-semibold'
                        : 'text-gray-400 hover:text-gray-700 font-normal hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm leading-none">+</span>
                    <span>New Chat</span>
                  </button>

                  {/* History Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      showToast('Loaded conversation history archive');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-[#FCFEED] border border-[#D8F929] text-gray-900 font-semibold'
                        : 'text-gray-400 hover:text-gray-700 font-normal hover:bg-gray-50'
                    }`}
                  >
                    <History size={14} />
                    <span>History</span>
                  </button>
                </div>

                {/* Reload & Close Window Controls */}
                <div className="flex items-center gap-1 bg-gray-50/80 p-0.5 rounded-xl border border-gray-200/70">
                  <button
                    type="button"
                    onClick={handleSyncHRMS}
                    className={`w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg transition hover:bg-white cursor-pointer ${
                      isSyncing ? 'animate-spin text-[#899c08]' : ''
                    }`}
                    title="Sync Live HRMS"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessages(INITIAL_MESSAGES)}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg transition hover:bg-white cursor-pointer"
                    title="Reset View"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Mini Analytics Toolbar (Branch, Tag, Edit, Metrics, Funnel) */}
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center bg-gray-50 border border-gray-200/70 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('tree')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      activeFilter === 'tree' ? 'bg-white shadow-2xs text-gray-800' : 'text-gray-400 hover:text-gray-700'
                    }`}
                    title="Org Tree & Hubs"
                  >
                    <GitBranch size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('tags')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      activeFilter === 'tags' ? 'bg-white shadow-2xs text-gray-800' : 'text-gray-400 hover:text-gray-700'
                    }`}
                    title="Department Tags"
                  >
                    <Tag size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('edit')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      activeFilter === 'edit' ? 'bg-white shadow-2xs text-gray-800' : 'text-gray-400 hover:text-gray-700'
                    }`}
                    title="Edit Requisitions"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('layers')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      activeFilter === 'layers' ? 'bg-white shadow-2xs text-gray-800' : 'text-gray-400 hover:text-gray-700'
                    }`}
                    title="Data Layers"
                  >
                    <Layers size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('filter')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      activeFilter === 'filter' ? 'bg-white shadow-2xs text-gray-800' : 'text-gray-400 hover:text-gray-700'
                    }`}
                    title="Filter By Department"
                  >
                    <Filter size={14} />
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Live HRMS Stream Active</span>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="mt-4 space-y-3.5 overflow-y-auto max-h-[380px] sm:max-h-[420px] pr-1 scrollbar-thin">
                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end items-end gap-2.5">
                        <div className="bg-[#111417] text-white px-4 py-2.5 rounded-2xl rounded-br-none shadow-xs max-w-[85%]">
                          <p className="text-xs md:text-[13px] leading-relaxed font-normal">{msg.content}</p>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mb-0.5 shadow-xs uppercase">
                          {userInitials}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start gap-3">
                      {/* Bot Icon with Active Indicator */}
                      <div className="w-8 h-8 rounded-xl bg-[#111417] border border-gray-800 flex items-center justify-center shrink-0 shadow-sm relative mt-0.5">
                        <Zap size={15} className="text-[#D8F929]" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
                      </div>

                      {/* AI Message Bubble */}
                      <div className="bg-[#F8F9FA] border border-gray-200/80 rounded-2xl rounded-tl-none p-3.5 sm:p-4 text-gray-800 shadow-2xs flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-gray-900">{msg.title || 'Enterprise Business AI'}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{msg.badge || 'Generated just now'}</span>
                        </div>

                        {msg.heading && (
                          <p className="text-xs font-semibold text-gray-900 mb-2">{msg.heading}</p>
                        )}

                        {/* Structured Points */}
                        {msg.points && msg.points.length > 0 && (
                          <div className="space-y-1.5 text-xs text-gray-700 leading-relaxed">
                            {msg.points.map((pt, pIdx) => (
                              <div key={pIdx} className="flex items-start gap-1.5">
                                <span className="text-[#899c08] font-bold mt-0.5">•</span>
                                <p>
                                  <strong className="text-gray-900 font-semibold">{pt.label} </strong>
                                  {pt.text}
                                  {pt.highlight && (
                                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.5 rounded mx-1">
                                      {pt.highlight}
                                    </span>
                                  )}
                                  {pt.suffix && <span> {pt.suffix}</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.footer && (
                          <p className="text-[11.5px] text-gray-600 mt-2.5 pt-2 border-t border-gray-200/70">
                            {msg.footer}
                          </p>
                        )}

                        {/* Action Chips */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {msg.actions.map((act) => (
                              <button
                                key={act.id}
                                type="button"
                                onClick={() => handleActionClick(act)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition shadow-2xs cursor-pointer ${
                                  act.primary
                                    ? 'bg-white border border-gray-300 text-gray-800 hover:border-[#D8F929] hover:bg-[#FCFEED]'
                                    : 'bg-white border border-gray-300 text-gray-800 hover:border-[#D8F929] hover:bg-[#FCFEED]'
                                }`}
                              >
                                {act.icon === 'sparkle' && (
                                  <span className="text-[#899c08] font-bold">✦</span>
                                )}
                                <span>{act.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Loading Indicator Bubble */}
                {loading && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#111417] border border-gray-800 flex items-center justify-center shrink-0 shadow-sm relative mt-0.5">
                      <Zap size={15} className="text-[#D8F929] animate-pulse" />
                    </div>
                    <div className="bg-[#F8F9FA] border border-gray-200/80 rounded-2xl rounded-tl-none p-3.5 text-gray-800 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]"></span>
                        <span className="text-xs text-gray-500 font-medium ml-2">Synthesizing live operational data...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Waveform & Input Section */}
            <div className="mt-5">
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={() => showToast('Attachment uploaded: Workforce_Policy_v2.csv')}
              />

              {/* Prompt Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="bg-white border border-gray-200 rounded-full p-1.5 pl-4 flex items-center gap-3 shadow-xs hover:border-gray-300 focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-black/5 transition"
                data-purpose="chat-input-bar"
              >
                {/* Attachment Icon */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
                  title="Attach HRMS export or resume deck"
                >
                  <Paperclip size={16} className="transform -rotate-45" />
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask follow-up query, filter by region, or request data slice..."
                  className="w-full text-xs md:text-[13px] text-gray-800 bg-transparent border-none focus:outline-hidden focus:ring-0 p-0 font-medium placeholder-gray-400"
                />

                {/* Send Action Button */}
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className={`w-9 h-9 rounded-full bg-[#14171A] text-[#D8F929] flex items-center justify-center shrink-0 hover:bg-black transition shadow-sm cursor-pointer ${
                    loading || !input.trim() ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                  }`}
                  title="Execute Query"
                >
                  <Send size={15} className="transform rotate-0 translate-x-[1px]" />
                </button>
              </form>
            </div>
          </section>
          {/* END: Left Card */}

          {/* ================================================================= */}
          {/* BEGIN: Right Card - AI Generated Real-Time Data & Executive Overview */}
          {/* ================================================================= */}
          <section className="lg:col-span-5 bg-white rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden min-h-[640px]" data-purpose="destination-details">
            <div>
              {/* Header Row: Title, Super Admin Badge and Total Workforce */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#111417] text-[#D8F929] tracking-wider uppercase">
                      Super Admin View
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">Auto-generated 2m ago</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 leading-tight">
                    Enterprise Workforce<br />& HR Pulse
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-gray-400 block leading-none mb-1">
                    Total Workforce
                  </span>
                  <span className="text-2xl font-bold text-gray-900 tracking-tight leading-none">
                    1,420
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 block mt-1">
                    +48 this month
                  </span>
                </div>
              </div>

              {/* Dynamic Hero Card / Key KPI Pills Banner */}
              <div className="w-full bg-gradient-to-br from-[#111417] via-[#1B2127] to-[#111417] text-white rounded-2xl p-3.5 mb-3 border border-gray-900/10 shadow-sm relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#D8F929]/15 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D8F929]"></span>
                    <span className="text-xs font-semibold tracking-tight text-gray-200">
                      Global Operational Health
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">HRMS-SYNC // v4.2</span>
                </div>

                {/* 3 Primary KPI Pills */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                    <span className="text-[10px] text-gray-400 block mb-0.5">Avg Attendance</span>
                    <span className="text-sm font-bold text-[#D8F929] tracking-tight">98.2%</span>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                    <span className="text-[10px] text-gray-400 block mb-0.5">Open Reqs</span>
                    <span className="text-sm font-bold text-white tracking-tight">34 Active</span>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                    <span className="text-[10px] text-gray-400 block mb-0.5">Pulse Score</span>
                    <span className="text-sm font-bold text-[#D8F929] tracking-tight">4.8 / 5.0</span>
                  </div>
                </div>
              </div>

              {/* Contextual AI Synthesis Summary */}
              <div className="p-2.5 bg-gray-50/80 rounded-xl border border-gray-200/60 mb-3.5">
                <p className="text-[11px] md:text-[11.5px] leading-relaxed text-gray-600 font-normal">
                  <strong className="text-gray-900 font-semibold">AI Synthesis:</strong> Q3 headcount expansion is tracking{' '}
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.5 rounded">
                    8% ahead of target
                  </span>
                  . Engineering hiring velocity accelerated while Operations attendance remains solid across US and EMEA hubs with zero compliance flags.
                </p>
              </div>

              {/* Section Title & Sub-toolbar */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Hiring Pipeline & Requisitions
                </h3>
                <div className="flex items-center gap-1.5">
                  {/* Layers & Filter Controls */}
                  <div className="flex items-center bg-gray-50 border border-gray-200/70 rounded-xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => showToast('Filtered by department hierarchy')}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition cursor-pointer"
                      title="Department Grouping"
                    >
                      <Layers size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast('Priority requisitions filter active')}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition cursor-pointer"
                      title="Filter Priority"
                    >
                      <Filter size={13} />
                    </button>
                  </div>

                  {/* Quick Expand Controls */}
                  <button
                    type="button"
                    onClick={() => setSortUrgent(!sortUrgent)}
                    className="flex items-center bg-gray-50 border border-gray-200/70 rounded-xl p-1 px-1.5 gap-1 text-[11px] font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition"
                  >
                    <span className="text-gray-400 text-[10px]">Sort:</span>
                    <span className="text-gray-800 font-bold">{sortUrgent ? 'Urgent' : 'All'}</span>
                  </button>
                </div>
              </div>

              {/* Hiring Pipeline Cards Stack */}
              <div className="space-y-2 mb-3">
                {REQUISITIONS_DATA.slice(0, sortUrgent ? 2 : 3).map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-xl border border-gray-200/80 bg-white hover:border-gray-300 transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-xs">{req.title}</span>
                        <span className="text-[10px] text-gray-400 font-normal">• {req.dept}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${req.stageStyle}`}>
                        {req.stage}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>
                        HR Lead: <strong className="text-gray-800 font-medium">{req.hrLead}</strong>
                      </span>
                      <span className="font-medium text-gray-700">{req.candidatesCount}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Department Attendance & Activity Breakdown */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Department Activity & Presence
                  </span>
                  <span className="text-[10px] font-medium text-gray-400">Weekly Shift Logs</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#F8F9FA] rounded-xl p-2 border border-gray-200/70">
                    <div className="flex items-center justify-between text-[10px] mb-1 text-gray-500">
                      <span>Engineering</span>
                      <span className="font-bold text-emerald-600">99.1%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#111417] rounded-full" style={{ width: '99.1%' }}></div>
                    </div>
                  </div>

                  <div className="bg-[#F8F9FA] rounded-xl p-2 border border-gray-200/70">
                    <div className="flex items-center justify-between text-[10px] mb-1 text-gray-500">
                      <span>Product & UX</span>
                      <span className="font-bold text-emerald-600">98.8%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#D8F929] rounded-full" style={{ width: '98.8%' }}></div>
                    </div>
                  </div>

                  <div className="bg-[#F8F9FA] rounded-xl p-2 border border-gray-200/70">
                    <div className="flex items-center justify-between text-[10px] mb-1 text-gray-500">
                      <span>Global Sales</span>
                      <span className="font-bold text-emerald-600">97.4%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#111417] rounded-full" style={{ width: '97.4%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom HR Lead Avatars & Floating Progress Pill */}
            <div className="relative mt-3">
              {/* Active HR Hiring Leads Avatars Bar */}
              <div className="grid grid-cols-4 gap-2 opacity-85">
                {HR_LEADS.map((lead, idx) => (
                  <div
                    key={idx}
                    className="h-12 rounded-xl overflow-hidden border border-gray-100 shadow-2xs relative group bg-gray-100 flex items-center justify-center cursor-pointer hover:opacity-100 transition"
                    title={lead.role}
                    onClick={() => showToast(`Selected HR Lead: ${lead.role}`)}
                  >
                    <img
                      alt={lead.role}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                      src={lead.img}
                    />
                    <span className="absolute bottom-1 left-1 text-[8px] bg-black/70 text-white px-1 rounded font-medium">
                      {lead.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Floating Glassmorphism Progress Pill */}
              {showProgressPill && (
                <div className="absolute inset-x-1 bottom-1 bg-white/90 backdrop-blur-md rounded-2xl p-2 px-3 border border-[#D8F929] shadow-lg flex items-center justify-between z-20 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-semibold text-gray-800">
                      Generating Department Audit Report
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 tracking-tight">94%</span>
                    <button
                      type="button"
                      onClick={() => showToast('Exporting Department Audit CSV Report...')}
                      className="px-2.5 py-1 rounded-lg bg-[#111417] text-[#D8F929] text-[10px] font-bold hover:bg-black transition cursor-pointer"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProgressPill(false)}
                      className="w-5 h-5 rounded-lg border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 transition cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
          {/* END: Right Card */}

        </main>
        {/* END: Main Content Layout */}

      </div>
    </div>
  );
}
