import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { RefreshCw, Shield, ShieldOff, UserPlus, Search, AlertCircle, CheckCircle, Key, FileText, ExternalLink, ClipboardCheck, Lock } from 'lucide-react';
import ActivationGatesModal from '../../components/ActivationGatesModal';

export default function CandidatePortalAccess() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [creatingId, setCreatingId] = useState(null);
  const [creatingWOId, setCreatingWOId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [selectedGatesCandidate, setSelectedGatesCandidate] = useState(null);
  const [createForm, setCreateForm] = useState({ email: '', name: '', password: '1234' });
  const [editForm, setEditForm] = useState({ email: '', name: '', password: '' });
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [modalError, setModalError] = useState('');

  const loadCandidates = async () => {
    setLoading(true);
    setError('');
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
      c.portal_user_email?.toLowerCase().includes(q) ||
      c.candidate_id?.toLowerCase().includes(q) ||
      c.requisition_title?.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const createEmailError = useMemo(() => {
    if (!showCreateModal || !createForm.email) return '';
    const typed = createForm.email.trim().toLowerCase();
    if (!typed || !typed.includes('@')) return '';
    
    const match = candidates.find(c =>
      c.candidate_id !== showCreateModal.candidate_id &&
      ((c.portal_user_email && c.portal_user_email.toLowerCase() === typed) ||
       (c.candidate_email && c.candidate_email.toLowerCase() === typed))
    );
    if (match) {
      return `Email '${typed}' is already used by ${match.candidate_name || 'another candidate'}`;
    }
    return '';
  }, [showCreateModal, createForm.email, candidates]);

  const editEmailError = useMemo(() => {
    if (!showEditModal || !editForm.email) return '';
    const typed = editForm.email.trim().toLowerCase();
    if (!typed || !typed.includes('@')) return '';
    
    const match = candidates.find(c =>
      c.candidate_id !== showEditModal.candidate_id &&
      ((c.portal_user_email && c.portal_user_email.toLowerCase() === typed) ||
       (c.candidate_email && c.candidate_email.toLowerCase() === typed))
    );
    if (match) {
      return `Email '${typed}' is already used by ${match.candidate_name || 'another candidate'}`;
    }
    return '';
  }, [showEditModal, editForm.email, candidates]);

  const withAccess = candidates.filter(c => c.has_portal_access).length;
  const withoutAccess = candidates.filter(c => !c.has_portal_access).length;

  const handleCreateAccess = (cand) => {
    setCreateForm({
      email: cand.portal_user_email || cand.candidate_email || '',
      name: cand.candidate_name || '',
      password: '1234',
    });
    setModalError('');
    setShowCreateModal(cand);
  };

  const handleEditAccess = (cand) => {
    setEditForm({
      email: cand.portal_user_email || cand.candidate_email || '',
      name: cand.candidate_name || '',
      password: '',
    });
    setModalError('');
    setShowEditModal(cand);
  };

  const handleSaveEditAccess = async () => {
    if (!showEditModal) return;
    const targetId = showEditModal.portal_user_id;
    setUpdatingId(showEditModal.candidate_id);
    setSuccessMsg('');
    setError('');
    setModalError('');
    try {
      if (targetId) {
        await request(`/api/auth/portal-users/${targetId}`, {
          method: 'PUT',
          token,
          body: {
            email: editForm.email,
            name: editForm.name,
            password: editForm.password || undefined,
            candidate_id: showEditModal.candidate_id,
          },
        });
      } else {
        await request('/api/auth/portal-users', {
          method: 'POST',
          token,
          body: {
            candidate_id: showEditModal.candidate_id,
            email: editForm.email,
            name: editForm.name,
            password: editForm.password || '1234',
          },
        });
      }
      setSuccessMsg(`Portal credentials updated for ${editForm.name}. Candidate can now login with ${editForm.email}`);
      setShowEditModal(null);
      await loadCandidates();
    } catch (err) {
      console.error('Failed to update portal access:', err);
      const msg = err.message || 'Failed to update portal credentials';
      setModalError(msg);
      setError(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveAccess = async () => {
    if (!showCreateModal) return;
    setCreatingId(showCreateModal.candidate_id);
    setSuccessMsg('');
    setModalError('');
    try {
      await request('/api/auth/portal-users', {
        method: 'POST',
        token,
        body: {
          candidate_id: showCreateModal.candidate_id,
          email: createForm.email,
          name: createForm.name,
          password: createForm.password,
        },
      });
      setSuccessMsg(`Portal access created for ${createForm.name}. Candidate can now login with ${createForm.email}`);
      setShowCreateModal(null);
      loadCandidates();
    } catch (err) {
      console.error('Failed to create portal access:', err);
      const msg = err.message || 'Failed to create portal access';
      setModalError(msg);
      setError(msg);
    } finally {
      setCreatingId(null);
    }
  };

  const handleCreateWorkOrder = async (cand) => {
    setCreatingWOId(cand.candidate_id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await request('/api/workforce/work-orders', {
        method: 'POST',
        token,
        body: {
          candidate_id: cand.candidate_id,
          candidate_name: cand.candidate_name,
          requisition_title: cand.requisition_title,
          vendor_name: cand.vendor_name,
        },
      });
      setSuccessMsg(res.message || `Work order created for ${cand.candidate_name}`);
      await loadCandidates();
    } catch (err) {
      console.error('Failed to create work order:', err);
      setError(err.message || 'Failed to create work order');
    } finally {
      setCreatingWOId(null);
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
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Hero */}
      <div className="bg-[#1a1a1a] text-white px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#a0a09a] mb-1">
              <span>CANDIDATES</span>
              <span>›</span>
              <span className="text-white">Portal Access</span>
            </div>
            <h1 className="text-[1.35rem] font-bold tracking-tight">Candidate Portal Access</h1>
            <p className="text-[0.82rem] text-[#a0a09a] mt-0.5">
              Create and manage candidate portal login accounts
            </p>
          </div>
          <button onClick={loadCandidates} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-[0.82rem] font-medium hover:bg-white/15 transition">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                <UserPlus size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">All Candidates</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{candidates.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#16a34a] flex items-center justify-center">
                <Shield size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">Active Access</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{withAccess}</div>
          </div>
          <div className="bg-white rounded-xl border border-[#eaeae6] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center">
                <Key size={17} className="text-white" />
              </div>
              <span className="text-[0.72rem] tracking-[0.14em] text-[#8a8a85] font-semibold uppercase">No Access</span>
            </div>
            <div className="text-[1.8rem] font-bold text-[#1a1a1a]">{withoutAccess}</div>
          </div>
        </div>

        {/* Success/Error */}
        {successMsg && (
          <div className="mb-4 p-3 bg-[#dcfce7] border border-[#bbf7d0] rounded-xl text-[0.88rem] text-[#166534] flex items-center gap-2">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-[#fee2e2] border border-[#fecaca] rounded-xl text-[0.88rem] text-[#991b1b] flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl border border-[#eaeae6] mb-6">
          <div className="p-4 border-b border-[#eaeae6]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a85]" />
              <input
                type="text"
                placeholder="Search candidate, email, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[0.68rem] tracking-[0.14em] text-[#8a8a85] uppercase font-semibold">
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  <th className="px-5 py-3 font-semibold">Candidate ID</th>
                  <th className="px-5 py-3 font-semibold">Requisition & Role</th>
                  <th className="px-5 py-3 font-semibold">Portal Status</th>
                  <th className="px-5 py-3 font-semibold">Work Order</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    {[1, 2, 3, 4, 5].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-4 w-40 bg-gray-200 rounded" /></td>
                        <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
                        <td className="px-5 py-3"><div className="h-5 w-24 bg-gray-200 rounded-full" /></td>
                        <td className="px-5 py-3"><div className="h-8 w-28 bg-gray-200 rounded-lg ml-auto" /></td>
                      </tr>
                    ))}
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <AlertCircle size={28} className="mx-auto mb-2 text-[#d1d5cc]" />
                      <div className="text-[0.92rem] text-[#8a8a85] font-medium">
                        {candidates.length === 0 ? 'No accepted candidates found' : 'No candidates match your search'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((cand) => (
                    <tr key={cand.candidate_id} className="border-t border-[#f0f0ec] hover:bg-[#fafaf8] transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[0.72rem] font-bold">
                            {(cand.candidate_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-[0.88rem] font-semibold text-[#1a1a1a]">{cand.candidate_name}</div>
                            <div className="text-[0.75rem] text-[#8a8a85]">{cand.portal_user_email || cand.candidate_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[0.78rem] font-mono text-[#8a8a85]">{cand.candidate_id}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-[0.85rem] font-medium text-[#1a1a1a]">{cand.requisition_title || '—'}</div>
                        <div className="text-[0.72rem] text-[#8a8a85]">{cand.vendor_name || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5">{statusBadge(cand.has_portal_access)}</td>
                      <td className="px-5 py-3.5">
                        {cand.has_work_order ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide cursor-pointer hover:opacity-85 transition"
                              style={{
                                backgroundColor: cand.work_order_status === 'ACTIVE' ? '#dcfce7' : '#fef3c7',
                                color: cand.work_order_status === 'ACTIVE' ? '#166534' : '#92400e',
                              }}
                              onClick={() => setSelectedGatesCandidate(cand)}
                              title="Click to view activation gates & verification checklist"
                            >
                              <FileText size={11} />
                              {cand.work_order_status || 'Created'}
                            </span>
                            <span className="text-[11px] font-mono text-[#4b5563] font-semibold bg-[#f3f4f6] px-2 py-0.5 rounded-md border border-[#e5e7eb]">
                              {cand.work_order_number || `WO-2026-${(cand.candidate_id || '').replace('SDC-', '').replace('SDC -', '').slice(0, 4).toUpperCase()}`}
                            </span>
                          </div>
                        ) : cand.has_portal_access ? (
                          <button
                            onClick={() => setSelectedGatesCandidate(cand)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-white text-[0.78rem] font-medium hover:bg-[#262626] transition shadow-2xs"
                          >
                            <ClipboardCheck size={13} />
                            Verification & Work Order
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f3f4f6] text-[#9ca3af] text-[0.78rem] font-medium border border-[#e5e7eb] cursor-not-allowed"
                            title="Create candidate portal login account first to unlock Work Order generation"
                          >
                            <Lock size={12} />
                            Portal Access Required
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!cand.has_portal_access ? (
                          <button
                            onClick={() => handleCreateAccess(cand)}
                            disabled={creatingId === cand.candidate_id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-white text-[0.78rem] font-medium hover:bg-[#262626] transition disabled:opacity-50 shadow-2xs"
                          >
                            <UserPlus size={13} />
                            {creatingId === cand.candidate_id ? 'Creating...' : 'Create Access'}
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              onClick={() => handleEditAccess(cand)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f4f4f0] hover:bg-[#eaeae6] border border-[#d1d1cc] text-[11px] font-bold text-[#1a1a1a] transition cursor-pointer shadow-2xs"
                              title="Edit Portal Email & Password"
                            >
                              <Key size={11} />
                              Edit Credentials
                            </button>
                            {!cand.has_work_order ? (
                              <button
                                onClick={() => setSelectedGatesCandidate(cand)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] text-white text-[11px] font-bold hover:bg-[#262626] transition cursor-pointer"
                              >
                                <FileText size={11} />
                                + Assign Work Order
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedGatesCandidate(cand)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f7f7f5] border border-[#eaeae6] text-[11px] font-bold text-[#1a1a1a] hover:bg-[#efefec] transition cursor-pointer"
                              >
                                <ExternalLink size={11} />
                                Gates & Onboarding
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Access Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-[1.1rem] font-bold text-[#1a1a1a]">Create Portal Access</h2>
              <p className="text-[0.82rem] text-[#8a8a85] mt-1">
                Create login credentials for <strong>{showCreateModal.candidate_name}</strong>
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-xl text-[0.82rem] text-[#991b1b] flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[0.75rem] font-semibold text-[#8a8a85] uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className={`w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border rounded-lg focus:outline-none transition ${
                    createEmailError ? 'border-red-500 text-red-900 bg-red-50/30 focus:border-red-500' : 'border-[#eaeae6] focus:border-[#1a1a1a]'
                  }`}
                />
                {createEmailError && (
                  <p className="text-[0.75rem] font-semibold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{createEmailError}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[0.75rem] font-semibold text-[#8a8a85] uppercase tracking-wide mb-1">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
                />
              </div>
              <div>
                <label className="block text-[0.75rem] font-semibold text-[#8a8a85] uppercase tracking-wide mb-1">Password</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
                />
                <p className="text-[0.72rem] text-[#8a8a85] mt-1">Candidate will use this to login to the portal</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(null)}
                className="flex-1 px-4 py-2.5 text-[0.82rem] font-medium text-[#8a8a85] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg hover:bg-[#efefec] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccess}
                disabled={!createForm.email || !!createEmailError || !createForm.name || !createForm.password || creatingId === showCreateModal.candidate_id}
                className="flex-1 px-4 py-2.5 text-[0.82rem] font-bold text-white bg-[#1a1a1a] rounded-lg hover:bg-[#262626] transition disabled:opacity-50"
              >
                {creatingId === showCreateModal.candidate_id ? 'Creating...' : 'Create Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Access Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#eaeae6] pb-3">
              <div>
                <h2 className="text-[1.1rem] font-bold text-[#1a1a1a]">Edit Portal Access</h2>
                <p className="text-[0.82rem] text-[#8a8a85] mt-0.5">
                  Update credentials for <strong>{showEditModal.candidate_name}</strong>
                </p>
              </div>
              <button onClick={() => setShowEditModal(null)} className="text-[#8a8a85] hover:text-[#1a1a1a] text-lg font-bold">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-xl text-[0.82rem] text-[#991b1b] flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[0.75rem] font-semibold text-[#8a8a85] uppercase tracking-wide mb-1">Login Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className={`w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border rounded-lg focus:outline-none transition ${
                    editEmailError ? 'border-red-500 text-red-900 bg-red-50/30 focus:border-red-500' : 'border-[#eaeae6] focus:border-[#1a1a1a]'
                  }`}
                  placeholder="candidate@example.com"
                />
                {editEmailError && (
                  <p className="text-[0.75rem] font-semibold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{editEmailError}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[0.75rem] font-semibold text-[#8a8a85] uppercase tracking-wide mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
                />
              </div>
              <div>
                <label className="block text-[0.75rem] font-semibold text-[#8a8a85] uppercase tracking-wide mb-1">
                  New Password <span className="normal-case font-normal text-[#a0a09a]">(leave blank to keep current)</span>
                </label>
                <input
                  type="text"
                  value={editForm.password}
                  onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter new password to update"
                  className="w-full px-3 py-2 text-[0.88rem] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg focus:outline-none focus:border-[#1a1a1a]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-[#eaeae6]">
              <button
                onClick={() => setShowEditModal(null)}
                className="flex-1 px-4 py-2.5 text-[0.82rem] font-medium text-[#8a8a85] bg-[#f7f7f5] border border-[#eaeae6] rounded-lg hover:bg-[#efefec] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditAccess}
                disabled={!editForm.email || !!editEmailError || !editForm.name || updatingId === showEditModal.candidate_id}
                className="flex-1 px-4 py-2.5 text-[0.82rem] font-bold text-white bg-[#1a1a1a] rounded-lg hover:bg-[#262626] transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {updatingId === showEditModal.candidate_id ? 'Saving...' : 'Update Credentials'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activation Gates Verification Checklist Modal */}
      {selectedGatesCandidate && (
        <ActivationGatesModal
          candidate={selectedGatesCandidate}
          token={token}
          onClose={() => setSelectedGatesCandidate(null)}
          onSuccess={loadCandidates}
        />
      )}
    </div>
  );
}
