import { useEffect, useState, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import ResumePreviewModal from '../components/ResumePreviewModal';
import {
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  FileText,
  Building2,
  UserCheck,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Eye,
  Award,
  Zap,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  LogOut
} from 'lucide-react';

export default function SuperAdminOutreachControl() {
  const { token, logout } = useAuth();

  // Data states
  const [stats, setStats] = useState({
    total_outreach_sent: 0,
    status_counts: { sent: 0, interested: 0, unavailable: 0, passed: 0 },
    interested_count: 0,
    unavailable_count: 0,
    response_rate_percent: 0,
    telegram_sent_count: 0,
    telegram_connected_candidates: 0,
    auto_outreach_enabled: true
  });
  const [requisitions, setRequisitions] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [reqDetails, setReqDetails] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  
  // Settings & Toggles
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  // UI state
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingReqDetails, setLoadingReqDetails] = useState(false);
  const [triggeringOutreach, setTriggeringOutreach] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [alertingCandidateId, setAlertingCandidateId] = useState(null);
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' | 'activity' | 'message_preview'
  const [previewChannel, setPreviewChannel] = useState('telegram'); // 'telegram' | 'email'
  const [filterRsvp, setFilterRsvp] = useState('all'); // 'all' | 'interested' | 'unavailable' | 'pending'
  const [searchCandidate, setSearchCandidate] = useState('');
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [previewCandidateModal, setPreviewCandidateModal] = useState(null);
  const [resumeCandidate, setResumeCandidate] = useState(null);

  // Helper notification toaster
  const showToast = (message, type = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: '', message: '' }), 4000);
  };

  // Initial Data Fetch
  const fetchGlobalData = async () => {
    setLoadingStats(true);
    try {
      const [statsRes, reqsRes, settingsRes] = await Promise.all([
        request('/api/superadmin/outreach/stats', { token }).catch(() => null),
        request('/api/superadmin/outreach/requisitions', { token }).catch(() => []),
        request('/api/superadmin/outreach/settings', { token }).catch(() => null)
      ]);

      if (statsRes) {
        setStats(statsRes);
      }
      if (Array.isArray(reqsRes)) {
        setRequisitions(reqsRes);
        if (reqsRes.length > 0 && !selectedReqId) {
          setSelectedReqId(reqsRes[0].id);
        }
      }
      if (settingsRes && settingsRes.auto_outreach_enabled !== undefined) {
        setAutoEnabled(settingsRes.auto_outreach_enabled);
      }
    } catch (err) {
      showToast(err.message || 'Error loading outreach data', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  // The audit log is only needed when its tab is opened. Its payload can contain
  // dozens of records, so keep it off the critical dashboard render path.
  const fetchActivityFeed = async (forceRefresh = false) => {
    if (activityLoaded && !forceRefresh) return;
    try {
      const res = await request('/api/superadmin/outreach/activity', { token, forceRefresh });
      if (Array.isArray(res)) setActivityFeed(res);
      setActivityLoaded(true);
    } catch (err) {
      showToast(err.message || 'Error loading outreach activity', 'error');
    }
  };

  // Fetch requisition specific details when selected
  const fetchRequisitionDetails = async (reqId, silent = false) => {
    if (!reqId) return;
    if (!silent) setLoadingReqDetails(true);
    try {
      const res = await request(`/api/superadmin/outreach/requisition/${reqId}`, { token });
      setReqDetails(res);
    } catch (err) {
      showToast(err.message || 'Error fetching candidates for position', 'error');
    } finally {
      if (!silent) setLoadingReqDetails(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, [token]);

  useEffect(() => {
    if (selectedReqId) {
      fetchRequisitionDetails(selectedReqId);
    }
  }, [selectedReqId, token]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityFeed();
  }, [activeTab, token]);

  // Toggle Auto Outreach Setting
  const handleToggleAutoOutreach = async () => {
    setToggleLoading(true);
    try {
      const nextState = !autoEnabled;
      const res = await request('/api/superadmin/outreach/settings', {
        token,
        method: 'POST',
        body: JSON.stringify({ auto_outreach_enabled: nextState })
      });
      setAutoEnabled(res.auto_outreach_enabled);
      showToast(`Auto Candidate Outreach is now ${res.auto_outreach_enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (err) {
      showToast(err.message || 'Failed to update auto outreach setting', 'error');
    } finally {
      setToggleLoading(false);
    }
  };

  // Trigger manual matching & email dispatch
  const handleTriggerOutreach = async () => {
    if (!selectedReqId) return;
    setTriggeringOutreach(true);
    try {
      const res = await request(`/api/superadmin/outreach/trigger/${selectedReqId}`, {
        token,
        method: 'POST'
      });
      const tgCount = res.telegram_alerts_sent != null ? res.telegram_alerts_sent : (res.top_candidates || []).filter(c => c.telegram_sent).length;
      const count = res.outreach_dispatched || res.emails_sent || (res.top_candidates || []).length || 0;
      showToast(`Successfully evaluated pool: outreach dispatched to ${count} candidates (${tgCount} live Telegram alerts sent)!`);
      // Refresh current requisition details and stats
      await fetchRequisitionDetails(selectedReqId);
      const updatedStats = await request('/api/superadmin/outreach/stats', { token }).catch(() => null);
      if (updatedStats) setStats(updatedStats);
    } catch (err) {
      showToast(err.message || 'Failed to trigger candidate matching & outreach', 'error');
    } finally {
      setTriggeringOutreach(false);
    }
  };

  // Send single live test alert to Telegram
  const handleSendTestTelegram = async (email = '', name = '', candidateId = null) => {
    if (candidateId) {
      setAlertingCandidateId(candidateId);
    } else {
      setTestingTelegram(true);
    }
    try {
      const res = await request('/api/superadmin/outreach/send-test-telegram', {
        token,
        method: 'POST',
        body: { email, requisition_id: selectedReqId },
      });
      showToast(`⚡ Live Telegram alert delivered to ${name || 'connected Telegram'} (Chat ID: ${res.chat_id})!`);
      // Refresh details silently in background to update status badges without table glitch
      if (selectedReqId) await fetchRequisitionDetails(selectedReqId, true);
    } catch (err) {
      showToast(err.message || 'Failed to send test Telegram alert. Open @Termjobs_alertbot in Telegram and send your email to link!', 'error');
    } finally {
      if (candidateId) {
        setAlertingCandidateId(null);
      } else {
        setTestingTelegram(false);
      }
    }
  };

  // Filtered Top Candidates
  const filteredCandidates = useMemo(() => {
    if (!reqDetails?.top_candidates) return [];
    return reqDetails.top_candidates.filter((c) => {
      // RSVP Filter
      if (filterRsvp === 'interested' && c.outreach?.status !== 'interested') return false;
      if (filterRsvp === 'unavailable' && c.outreach?.status !== 'unavailable') return false;
      if (filterRsvp === 'pending' && c.outreach && c.outreach.status !== 'sent') return false;
      if (filterRsvp === 'unsent' && c.outreach) return false;

      // Text search
      if (searchCandidate) {
        const query = searchCandidate.toLowerCase();
        const nameMatch = (c.name || c.candidate_name || '').toLowerCase().includes(query);
        const emailMatch = (c.email || c.candidate_email || '').toLowerCase().includes(query);
        const titleMatch = (c.title || c.candidate_title || '').toLowerCase().includes(query);
        const skillMatch = (c.skills || []).some((s) => s.toLowerCase().includes(query));
        return nameMatch || emailMatch || titleMatch || skillMatch;
      }
      return true;
    });
  }, [reqDetails, filterRsvp, searchCandidate]);

  const selectedReq = useMemo(() => {
    return requisitions.find((r) => r.id === selectedReqId) || reqDetails?.requisition || null;
  }, [requisitions, selectedReqId, reqDetails]);

  return (
    <div className="w-full min-w-0 pb-16 space-y-4 text-left font-sans text-gray-900" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Toast Notification */}
      {notification.message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 transition-all backdrop-blur-md ${
            notification.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-800'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header: Unboxed, Transparent, Clean Big Typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1 flex-wrap">
            <span className="text-purple-800 font-extrabold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
              SUPER ADMIN • AI OUTREACH ENGINE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <span>AI Candidate Outreach & Matching</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-700 shadow-3xs">
              Live Engine
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-medium mt-1">
            Deterministic Top 20 talent ranking with automated interactive email & Telegram RSVP buttons.
          </p>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <NotificationBell />

          <a
            href="https://t.me/Termjobs_alertbot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-sky-800 text-xs font-bold transition-all shadow-3xs cursor-pointer no-underline active:scale-95"
            title="Open Telegram Bot"
          >
            <Send size={12} className="text-[#229ED9]" />
            <span className="hidden sm:inline">@Termjobs_alertbot</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </a>

          <button
            type="button"
            onClick={() => handleSendTestTelegram()}
            disabled={testingTelegram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-emerald-800 text-xs font-bold transition-all shadow-3xs cursor-pointer disabled:opacity-50 active:scale-95"
            title="Send a live test alert to Telegram right now"
          >
            <Send size={12} className="text-emerald-600" />
            <span>{testingTelegram ? 'Sending...' : 'Test Telegram'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleAutoOutreach}
            disabled={toggleLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/80 backdrop-blur-md text-xs font-bold transition-all shadow-3xs cursor-pointer active:scale-95 ${
              autoEnabled
                ? 'bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100/90'
                : 'bg-white/60 text-gray-600 hover:bg-white'
            }`}
          >
            {autoEnabled ? (
              <>
                <ToggleRight size={16} className="text-emerald-600" />
                <span className="hidden sm:inline">Auto: Active</span>
              </>
            ) : (
              <>
                <ToggleLeft size={16} className="text-gray-400" />
                <span className="hidden sm:inline">Auto: Paused</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              fetchGlobalData();
              if (selectedReqId) fetchRequisitionDetails(selectedReqId);
            }}
            className="p-2 rounded-xl border border-white/80 bg-white/60 hover:bg-white backdrop-blur-md text-gray-700 transition-all shadow-3xs cursor-pointer active:scale-95"
            title="Refresh All Data"
          >
            <RefreshCw size={13} className={loadingStats || loadingReqDetails ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl border border-rose-200/80 bg-rose-50/80 hover:bg-rose-100 text-rose-700 transition-all shadow-3xs cursor-pointer active:scale-95"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards - Modern Glassmorphism */}
      <div className="flex flex-row overflow-x-auto snap-x no-scrollbar lg:grid lg:grid-cols-5 gap-2.5 sm:gap-3.5 pb-1 lg:pb-0">
        {/* Total Outreach Sent */}
        <div className="w-[145px] sm:w-[165px] lg:w-full shrink-0 snap-start bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/55 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-gray-500 uppercase tracking-wider truncate">
              OUTREACH SENT
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 flex items-center justify-center shrink-0">
              <Mail size={13} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight my-0.5 leading-none">
            {stats.total_outreach_sent}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-1">
            Multi-channel reach
          </div>
        </div>

        {/* Interested & Fast-Tracked */}
        <div className="w-[145px] sm:w-[165px] lg:w-full shrink-0 snap-start bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/55 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider truncate">
              INTERESTED
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={13} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight my-0.5 leading-none">
            {stats.interested_count}
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-700/80 font-medium truncate mt-1">
            1-tap confirmed
          </div>
        </div>

        {/* Unavailable */}
        <div className="w-[145px] sm:w-[165px] lg:w-full shrink-0 snap-start bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/55 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-800 uppercase tracking-wider truncate">
              UNAVAILABLE
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <XCircle size={13} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight my-0.5 leading-none">
            {stats.unavailable_count}
          </div>
          <div className="text-[10px] sm:text-[11px] text-amber-700/80 font-medium truncate mt-1">
            Status recorded
          </div>
        </div>

        {/* Telegram Alerts Delivered */}
        <div className="w-[145px] sm:w-[165px] lg:w-full shrink-0 snap-start bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/55 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-sky-800 uppercase tracking-wider flex items-center gap-1 truncate">
              <Send size={10} className="text-[#229ED9] shrink-0" /> TELEGRAM
            </span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[#229ED9] flex items-center justify-center shrink-0">
              <Send size={13} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-900 tracking-tight my-0.5 leading-none">
            {stats.telegram_sent_count || 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-sky-700/80 font-medium truncate mt-1">
            {stats.telegram_connected_candidates || 0} linked
          </div>
        </div>

        {/* Response Rate */}
        <div className="w-[145px] sm:w-[165px] lg:w-full shrink-0 snap-start bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/55 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-purple-800 uppercase tracking-wider truncate">
              RSVP RATE
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 flex items-center justify-center shrink-0">
              <Zap size={13} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight my-0.5 leading-none">
            {stats.response_rate_percent}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-purple-700/80 font-medium truncate mt-1">
            1-click engagement
          </div>
        </div>
      </div>

      {/* Main Workspace: Requisition Selector & Outreach Controller */}
      <div className="bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 overflow-hidden space-y-4">
        {/* Workspace Header / Requisition Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Dropdown Selector */}
          <div className="flex-1 max-w-xl">
            <label className="block text-[10.5px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
              Target Requisition for Candidate Matching
            </label>
            <div className="relative">
              <select
                value={selectedReqId}
                onChange={(e) => setSelectedReqId(e.target.value)}
                className="w-full bg-white/70 border border-white/90 text-gray-900 text-xs font-bold rounded-xl px-3.5 py-2.5 shadow-3xs focus:outline-none focus:ring-1 focus:ring-black appearance-none cursor-pointer pr-10"
              >
                {requisitions.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.title} • {req.company_name} ({req.status})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Manual Run Top 20 Match & Dispatch Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleTriggerOutreach}
              disabled={triggeringOutreach || !selectedReqId}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {triggeringOutreach ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Evaluating Pool & Dispatching...</span>
                </>
              ) : (
                <>
                  <Send size={13} className="text-amber-400" />
                  <span>Run Top 20 Match & Send Emails</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Active Requisition Pill Bar */}
        {selectedReq && (
          <div className="pt-2.5 border-t border-black/[0.04] flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-900 text-xs sm:text-[13px]">{selectedReq.title}</span>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-gray-100/90 border border-gray-200/60 px-2 py-0.5 rounded-lg text-[11px] shadow-3xs">
                <Building2 size={11} className="text-gray-500" /> {selectedReq.company_name}
              </span>
              <span className="text-gray-300">•</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 text-[10.5px] shadow-3xs">
                {selectedReq.status}
              </span>
              {selectedReq.skills && selectedReq.skills.length > 0 && (
                <div className="flex items-center gap-1 ml-1 flex-wrap">
                  <span className="text-gray-400 text-[11px]">Key Skills:</span>
                  {selectedReq.skills.slice(0, 4).map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200/80 shadow-3xs">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selectedReq.last_outreach_at && (
              <div className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                <Clock size={12} />
                <span>Last Dispatched: {new Date(selectedReq.last_outreach_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Primary Navigation Tabs - Rounded Glassmorphic Tab Bar Container */}
        <div className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('candidates')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'candidates'
                ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
                : 'text-gray-700 hover:text-black hover:bg-white/60'
            }`}
          >
            <Award size={13} className={activeTab === 'candidates' ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} />
            <span>Ranked Top 20</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'candidates' ? 'bg-amber-50 text-amber-900 border border-amber-200/80' : 'bg-gray-100 text-gray-600'
            }`}>
              {reqDetails?.top_candidates?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email_preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'email_preview'
                ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
                : 'text-gray-700 hover:text-black hover:bg-white/60'
            }`}
          >
            <Send size={13} className={activeTab === 'email_preview' ? 'text-[#229ED9]' : 'text-gray-400'} />
            <span>Interactive Alerts (Telegram & Email)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'activity'
                ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
                : 'text-gray-700 hover:text-black hover:bg-white/60'
            }`}
          >
            <Clock size={13} className={activeTab === 'activity' ? 'text-purple-600' : 'text-gray-400'} />
            <span>Outreach Audit Feed</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'activity' ? 'bg-purple-50 text-purple-900 border border-purple-200/80' : 'bg-gray-100 text-gray-600'
            }`}>
              {activityFeed.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Candidates Roster */}
        {activeTab === 'candidates' && (
          <div className="space-y-4">
            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by candidate name, skills, title..."
                  value={searchCandidate}
                  onChange={(e) => setSearchCandidate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black shadow-3xs transition-all"
                />
              </div>

              {/* Status Pill Filters */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-bold text-gray-400 mr-1 flex items-center gap-1">
                  <Filter size={12} /> RSVP:
                </span>
                {[
                  { id: 'all', label: 'All Ranked' },
                  { id: 'interested', label: '✓ Interested' },
                  { id: 'unavailable', label: '✕ Unavailable' },
                  { id: 'pending', label: 'Awaiting' },
                  { id: 'unsent', label: 'Unsent' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterRsvp(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      filterRsvp === f.id
                        ? 'bg-slate-950 text-white shadow-2xs border border-slate-900'
                        : 'bg-white/50 backdrop-blur-md border border-white/80 text-gray-600 hover:text-black hover:bg-white/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidates Table */}
            {loadingReqDetails ? (
              <div className="p-12 text-center text-gray-500 text-xs font-semibold flex items-center justify-center gap-2 bg-white/30 backdrop-blur-md rounded-2xl border border-white/60">
                <RefreshCw size={16} className="animate-spin text-gray-800" />
                <span>Running candidate talent ranking algorithms...</span>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs bg-white/30 backdrop-blur-md rounded-2xl border border-dashed border-white/80 shadow-3xs">
                No candidates matched the current filter criteria for this requisition.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto no-scrollbar rounded-2xl border border-white/80 bg-white/30 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-white/40 border-b border-black/[0.04]">
                      <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-3 px-3 text-center w-12">Rank</th>
                        <th className="py-3 px-3">Candidate & Source</th>
                        <th className="py-3 px-3 w-40">Match Fit</th>
                        <th className="py-3 px-3">Skills & Title</th>
                        <th className="py-3 px-3 w-48">RSVP Status</th>
                        <th className="py-3 px-3 text-right w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03]">
                      {filteredCandidates.map((c) => {
                        const outreach = c.outreach;

                        return (
                          <tr key={c.candidate_id || c.id} className="hover:bg-white/50 transition-colors group">
                            {/* Rank */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-[11px] ${
                                  c.rank === 1
                                    ? 'bg-gradient-to-br from-amber-200 to-amber-400 text-amber-950 border border-amber-300 shadow-2xs'
                                    : c.rank === 2
                                    ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-900 border border-slate-300 shadow-2xs'
                                    : c.rank === 3
                                    ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 border border-amber-200 shadow-2xs'
                                    : 'bg-white/80 text-gray-600 font-bold border border-white/90 shadow-3xs'
                                }`}
                              >
                                #{c.rank}
                              </span>
                            </td>

                            {/* Candidate & Contact */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs bg-slate-900 text-white font-bold text-xs">
                                  {(c.name || c.candidate_name || 'CA').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div
                                    onClick={() => setPreviewCandidateModal(c)}
                                    className="font-bold text-gray-950 text-xs truncate hover:underline cursor-pointer"
                                  >
                                    {c.name || c.candidate_name || 'Candidate'}
                                  </div>
                                  <div className="text-[11px] text-gray-400 font-mono truncate">{c.email || c.candidate_email}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded-md bg-white/80 text-gray-600 text-[10px] font-semibold border border-white/90 shadow-3xs">
                                      {c.vendor_name || 'Direct Applicant'}
                                    </span>
                                    {c.telegram_connected ? (
                                      <a
                                        href={`https://t.me/${c.telegram_username || 'Termjobs_alertbot'}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-1.5 py-0.5 rounded-md bg-sky-50 text-[#229ED9] text-[10px] font-bold border border-sky-200/80 flex items-center gap-1 hover:bg-sky-100 transition-colors"
                                        title="Open Candidate Telegram"
                                      >
                                        <Send size={10} /> @{c.telegram_username || 'Telegram'}
                                      </a>
                                    ) : (
                                      <a
                                        href={`https://t.me/Termjobs_alertbot?start=${encodeURIComponent(c.email || c.candidate_email || c.id)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Click to link this candidate via Telegram Bot"
                                      >
                                        <span>🔗</span> Link Telegram
                                      </a>
                                    )}
                                    {c.experience_years && (
                                      <span className="text-[10px] text-gray-400 font-medium">
                                        {c.experience_years} yrs exp
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Match Score */}
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-black text-xs text-gray-900">
                                  {Math.round(c.match_score)}%
                                </span>
                                <span className={`text-[10px] font-bold ${c.match_score >= 80 ? 'text-emerald-600' : c.match_score >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                                  {c.match_score >= 80 ? 'Strong Fit' : c.match_score >= 60 ? 'Good Fit' : 'Fair'}
                                </span>
                              </div>
                              <div className="w-full bg-black/[0.04] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    c.match_score >= 80
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                      : c.match_score >= 60
                                      ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                                      : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(10, c.match_score))}%` }}
                                />
                              </div>
                              {c.match_reasons && c.match_reasons.length > 0 && (
                                <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[130px]" title={c.match_reasons.join(', ')}>
                                  {c.match_reasons[0]}
                                </div>
                              )}
                            </td>

                            {/* Skills */}
                            <td className="py-3 px-3">
                              <div className="text-xs font-bold text-gray-900">{c.title || c.candidate_title || 'Candidate'}</div>
                              <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                                {(c.skills || []).slice(0, 4).map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded-md bg-white/70 text-gray-700 text-[10px] font-medium border border-white/80 shadow-3xs"
                                  >
                                    {s}
                                  </span>
                                ))}
                                {(c.skills || []).length > 4 && (
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    +{c.skills.length - 4} more
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Live Email & Telegram RSVP Status */}
                            <td className="py-3 px-3">
                              {!outreach ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/70 text-gray-600 border border-white/90 shadow-3xs">
                                  <Clock size={11} className="text-gray-400" /> Unsent
                                </span>
                              ) : outreach.status === 'interested' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50/90 text-emerald-800 border border-emerald-200/90 shadow-3xs">
                                    <CheckCircle2 size={11} className="text-emerald-600" /> Available & Interested
                                  </span>
                                  <div className="text-[9.5px] text-emerald-700 font-semibold pl-1">
                                    Fast-Tracked into Pipeline
                                  </div>
                                  {outreach.telegram_sent && (
                                    <div className="text-[9.5px] text-sky-700 font-bold flex items-center gap-1 pl-1">
                                      <Send size={9} /> Telegram Alert Sent
                                    </div>
                                  )}
                                </div>
                              ) : outreach.status === 'unavailable' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50/90 text-rose-800 border border-rose-200/90 shadow-3xs">
                                    <XCircle size={11} className="text-rose-600" /> Placed Elsewhere
                                  </span>
                                  <div className="text-[9.5px] text-gray-400 font-medium pl-1">
                                    Availability updated
                                  </div>
                                </div>
                              ) : outreach.status === 'passed' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/70 text-gray-700 border border-white/90 shadow-3xs">
                                  Passed on this role
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50/90 text-blue-800 border border-blue-200/90 shadow-3xs">
                                    <Mail size={11} className="text-blue-600" /> Sent • Awaiting RSVP
                                  </span>
                                  {outreach.telegram_sent && (
                                    <div className="text-[9.5px] text-sky-700 font-bold flex items-center gap-1 pl-1">
                                      <Send size={9} /> Telegram Alert Sent
                                    </div>
                                  )}
                                  {outreach.sent_at && (
                                    <div className="text-[9.5px] text-gray-400 pl-1 font-mono">
                                      {new Date(outreach.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {c.resume_url && (
                                  <button
                                    type="button"
                                    onClick={() => setResumeCandidate(c)}
                                    className="p-1.5 rounded-xl border border-white/90 bg-white/60 hover:bg-white text-gray-700 transition-all shadow-3xs active:scale-95"
                                    title="View Resume"
                                  >
                                    <FileText size={13} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleSendTestTelegram(c.email || c.candidate_email, c.name || c.candidate_name, c.candidate_id || c.id)}
                                  disabled={alertingCandidateId === (c.candidate_id || c.id) || testingTelegram}
                                  className="px-2.5 py-1.5 rounded-xl border border-sky-200/90 bg-sky-50/80 hover:bg-sky-100/90 text-[11px] font-bold text-sky-800 transition-all shadow-3xs flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95"
                                  title="Send live Telegram match alert to this candidate"
                                >
                                  {alertingCandidateId === (c.candidate_id || c.id) ? (
                                    <>
                                      <RefreshCw size={10} className="animate-spin text-[#229ED9]" />
                                      <span>Sending...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send size={10} className="text-[#229ED9]" />
                                      <span>Alert</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewCandidateModal(c)}
                                  className="px-2.5 py-1.5 rounded-xl border border-white/90 bg-white/80 hover:bg-white text-[11px] font-bold text-gray-900 transition-all shadow-3xs active:scale-95"
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View Alternative */}
                <div className="block md:hidden divide-y divide-black/[0.04] border border-white/80 rounded-2xl bg-white/40 backdrop-blur-md overflow-hidden shadow-sm">
                  {filteredCandidates.map((c) => {
                    const outreach = c.outreach;

                    return (
                      <div key={c.candidate_id || c.id} className="p-3.5 space-y-2.5 hover:bg-white/60 transition">
                        {/* Top: Rank, Name, Fit */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-[11px] shrink-0 ${
                                c.rank === 1
                                  ? 'bg-gradient-to-br from-amber-200 to-amber-400 text-amber-950 border border-amber-300 shadow-2xs'
                                  : c.rank === 2
                                  ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-900 border border-slate-300 shadow-2xs'
                                  : c.rank === 3
                                  ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 border border-amber-200 shadow-2xs'
                                  : 'bg-white/80 text-gray-600 font-bold border border-white/90 shadow-3xs'
                              }`}
                            >
                              #{c.rank}
                            </span>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs bg-slate-900 text-white font-bold text-[11px]">
                              {(c.name || c.candidate_name || 'CA').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-950 text-sm truncate">
                                {c.name || c.candidate_name || 'Candidate'}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate">
                                {c.title || c.candidate_title || 'Candidate'}
                              </div>
                            </div>
                          </div>

                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-3xs">
                            {Math.round(c.match_score)}% Fit
                          </span>
                        </div>

                        {/* Metadata: Source + Telegram */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-white/70 font-semibold text-gray-700 text-[10.5px] border border-white/80 shadow-3xs">
                            {c.vendor_name || 'Direct Applicant'}
                          </span>
                          {c.telegram_connected ? (
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-[#229ED9] text-[10.5px] font-bold border border-sky-200/80 flex items-center gap-1">
                              <Send size={10} /> Linked
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Telegram Unlinked</span>
                          )}
                          {c.email && (
                            <span className="text-gray-400 truncate max-w-[170px] font-mono text-[10.5px]">
                              {c.email}
                            </span>
                          )}
                        </div>

                        {/* Skills */}
                        {(c.skills || []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(c.skills || []).slice(0, 3).map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-white/70 border border-white/80 text-gray-700 text-[10px] font-medium shadow-3xs">
                                {s}
                              </span>
                            ))}
                            {(c.skills || []).length > 3 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-white/50 text-gray-500 text-[10px] font-semibold border border-white/60">
                                +{(c.skills || []).length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* RSVP Status Bar */}
                        <div className="bg-white/60 backdrop-blur-md rounded-xl p-2.5 border border-white/80 shadow-3xs flex items-center justify-between text-xs">
                          <span className="text-[11px] text-gray-500 font-semibold">Status:</span>
                          {!outreach ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-gray-600">
                              <Clock size={11} className="text-gray-400" /> Unsent
                            </span>
                          ) : outreach.status === 'interested' ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                              <CheckCircle2 size={11} className="text-emerald-600" /> Available & Interested
                            </span>
                          ) : outreach.status === 'unavailable' ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700">
                              <XCircle size={11} className="text-rose-600" /> Placed Elsewhere
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700">
                              <Mail size={11} className="text-blue-600" /> Outreach Sent
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-1.5 pt-1 text-xs">
                          <button
                            type="button"
                            onClick={() => handleSendTestTelegram(c.email || c.candidate_email, c.name || c.candidate_name, c.candidate_id || c.id)}
                            disabled={alertingCandidateId === (c.candidate_id || c.id) || testingTelegram}
                            className="flex-1 py-1.5 px-2.5 rounded-xl border border-sky-300/80 bg-sky-50/80 hover:bg-sky-100 text-[11px] font-bold text-sky-800 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 shadow-3xs"
                          >
                            <Send size={11} className="text-[#229ED9]" />
                            <span>Send Telegram Alert</span>
                          </button>

                          {c.resume_url && (
                            <button
                              type="button"
                              onClick={() => setResumeCandidate(c)}
                              className="p-1.5 rounded-xl border border-white/90 bg-white/70 hover:bg-white text-gray-700 transition active:scale-95 shadow-3xs"
                              title="View Resume"
                            >
                              <FileText size={13} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setPreviewCandidateModal(c)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-black text-white text-[11px] font-bold shadow-2xs transition active:scale-95"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Interactive Outreach Preview (Telegram & Email) */}
        {activeTab === 'email_preview' && (
          <div className="space-y-6 pt-1">
            {/* Format Toggle - Rounded Glassmorphic Segmented Control */}
            <div className="flex items-center justify-center">
              <div className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/40 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)]">
                <button
                  type="button"
                  onClick={() => setPreviewChannel('telegram')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                    previewChannel === 'telegram'
                      ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
                      : 'text-gray-700 hover:text-black hover:bg-white/60'
                  }`}
                >
                  <Send size={14} className="text-[#229ED9]" />
                  <span>Telegram Bot Alert</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-[#229ED9] text-[9.5px] font-black">LIVE</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewChannel('email')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                    previewChannel === 'email'
                      ? 'bg-white text-gray-950 border border-white/90 shadow-2xs font-extrabold'
                      : 'text-gray-700 hover:text-black hover:bg-white/60'
                  }`}
                >
                  <Mail size={14} className="text-gray-700" />
                  <span>HTML Email Design</span>
                </button>
              </div>
            </div>

            {/* View 1: Telegram Bot Alert Interface */}
            {previewChannel === 'telegram' && (
              <div className="max-w-md mx-auto bg-[#0F141C]/95 backdrop-blur-2xl text-white rounded-3xl p-5 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-150">
                {/* Telegram App Header Bar */}
                <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-3.5 px-1 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                      TJ
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1 text-[13px]">
                        TermJobs Career Alerts
                        <CheckCircle2 size={13} className="text-[#229ED9] fill-[#229ED9]" />
                      </div>
                      <div className="text-[10px] text-gray-400">@Termjobs_alertbot • bot</div>
                    </div>
                  </div>
                  <a
                    href="https://t.me/Termjobs_alertbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#229ED9] hover:underline"
                  >
                    Open Bot ↗
                  </a>
                </div>

                {/* Telegram Chat Bubble */}
                <div className="bg-[#18222D]/90 rounded-2xl p-4 text-xs leading-relaxed space-y-3 border border-white/10 shadow-lg">
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    💼 NEW MATCH: {selectedReq?.title || 'Senior Software Engineer'}
                  </div>
                  <div className="text-[11.5px] text-gray-300 space-y-1.5 bg-black/35 p-3 rounded-xl border border-white/5">
                    <div>🏢 <strong>Organization:</strong> {selectedReq?.company_name || 'Enterprise Partner'}</div>
                    <div>⭐ <strong>Match Fit:</strong> 96% Score</div>
                    <div>🎯 <strong>Key Requirements:</strong> {(selectedReq?.skills || ['Python', 'FastAPI', 'Cloud']).join(', ')}</div>
                    <div>💡 <strong>Why you matched:</strong> High overlap with verified candidate competencies</div>
                  </div>

                  <p className="text-[11.5px] text-gray-200">
                    Hi <strong>Rahul</strong>! Our AI talent engine ranked your profile among the <strong>Top 20 best-fit candidates</strong> for this requisition.
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Because availability changes, please confirm your interest with 1 tap below:
                  </p>

                  {/* Telegram Inline Keyboard Buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#2B5278] to-[#254566] hover:from-[#346394] hover:to-[#2B5278] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-sky-400/30 shadow-md cursor-pointer active:scale-98"
                    >
                      <Check size={14} className="text-emerald-400" />
                      <span>✅ Yes, I am Available & Interested</span>
                    </button>
                    <button
                      type="button"
                      className="w-full py-2.5 px-3 rounded-xl bg-[#2B5278]/60 hover:bg-[#2B5278] text-gray-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/10 cursor-pointer active:scale-98"
                    >
                      <X size={14} className="text-rose-400" />
                      <span>❌ No Longer Available / Placed</span>
                    </button>
                  </div>
                </div>

                {/* Explanatory footer */}
                <div className="mt-3.5 text-center text-[10.5px] text-gray-400 px-2">
                  ⚡ <strong>Zero friction:</strong> Tapping either button triggers an instant callback update in MongoDB and notifies your hiring managers in real time.
                </div>
              </div>
            )}

            {/* View 2: HTML Email Design */}
            {previewChannel === 'email' && (
              <div className="max-w-2xl mx-auto bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.04)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Fake Email Client Chrome */}
                <div className="bg-white/50 border-b border-black/[0.04] px-5 py-3 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="font-bold text-gray-700 ml-2">Inbox Preview (Interactive Email)</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-400">from: TermJobs Talent Team &lt;talent@termjobs.com&gt;</span>
                </div>

                {/* Email Content Body */}
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Header */}
                  <div className="border-b border-black/[0.04] pb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-950 text-white font-black flex items-center justify-center text-xs shadow-2xs">
                        TJ
                      </div>
                      <span className="font-black text-sm text-gray-950 tracking-tight">TermJobs Executive Staffing</span>
                    </div>
                    <h2 className="text-xl font-black text-gray-950">
                      Exclusive Opportunity: {selectedReq?.title || 'Senior Software Engineer'} at {selectedReq?.company_name || 'Enterprise Partner'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Matching your candidate talent profile on the TermJobs network.
                    </p>
                  </div>

                  {/* Body Message */}
                  <div className="text-xs text-gray-700 leading-relaxed space-y-3">
                    <p>Hi <strong>[Candidate Name]</strong>,</p>
                    <p>
                      Our AI talent matching engine identified your background as a <strong>Top 20 fit</strong> for an active requisition with <strong>{selectedReq?.company_name || 'our enterprise client'}</strong>.
                    </p>
                    <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 space-y-1.5 text-xs shadow-3xs">
                      <div><strong>Position:</strong> {selectedReq?.title || 'Open Role'}</div>
                      <div><strong>Organization:</strong> {selectedReq?.company_name || 'Client Company'}</div>
                      <div><strong>Key Skills:</strong> {(selectedReq?.skills || ['Cloud Architecture', 'Python', 'React']).join(', ')}</div>
                      <div><strong>Status:</strong> Immediate Hiring Priority</div>
                    </div>
                    <p>
                      Because candidate availability changes over time, please click one of the buttons below so our hiring managers know your current status:
                    </p>
                  </div>

                  {/* THE TWO BIG INTERACTIVE BUTTONS */}
                  <div className="p-5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 space-y-3 text-center shadow-3xs">
                    <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                      Interactive 1-Click RSVP
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <div className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-95">
                        <Check size={16} />
                        <span>✓ Yes, I am Available & Interested</span>
                      </div>
                      <div className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-95">
                        <X size={16} />
                        <span>✕ No Longer Available / Placed Elsewhere</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      No password or login required. Clicking instantly updates your profile and notifies the recruiting team.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Live Outreach Audit Feed */}
        {activeTab === 'activity' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <Clock size={14} className="text-purple-600" /> Real-Time Outreach Event Log
              </h3>
              <span className="px-2.5 py-1 rounded-full bg-white/60 text-gray-600 border border-white/80 text-[10.5px] font-bold shadow-3xs">
                {activityFeed.length} Events
              </span>
            </div>

            {activityFeed.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 bg-white/30 backdrop-blur-md rounded-2xl border border-dashed border-white/80 shadow-3xs">
                No email outreach events recorded yet. Click "Run Top 20 Match & Dispatch" to start.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04] border border-white/80 rounded-2xl bg-white/30 backdrop-blur-md overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                {activityFeed.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/50 transition-colors text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs ${
                          item.status === 'interested'
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                            : item.status === 'unavailable'
                            ? 'bg-gradient-to-br from-rose-500 to-pink-600'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}
                      >
                        {item.status === 'interested' ? (
                          <Check size={14} />
                        ) : item.status === 'unavailable' ? (
                          <X size={14} />
                        ) : (
                          <Mail size={14} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-gray-950">
                          {item.candidate_name || 'Candidate'} ({item.candidate_email})
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Requisition: <span className="font-semibold text-gray-800">{item.requisition_title || item.requisition_id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-3xs ${
                          item.status === 'interested'
                            ? 'bg-emerald-50/90 text-emerald-800 border border-emerald-200/90'
                            : item.status === 'unavailable'
                            ? 'bg-rose-50/90 text-rose-800 border border-rose-200/90'
                            : 'bg-blue-50/90 text-blue-800 border border-blue-200/90'
                        }`}
                      >
                        {item.status === 'interested'
                          ? 'Available & Interested'
                          : item.status === 'unavailable'
                          ? 'Placed Elsewhere'
                          : 'Email Sent'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {item.responded_at ? new Date(item.responded_at).toLocaleTimeString() : new Date(item.sent_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candidate Inspector Modal */}
      {previewCandidateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-white/90 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.04] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-2xs bg-slate-900 text-white font-black text-xs">
                  {(previewCandidateModal.name || 'CA').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200">
                      Rank #{previewCandidateModal.rank} Match
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">
                      {Math.round(previewCandidateModal.match_score)}% Fit
                    </span>
                  </div>
                  <h3 className="text-base font-black text-gray-950 mt-0.5">{previewCandidateModal.name}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCandidateModal(null)}
                className="p-1.5 rounded-xl hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-3xs">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email</div>
                  <div className="font-semibold text-gray-900 truncate font-mono mt-0.5">{previewCandidateModal.email}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vendor / Source</div>
                  <div className="font-semibold text-gray-900 truncate mt-0.5">{previewCandidateModal.vendor_name || 'Direct Applicant'}</div>
                </div>
              </div>

              <div className="p-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-3xs space-y-1.5">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Match Analysis ({Math.round(previewCandidateModal.match_score)}%)</div>
                <div className="space-y-1">
                  {(previewCandidateModal.match_reasons || []).map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-gray-700 text-xs">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-3xs space-y-1.5">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Skills & Proficiencies</div>
                <div className="flex flex-wrap gap-1">
                  {(previewCandidateModal.skills || []).map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-white/80 text-gray-700 font-semibold border border-white/90 text-[10px] shadow-3xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {previewCandidateModal.resume_url && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setResumeCandidate(previewCandidateModal)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-black transition-all shadow-xs active:scale-95"
                  >
                    <ExternalLink size={14} /> View Stored Resume
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {resumeCandidate && (
        <ResumePreviewModal
          token={token}
          candidateId={resumeCandidate.id || resumeCandidate.candidate_id}
          filename={resumeCandidate.filename || `${resumeCandidate.name || resumeCandidate.candidate_name || 'Candidate'}_Resume.pdf`}
          onClose={() => setResumeCandidate(null)}
        />
      )}
    </div>
  );
}
