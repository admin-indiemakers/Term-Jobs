import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Check,
  Building2,
  Users,
  Briefcase,
  Layers,
  ChevronRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  FileText
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'open' || s === 'published' || s === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {status || 'Published'}
      </span>
    );
  }
  if (s === 'pending_approval' || s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending Approval
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      {status || 'Draft'}
    </span>
  );
}

export default function HiringManagerDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Live Backend Data States (No Mock/Hardcoded Fallbacks)
  const [requisitions, setRequisitions] = useState([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState([]);
  const [acceptedCandidates, setAcceptedCandidates] = useState([]);
  const [onboardingList, setOnboardingList] = useState([]);
  const [openIssues, setOpenIssues] = useState([]);
  const [wfStats, setWfStats] = useState(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reqsData, shortlistedData, acceptedData, obData, issuesData, wfData] = await Promise.all([
        request('/requisitions', { token }).catch(() => []),
        request('/candidates/shortlisted', { token }).catch(() => []),
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/workforce/stats', { token }).catch(() => null),
      ]);

      const reqList = Array.isArray(reqsData) ? reqsData : reqsData?.requisitions || [];
      setRequisitions(reqList);

      const sList = Array.isArray(shortlistedData) ? shortlistedData : shortlistedData?.shortlisted_candidates || [];
      setShortlistedCandidates(sList);

      const aList = Array.isArray(acceptedData) ? acceptedData : acceptedData?.candidates || [];
      setAcceptedCandidates(aList);

      const oList = Array.isArray(obData) ? obData : obData?.candidates || [];
      setOnboardingList(oList);

      const iList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
      setOpenIssues(iList.filter((i) => i.status === 'open'));

      if (wfData) setWfStats(wfData);
    } catch (err) {
      console.error('Failed to load hiring manager dashboard data:', err);
      setError(err.message || 'Unable to load live dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [token]);

  // Derived Exact Real Metrics from Live Backend Data
  const liveRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s === 'published' || s === 'open' || s === 'active';
    });
  }, [requisitions]);

  const completedRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s === 'closed' || s === 'completed' || s === 'filled';
    });
  }, [requisitions]);

  const draftRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s === 'draft' || s === 'drafted' || s === 'intake' || s === 'structuring' || s === 'pending_approval' || s === 'pending';
    });
  }, [requisitions]);

  // Exact Real Counts (No Hardcoded Fallback Numbers)
  const liveRolesCount = liveRequisitions.length;
  const totalRequisitionsCount = requisitions.length;
  const completedCount = completedRequisitions.length;
  const draftCount = draftRequisitions.length;
  const shortlistedCount = shortlistedCandidates.length;
  const acceptedCount = acceptedCandidates.length;
  const onboardingCount = onboardingList.length;
  const activeTeamCount = wfStats?.stats?.active_workers || wfStats?.active_count || 0;
  const pendingTimesheetsCount = wfStats?.stats?.pending_timesheets || wfStats?.pending_timesheets || 0;

  // Pipeline Stage Calculations from Real Data
  const pipelineStages = useMemo(() => {
    return [
      { id: 'live', count: liveRolesCount, label: 'LIVE ROLES', to: '/dashboard/requisitions/published' },
      { id: 'ai', count: draftCount, label: 'AI REVIEW', to: '/dashboard/requisitions/drafted' },
      { id: 'shortlisted', count: shortlistedCount, label: 'SHORTLISTED', to: '/dashboard/candidates' },
      { id: 'accepted', count: acceptedCount, label: 'ACCEPTED', to: '/dashboard/candidates/accepted' },
      { id: 'onboarding', count: onboardingCount, label: 'ONBOARDING', to: '/dashboard/candidates/onboarding' },
    ];
  }, [liveRolesCount, draftCount, shortlistedCount, acceptedCount, onboardingCount]);

  // Greeting
  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div
      className="w-full min-w-0 pb-12 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            {greetingText.toUpperCase()}, {user?.name || 'HR'}
          </div>
          <h1 className="text-2xl sm:text-[1.65rem] font-extrabold text-gray-900 tracking-tight">
            Hiring at a glance
          </h1>
          <p className="text-xs text-gray-500 font-normal mt-0.5 max-w-2xl">
            One screen for requisitions, candidate movement, onboarding, and the actions that need your attention.
          </p>

          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Hiring Manager
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {user?.tenant_name || 'Client Workspace'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {liveRolesCount} live {liveRolesCount === 1 ? 'role' : 'roles'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {shortlistedCount} shortlisted
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions/new')}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>+ New Requisition</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* 5 Compact Stat Metric Cards (Single Balanced Row, Exact Real Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            LIVE REQUISITIONS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {liveRolesCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            {liveRolesCount > 0 ? 'Active in market' : 'No live roles'}
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            TOTAL REQUISITIONS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {totalRequisitionsCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium truncate">
            {completedCount} completed • {draftCount} drafts
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            ONBOARDING IN PROGRESS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {onboardingCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            {openIssues.length} open issues
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            ACTIVE TEAM
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {activeTeamCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            {activeTeamCount} active • {onboardingCount} onboarding
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            PENDING TIMESHEETS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {pendingTimesheetsCount}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            {pendingTimesheetsCount > 0 ? 'Awaiting your approval' : 'All timesheets reviewed'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Overview (Active Requisitions + Needs Attention & Hiring Pipeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Active Requisitions Card */}
        <div className="lg:col-span-7 bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Active requisitions</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Only decision-ready details are shown</p>
            </div>
            <Link
              to="/dashboard/requisitions"
              className="text-xs font-bold text-gray-900 hover:text-black flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-gray-400">Loading active requisitions...</div>
          ) : liveRequisitions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-8 space-y-2">
              <div className="font-semibold text-gray-800 text-sm">No active requisitions found.</div>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">
                Create a new AI-assisted requisition to start candidate sourcing and interviews.
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/requisitions/new')}
                className="mt-1 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-2xs hover:bg-gray-900 transition-colors cursor-pointer"
              >
                + Create Requisition
              </button>
            </div>
          ) : (
            <div
              className="overflow-x-auto overflow-y-auto pr-1 custom-scrollbar"
              style={{ maxHeight: '240px' }}
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                    <th className="py-2 px-2.5">TITLE & DEPARTMENT</th>
                    <th className="py-2 px-2.5">STATUS</th>
                    <th className="py-2 px-2.5">CREATED</th>
                    <th className="py-2 px-2.5 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liveRequisitions.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-gray-900">{r.title || 'Untitled Role'}</div>
                        <div className="text-[10px] text-gray-400">{r.department || 'General'}</div>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5 px-2.5 text-gray-500 font-medium text-[11px]">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                          className="font-bold text-gray-900 hover:text-black text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Needs Attention & Compact Pipeline */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Needs Your Attention Card */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
            <div className="pb-2 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Needs your attention</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">AI removes routine work; you decide.</p>
            </div>

            <div className="space-y-2 text-xs">
              {/* Alert 1: Drafts */}
              <div
                onClick={() => navigate('/dashboard/requisitions/drafted')}
                className="p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors cursor-pointer space-y-0.5"
              >
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-black shrink-0 mt-1.5" />
                  <div>
                    <div className="font-bold text-gray-900">
                      {draftCount > 0 ? (
                        <>
                          <span>{draftRequisitions[0]?.title || 'Requisition'}</span>{' '}
                          <span className="font-normal text-gray-600">needs review / intake</span>
                        </>
                      ) : (
                        <span>All requisitions structured</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {draftCount > 0 ? `${draftCount} draft requisition${draftCount > 1 ? 's' : ''} in review` : 'No pending AI intake questions'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alert 2: Shortlists */}
              <div
                onClick={() => navigate('/dashboard/candidates')}
                className="p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors cursor-pointer space-y-0.5"
              >
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-black shrink-0 mt-1.5" />
                  <div>
                    <div className="font-bold text-gray-900">
                      {shortlistedCount > 0 ? (
                        <>
                          <span>{shortlistedCount} candidate{shortlistedCount > 1 ? 's' : ''}</span>{' '}
                          <span className="font-normal text-gray-600">ready for review</span>
                        </>
                      ) : (
                        <span>No pending shortlist reviews</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {shortlistedCount > 0 ? 'Shortlisted profiles awaiting screening' : 'Candidate screenings are up to date'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alert 3: Onboarding & Issues */}
              <div
                onClick={() => navigate('/dashboard/candidates/onboarding')}
                className="p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors cursor-pointer space-y-0.5"
              >
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-black shrink-0 mt-1.5" />
                  <div>
                    <div className="font-bold text-gray-900">
                      {onboardingCount > 0 ? (
                        <>
                          <span>{onboardingCount} onboarding record{onboardingCount > 1 ? 's' : ''}</span>{' '}
                          <span className="font-normal text-gray-600">active</span>
                        </>
                      ) : (
                        <span>No active onboarding records</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {openIssues.length === 0 ? 'No open candidate issues' : `${openIssues.length} issues requiring review`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Hiring Pipeline Card (Placed directly under Needs Your Attention) */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">Hiring pipeline</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Workload across active stages</p>
              </div>
              <Link
                to="/dashboard/requisitions"
                className="text-xs font-bold text-gray-900 hover:text-black flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight size={11} />
              </Link>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {pipelineStages.map((stage) => (
                <div
                  key={stage.id}
                  onClick={() => navigate(stage.to)}
                  className="bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-xl p-2 text-center transition-all cursor-pointer space-y-1"
                >
                  <div className="text-sm font-extrabold text-gray-900">
                    {stage.count}
                  </div>
                  <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-tighter truncate">
                    {stage.label}
                  </div>
                  <div className="w-full bg-gray-200 h-0.5 rounded-full overflow-hidden">
                    <div
                      className="bg-black h-full rounded-full transition-all"
                      style={{ width: stage.count > 0 ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}