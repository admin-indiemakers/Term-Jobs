import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Link2,
  Check,
  UserPlus,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  Loader2,
  Building2,
  Mail,
  Lock,
  ShieldCheck,
  Shield
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

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
};

export default function ManageDirectors() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/director?company=${encodeURIComponent(user?.tenant_name || 'Bearitt')}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setSuccess('Invite link copied to clipboard! Anyone with this link can request Director access.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApproveDirector = async (director) => {
    setApprovingId(director.id);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${director.id}/approve`, {
        method: 'POST',
        token,
      });
      setSuccess(`Director "${director.name || director.email}" approved and activated successfully.`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve director account');
    } finally {
      setApprovingId(null);
    }
  };

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editing, setEditing] = useState(false);

  // MSA Governance State
  const [msaList, setMsaList] = useState([]);
  const [reviewMsa, setReviewMsa] = useState(null);
  const [revisionNotesInput, setRevisionNotesInput] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [msaActionLoading, setMsaActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/api/auth/users', { token }).catch(() => []),
      request('/api/work-orders', { token }).catch(() => []),
    ])
      .then(([usersData, woData]) => {
        const allUsers = Array.isArray(usersData) ? usersData : [];
        setDirectors(allUsers.filter((u) => u.role === 'Director'));

        const allWo = Array.isArray(woData) ? woData : woData?.work_orders || [];
        setMsaList(allWo);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleApproveMsa = async (msa) => {
    setMsaActionLoading(true);
    setError('');
    try {
      await request(`/api/work-orders/${msa.id}/approve`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          approved_by: `${user?.name || 'Director'} (Director Governance)`,
          approval_type: 'click_to_approve',
        }),
      });
      setSuccess(`Master Services Agreement (MSA) approved for ${msa.candidate_name || 'candidate'}!`);
      setReviewMsa(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to approve MSA');
    } finally {
      setMsaActionLoading(false);
    }
  };

  const handleRequestMsaRevision = async () => {
    if (!reviewMsa || !revisionNotesInput.trim()) return;
    setMsaActionLoading(true);
    setError('');
    try {
      await request(`/api/work-orders/${reviewMsa.id}/request-revision`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          reviewer: `${user?.name || 'Director'} (Director)`,
          revision_notes: revisionNotesInput.trim(),
        }),
      });
      setSuccess('Revision feedback sent back to vendor successfully.');
      setReviewMsa(null);
      setShowRevisionModal(false);
      setRevisionNotesInput('');
      load();
    } catch (err) {
      setError(err.message || 'Failed to request revision');
    } finally {
      setMsaActionLoading(false);
    }
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

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleCreateDirector = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await request('/api/auth/users', {
        method: 'POST',
        token,
        body: {
          role: 'Director',
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        },
      });
      setSuccess(`Director account created for ${form.email}.`);
      setForm(EMPTY_FORM);
      setShowCreateModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to create director account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDirector = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/auth/users/${confirmDelete.id}`, { method: 'DELETE', token });
      setSuccess(`Director account "${confirmDelete.name || confirmDelete.email}" removed.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to remove account');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!edit) return;
    setEditing(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (edit.email !== '') payload.email = edit.email.trim();
      if (edit.name !== '') payload.name = edit.name.trim();
      if (edit.password) payload.password = edit.password;

      await request(`/api/auth/users/${edit.id}`, { method: 'PATCH', token, body: payload });
      setSuccess(`Director "${edit.name || edit.email}" updated successfully.`);
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to update director account');
    } finally {
      setEditing(false);
    }
  };

  const filteredDirectors = useMemo(() => {
    if (!searchQuery.trim()) return directors;
    const q = searchQuery.toLowerCase();
    return directors.filter(
      (d) =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q)
    );
  }, [directors, searchQuery]);

  const activeCount = useMemo(() => directors.filter((d) => d.is_active !== false).length, [directors]);

  return (
    <div
      className="w-full min-w-0 pb-12 space-y-5 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Header Banner Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin')}
              className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={13} />
              Dashboard
            </button>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase">
              EXECUTIVE GOVERNANCE
            </span>
          </div>

          <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            Directors
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1 max-w-2xl">
            Manage Director accounts in the {user?.tenant_name || 'company'} workspace. Directors have executive read-only oversight across all requisitions and hiring pipelines.
          </p>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs">
              ● Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {user?.tenant_name || 'Client'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-800 text-xs font-semibold shadow-2xs">
              {directors.length} active directors
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Copy public invite link for new Directors"
          >
            <Link2 size={14} className="text-gray-500" />
            <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Create Director</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            TOTAL DIRECTORS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {directors.length}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Registered executive viewers
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            ACTIVE ACCOUNTS
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            {activeCount}
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Operational director logins
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            ACCESS LEVEL
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight my-0.5">
            Executive
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Read-only platform oversight
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Directors Data Table Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Active Directors</h2>
            <p className="text-xs text-gray-500">All director credentials provisioned under {user?.tenant_name}</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search director name, email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading directors...</div>
        ) : filteredDirectors.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No director accounts found matching your query.
          </div>
        ) : (
          <div
            className="overflow-x-auto overflow-y-auto pr-1"
            style={{
              maxHeight: '520px',
              minHeight: '340px',
            }}
          >
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-3 px-3">NAME</th>
                  <th className="py-3 px-3">EMAIL</th>
                  <th className="py-3 px-3">ROLE / ACCESS</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3">CREATED</th>
                  <th className="py-3 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDirectors.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Name with Avatar */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{u.name || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-3 text-gray-600 font-medium">
                      {u.email}
                    </td>

                    {/* Role / Access Level */}
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        <ShieldCheck size={11} className="text-gray-500" />
                        <span>Director (Read-Only)</span>
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3">
                      {u.is_active !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Approval
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-3 text-gray-500 font-medium">
                      {formatDate(u.created_at)}
                    </td>

                    {/* Actions (Approve / Reject for pending, Edit / Remove for active) */}
                    <td className="py-3.5 px-3 text-right">
                      {u.is_active === false ? (
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleApproveDirector(u)}
                            disabled={approvingId === u.id}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Check size={13} />
                            <span>{approvingId === u.id ? 'Approving...' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(u)}
                            className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEdit({ ...u, password: '' })}
                            className="font-bold text-gray-900 hover:text-black text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(u)}
                            className="font-bold text-red-600 hover:text-red-700 text-xs transition-colors underline-offset-2 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Master Services Agreements (MSA) Executive Approval Governance */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Master Services Agreements (MSA) Approval Governance</h2>
            <p className="text-xs text-gray-500">Executive review and approval of vendor commercial agreements and rate limits</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold shadow-2xs self-start sm:self-auto">
            {msaList.filter(m => m.status === 'Submitted').length} Pending MSA Approvals
          </span>
        </div>

        {msaList.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No Master Services Agreements submitted for executive review yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white">
                  <th className="py-3 px-3">CANDIDATE & ROLE</th>
                  <th className="py-3 px-3">VENDOR</th>
                  <th className="py-3 px-3">AGREED RATE</th>
                  <th className="py-3 px-3">VENDOR FLOOR & CAP</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {msaList.map((msa) => (
                  <tr key={msa.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-gray-900">{msa.candidate_name || 'Candidate'}</div>
                      <div className="text-[11px] text-gray-500">{msa.job_title || 'Role'} • {msa.requisition_ref || 'REQ'}</div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-gray-700">
                      {msa.vendor_name || 'Vendor'}
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-black">
                      ₹{Number(msa.billing_rate || 0).toLocaleString()}/{msa.rate_type || 'month'}
                    </td>
                    <td className="py-3.5 px-3 text-gray-600 font-medium">
                      ₹{Number(msa.vendor_visible_floor || 0).toLocaleString()} - ₹{Number(msa.vendor_visible_cap || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      {msa.status === 'Submitted' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Director Approval
                        </span>
                      ) : msa.status === 'Approved' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Approved ({msa.approved_by || 'Director'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Revision Requested
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewMsa(msa);
                          setRevisionNotesInput(msa.revision_notes || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-900 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                      >
                        Review MSA Commercials →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Director MSA Review & Approval Modal Popup */}
      {reviewMsa && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in overflow-y-auto"
          onClick={() => setReviewMsa(null)}
        >
          <div
            className="relative w-full max-w-[640px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Master Services Agreement (MSA) Governance Review</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Candidate: <strong>{reviewMsa.candidate_name}</strong> ({reviewMsa.job_title}) • Vendor: <strong>{reviewMsa.vendor_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewMsa(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* AI Reasoning Banner if available */}
              {reviewMsa.ai_reasoning && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-800 leading-relaxed">
                  <strong className="font-bold text-gray-900 block mb-1">🤖 AI Derivation Reasoning:</strong>
                  {reviewMsa.ai_reasoning}
                </div>
              )}

              {/* Commercial Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">Agreed Billing Rate</div>
                  <div className="text-base font-extrabold text-black">
                    ₹{Number(reviewMsa.billing_rate || 0).toLocaleString()}/{reviewMsa.rate_type || 'month'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">Vendor Visible Floor & Cap</div>
                  <div className="text-xs font-semibold text-gray-700">
                    ₹{Number(reviewMsa.vendor_visible_floor || 0).toLocaleString()} - ₹{Number(reviewMsa.vendor_visible_cap || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">Contract Timeline</div>
                  <div className="text-xs font-semibold text-gray-700">
                    {reviewMsa.start_date || 'TBD'} to {reviewMsa.end_date || 'TBD'}
                  </div>
                </div>
              </div>

              {/* Scope of Services */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Scope of Services & Deliverables
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800 whitespace-pre-wrap">
                  {reviewMsa.scope_of_work || 'Standard deliverables as per role JD.'}
                </div>
              </div>

              {/* Special Terms */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Special Master Services Terms & Clauses
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800 whitespace-pre-wrap">
                  {reviewMsa.special_terms || 'Standard NET 30 payment terms.'}
                </div>
              </div>

              {/* Signed Document attachment if any */}
              {reviewMsa.esign_document_url && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                  <span className="font-semibold">📎 Signed Agreement Attached: {reviewMsa.esign_filename || 'MSA_Signed.pdf'}</span>
                  <a href={reviewMsa.esign_document_url} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">
                    View Document PDF
                  </a>
                </div>
              )}

              {/* Revision Feedback Textarea if active */}
              {showRevisionModal ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold uppercase text-rose-800">
                    Rejection / Revision Reason Note for Vendor *
                  </label>
                  <textarea
                    rows="3"
                    value={revisionNotesInput}
                    onChange={(e) => setRevisionNotesInput(e.target.value)}
                    placeholder="Enter explicit reason why the MSA was rejected/returned for revision..."
                    className="w-full p-3 rounded-lg border border-rose-200 text-xs text-gray-900 outline-none bg-white"
                  ></textarea>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRevisionModal(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestMsaRevision}
                      disabled={msaActionLoading || !revisionNotesInput.trim()}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-50 border-none"
                    >
                      Send Revision Feedback →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowRevisionModal(true)}
                    className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Request Revision / Reject 💬
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveMsa(reviewMsa)}
                    disabled={msaActionLoading}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border-none"
                  >
                    <Check size={14} />
                    <span>{msaActionLoading ? 'Approving...' : 'Approve MSA Agreement ✓'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Create Director</h3>
                <p className="text-xs text-gray-500 mt-0.5">Provision an executive read-only account for {user?.tenant_name || 'your company'}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDirector} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleInput}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleInput}
                  placeholder="director@company.com"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={4}
                  value={form.password}
                  onChange={handleInput}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Director Modal */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setEdit(null)}
        >
          <div
            className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Edit Director</h3>
                <p className="text-xs text-gray-500 mt-0.5">Update credentials for {edit.email}.</p>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  minLength={4}
                  value={edit.password || ''}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEdit(null)}
                  disabled={editing}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-gray-900 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editing && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-7 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900">Remove Director?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently delete the account <strong>{confirmDelete.name || confirmDelete.email}</strong> ({confirmDelete.email}). This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDirector}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 size={13} className="animate-spin text-white" />}
                <span>Remove Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
