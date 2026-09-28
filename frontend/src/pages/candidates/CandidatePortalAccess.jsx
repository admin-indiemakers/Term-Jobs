import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { RefreshCw, Shield, ShieldOff, UserPlus, Search, AlertCircle, CheckCircle, Key, Edit3, Lock, X } from 'lucide-react';

export default function CandidatePortalAccess() {
  const { token, user } = useAuth();

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    const emailVal = (createForm.email || '').trim();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setError('Please enter a valid official email address (e.g. candidate@company.com).');
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
      setSuccessMsg(`Portal access created for ${createForm.name}. Candidate can now login with ${emailVal}`);
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
    setUpdatingId(cid);
    setSuccessMsg('');
    setError('');
    try {
      if (showEditModal.portal_user_id) {
        const body = {
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
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
            email: editForm.email.trim().toLowerCase(),
            name: editForm.name.trim(),
            password: editForm.password || '1234',
          },
        });
      }
      setSuccessMsg(`Portal credentials updated for ${editForm.name}.`);
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
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
              <input
                type="text"
                placeholder="Search candidate, email, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                className="w-full pl-10 pr-3.5 py-2.5 text-[0.9rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 placeholder:text-[#a3a3a3] placeholder:font-normal transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[0.68rem] tracking-[0.14em] text-[#8a8a85] uppercase font-semibold">
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  <th className="px-5 py-3 font-semibold">Work Order ID</th>
                  <th className="px-5 py-3 font-semibold">Requisition & Role</th>
                  <th className="px-5 py-3 font-semibold">Portal Status</th>
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
                        <td className="px-5 py-3"><div className="h-8 w-28 bg-gray-200 rounded-lg ml-auto" /></td>
                      </tr>
                    ))}
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <AlertCircle size={28} className="mx-auto mb-2 text-[#d1d5cc]" />
                      <div className="text-[0.92rem] text-[#8a8a85] font-medium">
                        {candidates.length === 0 ? 'No accepted candidates found' : 'No candidates match your search'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((cand) => (
                    <tr key={cand.workorder_id || cand.candidate_id} className="border-t border-[#f0f0ec] hover:bg-[#fafaf8] transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[0.72rem] font-bold">
                            {(cand.candidate_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-[0.88rem] font-semibold text-[#1a1a1a]">{cand.candidate_name}</div>
                            <div className="text-[0.75rem] text-[#8a8a85]">{cand.candidate_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[0.78rem] font-mono text-[#8a8a85]">{cand.workorder_id || cand.candidate_id}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-[0.85rem] font-medium text-[#1a1a1a]">{cand.requisition_title || '—'}</div>
                        <div className="text-[0.72rem] text-[#8a8a85]">{cand.vendor_name || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5">{statusBadge(cand.has_portal_access)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {!cand.has_portal_access ? (
                          <button
                            onClick={() => handleCreateAccess(cand)}
                            disabled={creatingId === (cand.candidate_id || cand.workorder_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-white text-[0.78rem] font-bold hover:bg-[#262626] transition disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <UserPlus size={13} />
                            {creatingId === (cand.candidate_id || cand.workorder_id) ? 'Creating...' : 'Create Access'}
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditAccess(cand)}
                              disabled={updatingId === (cand.candidate_id || cand.workorder_id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#eaeae6] text-[#1a1a1a] text-[0.78rem] font-bold hover:bg-[#f7f7f5] hover:border-[#1a1a1a] transition cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              <Edit3 size={13} />
                              Edit Access
                            </button>
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
              <div>
                <label className="block text-[0.74rem] font-bold text-[#404040] uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
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
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  style={{ color: '#0a0a0a', backgroundColor: '#ffffff' }}
                  className="w-full px-3.5 py-2.5 text-[0.92rem] font-semibold text-[#0a0a0a] bg-white border border-[#d4d4d4] rounded-xl focus:outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-black/5 shadow-2xs transition-all"
                />
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
