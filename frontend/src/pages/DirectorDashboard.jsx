import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, API_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Briefcase,
  Users,
  Layers,
  FileCheck,
  FileText,
  Search,
  Upload,
  Trash2,
  ArrowRight,
  Building,
  Check,
  AlertCircle
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function DirectorDashboard({ view = 'overview' }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [templateMsg, setTemplateMsg] = useState('');
  const [approvingId, setApprovingId] = useState('');
  const [activeTab, setActiveTab] = useState(view);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const templateFileRef = useRef(null);

  useEffect(() => {
    setActiveTab(view);
  }, [view]);

  const loadTemplates = () => {
    request('/templates', { token })
      .then((res) => setTemplates(res || []))
      .catch((err) => setError(err.message));
  };

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      request('/requisitions', { token }),
      request('/candidates/shortlisted', { token }),
      request('/api/auth/vendors', { token }),
      request('/templates', { token }),
    ])
      .then(([reqsRes, candsRes, vendorsRes, templatesRes]) => {
        setRequisitions(reqsRes || []);
        setCandidates(candsRes || []);
        setVendors(vendorsRes || []);
        setTemplates(templatesRes || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, [token]);

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateMsg('');
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE_URL}/templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Upload failed');
      }
      await response.json();
      setTemplateMsg(`Template "${file.name}" uploaded successfully.`);
      loadTemplates();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (templateFileRef.current) templateFileRef.current.value = '';
    }
  };

  const handleTemplateDelete = async (id) => {
    setTemplateMsg('');
    setError('');
    try {
      await request(`/templates/${id}`, { method: 'DELETE', token });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setTemplateMsg('Template removed.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveRequisition = async (reqId, e) => {
    if (e) e.stopPropagation();
    setApprovingId(reqId);
    setError('');
    setTemplateMsg('');
    try {
      await request(`/requisitions/${reqId}/director-approve`, {
        method: 'POST',
        token,
      });
      setTemplateMsg('Requisition approved successfully!');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to approve requisition');
    } finally {
      setApprovingId('');
    }
  };

  const handleOpenRejectModal = (r, e) => {
    if (e) e.stopPropagation();
    setRejectModalReq(r);
    setRejectReason('');
    setError('');
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectModalReq) return;
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejecting this requisition.');
      return;
    }
    setApprovingId(rejectModalReq.id);
    setError('');
    setTemplateMsg('');
    try {
      await request(`/requisitions/${rejectModalReq.id}/reject`, {
        method: 'POST',
        body: {
          reviewer: user?.name || user?.email,
          reason: rejectReason.trim(),
        },
        token,
      });
      setTemplateMsg('Requisition rejected and sent back to Hiring Manager with rejection feedback.');
      setRejectModalReq(null);
      setRejectReason('');
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to reject requisition');
    } finally {
      setApprovingId('');
    }
  };

  const pendingApprovalsList = useMemo(() => {
    return requisitions.filter(
      (r) => (r.status === 'PendingApproval' || r.status === 'Pending_Approval') && !r.director_approved
    );
  }, [requisitions]);

  const approvedList = useMemo(() => {
    return requisitions.filter((r) => r.director_approved);
  }, [requisitions]);

  const publishedCount = requisitions.filter((r) => r.status === 'Published').length;
  const engagedVendors = vendors.filter((v) => v.engaged).length;

  const candidatesByRequisition = useMemo(() => {
    const map = {};
    (candidates || []).forEach((c) => {
      if (!c.requisition_id) return;
      map[c.requisition_id] = (map[c.requisition_id] || 0) + 1;
    });
    return map;
  }, [candidates]);

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.ref || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === 'PENDING') {
        return (r.status === 'PendingApproval' || r.status === 'Pending_Approval') && !r.director_approved;
      }
      if (statusFilter === 'APPROVED') {
        return r.director_approved;
      }
      if (statusFilter === 'PUBLISHED') {
        return r.status === 'Published';
      }
      return true;
    });
  }, [requisitions, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="w-full py-20 text-center text-xs text-gray-400 font-medium">
        Loading Executive Console...
      </div>
    );
  }

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-6 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-black text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-widest uppercase text-amber-400 mb-2">
              <ShieldCheck size={14} className="text-amber-400" />
              <span>{user?.tenant_name || 'SDC Limited'} • Executive Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Executive Governance & Approvals
            </h1>
            <p className="text-xs text-gray-300 font-normal mt-1 max-w-2xl">
              Authorized workspace for reviewing job requisitions, granting Director approval, and managing company role templates.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{pendingApprovalsList.length} Pending Approval</span>
            </span>
          </div>
        </div>

        {/* Dynamic Inner Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/10 flex-wrap relative z-10">
          <button
            type="button"
            onClick={() => {
              setActiveTab('overview');
              navigate('/dashboard/director');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-black shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-gray-200'
            }`}
          >
            📊 Executive Overview
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('approvals');
              navigate('/dashboard/director/approvals');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'approvals'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-gray-200'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Requisition Approvals</span>
            {pendingApprovalsList.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-black text-amber-400">
                {pendingApprovalsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('requisitions');
              navigate('/dashboard/director/requisitions');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'requisitions'
                ? 'bg-white text-black shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-gray-200'
            }`}
          >
            💼 All Requisitions ({requisitions.length})
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {templateMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span className="font-semibold">{templateMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 flex items-center gap-2.5 shadow-xs">
          <AlertCircle size={18} className="shrink-0 text-red-600" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Total Requisitions</span>
            <Briefcase size={16} className="text-gray-700" />
          </div>
          <div className="text-2xl font-black text-gray-900">{requisitions.length}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Company wide created</div>
        </div>

        <div className={`border rounded-2xl p-4 shadow-xs transition-all ${
          pendingApprovalsList.length > 0
            ? 'bg-gradient-to-br from-amber-50 to-white border-amber-300 ring-2 ring-amber-400/20'
            : 'bg-white border-gray-200/90'
        }`}>
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">Pending Approval</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950">{pendingApprovalsList.length}</div>
          <div className="text-[11px] text-amber-800 mt-1 font-medium">Requires Director sign-off</div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Approved / Live</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{publishedCount}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Published to vendors</div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Shortlisted</span>
            <Users size={16} className="text-gray-700" />
          </div>
          <div className="text-2xl font-black text-gray-900">{candidates.length}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Candidate profiles</div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Partner Vendors</span>
            <Layers size={16} className="text-gray-700" />
          </div>
          <div className="text-2xl font-black text-gray-900">{engagedVendors}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium">Engaged consultancies</div>
        </div>
      </div>

      {/* SECTION 1: REQUISITION APPROVALS QUEUE */}
      {(activeTab === 'approvals' || activeTab === 'overview') && (
        <div className="bg-white border border-amber-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck size={16} className="text-amber-600" />
                <span>Requisition Approvals Queue</span>
              </div>
              <h2 className="text-lg font-extrabold text-gray-900 mt-0.5">
                Requisitions Awaiting Director Sign-off ({pendingApprovalsList.length})
              </h2>
            </div>
            {pendingApprovalsList.length > 0 && (
              <span className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                ⏳ Action required to unlock HM publishing
              </span>
            )}
          </div>

          {pendingApprovalsList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <div className="text-sm font-bold text-gray-900">All Requisitions Approved!</div>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                There are currently no job requisitions waiting for Director approval. Hiring managers can publish approved roles directly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {pendingApprovalsList.map((r) => {
                const sr = r.structured_role || {};
                return (
                  <div
                    key={r.id}
                    className="bg-gradient-to-br from-amber-50/40 via-white to-white border border-amber-200/80 hover:border-amber-400 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
                        <span>REQ #{r.id.slice(0, 8)}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                          Pending Approval
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-gray-900 hover:text-black transition-colors">
                          {r.title || sr.title || 'Untitled Requisition'}
                        </h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          Created {formatDate(r.created_at)} • Hiring Manager: {sr.hiring_manager || r.hiring_manager_name || 'Hiring Manager'}
                        </p>
                      </div>

                      {/* Criteria Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {sr.work_mode && (
                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold">
                            📍 {sr.work_mode}
                          </span>
                        )}
                        {sr.duration && (
                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold">
                            ⏱️ {sr.duration}
                          </span>
                        )}
                        {sr.ceiling_internal && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100/70 text-amber-900 text-[11px] font-bold">
                            💰 Ceiling: ₹{sr.ceiling_internal}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-colors"
                      >
                        Review Criteria →
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleOpenRejectModal(r, e)}
                          disabled={approvingId === r.id}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Reject ✕
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleApproveRequisition(r.id, e)}
                          disabled={approvingId === r.id}
                          className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Check size={13} />
                          <span>{approvingId === r.id ? 'Authorizing...' : 'Approve ✓'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: ROLE TEMPLATES */}
      {(activeTab === 'overview') && (
        <div className="bg-white border border-gray-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Pre-Approved Role Templates</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload JSON templates so hiring managers can pre-fill new job requisitions instantly with standardized criteria.
              </p>
            </div>

            <input
              ref={templateFileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleTemplateUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => templateFileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Upload size={14} />
              <span>{uploading ? 'Uploading...' : 'Upload JSON Template'}</span>
            </button>
          </div>

          {templates.length === 0 ? (
            <p className="text-xs text-gray-400 py-4">No role templates uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    <th className="pb-2">Template Name</th>
                    <th className="pb-2">Role Title</th>
                    <th className="pb-2">Uploaded</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="py-3 font-bold text-gray-900">{t.name || 'Untitled Template'}</td>
                      <td className="py-3 text-gray-600">{t.structured_role?.title || '—'}</td>
                      <td className="py-3 text-gray-400">{formatDate(t.created_at)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleTemplateDelete(t.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: ALL REQUISITIONS DIRECTORY */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">All Company Requisitions</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Complete catalog of active, pending, and published job requisitions across the company.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search requisitions..."
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-black focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-white text-black shadow-2xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'PENDING' ? 'bg-white text-amber-900 shadow-2xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                Pending Approval
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('APPROVED')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'APPROVED' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                Approved
              </button>
            </div>
          </div>
        </div>

        {filteredRequisitions.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No requisitions found matching criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3">Requisition Title</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Director Sign-off</th>
                  <th className="pb-3">Candidates</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequisitions.map((r) => {
                  const isPending = (r.status === 'PendingApproval' || r.status === 'Pending_Approval') && !r.director_approved;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 font-bold text-gray-900">
                        {r.title || 'Untitled Requisition'}
                        <div className="text-[10px] text-gray-400 font-normal">REQ #{r.id.slice(0, 8)}</div>
                      </td>
                      <td className="py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3.5">
                        {r.director_approved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Approved ({r.director_approved_by || 'Director'})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            <Clock size={12} className="text-amber-600" />
                            <span>Pending Approval</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 font-semibold text-gray-700">
                        {candidatesByRequisition[r.id] || 0} candidates
                      </td>
                      <td className="py-3.5 text-gray-400 font-medium">{formatDate(r.created_at)}</td>
                      <td className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleOpenRejectModal(r, e)}
                              disabled={approvingId === r.id}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Reject ✕
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleApproveRequisition(r.id, e)}
                              disabled={approvingId === r.id}
                              className="px-3 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {approvingId === r.id ? 'Approving...' : 'Approve ✓'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/requisitions/${r.id}`)}
                            className="text-gray-600 hover:text-black text-xs font-bold"
                          >
                            View →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100 text-left animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-red-600 font-extrabold text-sm">
                <AlertCircle size={18} />
                <span>Reject Requisition & Request Changes</span>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="text-gray-400 hover:text-black font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-extrabold text-base text-gray-900">
                {rejectModalReq.title || 'Untitled Requisition'}
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                REQ #{rejectModalReq.id.slice(0, 8)} • This feedback will be sent directly to the Hiring Manager to guide their revisions.
              </p>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Rejection Reason / Required Modifications <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="4"
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Rate ceiling of ₹1200 is above budget. Please reduce internal ceiling to ₹900/hr or adjust required seniority level."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-red-500 focus:bg-white transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectModalReq(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rejectReason.trim() || approvingId === rejectModalReq.id}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{approvingId === rejectModalReq.id ? 'Rejecting...' : 'Confirm Rejection & Send Reason ✕'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
