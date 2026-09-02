import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Building2,
  Briefcase,
  Layers,
  Calendar,
  KeyRound,
  UserPlus,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  X,
  Loader2,
  Lock,
  ChevronRight
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
        {status || 'Open'}
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

const EMPTY_INVITE = {
  role: 'Hiring Manager',
  name: '',
  email: '',
  password: '',
  department: '',
};

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [calConfig, setCalConfig] = useState({ provider: null, status: 'disconnected', connected_email: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teamTab, setTeamTab] = useState('managers'); // 'managers' | 'directors' | 'vendors'

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCalModal, setShowCalModal] = useState(false);

  // Invite Form
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // Password Form
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '' });
  const [changingPwd, setChangingPwd] = useState(false);

  // Cal.com Form
  const [calForm, setCalForm] = useState({
    cal_link: '',
    cal_username: '',
    event_slug: '30min',
    default_duration: 60,
    default_timezone: 'Asia/Kolkata',
    instructions: '',
  });
  const [savingCal, setSavingCal] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }),
      request('/requisitions', { token }),
      request('/api/auth/vendors', { token }),
      request('/api/calendar/config', { token }).catch(() => null),
    ])
      .then(([usersRes, reqsRes, vendorsRes, calConfigRes]) => {
        setUsers(usersRes || []);
        setRequisitions(reqsRes || []);
        setVendors(vendorsRes || []);
        if (calConfigRes) {
          setCalConfig(calConfigRes);
          setCalForm({
            cal_link: calConfigRes.cal_link || '',
            cal_username: calConfigRes.cal_username || '',
            event_slug: calConfigRes.event_slug || '30min',
            default_duration: calConfigRes.default_duration || 60,
            default_timezone: calConfigRes.default_timezone || 'Asia/Kolkata',
            instructions: calConfigRes.instructions || '',
          });
        }
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  // 2-second auto-dismiss timer for success notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const hiringManagers = useMemo(() => users.filter((u) => u.role === 'Hiring Manager'), [users]);
  const directors = useMemo(() => users.filter((u) => u.role === 'Director'), [users]);
  const pendingApprovals = useMemo(
    () => requisitions.filter((r) => (r.status || '').toLowerCase() === 'pending_approval'),
    [requisitions]
  );
  const activePublished = useMemo(
    () =>
      requisitions.filter(
        (r) =>
          (r.status || '').toLowerCase() === 'open' ||
          (r.status || '').toLowerCase() === 'published' ||
          (r.status || '').toLowerCase() === 'active'
      ),
    [requisitions]
  );
  const engagedVendors = useMemo(() => vendors.filter((v) => v.engaged), [vendors]);

  const displayedTeamMembers = useMemo(() => {
    if (teamTab === 'managers') return hiringManagers;
    if (teamTab === 'directors') return directors;
    return engagedVendors;
  }, [teamTab, hiringManagers, directors, engagedVendors]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmittingInvite(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          role: inviteForm.role,
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          password: inviteForm.password,
          department: inviteForm.role === 'Hiring Manager' ? inviteForm.department.trim() : undefined,
        },
      });
      setSuccess(`${inviteForm.role} account created for ${inviteForm.email}.`);
      setInviteForm(EMPTY_INVITE);
      setShowInviteModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to create team member');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangingPwd(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/change-password', {
        method: 'POST',
        token,
        body: pwdForm,
      });
      setSuccess('Password updated successfully.');
      setPwdForm({ current_password: '', new_password: '' });
      setShowPasswordModal(false);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleSaveCalConfig = async (e) => {
    e?.preventDefault();
    setSavingCal(true);
    setError('');
    setSuccess('');
    try {
      const updated = await request('/api/calendar/config', {
        method: 'PUT',
        token,
        body: {
          provider: 'cal',
          status: 'connected',
          cal_link: calForm.cal_link || 'https://cal.com/',
          cal_username: calForm.cal_username || '',
          event_slug: calForm.event_slug || '30min',
          default_duration: Number(calForm.default_duration) || 60,
          default_timezone: calForm.default_timezone || 'Asia/Kolkata',
          instructions: calForm.instructions || '',
        },
      });
      setCalConfig(updated);
      setSuccess('Cal.com scheduling settings updated successfully.');
      setShowCalModal(false);
    } catch (err) {
      setError(err.message || 'Failed to save scheduling configuration.');
    } finally {
      setSavingCal(false);
    }
  };

  return (
    <div
      className="w-full min-w-0 pb-8 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • COMPANY GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-[1.65rem] font-extrabold text-gray-900 tracking-tight">
            {user?.tenant_name || 'Company'} Admin Console
          </h1>
          <p className="text-xs text-gray-500 font-normal mt-0.5 max-w-2xl">
            Oversee team member provisioning, vendor consultancy partnerships, and candidate scheduling.
          </p>

          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {user?.tenant_name || 'Client'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {hiringManagers.length + directors.length} team members
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound size={13} />
            <span>Password</span>
          </button>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* 5 Stat Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            HIRING MANAGERS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {hiringManagers.length}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            Department leads
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            DIRECTORS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {directors.length}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            Executive reviewers
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            REQUISITIONS
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {requisitions.length}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            Total job requisitions
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            PENDING APPROVAL
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {pendingApprovals.length}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            Awaiting sign-off
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            ACTIVE / OPEN
          </div>
          <div className="text-2xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {activePublished.length}
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            Live pipeline
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Middle Row: 2 Quick Action Hubs (Partner Vendors & Cal.com Scheduling) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Partner Vendors Banner */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900">Partner Vendors</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {engagedVendors.length} of {vendors.length} consultancies engaged
                </div>
              </div>
            </div>
            <Link
              to="/dashboard/admin/partner-vendors"
              className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-2xs transition-colors shrink-0 flex items-center gap-1"
            >
              <span>Manage</span>
              <ChevronRight size={12} />
            </Link>
          </div>

          {/* Engaged Vendor Badges */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {engagedVendors.length === 0 ? (
              <span className="text-[11px] text-gray-400 italic">No vendors engaged yet.</span>
            ) : (
              engagedVendors.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/90 text-[11px] font-semibold text-gray-800"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-gray-900">{v.name}</span>
                  {v.candidate_limit != null && (
                    <span className="text-[10px] text-gray-400 font-medium font-mono">({v.candidate_limit}/req)</span>
                  )}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Cal.com Integration Banner */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 hover:bg-gray-50/40 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-900">Cal.com Scheduling</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-[11px] text-gray-500 truncate font-mono">
                {calConfig?.cal_username ? `cal.com/${calConfig.cal_username}` : '30min interview configured'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCalModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 text-xs font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            Configure
          </button>
        </div>
      </div>

      {/* Bottom Main 2-Column Overview (Balanced Height & Screen-Fitted) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (6 cols): Requisitions Pipeline Table */}
        <div className="lg:col-span-6 bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Requisitions Pipeline</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Active hiring demands</p>
            </div>
            <Link
              to="/dashboard/requisitions"
              className="text-xs font-bold text-gray-900 hover:text-black flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-gray-400">Loading requisitions...</div>
          ) : requisitions.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No requisitions in this workspace yet.</div>
          ) : (
            <div
              className="overflow-x-auto overflow-y-auto pr-1"
              style={{ maxHeight: '260px', minHeight: '200px' }}
            >
              <table className="w-full text-left text-xs border-collapse relative">
                <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                  <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                    <th className="py-2.5 px-3">TITLE</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3 text-right">CREATED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requisitions.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900">{r.title || 'Untitled Requisition'}</div>
                        <div className="text-[10px] text-gray-400">{r.department || 'General'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500 font-medium text-[11px]">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (6 cols): Team Members Tabbed Table Card */}
        <div className="lg:col-span-6 bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Team Members</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Managers and Directors in this company</p>
            </div>

            {/* Tabs for Managers / Directors / Vendors */}
            <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTeamTab('managers')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  teamTab === 'managers'
                    ? 'bg-white text-black shadow-2xs'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Managers ({hiringManagers.length})
              </button>
              <button
                type="button"
                onClick={() => setTeamTab('directors')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  teamTab === 'directors'
                    ? 'bg-white text-black shadow-2xs'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Directors ({directors.length})
              </button>
              <button
                type="button"
                onClick={() => setTeamTab('vendors')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  teamTab === 'vendors'
                    ? 'bg-white text-black shadow-2xs'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Vendors ({engagedVendors.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-gray-400">Loading data...</div>
          ) : displayedTeamMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No {teamTab === 'managers' ? 'Hiring Managers' : teamTab === 'directors' ? 'Directors' : 'engaged Partner Vendors'} found.
            </div>
          ) : (
            <div
              className="overflow-x-auto overflow-y-auto pr-1"
              style={{ maxHeight: '260px', minHeight: '200px' }}
            >
              <table className="w-full text-left text-xs border-collapse relative">
                <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                  <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                    <th className="py-2.5 px-3">{teamTab === 'vendors' ? 'VENDOR / CONSULTANCY' : 'NAME'}</th>
                    <th className="py-2.5 px-3">{teamTab === 'vendors' ? 'SUBMISSION LIMIT' : 'EMAIL'}</th>
                    <th className="py-2.5 px-3 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedTeamMembers.map((item) => {
                    const isVendor = teamTab === 'vendors';
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Name / Vendor Title with Avatar */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-black text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                              {(item.name || item.email || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{item.name || '—'}</div>
                              {isVendor ? (
                                <div className="text-[10px] text-gray-400 capitalize">{item.tenant_type || 'Consultancy'}</div>
                              ) : (
                                item.department && <div className="text-[10px] text-gray-400">{item.department}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email or Candidate Limit */}
                        <td className="py-2.5 px-3 text-gray-600 font-medium">
                          {isVendor ? (
                            <span className="font-bold text-gray-900">
                              {item.candidate_limit != null ? `${item.candidate_limit} / req` : '3 / req (default)'}
                            </span>
                          ) : (
                            item.email
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {isVendor ? 'Engaged' : item.is_active !== false ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Team Member Modal Popup */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="relative w-full max-w-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Invite Team Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Provision an account for {user?.tenant_name || 'your company'}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3.5">
              {/* Role Select */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Account Role *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role: 'Hiring Manager' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      inviteForm.role === 'Hiring Manager'
                        ? 'bg-black text-white shadow-2xs'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Hiring Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role: 'Director' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      inviteForm.role === 'Director'
                        ? 'bg-black text-white shadow-2xs'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Director
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="e.g. Maya Patel"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="maya@company.com"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              {/* Department (for HM) */}
              {inviteForm.role === 'Hiring Manager' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Department (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    placeholder="e.g. Engineering, Product, Marketing"
                    className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  disabled={submittingInvite}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvite}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingInvite && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Change Password</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials for {user?.email}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={pwdForm.new_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={changingPwd}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPwd}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {changingPwd && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cal.com Scheduling Modal */}
      {showCalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowCalModal(false)}
        >
          <div
            className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Cal.com Scheduling Integration</h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect scheduling link to generate live candidate booking slots.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCalModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCalConfig} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Cal.com / Cal.diy Base URL or Handle *
                </label>
                <input
                  type="text"
                  required
                  value={calForm.cal_username}
                  onChange={(e) => setCalForm({ ...calForm, cal_username: e.target.value })}
                  placeholder="e.g. cal.com/mohammed-hashil"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Default Event Slug
                  </label>
                  <input
                    type="text"
                    value={calForm.event_slug}
                    onChange={(e) => setCalForm({ ...calForm, event_slug: e.target.value })}
                    placeholder="30min"
                    className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Interview Duration
                  </label>
                  <select
                    value={calForm.default_duration}
                    onChange={(e) => setCalForm({ ...calForm, default_duration: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={90}>90 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Company Timezone
                </label>
                <input
                  type="text"
                  value={calForm.default_timezone}
                  onChange={(e) => setCalForm({ ...calForm, default_timezone: e.target.value })}
                  placeholder="Asia/Kolkata (IST - UTC+5:30)"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCalModal(false)}
                  disabled={savingCal}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCal}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingCal && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
