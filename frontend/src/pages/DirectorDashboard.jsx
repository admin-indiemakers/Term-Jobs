import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
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
  AlertCircle,
  AlertTriangle,
  Receipt,
  Plus,
  X,
  Eye,
  MapPin,
  Calendar,
  DollarSign
} from 'lucide-react';

export function getRequisitionDisplayInfo(r) {
  if (!r) return { status: 'Draft', statusBadge: 'Draft', signOffText: 'Not Submitted', isRejected: false, isApproved: false, isPending: false };

  const isDeleted = Boolean(r.is_deleted || r.status === 'Deleted by HM');
  if (isDeleted) {
    return {
      status: 'Deleted by HM',
      statusBadge: 'Deleted by HM',
      signOffType: 'deleted',
      signOffText: `Approved (Previous) • Deleted by ${r.deleted_by || 'Hiring Manager'}`,
      isDeleted: true,
      isRejected: false,
      isApproved: false,
      isPending: false,
    };
  }

  // Approved: Director sign-off should show Approved, and the requisition status should change to Published.
  const isApproved = (Boolean(r.director_approved) || r.status === 'Published') && r.status !== 'Closed';
  if (isApproved) {
    return {
      status: 'Published',
      statusBadge: 'Published',
      signOffType: 'approved',
      signOffText: r.director_approved_by ? `Approved (${r.director_approved_by})` : 'Approved',
      isApproved: true,
      isRejected: false,
      isPending: false,
    };
  }

  // Rejected: Director sign-off should show Rejected, and the requisition status should change to Restructuring.
  // When a requisition is in the Restructuring state, the Director sign-off status should clearly indicate that it was rejected and requires revision before resubmission.
  const isRejected =
    Boolean(r.rejection_reason) ||
    Boolean(r.rejected_by) ||
    Boolean(r.rejected_at) ||
    r.status === 'Restructuring' ||
    (r.status === 'Structuring' && Boolean(r.rejection_reason));

  if (isRejected) {
    return {
      status: 'Restructuring',
      statusBadge: 'Restructuring',
      signOffType: 'rejected',
      signOffText: r.rejected_by ? `Rejected (${r.rejected_by})` : 'Rejected',
      subSignOffText: 'Revision Required • Awaiting Resubmission',
      rejectionReason: r.rejection_reason || '',
      isRejected: true,
      isApproved: false,
      isPending: false,
    };
  }

  // Pending Approval: Requisition status and Director sign-off should both show Pending Approval.
  const s = String(r.status || '').toLowerCase().replace(/[\s_-]+/g, '');
  const isPending = s === 'pendingapproval' || s === 'pending' || s.includes('pending');
  if (isPending) {
    return {
      status: 'Pending Approval',
      statusBadge: 'Pending Approval',
      signOffType: 'pending',
      signOffText: 'Pending Approval',
      isPending: true,
      isApproved: false,
      isRejected: false,
    };
  }

  if (r.status === 'Closed') {
    return {
      status: 'Closed',
      statusBadge: 'Closed',
      signOffType: 'closed',
      signOffText: r.director_approved_by ? `Approved (${r.director_approved_by}) • Closed` : 'Closed',
      isApproved: false,
      isRejected: false,
      isPending: false,
    };
  }

  return {
    status: r.status || 'Draft',
    statusBadge: r.status || 'Draft',
    signOffType: 'draft',
    signOffText: 'Not Submitted',
    isApproved: false,
    isRejected: false,
    isPending: false,
  };
}

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams();

  const currentTab = useMemo(() => {
    if (view && view !== 'overview') return view;
    const p = location.pathname.toLowerCase();
    if (p.includes('/approvals')) return 'approvals';
    if (p.includes('/requisitions')) return 'requisitions';
    return view || 'overview';
  }, [view, location.pathname]);

  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [clientTenants, setClientTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(user?.tenant_id || '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [templateMsg, setTemplateMsg] = useState('');
  const [approvingId, setApprovingId] = useState('');
  const [activeTab, setActiveTab] = useState(currentTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [dismissedDeletedAlerts, setDismissedDeletedAlerts] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [templateFormError, setTemplateFormError] = useState('');
  const [templateForm, setTemplateForm] = useState({
    name: '',
    title: '',
    job_family: '',
    priority: 'Normal',
    must_have_skills: '',
    nice_to_have_skills: '',
    experience: '3-5 years',
    headcount: 1,
    certifications: '',
    engagement_type: 'Contract',
    duration: '6 Months',
    rate_basis: 'Hourly',
    budget_cap_currency: 'INR',
    vendor_floor: '',
    vendor_cap: '',
    ceiling_internal: '',
    work_mode: 'Remote',
    primary_location: '',
    equipment_provided: 'Company-provided',
    bgv_required: 'Standard',
    nda_required: 'Yes',
    description: '',
  });
  const templateFileRef = useRef(null);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const [selectedRequisitionForView, setSelectedRequisitionForView] = useState(null);
  const [viewModalLoading, setViewModalLoading] = useState(false);

  const reqIdFromUrl = searchParams.get('reqId') || routeParams?.id;

  useEffect(() => {
    if (!reqIdFromUrl) return;
    const found = (Array.isArray(requisitions) ? requisitions : []).find((r) => r.id === reqIdFromUrl);
    if (found) {
      setSelectedRequisitionForView(found);
    } else if (token) {
      setViewModalLoading(true);
      request(`/requisitions/${reqIdFromUrl}`, { token })
        .then((res) => {
          if (res && res.id) setSelectedRequisitionForView(res);
        })
        .catch(() => {})
        .finally(() => setViewModalLoading(false));
    }
  }, [reqIdFromUrl, requisitions, token]);

  const handleViewRequisition = (r, e) => {
    if (e) e.stopPropagation();
    setSelectedRequisitionForView(r);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('reqId', r.id);
      return next;
    }, { replace: true });
  };

  const handleCloseRequisitionView = () => {
    setSelectedRequisitionForView(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('reqId');
      return next;
    }, { replace: true });
  };

  const activeTenantName = useMemo(() => {
    if (user?.role === 'Super Admin') {
      const matched = clientTenants.find((t) => t.id === selectedTenantId);
      return matched ? matched.name : (user?.tenant_name || 'Buyer Company');
    }
    return user?.tenant_name || 'Buyer Company';
  }, [user, clientTenants, selectedTenantId]);

  const loadTemplates = (overrideTenantId) => {
    const tid = overrideTenantId !== undefined ? overrideTenantId : (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id);
    const url = tid ? `/templates?tenant_id=${tid}` : '/templates';
    request(url, { token })
      .then((res) => setTemplates(Array.isArray(res) ? res : res?.templates || []))
      .catch((err) => setError(err?.message || 'Failed to load templates'));
  };

  const handleTenantChange = (newTid) => {
    setSelectedTenantId(newTid);
    loadTemplates(newTid);
  };

  const loadAll = () => {
    setLoading(true);
    const tid = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id);
    const tplUrl = tid ? `/templates?tenant_id=${tid}` : '/templates';
    Promise.all([
      request('/requisitions', { token }).catch(() => []),
      request('/candidates/shortlisted', { token }).catch(() => []),
      request('/api/auth/vendors', { token }).catch(() => []),
      request(tplUrl, { token }).catch(() => []),
      request('/api/workforce/director/work-orders', { token }).catch(() => ({ work_orders: [] })),
      request('/api/auth/tenants', { token }).catch(() => []),
    ])
      .then(([reqsRes, candsRes, vendorsRes, templatesRes, wosRes, tenantsRes]) => {
        const reqList = Array.isArray(reqsRes) ? reqsRes : (reqsRes?.requisitions || []);
        const candList = Array.isArray(candsRes) ? candsRes : (candsRes?.shortlisted_candidates || candsRes?.candidates || []);
        const vendorList = Array.isArray(vendorsRes) ? vendorsRes : (vendorsRes?.vendors || []);
        const templateList = Array.isArray(templatesRes) ? templatesRes : (templatesRes?.templates || []);
        const woList = Array.isArray(wosRes?.work_orders) ? wosRes.work_orders : (Array.isArray(wosRes) ? wosRes : []);
        const allTenants = Array.isArray(tenantsRes) ? tenantsRes : (tenantsRes?.tenants || []);
        const clientList = allTenants.filter((t) => t.tenant_type === 'client');

        setRequisitions(reqList);
        setCandidates(candList);
        setVendors(vendorList);
        setTemplates(templateList);
        setWorkOrders(woList);
        setClientTenants(clientList);

        if (user?.role === 'Super Admin' && !selectedTenantId && clientList.length > 0) {
          const defaultTenant = clientList.find((c) => c.id !== user?.tenant_id) || clientList[0];
          setSelectedTenantId(defaultTenant.id);
          const customTplUrl = `/templates?tenant_id=${defaultTenant.id}`;
          request(customTplUrl, { token })
            .then((res) => setTemplates(Array.isArray(res) ? res : res?.templates || []))
            .catch(() => {});
        }

        setError('');
      })
      .catch((err) => setError(err?.message || 'Failed to load dashboard data'))
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
      const targetTenant = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id) || '';
      const formData = new FormData();
      formData.append('file', file);
      if (targetTenant) {
        formData.append('tenant_id', targetTenant);
      }
      const uploadUrl = targetTenant ? `/templates?tenant_id=${targetTenant}` : '/templates';
      await request(uploadUrl, {
        method: 'POST',
        body: formData,
        token,
      });
      setTemplateMsg(`Template "${file.name}" uploaded successfully for ${activeTenantName}.`);
      loadTemplates(targetTenant);
    } catch (err) {
      setError(err?.message || 'Upload failed');
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
      setError(err?.message || 'Failed to remove template');
    }
  };

  const handleCreateTemplateSubmit = async (e) => {
    e.preventDefault();
    setTemplateFormError('');
    if (!templateForm.name.trim()) {
      setTemplateFormError('Please enter a Template Name.');
      return;
    }
    if (!templateForm.title.trim()) {
      setTemplateFormError('Please enter a Job Title.');
      return;
    }
    if (!templateForm.must_have_skills.trim()) {
      setTemplateFormError('Please enter at least one Must-Have Skill.');
      return;
    }

    setTemplateSubmitting(true);
    try {
      const targetTenant = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id) || '';
      const payload = {
        name: templateForm.name.trim(),
        title: templateForm.title.trim(),
        job_family: templateForm.job_family.trim(),
        priority: templateForm.priority,
        must_have_skills: templateForm.must_have_skills,
        nice_to_have_skills: templateForm.nice_to_have_skills,
        experience: templateForm.experience,
        headcount: parseInt(templateForm.headcount, 10) || 1,
        certifications: templateForm.certifications,
        engagement_type: templateForm.engagement_type,
        duration: templateForm.duration,
        rate_basis: templateForm.rate_basis,
        budget_cap_currency: templateForm.budget_cap_currency,
        vendor_floor: templateForm.vendor_floor !== '' ? Number(templateForm.vendor_floor) : null,
        vendor_cap: templateForm.vendor_cap !== '' ? Number(templateForm.vendor_cap) : null,
        ceiling_internal: templateForm.ceiling_internal !== '' ? Number(templateForm.ceiling_internal) : null,
        work_mode: templateForm.work_mode,
        primary_location: templateForm.primary_location.trim(),
        equipment_provided: templateForm.equipment_provided,
        bgv_required: templateForm.bgv_required,
        nda_required: templateForm.nda_required,
        description: templateForm.description.trim(),
        tenant_id: targetTenant,
      };

      await request('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        token,
      });

      setTemplateMsg(`Role template "${payload.name}" created successfully for ${activeTenantName}.`);
      setShowCreateTemplateModal(false);
      setTemplateForm({
        name: '',
        title: '',
        job_family: '',
        priority: 'Normal',
        must_have_skills: '',
        nice_to_have_skills: '',
        experience: '3-5 years',
        headcount: 1,
        certifications: '',
        engagement_type: 'Contract',
        duration: '6 Months',
        rate_basis: 'Hourly',
        budget_cap_currency: 'INR',
        vendor_floor: '',
        vendor_cap: '',
        ceiling_internal: '',
        work_mode: 'Remote',
        primary_location: '',
        equipment_provided: 'Company-provided',
        bgv_required: 'Standard',
        nda_required: 'Yes',
        description: '',
      });
      loadTemplates(targetTenant);
    } catch (err) {
      setTemplateFormError(err?.message || 'Failed to create role template');
    } finally {
      setTemplateSubmitting(false);
    }
  };

  const handleApproveRequisition = async (reqId, e) => {
    if (e) e.stopPropagation();
    setApprovingId(reqId);
    setError('');
    setTemplateMsg('');
    try {
      const updatedReq = await request(`/requisitions/${reqId}/director-approve`, {
        method: 'POST',
        token,
      });
      setTemplateMsg('Requisition approved successfully!');
      const approverName = updatedReq?.director_approved_by || user?.name || user?.email || 'Director';
      const approvedAt = updatedReq?.director_approved_at || new Date().toISOString();
      setRequisitions((prev) =>
        (Array.isArray(prev) ? prev : []).map((r) =>
          r.id === reqId
            ? {
                ...r,
                status: updatedReq?.status || 'Published',
                director_approved: true,
                director_approved_by: approverName,
                director_approved_at: approvedAt,
                rejection_reason: null,
                rejected_by: null,
                rejected_at: null,
              }
            : r
        )
      );
      setSelectedRequisitionForView((prev) =>
        prev && prev.id === reqId
          ? {
              ...prev,
              status: updatedReq?.status || 'Published',
              director_approved: true,
              director_approved_by: approverName,
              director_approved_at: approvedAt,
              rejection_reason: null,
              rejected_by: null,
              rejected_at: null,
            }
          : prev
      );
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
    const reqId = rejectModalReq.id;
    setApprovingId(reqId);
    setError('');
    setTemplateMsg('');
    try {
      const reviewerName = user?.name || user?.email || 'Director';
      const reasonText = rejectReason.trim();
      const nowIso = new Date().toISOString();
      await request(`/requisitions/${reqId}/reject`, {
        method: 'POST',
        body: {
          reviewer: reviewerName,
          reason: reasonText,
        },
        token,
      });
      setTemplateMsg('Requisition rejected and sent back to Hiring Manager with rejection feedback.');
      setRejectModalReq(null);
      setRejectReason('');
      setRequisitions((prev) =>
        (Array.isArray(prev) ? prev : []).map((r) =>
          r.id === reqId
            ? {
                ...r,
                status: 'Structuring',
                director_approved: false,
                rejection_reason: reasonText,
                rejected_by: reviewerName,
                rejected_at: nowIso,
              }
            : r
        )
      );
      setSelectedRequisitionForView((prev) =>
        prev && prev.id === reqId
          ? {
              ...prev,
              status: 'Structuring',
              director_approved: false,
              rejection_reason: reasonText,
              rejected_by: reviewerName,
              rejected_at: nowIso,
            }
          : prev
      );
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to reject requisition');
    } finally {
      setApprovingId('');
    }
  };

  const isReqPendingApproval = useCallback((r) => {
    if (!r) return false;
    if (r.is_deleted || r.status === 'Deleted by HM') return false;
    if (r.director_approved || r.status === 'Published') return false;
    if (Boolean(r.rejection_reason) || Boolean(r.rejected_by) || r.status === 'Restructuring') return false;
    const s = String(r.status || '').toLowerCase().replace(/[\s_-]+/g, '');
    return s === 'pendingapproval' || s === 'pending' || s.includes('pending');
  }, []);

  const pendingApprovalsList = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter(isReqPendingApproval);
  }, [requisitions, isReqPendingApproval]);

  const pendingWorkOrders = useMemo(() => {
    const list = Array.isArray(workOrders) ? workOrders : [];
    return list.filter((w) => {
      const st = (w.status || w.sow_data?.status || '').toLowerCase();
      const isApproved = st.includes('approved') || st === 'active' || w.director_approved === true || w.sow_data?.director_approved === true;
      return !isApproved;
    });
  }, [workOrders]);

  const handleApproveWorkOrder = async (cid) => {
    setApprovingId(cid);
    try {
      await request(`/api/workforce/procurement/sow/${encodeURIComponent(cid)}/director-approve`, {
        method: 'POST',
        token,
      });
      setTemplateMsg(`Work Order for candidate ${cid} approved successfully!`);
      loadAll();
    } catch (err) {
      setError(err?.message || 'Failed to approve Work Order.');
    } finally {
      setApprovingId('');
    }
  };

  const approvedList = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => (Boolean(r.director_approved) || r.status === 'Published') && !r.is_deleted && r.status !== 'Deleted by HM');
  }, [requisitions]);

  const rejectedList = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => getRequisitionDisplayInfo(r).isRejected);
  }, [requisitions]);

  const publishedCount = (Array.isArray(requisitions) ? requisitions : []).filter(
    (r) => r.status === 'Published' && !r.is_deleted && r.status !== 'Deleted by HM'
  ).length;

  const deletedByHmRequisitions = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => r.status === 'Deleted by HM' || r.is_deleted);
  }, [requisitions]);

  const engagedVendors = (Array.isArray(vendors) ? vendors : []).filter((v) => v.engaged).length;

  const candidatesByRequisition = useMemo(() => {
    const map = {};
    const list = Array.isArray(candidates) ? candidates : [];
    list.forEach((c) => {
      if (!c.requisition_id) return;
      map[c.requisition_id] = (map[c.requisition_id] || 0) + 1;
    });
    return map;
  }, [candidates]);

  const filteredRequisitions = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.ref || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      const info = getRequisitionDisplayInfo(r);

      if (statusFilter === 'DELETED') {
        return info.isDeleted;
      }
      if (statusFilter === 'PENDING') {
        return info.isPending;
      }
      if (statusFilter === 'APPROVED' || statusFilter === 'PUBLISHED') {
        return info.isApproved;
      }
      if (statusFilter === 'REJECTED' || statusFilter === 'RESTRUCTURING') {
        return info.isRejected;
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

          <button
            type="button"
            onClick={() => navigate('/dashboard/director/work-orders')}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
          >
            <Receipt size={14} className="text-amber-400" />
            <span>Work Orders (SOW)</span>
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

      {/* Alert Banner: Requisitions Deleted by Hiring Manager after Director Approval */}
      {!dismissedDeletedAlerts && deletedByHmRequisitions.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 via-red-50 to-amber-50 border border-rose-200 rounded-3xl text-xs shadow-xs space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-950 font-extrabold text-sm">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <span>Notice: {deletedByHmRequisitions.length} Approved / Published Requisition(s) Deleted by Hiring Manager</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('requisitions');
                  setStatusFilter('DELETED');
                }}
                className="text-[11px] font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-200 px-3 py-1 rounded-xl transition-colors cursor-pointer"
              >
                View in Directory →
              </button>
              <button
                type="button"
                onClick={() => setDismissedDeletedAlerts(true)}
                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 px-2 py-1 rounded-xl cursor-pointer"
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
          <p className="text-[11px] text-rose-800">
            The following job requisition(s) were previously approved and published by the Director, but subsequently deleted/cancelled by the Hiring Manager:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-0.5">
            {deletedByHmRequisitions.slice(0, 4).map((dr) => (
              <div key={dr.id} className="bg-white/90 border border-rose-100 rounded-2xl p-3 flex items-start justify-between gap-3 shadow-2xs">
                <div>
                  <div className="font-extrabold text-gray-900">{dr.title || 'Untitled Requisition'}</div>
                  <div className="text-[10px] text-gray-400">REQ #{dr.id.slice(0, 8)}</div>
                  <div className="text-[10px] text-rose-700 font-semibold mt-1">
                    Deleted by <strong className="underline">{dr.deleted_by || 'Hiring Manager'}</strong> on {formatDate(dr.deleted_at || dr.created_at)}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-extrabold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                  Was Live / Published
                </span>
              </div>
            ))}
          </div>
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
          (pendingApprovalsList.length + pendingWorkOrders.length) > 0
            ? 'bg-gradient-to-br from-amber-50 to-white border-amber-300 ring-2 ring-amber-400/20'
            : 'bg-white border-gray-200/90'
        }`}>
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">Pending Sign-off</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950">{pendingApprovalsList.length + pendingWorkOrders.length}</div>
          <div className="text-[11px] text-amber-800 mt-1 font-medium">
            {pendingApprovalsList.length} Req · {pendingWorkOrders.length} Work Orders
          </div>
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
                        onClick={(e) => handleViewRequisition(r, e)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
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

      {/* SECTION 1.5: PENDING WORK ORDERS / CANDIDATE PLACEMENTS */}
      {(activeTab === 'approvals' || activeTab === 'overview') && pendingWorkOrders.length > 0 && (
        <div className="bg-white border border-indigo-200/80 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 text-indigo-800 text-xs font-bold uppercase tracking-wider">
                <FileCheck size={16} className="text-indigo-600" />
                <span>Work Orders — Director Sign-Off</span>
              </div>
              <h2 className="text-lg font-extrabold text-gray-900 mt-0.5">
                Candidate Placements Awaiting Approval ({pendingWorkOrders.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/director/work-orders')}
              className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              View All Work Orders →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {pendingWorkOrders.map((wo) => {
              const cid = wo.candidate_id || wo.workorder_id;
              const sow = wo.sow_data || {};
              const name = sow.deployed_personnel || wo.candidate_name || wo.recruiter_name || 'Candidate';
              const role = sow.role || wo.company_name || 'Specialist';
              const company = sow.company_name || wo.company_name || 'Client Company';
              const vendor = sow.supplier_name || wo.recruiter_name || 'Direct Applicant';
              const rate = sow.charge_rate || wo.bill_rate || '—';
              const duration = sow.duration || '—';
              const isProcessing = approvingId === cid;
              return (
                <div
                  key={cid}
                  className="bg-gradient-to-br from-indigo-50/30 via-white to-white border border-indigo-200/60 hover:border-indigo-400 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider">
                      <span>WO #{(cid || '').slice(0, 12)}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                        <Clock size={11} /> Pending Approval
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">{name}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">{role} · {company}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Vendor: {vendor}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {rate && (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[11px] font-semibold">
                          💰 {rate}
                        </span>
                      )}
                      {duration && (
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold">
                          ⏱️ {duration}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/director/work-orders')}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Review SOW →
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveWorkOrder(cid)}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check size={13} />
                      <span>{isProcessing ? 'Approving...' : 'Approve ✓'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: ROLE TEMPLATES */}
      {(activeTab === 'overview') && (
        <div className="bg-white border border-gray-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-gray-900">Pre-Approved Role Templates</h2>
                {user?.role === 'Super Admin' && clientTenants.length > 0 ? (
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg shadow-2xs">
                    <Building size={13} className="text-gray-500" />
                    <span className="text-[10.5px] font-bold text-gray-500 uppercase">Target Buyer:</span>
                    <select
                      value={selectedTenantId}
                      onChange={(e) => handleTenantChange(e.target.value)}
                      className="text-xs font-extrabold bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                    >
                      {clientTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-bold border border-gray-200">
                    🏢 {activeTenantName}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Standardized role templates assigned exclusively to <strong>{activeTenantName}</strong>. Hiring managers at {activeTenantName} can pre-fill requisitions with standardized criteria.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <input
                ref={templateFileRef}
                type="file"
                accept=".json,application/json,text/json,text/plain,application/octet-stream"
                onChange={handleTemplateUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  setTemplateFormError('');
                  setShowCreateTemplateModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Plus size={14} />
                <span>Create Role Template</span>
              </button>

              <button
                type="button"
                onClick={() => templateFileRef.current?.click()}
                disabled={uploading}
                title="Alternative: Import existing JSON template file"
                className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload size={13} className="text-gray-500" />
                <span className="hidden sm:inline">{uploading ? 'Importing...' : 'Import JSON'}</span>
              </button>
            </div>
          </div>

          {/* Inline Upload Status Notification */}
          {templateMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 shadow-2xs">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span className="font-semibold">{templateMsg}</span>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2 text-gray-400">
                <Briefcase size={20} />
              </div>
              <p className="text-xs font-bold text-gray-700">No role templates added yet</p>
              <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1 mb-3">
                Create pre-approved role templates with standardized skills, rates, and compliance criteria for your Hiring Managers.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTemplateFormError('');
                  setShowCreateTemplateModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Create First Template</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    <th className="pb-2">Template & Role</th>
                    <th className="pb-2">Department / Skills</th>
                    <th className="pb-2">Rates / Commercials</th>
                    <th className="pb-2">Work Mode</th>
                    <th className="pb-2">Created</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((t) => {
                    const sr = t.structured_role || {};
                    const skills = Array.isArray(sr.must_have_skills) ? sr.must_have_skills : [];
                    const currency = sr.budget_cap_currency === 'USD' ? '$' : (sr.budget_cap_currency === 'EUR' ? '€' : (sr.budget_cap_currency === 'GBP' ? '£' : '₹'));
                    const rateStr = sr.vendor_cap || (sr.rate_band && sr.rate_band[1])
                      ? `${currency}${sr.vendor_floor || (sr.rate_band && sr.rate_band[0]) || 0} - ${currency}${sr.vendor_cap || (sr.rate_band && sr.rate_band[1])}/${sr.rate_basis === 'Annual' ? 'yr' : 'hr'}`
                      : (sr.ceiling_internal ? `Max ${currency}${sr.ceiling_internal}` : '—');

                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="py-3">
                          <div className="font-bold text-gray-900">{t.name || 'Untitled Template'}</div>
                          <div className="text-[11px] text-gray-500 font-medium">{sr.title || '—'}</div>
                        </td>
                        <td className="py-3">
                          <div className="text-gray-700 font-semibold">{sr.department || sr.job_family || 'General'}</div>
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {skills.slice(0, 3).map((s, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                                  {s}
                                </span>
                              ))}
                              {skills.length > 3 && (
                                <span className="text-[10px] text-gray-400 font-medium">+{skills.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-gray-700 font-semibold">{rateStr}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60">
                            {sr.work_mode || 'Remote'}
                          </span>
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: ALL REQUISITIONS DIRECTORY */}
      {(activeTab === 'requisitions' || activeTab === 'overview') && (
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
              <button
                type="button"
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'REJECTED' ? 'bg-white text-orange-900 shadow-2xs font-extrabold' : 'text-gray-500 hover:text-black'
                }`}
              >
                Restructuring / Rejected {rejectedList.length > 0 ? `(${rejectedList.length})` : ''}
              </button>
              {deletedByHmRequisitions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('DELETED')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'DELETED' ? 'bg-white text-rose-800 shadow-2xs font-extrabold' : 'text-gray-500 hover:text-rose-700'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Deleted by HM ({deletedByHmRequisitions.length})</span>
                </button>
              )}
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
                  const disp = getRequisitionDisplayInfo(r);
                  const isDeletedByHm = disp.isDeleted;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleViewRequisition(r)}
                      className={`transition-colors cursor-pointer ${
                        isDeletedByHm ? 'bg-rose-50/25 hover:bg-rose-50/40' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="py-3.5 font-bold text-gray-900">
                        {r.title || 'Untitled Requisition'}
                        <div className="text-[10px] text-gray-400 font-normal">
                          {r.ref || `REQ #${r.id.slice(0, 8)}`}
                        </div>
                      </td>
                      <td className="py-3.5">
                        {isDeletedByHm ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300">
                            <Trash2 size={12} className="text-rose-600" />
                            <span>Deleted by HM</span>
                          </span>
                        ) : disp.isApproved ? (
                          <StatusBadge status="Published" />
                        ) : disp.isRejected ? (
                          <StatusBadge status="Restructuring" />
                        ) : disp.isPending ? (
                          <StatusBadge status="Pending Approval" />
                        ) : (
                          <StatusBadge status={disp.status} />
                        )}
                      </td>
                      <td className="py-3.5">
                        {isDeletedByHm ? (
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-gray-400 line-through">
                              Approved ({r.director_approved_by || 'Director'})
                            </div>
                            <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                              <AlertTriangle size={11} className="text-rose-600" />
                              <span>Deleted by {r.deleted_by || 'Hiring Manager'}</span>
                            </div>
                            {r.deleted_at && (
                              <div className="text-[10px] text-gray-400">{formatDate(r.deleted_at)}</div>
                            )}
                          </div>
                        ) : disp.isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Approved{r.director_approved_by ? ` (${r.director_approved_by})` : ''}</span>
                          </span>
                        ) : disp.isRejected ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <X size={12} className="text-rose-600" />
                                <span>Rejected{r.rejected_by ? ` (${r.rejected_by})` : ''}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertCircle size={10} className="text-amber-600" />
                                <span>Revision Required</span>
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                              <span className="text-amber-700 font-semibold">Awaiting Resubmission</span>
                              {r.rejection_reason && (
                                <span className="text-gray-400 max-w-xs truncate" title={r.rejection_reason}>
                                  • "{r.rejection_reason}"
                                </span>
                              )}
                            </div>
                          </div>
                        ) : disp.isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            <Clock size={12} className="text-amber-600" />
                            <span>Pending Approval</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium text-[11px]">{disp.signOffText}</span>
                        )}
                      </td>
                      <td className="py-3.5 font-semibold text-gray-700">
                        {isDeletedByHm ? '—' : `${candidatesByRequisition[r.id] || 0} candidates`}
                      </td>
                      <td className="py-3.5 text-gray-400 font-medium">{formatDate(r.created_at)}</td>
                      <td className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isDeletedByHm ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="inline-block px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                              Removed by HM
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleViewRequisition(r, e)}
                              className="px-2.5 py-1 rounded-lg text-gray-500 hover:text-black hover:bg-gray-100 text-xs font-bold transition-colors cursor-pointer"
                            >
                              View →
                            </button>
                          </div>
                        ) : disp.isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleViewRequisition(r, e)}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                            >
                              View
                            </button>
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
                            onClick={(e) => handleViewRequisition(r, e)}
                            className="px-2.5 py-1 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100 text-xs font-bold transition-colors cursor-pointer"
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
      )}

      {/* DEDICATED DIRECTOR REQUISITION DETAILS MODAL */}
      {selectedRequisitionForView && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={handleCloseRequisitionView}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 text-left animate-in fade-in zoom-in-95 duration-150 overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/60 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-gray-200 text-gray-800 tracking-wider">
                    {selectedRequisitionForView.ref || `REQ #${selectedRequisitionForView.id.slice(0, 8)}`}
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">
                    {selectedRequisitionForView.department || selectedRequisitionForView.structured_role?.department || 'Engineering & Technology'}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">
                    Created {formatDate(selectedRequisitionForView.created_at)}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                  {selectedRequisitionForView.title || selectedRequisitionForView.structured_role?.title || 'Untitled Requisition'}
                </h2>
                <div className="text-xs text-gray-600 font-medium">
                  Hiring Manager: <strong className="text-gray-900">{selectedRequisitionForView.structured_role?.hiring_manager || selectedRequisitionForView.hiring_manager_name || 'Assigned Hiring Manager'}</strong>
                  {selectedRequisitionForView.company_name && (
                    <> • <span className="text-gray-500">{selectedRequisitionForView.company_name}</span></>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRequisitionView}
                className="w-9 h-9 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-black flex items-center justify-center font-bold text-sm cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Approval Status & Sign-off Governance Banner */}
              {(() => {
                const disp = getRequisitionDisplayInfo(selectedRequisitionForView);
                const isDel = selectedRequisitionForView.is_deleted || selectedRequisitionForView.status === 'Deleted by HM';

                if (isDel) {
                  return (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
                      <div className="flex items-center gap-2 font-black text-rose-900 text-sm">
                        <Trash2 size={16} className="text-rose-600" />
                        <span>Deleted by Hiring Manager</span>
                      </div>
                      <p className="text-xs text-rose-800">
                        This requisition was previously signed off but was removed by {selectedRequisitionForView.deleted_by || 'the Hiring Manager'} on {formatDate(selectedRequisitionForView.deleted_at || selectedRequisitionForView.created_at)}.
                      </p>
                    </div>
                  );
                }

                if (disp.isApproved) {
                  return (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span className="font-extrabold text-sm text-emerald-900">
                            Requisition Status: Published • Director Sign-off: Approved
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 font-medium">
                          Approved by {selectedRequisitionForView.director_approved_by || 'Director'} on {formatDate(selectedRequisitionForView.director_approved_at || selectedRequisitionForView.updated_at)}. Active for vendor submissions.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-emerald-800 border border-emerald-300 shadow-2xs shrink-0">
                        <Check size={13} className="text-emerald-600" />
                        <span>Published & Live</span>
                      </span>
                    </div>
                  );
                }

                if (disp.isRejected) {
                  return (
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-orange-300 text-gray-900 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-orange-200">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={18} className="text-orange-600" />
                          <span className="font-black text-sm text-orange-950">
                            Requisition Status: Restructuring • Director Sign-off: Rejected
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-900 border border-orange-300">
                          <AlertCircle size={12} className="text-orange-700" />
                          <span>Revision Required • Awaiting Resubmission</span>
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-orange-200 space-y-1">
                        <div className="text-[11px] font-extrabold text-orange-800 uppercase tracking-wider">
                          Director Reviewer Feedback ({selectedRequisitionForView.rejected_by || 'Director'}{selectedRequisitionForView.rejected_at ? ` on ${formatDate(selectedRequisitionForView.rejected_at)}` : ''}):
                        </div>
                        <p className="text-xs text-gray-900 font-medium whitespace-pre-wrap">
                          "{selectedRequisitionForView.rejection_reason || 'Revisions requested by Director prior to publishing.'}"
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-600 font-medium">
                        The Hiring Manager has been notified with this feedback and must restructure the role specifications, scope, or commercials before resubmitting for your sign-off.
                      </p>
                    </div>
                  );
                }

                if (disp.isPending) {
                  return (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-amber-700" />
                          <span className="font-black text-sm text-amber-950">
                            Requisition Status: Pending Approval • Director Sign-off: Pending Approval
                          </span>
                        </div>
                        <p className="text-xs text-amber-800 font-medium">
                          Submitted by Hiring Manager. Your executive sign-off is required to publish this requisition to partner vendors.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleOpenRejectModal(selectedRequisitionForView, e)}
                          disabled={approvingId === selectedRequisitionForView.id}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Reject ✕
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleApproveRequisition(selectedRequisitionForView.id, e)}
                          disabled={approvingId === selectedRequisitionForView.id}
                          className="px-4 py-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check size={13} />
                          <span>{approvingId === selectedRequisitionForView.id ? 'Approving...' : 'Approve & Publish ✓'}</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-700 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">Status: {disp.status} • Sign-off: {disp.signOffText}</span>
                    <StatusBadge status={disp.status} />
                  </div>
                );
              })()}

              {/* Grid: Role Specs & Commercials */}
              {(() => {
                const sr = selectedRequisitionForView.structured_role || {};
                const skillsList = (() => {
                  if (Array.isArray(sr.primary_skills)) return sr.primary_skills;
                  if (Array.isArray(sr.required_skills)) return sr.required_skills;
                  if (Array.isArray(selectedRequisitionForView.skills)) return selectedRequisitionForView.skills;
                  if (typeof sr.primary_skills === 'string') return sr.primary_skills.split(',').map((s) => s.trim()).filter(Boolean);
                  if (typeof sr.must_have_skills === 'string') return sr.must_have_skills.split(',').map((s) => s.trim()).filter(Boolean);
                  return [];
                })();
                const niceSkillsList = (() => {
                  if (Array.isArray(sr.secondary_skills)) return sr.secondary_skills;
                  if (Array.isArray(sr.nice_to_have_skills)) return sr.nice_to_have_skills;
                  if (typeof sr.secondary_skills === 'string') return sr.secondary_skills.split(',').map((s) => s.trim()).filter(Boolean);
                  if (typeof sr.nice_to_have_skills === 'string') return sr.nice_to_have_skills.split(',').map((s) => s.trim()).filter(Boolean);
                  return [];
                })();

                return (
                  <div className="space-y-4">
                    {/* Role Specifications Card */}
                    <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Briefcase size={14} className="text-gray-700" />
                        <span>Role Specifications & Headcount</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Experience</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.experience_level || sr.experience_years || sr.experience || '3–5 years'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Headcount</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.headcount || selectedRequisitionForView.headcount || 1} Role(s)</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Work Mode</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.work_mode || selectedRequisitionForView.work_mode || 'Remote'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Location</div>
                          <div className="font-extrabold text-gray-900 mt-0.5 truncate">{sr.primary_location || sr.location || 'Pan India'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Engagement</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.engagement_type || 'Contract'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Duration</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.duration || '6 Months'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Commercials & Financial Governance Card */}
                    <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Receipt size={14} className="text-gray-700" />
                        <span>Director Financial Controls & Governance</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Rate Basis</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.rate_basis || 'Hourly'} ({sr.budget_cap_currency || 'INR'})</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-amber-700 font-bold uppercase">Internal Ceiling</div>
                          <div className="font-extrabold text-amber-950 mt-0.5">
                            {sr.ceiling_internal ? `₹${Number(sr.ceiling_internal).toLocaleString('en-IN')}` : 'Market Discretionary'}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Vendor Floor - Cap</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">
                            {sr.vendor_floor && sr.vendor_cap ? `₹${Number(sr.vendor_floor).toLocaleString('en-IN')} – ₹${Number(sr.vendor_cap).toLocaleString('en-IN')}` : 'Tier Standard'}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Candidate Pipeline</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">
                            {candidatesByRequisition[selectedRequisitionForView.id] || 0} candidate(s)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compliance & Setup */}
                    <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-gray-700" />
                        <span>Compliance & Provisioning</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">BGV Level</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.bgv_required || 'Standard Verification'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">NDA Required</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.nda_required || 'Yes'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Equipment</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.equipment_provided || 'Company-provided'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Shift Schedule</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">{sr.shift_timing || 'General Shift (IST)'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Skills */}
                    {(skillsList.length > 0 || niceSkillsList.length > 0) && (
                      <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-gray-700" />
                          <span>Required Skills & Competencies</span>
                        </div>
                        <div className="space-y-2">
                          {skillsList.length > 0 && (
                            <div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1.5">Must-Have Skills:</div>
                              <div className="flex flex-wrap gap-1.5">
                                {skillsList.map((sk, idx) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-gray-900 border border-gray-200 shadow-2xs">
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {niceSkillsList.length > 0 && (
                            <div className="pt-1">
                              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nice-To-Have Skills:</div>
                              <div className="flex flex-wrap gap-1.5">
                                {niceSkillsList.map((sk, idx) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Full Job Description / SOW Preview */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                          <FileText size={14} className="text-gray-700" />
                          <span>Role Summary & Job Description</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold">Structured Requisition Document</span>
                      </div>
                      <div className="text-xs text-gray-700 font-normal leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto pr-2">
                        {selectedRequisitionForView.generated_jd_markdown ||
                          sr.summary ||
                          sr.role_overview ||
                          selectedRequisitionForView.description ||
                          'No formatted job description markdown was attached to this requisition.'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-gray-500 font-medium">
                Director Portal Requisition Viewer • REQ #{selectedRequisitionForView.id.slice(0, 8)}
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const disp = getRequisitionDisplayInfo(selectedRequisitionForView);
                  if (disp.isPending) {
                    return (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleOpenRejectModal(selectedRequisitionForView, e)}
                          disabled={approvingId === selectedRequisitionForView.id}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Reject ✕
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleApproveRequisition(selectedRequisitionForView.id, e)}
                          disabled={approvingId === selectedRequisitionForView.id}
                          className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check size={13} />
                          <span>{approvingId === selectedRequisitionForView.id ? 'Approving...' : 'Approve & Publish ✓'}</span>
                        </button>
                      </>
                    );
                  }
                  return null;
                })()}
                <button
                  type="button"
                  onClick={handleCloseRequisitionView}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* MODAL: CREATE ROLE TEMPLATE FORM */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-gray-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center shadow-xs">
                  <Briefcase size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
                    Create Pre-Approved Role Template
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Standardized criteria assigned exclusively to <strong className="text-gray-700">{activeTenantName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTemplateModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-gray-200/80 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTemplateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-left">
              {templateFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-600" />
                  <span className="font-semibold">{templateFormError}</span>
                </div>
              )}

              {/* Group 1: Role Identification */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-800 font-extrabold text-xs">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Role Identification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="e.g. Senior Frontend React Engineer"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                      placeholder="e.g. Senior React Developer"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Department / Job Family
                    </label>
                    <input
                      type="text"
                      value={templateForm.job_family}
                      onChange={(e) => setTemplateForm({ ...templateForm, job_family: e.target.value })}
                      placeholder="e.g. Engineering / Frontend"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Priority Level
                    </label>
                    <select
                      value={templateForm.priority}
                      onChange={(e) => setTemplateForm({ ...templateForm, priority: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical / Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group 2: Skills & Requirements */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-800 font-extrabold text-xs">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Skills & Candidate Specifications</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Must-Have Skills <span className="text-red-500">*</span> <span className="text-[10px] text-gray-400 normal-case font-normal">(Comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={templateForm.must_have_skills}
                      onChange={(e) => setTemplateForm({ ...templateForm, must_have_skills: e.target.value })}
                      placeholder="e.g. React.js, TypeScript, Redux Toolkit, REST APIs"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Nice-To-Have Skills <span className="text-[10px] text-gray-400 normal-case font-normal">(Comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={templateForm.nice_to_have_skills}
                      onChange={(e) => setTemplateForm({ ...templateForm, nice_to_have_skills: e.target.value })}
                      placeholder="e.g. Next.js, Tailwind CSS, GraphQL, Docker"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Experience Level
                      </label>
                      <input
                        type="text"
                        value={templateForm.experience}
                        onChange={(e) => setTemplateForm({ ...templateForm, experience: e.target.value })}
                        placeholder="e.g. 5-8 years"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Openings / Headcount
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={templateForm.headcount}
                        onChange={(e) => setTemplateForm({ ...templateForm, headcount: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Certifications
                      </label>
                      <input
                        type="text"
                        value={templateForm.certifications}
                        onChange={(e) => setTemplateForm({ ...templateForm, certifications: e.target.value })}
                        placeholder="e.g. AWS Certified Developer"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Commercials & Engagement */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-800 font-extrabold text-xs">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Commercials & Engagement Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Engagement Type
                    </label>
                    <select
                      value={templateForm.engagement_type}
                      onChange={(e) => setTemplateForm({ ...templateForm, engagement_type: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Contract">Contract (C2C / Vendor)</option>
                      <option value="Fixed Term">Fixed Term Contract</option>
                      <option value="Contract to Hire">Contract to Hire</option>
                      <option value="Full Time">Full-Time Employee</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Duration
                    </label>
                    <input
                      type="text"
                      value={templateForm.duration}
                      onChange={(e) => setTemplateForm({ ...templateForm, duration: e.target.value })}
                      placeholder="e.g. 6 Months"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Rate Basis
                    </label>
                    <select
                      value={templateForm.rate_basis}
                      onChange={(e) => setTemplateForm({ ...templateForm, rate_basis: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Hourly">Hourly Rate</option>
                      <option value="Daily">Daily Rate</option>
                      <option value="Monthly">Monthly Fixed</option>
                      <option value="Annual">Annual CTC</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Currency
                    </label>
                    <select
                      value={templateForm.budget_cap_currency}
                      onChange={(e) => setTemplateForm({ ...templateForm, budget_cap_currency: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="INR">₹ INR</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                      <option value="GBP">£ GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Vendor Floor Rate
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 800"
                      value={templateForm.vendor_floor}
                      onChange={(e) => setTemplateForm({ ...templateForm, vendor_floor: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Vendor Cap Rate
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1200"
                      value={templateForm.vendor_cap}
                      onChange={(e) => setTemplateForm({ ...templateForm, vendor_cap: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Internal Ceiling
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1400"
                      value={templateForm.ceiling_internal}
                      onChange={(e) => setTemplateForm({ ...templateForm, ceiling_internal: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Work Setup & Compliance */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-800 font-extrabold text-xs">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">4</span>
                  <span>Work Setup & Compliance</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Work Mode
                    </label>
                    <select
                      value={templateForm.work_mode}
                      onChange={(e) => setTemplateForm({ ...templateForm, work_mode: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Remote">100% Remote</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="On-site">On-site</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Primary Location
                    </label>
                    <input
                      type="text"
                      value={templateForm.primary_location}
                      onChange={(e) => setTemplateForm({ ...templateForm, primary_location: e.target.value })}
                      placeholder="e.g. Bangalore / Remote"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Equipment Provisioning
                    </label>
                    <select
                      value={templateForm.equipment_provided}
                      onChange={(e) => setTemplateForm({ ...templateForm, equipment_provided: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Company-provided">Company-provided Laptop</option>
                      <option value="Vendor-provided">Vendor-provided Equipment</option>
                      <option value="BYOD">BYOD (Bring Your Own Device)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Background Check
                    </label>
                    <select
                      value={templateForm.bgv_required}
                      onChange={(e) => setTemplateForm({ ...templateForm, bgv_required: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Standard">Standard BGV</option>
                      <option value="Enhanced">Enhanced / Strict BGV</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      NDA Required
                    </label>
                    <select
                      value={templateForm.nda_required}
                      onChange={(e) => setTemplateForm({ ...templateForm, nda_required: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Yes">Yes (Standard NDA)</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group 5: Role Overview / Notes */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Role Summary & Instructions <span className="text-[10px] text-gray-400 normal-case font-normal">(Optional guidance for Hiring Managers)</span>
                </label>
                <textarea
                  rows="3"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder="e.g. Pre-approved profile for UI engineering pods. Candidates must have extensive experience in state management and testing."
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-black transition-all font-medium"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={templateSubmitting}
                  className="px-5 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{templateSubmitting ? 'Saving Template...' : 'Save Role Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
