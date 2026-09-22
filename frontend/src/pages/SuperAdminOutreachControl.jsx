import { useEffect, useState, useMemo } from 'react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
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
  Check,
  X,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export default function SuperAdminOutreachControl() {
  const { token } = useAuth();

  // Data states
  const [stats, setStats] = useState({
    total_outreach_sent: 0,
    status_counts: { sent: 0, interested: 0, unavailable: 0, passed: 0 },
    interested_count: 0,
    unavailable_count: 0,
    response_rate_percent: 0,
    auto_outreach_enabled: true
  });
  const [requisitions, setRequisitions] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [reqDetails, setReqDetails] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  
  // Settings & Toggles
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  // UI state
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingReqDetails, setLoadingReqDetails] = useState(false);
  const [triggeringOutreach, setTriggeringOutreach] = useState(false);
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' | 'activity' | 'email_preview'
  const [filterRsvp, setFilterRsvp] = useState('all'); // 'all' | 'interested' | 'unavailable' | 'pending'
  const [searchCandidate, setSearchCandidate] = useState('');
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [previewCandidateModal, setPreviewCandidateModal] = useState(null);

  // Helper notification toaster
  const showToast = (message, type = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: '', message: '' }), 4000);
  };

  // Initial Data Fetch
  const fetchGlobalData = async () => {
    setLoadingStats(true);
    try {
      const [statsRes, reqsRes, settingsRes, actRes] = await Promise.all([
        request('/api/superadmin/outreach/stats', { token }).catch(() => null),
        request('/api/superadmin/outreach/requisitions', { token }).catch(() => []),
        request('/api/superadmin/outreach/settings', { token }).catch(() => null),
        request('/api/superadmin/outreach/activity', { token }).catch(() => [])
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
      if (Array.isArray(actRes)) {
        setActivityFeed(actRes);
      }
    } catch (err) {
      showToast(err.message || 'Error loading outreach data', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch requisition specific details when selected
  const fetchRequisitionDetails = async (reqId) => {
    if (!reqId) return;
    setLoadingReqDetails(true);
    try {
      const res = await request(`/api/superadmin/outreach/requisition/${reqId}`, { token });
      setReqDetails(res);
    } catch (err) {
      showToast(err.message || 'Error fetching candidates for position', 'error');
    } finally {
      setLoadingReqDetails(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, [token]);

  useEffect(() => {
    if (selectedReqId) {
      fetchRequisitionDetails(selectedReqId);
    }
  }, [selectedReqId]);

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
      showToast(`Successfully evaluated pool and dispatched emails to ${res.emails_sent || 0} top candidates!`);
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
        const nameMatch = c.name?.toLowerCase().includes(query);
        const emailMatch = c.email?.toLowerCase().includes(query);
        const titleMatch = c.title?.toLowerCase().includes(query);
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
    <div className="space-y-6 pb-12 font-sans text-gray-900 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Toast Notification */}
      {notification.message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2.5 transition-all ${
            notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Breadcrumb & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
            <Link to="/dashboard/superadmin" className="hover:text-black transition-colors">
              Super Admin
            </Link>
            <ChevronRight size={13} />
            <Link to="/dashboard/superadmin/candidates" className="hover:text-black transition-colors">
              Candidate Pool
            </Link>
            <ChevronRight size={13} />
            <span className="text-gray-900 font-bold">AI Outreach & Matching</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles size={20} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                AI Candidate Outreach & Matching Engine
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Deterministic Top 20 talent ranking with automated interactive email RSVP buttons.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Automated Dispatch Toggle */}
          <button
            type="button"
            onClick={handleToggleAutoOutreach}
            disabled={toggleLoading}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              autoEnabled
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {autoEnabled ? (
              <>
                <ToggleRight size={20} className="text-emerald-600" />
                <span>Auto-Outreach: Active</span>
              </>
            ) : (
              <>
                <ToggleLeft size={20} className="text-gray-400" />
                <span>Auto-Outreach: Paused</span>
              </>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              fetchGlobalData();
              if (selectedReqId) fetchRequisitionDetails(selectedReqId);
            }}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-xs cursor-pointer"
            title="Refresh All Data"
          >
            <RefreshCw size={16} className={loadingStats || loadingReqDetails ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Emails Sent */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              TOTAL EMAILS DISPATCHED
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center">
              <Mail size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 tracking-tight my-1">
            {stats.total_outreach_sent}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Personalized HTML emails to Top 20 ranked candidates
          </div>
        </div>

        {/* Interested & Fast-Tracked */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              AVAILABLE & INTERESTED
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 tracking-tight my-1">
            {stats.interested_count}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Clicked button & auto fast-tracked into recruiter pipeline
          </div>
        </div>

        {/* Placed Elsewhere */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              PLACED / UNAVAILABLE
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center">
              <XCircle size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-600 tracking-tight my-1">
            {stats.unavailable_count}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Talent memory auto-updated to prevent wasted recruiter outreach
          </div>
        </div>

        {/* Response Rate */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              INTERACTIVE RSVP RATE
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700 flex items-center justify-center">
              <Zap size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-purple-700 tracking-tight my-1">
            {stats.response_rate_percent}%
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Candidate engagement with 1-click action buttons
          </div>
        </div>
      </div>

      {/* Main Workspace: Requisition Selector & Outreach Controller */}
      <div className="bg-white border border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Workspace Header / Requisition Selector */}
        <div className="p-5 sm:p-6 border-b border-gray-200 bg-gray-50/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Dropdown Selector */}
            <div className="flex-1 max-w-xl">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Target Requisition for Candidate Matching
              </label>
              <div className="relative">
                <select
                  value={selectedReqId}
                  onChange={(e) => setSelectedReqId(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm font-semibold rounded-xl px-3.5 py-2.5 shadow-2xs focus:ring-2 focus:ring-black focus:outline-none appearance-none cursor-pointer"
                >
                  {requisitions.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.title} • {req.company_name} ({req.status})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
            </div>

            {/* Manual Run Top 20 Match & Dispatch Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTriggerOutreach}
                disabled={triggeringOutreach || !selectedReqId}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {triggeringOutreach ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Evaluating Pool & Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} className="text-amber-400" />
                    <span>Run Top 20 Match & Send Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Requisition Pill Bar */}
          {selectedReq && (
            <div className="mt-4 pt-3 border-t border-gray-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-gray-900">{selectedReq.title}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600 flex items-center gap-1">
                  <Building2 size={13} /> {selectedReq.company_name}
                </span>
                <span className="text-gray-400">•</span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold border border-gray-200 text-[11px]">
                  {selectedReq.status}
                </span>
                {selectedReq.skills && selectedReq.skills.length > 0 && (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-gray-400 text-[11px]">Key Skills:</span>
                    {selectedReq.skills.slice(0, 4).map((s, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px] border border-blue-200">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {selectedReq.last_outreach_at && (
                <div className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                  <Clock size={12} />
                  <span>Last Dispatched: {new Date(selectedReq.last_outreach_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 sm:px-6 bg-white">
          <div className="flex space-x-6">
            <button
              type="button"
              onClick={() => setActiveTab('candidates')}
              className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'candidates'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Award size={15} />
              <span>Ranked Top 20 Candidates ({reqDetails?.top_candidates?.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email_preview')}
              className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'email_preview'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Mail size={15} />
              <span>Interactive Email Design</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'activity'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Clock size={15} />
              <span>Live Outreach Audit Feed ({activityFeed.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Candidates Roster */}
        {activeTab === 'candidates' && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by candidate name, skills, title..."
                  value={searchCandidate}
                  onChange={(e) => setSearchCandidate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Status Pill Filters */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-semibold text-gray-400 mr-1 flex items-center gap-1">
                  <Filter size={12} /> RSVP:
                </span>
                {[
                  { id: 'all', label: 'All Ranked' },
                  { id: 'interested', label: '✓ Interested' },
                  { id: 'unavailable', label: '✕ Placed / Unavailable' },
                  { id: 'pending', label: 'Awaiting Response' },
                  { id: 'unsent', label: 'Unsent' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterRsvp(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      filterRsvp === f.id
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidates Table */}
            {loadingReqDetails ? (
              <div className="p-12 text-center text-gray-500 text-xs font-semibold flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-gray-800" />
                <span>Running candidate talent ranking algorithms...</span>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No candidates matched the current filter criteria for this requisition.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs divide-y divide-gray-200">
                  <thead className="bg-gray-50 font-bold text-gray-600 tracking-wider uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Rank</th>
                      <th className="py-3 px-4">Candidate & Source</th>
                      <th className="py-3 px-4 w-36">Match Score</th>
                      <th className="py-3 px-4">Skills & Profile</th>
                      <th className="py-3 px-4 w-44">Live Email RSVP Status</th>
                      <th className="py-3 px-4 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredCandidates.map((c) => {
                      const outreach = c.outreach;
                      const isTop3 = c.rank <= 3;

                      return (
                        <tr key={c.candidate_id} className="hover:bg-gray-50/80 transition-colors">
                          {/* Rank */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-extrabold text-[11px] ${
                                c.rank === 1
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : c.rank === 2
                                  ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                  : c.rank === 3
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              #{c.rank}
                            </span>
                          </td>

                          {/* Candidate & Contact */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900 text-xs">{c.name}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{c.email}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium border border-gray-200">
                                {c.vendor_name || 'Direct Applicant'}
                              </span>
                              {c.experience_years && (
                                <span className="text-[10px] text-gray-400">
                                  {c.experience_years} yrs exp
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Match Score */}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-extrabold text-xs text-gray-900">
                                {Math.round(c.match_score)}%
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold">
                                {c.match_score >= 80 ? 'Strong Fit' : c.match_score >= 60 ? 'Good Fit' : 'Fair'}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  c.match_score >= 80
                                    ? 'bg-emerald-500'
                                    : c.match_score >= 60
                                    ? 'bg-blue-500'
                                    : 'bg-amber-500'
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
                          <td className="py-3 px-4">
                            <div className="text-xs font-semibold text-gray-800">{c.title || 'Candidate'}</div>
                            <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                              {(c.skills || []).slice(0, 4).map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium border border-gray-200"
                                >
                                  {s}
                                </span>
                              ))}
                              {(c.skills || []).length > 4 && (
                                <span className="text-[10px] text-gray-400">
                                  +{c.skills.length - 4} more
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Live Email RSVP Status */}
                          <td className="py-3 px-4">
                            {!outreach ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                <Clock size={11} /> Unsent
                              </span>
                            ) : outreach.status === 'interested' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                  <CheckCircle2 size={11} /> Available & Interested
                                </span>
                                <div className="text-[9.5px] text-emerald-600 font-medium mt-0.5">
                                  Fast-Tracked into Pipeline
                                </div>
                              </div>
                            ) : outreach.status === 'unavailable' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                                  <XCircle size={11} /> Placed Elsewhere
                                </span>
                                <div className="text-[9.5px] text-gray-400 font-medium mt-0.5">
                                  Availability updated
                                </div>
                              </div>
                            ) : outreach.status === 'passed' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                Passed on this role
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Mail size={11} /> Email Sent • Awaiting RSVP
                                </span>
                                {outreach.sent_at && (
                                  <div className="text-[9.5px] text-gray-400 mt-0.5">
                                    {new Date(outreach.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.resume_url && (
                                <a
                                  href={c.resume_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition-colors"
                                  title="View Resume"
                                >
                                  <FileText size={13} />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setPreviewCandidateModal(c)}
                                className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-[11px] font-bold text-gray-800 transition-colors"
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
            )}
          </div>
        )}

        {/* Tab 2: Interactive Email Template Preview */}
        {activeTab === 'email_preview' && (
          <div className="p-5 sm:p-8 bg-gray-100/70">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Fake Email Client Chrome */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span className="font-semibold text-gray-700 ml-2">Inbox Preview (Interactive Email)</span>
                </div>
                <span className="font-mono text-[11px]">from: TermJobs Talent Team &lt;talent@termjobs.com&gt;</span>
              </div>

              {/* Email Content Body */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Header */}
                <div className="border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-black text-white font-extrabold flex items-center justify-center text-xs">
                      TJ
                    </div>
                    <span className="font-extrabold text-sm text-gray-900 tracking-tight">TermJobs Executive Staffing</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900">
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
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1.5 text-xs">
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
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 text-center">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Interactive 1-Click RSVP
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <div className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-700">
                      <Check size={16} />
                      <span>✓ Yes, I am Available & Interested</span>
                    </div>
                    <div className="w-full sm:w-auto px-5 py-3 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-700">
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
          </div>
        )}

        {/* Tab 3: Live Outreach Audit Feed */}
        {activeTab === 'activity' && (
          <div className="p-5 sm:p-6">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">
              Real-Time Outreach Event Log
            </h3>
            {activityFeed.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No email outreach events recorded yet. Click "Run Top 20 Match & Send Emails" to start.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {activityFeed.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 ${
                          item.status === 'interested'
                            ? 'bg-emerald-500'
                            : item.status === 'unavailable'
                            ? 'bg-rose-500'
                            : 'bg-blue-500'
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
                        <div className="font-bold text-gray-900">
                          {item.candidate_name || 'Candidate'} ({item.candidate_email})
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Requisition: <span className="font-semibold text-gray-700">{item.requisition_title || item.requisition_id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'interested'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'unavailable'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                  Rank #{previewCandidateModal.rank} Match
                </span>
                <h3 className="text-lg font-bold text-gray-900">{previewCandidateModal.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCandidateModal(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">Email</div>
                  <div className="font-semibold text-gray-800">{previewCandidateModal.email}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">Vendor / Source</div>
                  <div className="font-semibold text-gray-800">{previewCandidateModal.vendor_name || 'Direct'}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Match Analysis ({Math.round(previewCandidateModal.match_score)}%)</div>
                <div className="space-y-1">
                  {(previewCandidateModal.match_reasons || []).map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-gray-700">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Skills & Proficiencies</div>
                <div className="flex flex-wrap gap-1">
                  {(previewCandidateModal.skills || []).map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {previewCandidateModal.resume_url && (
                <div className="pt-2">
                  <a
                    href={previewCandidateModal.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-gray-900 transition-colors"
                  >
                    <ExternalLink size={14} /> View Stored Resume
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
