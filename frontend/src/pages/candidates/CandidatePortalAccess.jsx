import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { RefreshCw, Shield, ShieldOff, UserPlus, Search, AlertCircle, CheckCircle, Key, Edit3, Lock, X, Mail } from 'lucide-react';
import { validateEmail } from '../../utils/emailValidation';

export default function CandidatePortalAccess() {
  const { token, user } = useAuth();

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [search, setSearch] = useState('');
  const [creatingId, setCreatingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [createForm, setCreateForm] = useState({ email: '', name: '', password: '1234' });
  const [editForm, setEditForm] = useState({ email: '', name: '', password: '', is_active: true });
  const [successMsg, setSuccessMsg] = useState('');

  const loadCandidates = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await request('/api/auth/portal-users', { token });
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load portal users:', err);
      setError(err.message || 'Unable to reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCandidates(); }, [token]);

  const filtered = useMemo(() => {
    if (!search) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(c =>
      c.candidate_name?.toLowerCase().includes(q) ||
      c.candidate_email?.toLowerCase().includes(q) ||
      c.candidate_id?.toLowerCase().includes(q) ||
      c.requisition_title?.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const withAccess = candidates.filter(c => c.has_portal_access).length;
  const withoutAccess = candidates.filter(c => !c.has_portal_access).length;

  const handleCreateAccess = (cand) => {
    setEmailError('');
    setCreateForm({
      email: cand.candidate_email || cand.portal_user_email || '',
      name: cand.candidate_name || '',
      password: '1234',
    });
    setShowCreateModal(cand);
  };

  const handleSaveAccess = async () => {
    if (!showCreateModal) return;
    setError('');
    setEmailError('');
    const emailVal = (createForm.email || '').trim();
    const emailErr = validateEmail(emailVal);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    const cid = showCreateModal.candidate_id || showCreateModal.workorder_id;
    setCreatingId(cid);
    setSuccessMsg('');
    try {
      await request('/api/auth/portal-users', {
        method: 'POST',
        token,
        body: {
          candidate_id: showCreateModal.candidate_id || cid,
          workorder_id: cid,
          email: emailVal.toLowerCase(),
          name: createForm.name.trim(),
          password: createForm.password,
        },
      });
      setSuccessMsg(`Portal access created and login credentials emailed to ${emailVal}`);
      setShowCreateModal(null);
      await loadCandidates();
    } catch (err) {
      console.error('Failed to create portal access:', err);
      setError(err.message || 'Failed to create portal access');
    } finally {
      setCreatingId(null);
    }
  };

  const handleEditAccess = (cand) => {
    setEmailError('');
    setEditForm({
      email: cand.candidate_email || cand.portal_user_email || '',
      name: cand.candidate_name || '',
      password: '',
      is_active: cand.has_portal_access !== false,
    });
    setShowEditModal(cand);
  };

  const handleUpdateAccess = async () => {
    if (!showEditModal) return;
    const cid = showEditModal.candidate_id || showEditModal.workorder_id;
    setEmailError('');
    setError('');
    const emailVal = (editForm.email || '').trim();
    if (emailVal) {
      const emailErr = validateEmail(emailVal);
      if (emailErr) {
        setEmailError(emailErr);
        return;
      }
    }
    setUpdatingId(cid);
    setSuccessMsg('');
    try {
      if (showEditModal.portal_user_id) {
        const body = {
          name: editForm.name.trim(),
          email: emailVal.toLowerCase(),
          is_active: editForm.is_active,
          candidate_id: cid,
        };
        if (editForm.password) body.password = editForm.password;
        await request(`/api/auth/portal-users/${showEditModal.portal_user_id}`, {
          method: 'PUT',
          token,
          body,
        });
      } else {
        await request('/api/auth/portal-users', {
          method: 'POST',
          token,
          body: {
            candidate_id: cid,
            workorder_id: cid,
            email: emailVal.toLowerCase(),
            name: editForm.name.trim(),
            password: editForm.password || '1234',
          },
        });
      }
      setSuccessMsg(`Portal credentials updated for ${editForm.name}${editForm.password ? ' and new credentials emailed to candidate' : ''}.`);
      setShowEditModal(null);
      await loadCandidates();
    } catch (err) {
      console.error('Failed to update portal access:', err);
      setError(err.message || 'Failed to update portal access');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusBadge = (hasAccess) => {
    if (hasAccess) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-[#dcfce7] text-[#166534]">
          <Shield size={11} /> Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-[#f3f4f6] text-[#6b7280]">
        <ShieldOff size={11} /> No Access
      </span>
    );
  };

  return (
    <div
      className="w-full min-w-0 h-full flex-1 flex flex-col justify-between gap-3 text-left overflow-hidden pb-1 font-sans"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-cand-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
      `}</style>

      {/* ── 1. MODERN TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • ACCESS CONTROL
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Candidate Portal Access
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1">
            Provision and manage candidate portal login credentials for onboarding documentation and compliance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadCandidates}
            className="px-3.5 py-1.5 rounded-xl bg-white/60 hover:bg-white text-gray-700 hover:text-black border border-white/80 text-xs font-semibold shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP 3 GLASSMORHPIC METRIC CARDS ── */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">TOTAL CANDIDATES</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">{candidates.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
            <UserPlus size={18} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ACTIVE PORTAL ACCESS</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{withAccess}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-xs">
            <Shield size={18} />
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PENDING CREDENTIALS</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{withoutAccess}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs">
            <Key size={18} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="shrink-0 p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-700 font-medium flex items-center gap-2 shadow-2xs">
          <CheckCircle size={15} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="shrink-0 p-3 bg-red-50/90 border border-red-200/80 rounded-2xl text-xs text-red-700 font-medium flex items-center gap-2 shadow-2xs">
          <AlertCircle size={15} className="text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 3. MAIN GLASSMORHPIC TABLE CONTAINER ── */}
      <div className="flex-1 min-h-[360px] md:min-h-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between overflow-hidden">
        {/* Top Controls: Search Bar + Count */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/[0.04]">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search candidate, email, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs text-gray-900 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{filtered.length}</span> portal users
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto custom-cand-scroll pt-2">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-black/[0.04] text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">
                <th className="py-3 pl-3 pr-3">Candidate</th>
                <th className="py-3 px-3">Work Order ID</th>
                <th className="py-3 px-3">Requisition & Role</th>
                <th className="py-3 px-3">Portal Status</th>
                <th className="py-3 pr-3 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 pl-3 pr-3"><div className="h-4 w-28 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-32 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-40 bg-gray-200/80 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-5 w-20 bg-gray-200/80 rounded-full" /></td>
                      <td className="py-3 pr-3 pl-3"><div className="h-7 w-24 bg-gray-200/80 rounded-xl ml-auto" /></td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-400 text-xs">
                    <AlertCircle size={24} className="mx-auto mb-2 text-gray-300" />
                    <div>{candidates.length === 0 ? 'No accepted candidates found' : 'No candidates match your search query'}</div>
                  </td>
                </tr>
              ) : (
                filtered.map((cand) => (
                  <tr key={cand.workorder_id || cand.candidate_id} className="hover:bg-white/60 transition-colors">
                    <td className="py-3 pl-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-3xs">
                          {(cand.candidate_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs sm:text-[13px] font-extrabold text-gray-900">{cand.candidate_name}</div>
                          <div className="text-[11px] text-gray-400 font-medium">{cand.candidate_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-mono font-semibold text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-md border border-gray-200/60">
                        {cand.workorder_id || cand.candidate_id}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-bold text-gray-900">{cand.requisition_title || '—'}</div>
                      <div className="text-[10.5px] text-gray-400 font-normal">{cand.vendor_name || 'Direct'}</div>
                    </td>
                    <td className="py-3 px-3">{statusBadge(cand.has_portal_access)}</td>
                    <td className="py-3 pr-3 pl-3 text-right">
                      {!cand.has_portal_access ? (
                        <button
                          type="button"
                          onClick={() => handleCreateAccess(cand)}
                          disabled={creatingId === (cand.candidate_id || cand.workorder_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          <UserPlus size={12} />
                          <span>{creatingId === (cand.candidate_id || cand.workorder_id) ? 'Creating...' : 'Create Access'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEditAccess(cand)}
                          disabled={updatingId === (cand.candidate_id || cand.workorder_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white border border-white/90 text-gray-800 text-xs font-bold transition shadow-3xs disabled:opacity-50 cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>Edit Access</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Create Access Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(null)}>
          <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[1.2rem] font-extrabold text-[#0a0a0a] tracking-tight">Create Portal Access</h2>
                <p className="text-[0.84rem] text-[#525252] mt-0.5">
                  Create login credentials for <strong className="text-[#0a0a0a]">{showCreateModal.candidate_name}</strong>
                </p>
              </div>
              <button onClick={() => setShowCreateModal(null)} className="text-[#737373] hover:text-[#0a0a0a] p-1.5 rounded-lg hover:bg-[#f5f5f5] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50/80 border border-emerald-200/70 rounded-xl text-emerald-900 text-[0.8rem]">
                <Mail size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800">Email Notification Enabled</p>
                  <p className="text-[0.74rem] text-emerald-700/90 mt-0.5">
                    The candidate will automatically receive an email with their login credentials (email &amp; password) and direct portal access link.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => {
                    setCreateForm(f => ({ ...f, email: e.target.value }));
                    if (emailError) setEmailError('');
                  }}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
                {emailError && (
                  <p className="text-[0.74rem] text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
              </div>
              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
                <p className="text-[0.74rem] text-[#737373] mt-1.5 font-medium">Candidate will use this password to log in to the portal</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(null)}
                className="flex-1 px-4 py-2.5 text-[0.84rem] font-bold text-[#404040] bg-white border border-[#d4d4d4] rounded-xl hover:bg-[#f5f5f5] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccess}
                disabled={!createForm.email || !createForm.name || !createForm.password || creatingId === (showCreateModal.candidate_id || showCreateModal.workorder_id)}
                className="flex-1 px-4 py-2.5 text-[0.84rem] font-bold text-white bg-[#0a0a0a] rounded-xl hover:bg-[#262626] transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {creatingId === (showCreateModal.candidate_id || showCreateModal.workorder_id) ? 'Creating...' : 'Create Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Edit Access Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(null)}>
          <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[1.2rem] font-extrabold text-[#0a0a0a] tracking-tight">Edit Portal Access</h2>
                <p className="text-[0.84rem] text-[#525252] mt-0.5">
                  Update credentials for <strong className="text-[#0a0a0a]">{showEditModal.candidate_name}</strong>
                </p>
              </div>
              <button onClick={() => setShowEditModal(null)} className="text-[#737373] hover:text-[#0a0a0a] p-1.5 rounded-lg hover:bg-[#f5f5f5] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => {
                    setEditForm(f => ({ ...f, email: e.target.value }));
                    if (emailError) setEmailError('');
                  }}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
                {emailError && (
                  <p className="text-[0.74rem] text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
              </div>
              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Reset Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter new password to reset"
                  value={editForm.password}
                  onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 placeholder:text-[#a3a3a3] placeholder:font-normal shadow-2xs transition-all"
                />
                <p className="text-[0.74rem] text-[#737373] mt-1.5 font-medium">Leave blank to keep existing password unchanged</p>
                {editForm.password && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50/80 border border-blue-200/70 rounded-xl text-blue-900 text-[0.76rem] mt-2">
                    <Mail size={14} className="text-blue-600 shrink-0" />
                    <span>A notification with the updated password will be sent to the candidate's email.</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[0.84rem] font-bold text-[#0a0a0a]">Account Status</span>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`px-3 py-1 text-[0.75rem] font-extrabold rounded-full transition cursor-pointer border ${
                    editForm.is_active ? 'bg-[#dcfce7] text-[#166534] border-[#86efac]' : 'bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]'
                  }`}
                >
                  {editForm.is_active ? 'Active' : 'Suspended'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEditModal(null)}
                className="flex-1 px-4 py-2.5 text-[0.84rem] font-bold text-[#404040] bg-white border border-[#d4d4d4] rounded-xl hover:bg-[#f5f5f5] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAccess}
                disabled={!editForm.email || !editForm.name || updatingId === (showEditModal.candidate_id || showEditModal.workorder_id)}
                className="flex-1 px-4 py-2.5 text-[0.84rem] font-bold text-white bg-[#0a0a0a] rounded-xl hover:bg-[#262626] transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {updatingId === (showEditModal.candidate_id || showEditModal.workorder_id) ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
