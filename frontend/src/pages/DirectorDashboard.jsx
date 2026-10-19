import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { request, API_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { PRESET_ROLE_TEMPLATES } from '../utils/presetRoleTemplates';
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
  DollarSign,
  RefreshCw,
  LayoutDashboard
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

  // Approved: Director sign-off should show Approved, and the requisition status should change to Published.
  const normStatus = String(r.status || '').trim().toLowerCase();
  const isApproved =
    (Boolean(r.director_approved) ||
      normStatus === 'published' ||
      normStatus === 'approved') &&
    normStatus !== 'closed';

  if (isApproved) {
    const approvalDate = r.director_approved_at || r.approved_at || (r.director_approved ? r.updated_at : null);
    return {
      status: 'Published',
      statusBadge: 'Published',
      signOffType: 'approved',
      signOffText: r.director_approved_by ? `Approved (${r.director_approved_by})` : 'Approved',
      approvedBy: r.director_approved_by || r.approved_by || 'Director',
      approvedAt: approvalDate,
      isApproved: true,
      isRejected: false,
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
  const [searchParams] = useSearchParams();
  const routeParams = useParams();

  const currentTab = useMemo(() => {
    if (view && view !== 'overview' && view !== 'approvals') return view;
    const p = location.pathname.toLowerCase();
    if (p.includes('/templates')) return 'templates';
    return 'requisitions';
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
  const [selectedPresetIdx, setSelectedPresetIdx] = useState('');
  const [seedingPresets, setSeedingPresets] = useState(false);
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
  const dashboardLoadVersion = useRef(0);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  // Auto-dismiss template / action notification banner after 2 seconds
  useEffect(() => {
    if (!templateMsg) return;
    const timer = setTimeout(() => {
      setTemplateMsg('');
    }, 2000);
    return () => clearTimeout(timer);
  }, [templateMsg]);

  // Auto-dismiss error banner after 3 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const [selectedRequisitionForView, setSelectedRequisitionForView] = useState(null);
  const [viewModalLoading, setViewModalLoading] = useState(false);

  const reqIdFromUrl = searchParams.get('reqId') || routeParams?.id;

  useEffect(() => {
    let cancelled = false;
    setSelectedRequisitionForView(null);
    if (!reqIdFromUrl || !token) {
      setViewModalLoading(false);
      return;
    }
    setViewModalLoading(true);
    request(`/requisitions/${reqIdFromUrl}`, { token })
      .then((res) => {
        if (!cancelled && res?.id) setSelectedRequisitionForView(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load requisition criteria.');
      })
      .finally(() => { if (!cancelled) setViewModalLoading(false); });
    return () => { cancelled = true; };
  }, [reqIdFromUrl, token]);

  const handleViewRequisition = (r, e) => {
    if (e) e.stopPropagation();
    navigate(`/dashboard/director/requisitions?reqId=${encodeURIComponent(r.id)}`);
  };

  const handleCloseRequisitionView = () => {
    setSelectedRequisitionForView(null);
    navigate('/dashboard/director/requisitions', { replace: true });
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

  const loadAll = (isSilent = false) => {
    const loadVersion = ++dashboardLoadVersion.current;
    if (!isSilent) setLoading(true);
    const tid = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id);
    const tplUrl = tid ? `/templates?tenant_id=${tid}` : '/templates';
    Promise.all([
      request('/requisitions?fresh=true', { token, noCache: true }),
      request('/candidates/shortlisted', { token }).catch(() => []),
      request('/api/auth/vendors', { token }).catch(() => []),
      request(tplUrl, { token }).catch(() => []),
      request('/api/workforce/director/work-orders', { token }).catch(() => ({ work_orders: [] })),
      request('/api/auth/tenants', { token }).catch(() => []),
    ])
      .then(([reqsRes, candsRes, vendorsRes, templatesRes, wosRes, tenantsRes]) => {
        if (loadVersion !== dashboardLoadVersion.current) return;
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
            .catch(() => { });
        }

        setError('');
      })
      .catch((err) => {
        if (loadVersion === dashboardLoadVersion.current) setError(err?.message || 'Failed to load dashboard data');
      })
      .finally(() => {
        if (loadVersion === dashboardLoadVersion.current) setLoading(false);
      });
  };

  useEffect(loadAll, [token]);

  const deadlineRefreshRef = useRef(loadAll);
  deadlineRefreshRef.current = loadAll;
  useEffect(() => {
    if (!token) return;
    const refresh = () => deadlineRefreshRef.current(true);
    let day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const timer = setInterval(() => {
      const nextDay = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (nextDay !== day) { day = nextDay; refresh(); }
    }, 1000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [token]);

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

  const handleApplyPreset = (presetIndexStr) => {
    const idx = parseInt(presetIndexStr, 10);
    if (isNaN(idx) || !PRESET_ROLE_TEMPLATES[idx]) return;
    const p = PRESET_ROLE_TEMPLATES[idx];
    setSelectedPresetIdx(presetIndexStr);
    setTemplateForm({
      name: p.name || '',
      title: p.title || '',
      job_family: p.job_family || '',
      priority: p.priority || 'Normal',
      must_have_skills: p.must_have_skills || '',
      nice_to_have_skills: p.nice_to_have_skills || '',
      experience: p.experience || '3-5 years',
      headcount: p.headcount || 1,
      certifications: p.certifications || '',
      engagement_type: p.engagement_type || 'Contract',
      duration: p.duration || '6 Months',
      rate_basis: p.rate_basis || 'Hourly',
      budget_cap_currency: p.budget_cap_currency || 'INR',
      vendor_floor: p.vendor_floor || '',
      vendor_cap: p.vendor_cap || '',
      ceiling_internal: p.ceiling_internal || '',
      work_mode: p.work_mode || 'Remote',
      primary_location: p.primary_location || '',
      equipment_provided: p.equipment_provided || 'Company-provided',
      bgv_required: p.bgv_required || 'Standard',
      nda_required: p.nda_required || 'Yes',
      description: p.description || '',
    });
    setTemplateFormError('');
  };

  const handleSeedAllPresets = async () => {
    const targetTenant = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id) || '';
    setSeedingPresets(true);
    setError('');
    setTemplateMsg('');
    try {
      const res = await request(`/templates/seed-presets${targetTenant ? `?tenant_id=${targetTenant}` : ''}`, {
        method: 'POST',
        token,
      });
      setTemplateMsg(`Standard pre-approved role templates (${res?.total || 9} roles) successfully populated for ${activeTenantName}!`);
      loadTemplates(targetTenant);
    } catch (err) {
      setError(err?.message || 'Failed to seed preset templates');
    } finally {
      setSeedingPresets(false);
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
      setSelectedPresetIdx('');
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
    // Discard dashboard reads started before this decision.
    ++dashboardLoadVersion.current;
    setApprovingId(reqId);
    setError('');
    setTemplateMsg('');
    try {
      const updatedReq = await request(`/requisitions/${reqId}/director-approve`, {
        method: 'POST',
        token,
      });
      setTemplateMsg('Requisition approved successfully!');
      const approverName = updatedReq?.director_approved_by || updatedReq?.approved_by || user?.name || user?.email || 'Director';
      const approvedAt = updatedReq?.director_approved_at || updatedReq?.approved_at || new Date().toISOString();
      setRequisitions((prev) =>
        (Array.isArray(prev) ? prev : []).map((r) =>
          r.id === reqId
            ? {
              ...r,
              status: updatedReq?.status || 'Published',
              director_approved: true,
              director_approved_by: approverName,
              director_approved_at: approvedAt,
              approved_by: approverName,
              approved_at: approvedAt,
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
            approved_by: approverName,
            approved_at: approvedAt,
            rejection_reason: null,
            rejected_by: null,
            rejected_at: null,
          }
          : prev
      );
      loadAll(true);
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
      loadAll(true);
    } catch (err) {
      setError(err.message || 'Failed to reject requisition');
    } finally {
      setApprovingId('');
    }
  };

  const isReqPendingApproval = useCallback((r) => {
    if (!r) return false;
    return getRequisitionDisplayInfo(r).isPending;
  }, []);

  const pendingApprovalsList = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter(isReqPendingApproval);
  }, [requisitions, isReqPendingApproval]);

  const pendingWorkOrders = useMemo(() => {
    const list = Array.isArray(workOrders) ? workOrders : [];
    return list.filter((w) => {
      const st = (w.status || w.sow_data?.status || '').toLowerCase();
      return st === 'pending director approval' || st === 'approved by procurement';
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
      loadAll(true);
    } catch (err) {
      setError(err?.message || 'Failed to approve Work Order.');
    } finally {
      setApprovingId('');
    }
  };

  const approvedList = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => getRequisitionDisplayInfo(r).isApproved);
  }, [requisitions]);

  const rejectedList = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => getRequisitionDisplayInfo(r).isRejected);
  }, [requisitions]);

  const publishedCount = approvedList.length;

  const deletedByHmRequisitions = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((r) => getRequisitionDisplayInfo(r).isDeleted);
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
    const term = searchTerm.trim().toLowerCase();

    return list.filter((r) => {
      const info = getRequisitionDisplayInfo(r);

      if (term) {
        const title = (r.title || '').toLowerCase();
        const ref = (r.ref || '').toLowerCase();
        const id = (r.id || '').toLowerCase();
        const idShort = id.slice(0, 8);
        const dept = (r.department || r.structured_role?.department || r.job_family || '').toLowerCase();
        const status = (info.status || r.status || '').toLowerCase();
        const signOff = (info.signOffText || r.director_approved_by || '').toLowerCase();
        const skills = Array.isArray(r.skills)
          ? r.skills.join(' ').toLowerCase()
          : typeof r.skills === 'string'
          ? r.skills.toLowerCase()
          : '';

        const matches =
          title.includes(term) ||
          ref.includes(term) ||
          id.includes(term) ||
          idShort.includes(term) ||
          `req-${idShort}`.includes(term) ||
          `req #${idShort}`.includes(term) ||
          dept.includes(term) ||
          status.includes(term) ||
          signOff.includes(term) ||
          skills.includes(term);

        if (!matches) return false;
      }

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
      className="w-full min-w-0 pb-16 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 shrink-0">
        <div>
          <div className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            TERM JOBS • EXECUTIVE GOVERNANCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Executive Governance & Approvals
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-normal mt-1 max-w-2xl">
            {activeTenantName} · Review requisitions, grant sign-offs, and monitor hiring governance.
          </p>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {user?.role === 'Super Admin' && clientTenants.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md border border-white/90 px-3 py-1.5 rounded-xl shadow-2xs">
              <Building size={13} className="text-gray-500" />
              <span className="text-[10.5px] font-bold text-gray-500 uppercase">Target:</span>
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
          )}

          <button
            type="button"
            onClick={() => loadAll(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold border border-white/90 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
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

      {/* Main Content Area: Left Active Section Card(s) + Right Vertical Stat Cards */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3.5 items-stretch pt-1">
        {/* Left Column: Active Content Section */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 w-full space-y-4">



          {/* SECTION 2: ROLE TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-gray-900">Pre-Approved Role Templates</h2>
                    {user?.role === 'Super Admin' && clientTenants.length > 0 ? (
                      <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md border border-white/90 px-2.5 py-0.5 rounded-lg shadow-2xs">
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
                      <span className="px-2.5 py-0.5 rounded-md bg-white/70 border border-white/90 text-gray-700 text-[11px] font-bold shadow-3xs">
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
                    onClick={handleSeedAllPresets}
                    disabled={seedingPresets}
                    title="Populate 9 comprehensive pre-approved role templates for your company"
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={14} className={seedingPresets ? 'animate-spin' : ''} />
                    <span>{seedingPresets ? 'Seeding Roles...' : '⚡ Seed 9 Standard Roles'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTemplateFormError('');
                      setSelectedPresetIdx('');
                      setShowCreateTemplateModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Create Role Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => templateFileRef.current?.click()}
                    disabled={uploading}
                    title="Alternative: Import existing JSON template file"
                    className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white border border-white/90 text-gray-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                <div className="py-8 text-center bg-white/50 backdrop-blur-md rounded-2xl border border-dashed border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2 text-gray-400">
                    <Briefcase size={20} />
                  </div>
                  <p className="text-xs font-bold text-gray-700">No role templates added yet</p>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1 mb-3">
                    Create pre-approved role templates with standardized skills, rates, and compliance criteria for your Hiring Managers.
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSeedAllPresets}
                      disabled={seedingPresets}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles size={13} className={seedingPresets ? 'animate-spin' : ''} />
                      <span>{seedingPresets ? 'Seeding...' : '⚡ Seed 9 Standard Roles'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateFormError('');
                        setSelectedPresetIdx('');
                        setShowCreateTemplateModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Create Custom Template</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                        <th className="w-[28%] py-3 px-3.5 text-left">Template & Role</th>
                        <th className="w-[24%] py-3 px-3 text-left">Department / Skills</th>
                        <th className="w-[18%] py-3 px-3 text-left">Rates / Commercials</th>
                        <th className="w-[12%] py-3 px-3 text-left">Work Mode</th>
                        <th className="w-[10%] py-3 px-3 text-left">Created</th>
                        <th className="w-[8%] py-3 px-3.5 text-right">Action</th>
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
                          <tr key={t.id} className="hover:bg-white/60 transition-colors">
                            <td className="w-[28%] py-3.5 px-3.5 align-middle">
                              <div className="font-bold text-gray-900">{t.name || 'Untitled Template'}</div>
                              <div className="text-[11px] text-gray-500 font-medium">{sr.title || '—'}</div>
                            </td>
                            <td className="w-[24%] py-3.5 px-3 align-middle">
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
                            <td className="w-[18%] py-3.5 px-3 align-middle text-gray-700 font-semibold">{rateStr}</td>
                            <td className="w-[12%] py-3.5 px-3 align-middle">
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px] font-bold border border-gray-200/80">
                                {sr.work_mode || 'Remote'}
                              </span>
                            </td>
                            <td className="w-[10%] py-3.5 px-3 align-middle text-gray-400">{formatDate(t.created_at)}</td>
                            <td className="w-[8%] py-3.5 px-3.5 align-middle text-right">
                              <button
                                type="button"
                                onClick={() => handleTemplateDelete(t.id)}
                                className="text-gray-400 hover:text-red-600 text-xs font-bold transition-colors cursor-pointer"
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

          {/* ALL COMPANY REQUISITIONS DIRECTORY */}
          {activeTab !== 'templates' && (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              {/* Top Controls Row: Title & Subtitle on Left, Search Bar on Right */}
              <div className="pb-3.5 border-b border-gray-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-gray-900">All Company Requisitions</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Complete catalog of active, pending, and published job requisitions across the company.
                    </p>
                  </div>

                  {/* Search Input Bar */}
                  <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search requisitions..."
                      className="w-full pl-9 pr-8 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-xl focus:outline-none focus:border-black focus:bg-white transition-all shadow-2xs"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-0.5 cursor-pointer z-10"
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Pills Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="inline-flex items-center gap-1 bg-white/60 backdrop-blur-md border border-white/80 p-1 rounded-xl text-[11px] font-bold shadow-2xs overflow-x-auto max-w-full">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${statusFilter === 'ALL' ? 'bg-black text-white shadow-2xs font-extrabold' : 'text-gray-600 hover:text-black'
                        }`}
                    >
                      All {requisitions.length > 0 ? `(${requisitions.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('PENDING')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${statusFilter === 'PENDING' ? 'bg-black text-white shadow-2xs font-extrabold' : 'text-gray-600 hover:text-black'
                        }`}
                    >
                      Pending Approval {pendingApprovalsList.length > 0 ? `(${pendingApprovalsList.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('APPROVED')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${statusFilter === 'APPROVED' ? 'bg-black text-white shadow-2xs font-extrabold' : 'text-gray-600 hover:text-black'
                        }`}
                    >
                      Approved {approvedList.length > 0 ? `(${approvedList.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('REJECTED')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${statusFilter === 'REJECTED' ? 'bg-black text-white shadow-2xs font-extrabold' : 'text-gray-600 hover:text-black'
                        }`}
                    >
                      Restructuring / Rejected {rejectedList.length > 0 ? `(${rejectedList.length})` : ''}
                    </button>
                    {deletedByHmRequisitions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter('DELETED')}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${statusFilter === 'DELETED' ? 'bg-black text-white shadow-2xs font-extrabold' : 'text-gray-600 hover:text-rose-700'
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
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs text-gray-500 font-medium">
                    {searchTerm.trim()
                      ? `No requisitions found matching "${searchTerm.trim()}".`
                      : 'No requisitions found matching criteria.'}
                  </p>
                  {searchTerm.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="text-xs font-bold text-gray-900 hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[880px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                        <th className="w-[22%] py-3 px-3.5 text-left">Requisition Title</th>
                        <th className="w-[13%] py-3 px-3 text-left">Status</th>
                        <th className="w-[16%] py-3 px-3 text-left">Director Sign-off</th>
                        <th className="w-[11%] py-3 px-3 text-left">Candidates</th>
                        <th className="w-[15%] py-3 px-3 text-left">Timeline</th>
                        <th className="w-[23%] min-w-[225px] py-3 px-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRequisitions.map((r) => {
                        const disp = getRequisitionDisplayInfo(r);
                        const isDeletedByHm = disp.isDeleted;
                        const approvalDate = disp.approvedAt || r.director_approved_at || r.approved_at || (r.director_approved ? r.updated_at : null);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => handleViewRequisition(r)}
                            className={`transition-colors cursor-pointer ${isDeletedByHm ? 'bg-rose-50/25 hover:bg-rose-50/40' : 'hover:bg-gray-50/80'
                              }`}
                          >
                            <td className="w-[22%] py-3.5 px-3.5 align-middle font-bold text-gray-900">
                              <div className="truncate" title={r.title || 'Untitled Requisition'}>
                                {r.title || 'Untitled Requisition'}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono font-normal mt-0.5">
                                {r.ref || `REQ #${r.id.slice(0, 8)}`}
                              </div>
                            </td>
                            <td className="w-[13%] py-3.5 px-3 align-middle">
                              {isDeletedByHm ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 whitespace-nowrap">
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
                            <td className="w-[16%] py-3.5 px-3 align-middle">
                              {isDeletedByHm ? (
                                <div className="space-y-0.5">
                                  <div className="text-[10px] text-gray-400 line-through">
                                    Approved ({r.director_approved_by || 'Director'})
                                  </div>
                                  <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                                    <AlertTriangle size={11} className="text-rose-600 shrink-0" />
                                    <span className="truncate">Deleted by {r.deleted_by || 'HM'}</span>
                                  </div>
                                  {r.deleted_at && (
                                    <div className="text-[10px] text-gray-400">{formatDate(r.deleted_at)}</div>
                                  )}
                                </div>
                              ) : disp.isApproved ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  <span>Approved{r.director_approved_by ? ` (${r.director_approved_by})` : ''}</span>
                                </span>
                              ) : disp.isRejected ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                      <X size={12} className="text-rose-600 shrink-0" />
                                      <span>Rejected{r.rejected_by ? ` (${r.rejected_by})` : ''}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      <AlertCircle size={10} className="text-amber-600 shrink-0" />
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
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 whitespace-nowrap">
                                  <Clock size={12} className="text-amber-600 shrink-0" />
                                  <span>Pending Approval</span>
                                </span>
                              ) : (
                                <span className="text-gray-400 font-medium text-[11px]">{disp.signOffText}</span>
                              )}
                            </td>
                            <td className="w-[11%] py-3.5 px-3 align-middle font-semibold text-gray-700 whitespace-nowrap">
                              {isDeletedByHm ? (
                                <span className="text-gray-400">—</span>
                              ) : (
                                <span>
                                  {candidatesByRequisition[r.id] || 0} {candidatesByRequisition[r.id] === 1 ? 'candidate' : 'candidates'}
                                </span>
                              )}
                            </td>
                            <td className="w-[15%] py-3.5 px-3 align-middle">
                              <div className="text-gray-900 font-semibold text-xs flex items-center gap-1 whitespace-nowrap">
                                <span className="text-gray-400 font-medium text-[11px]">Created:</span>
                                <span>{formatDate(r.created_at)}</span>
                              </div>
                              {disp.isApproved && approvalDate && (
                                <div className="text-emerald-700 font-bold text-[11px] mt-0.5 flex items-center gap-1 whitespace-nowrap">
                                  <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                                  <span>Approved: {formatDate(approvalDate)}</span>
                                </div>
                              )}
                            </td>
                            <td className="w-[23%] min-w-[225px] py-3.5 px-3.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              {isDeletedByHm ? (
                                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                  <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                                    Removed by HM
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleViewRequisition(r, e)}
                                    className="w-16 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-colors shadow-2xs cursor-pointer text-center"
                                  >
                                    View →
                                  </button>
                                </div>
                              ) : disp.isPending ? (
                                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => handleViewRequisition(r, e)}
                                    className="w-16 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs text-center"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenRejectModal(r, e)}
                                    disabled={approvingId === r.id}
                                    className="w-16 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50 text-center"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleApproveRequisition(r.id, e)}
                                    disabled={approvingId === r.id}
                                    className="w-16 py-1.5 rounded-lg bg-black hover:bg-gray-900 border border-black text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                                  >
                                    {approvingId === r.id ? '...' : 'Approve'}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => handleViewRequisition(r, e)}
                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                  >
                                    <span>View</span>
                                    <span className="text-gray-400">→</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                  {/* Mobile Card List View */}
                  <div className="block md:hidden space-y-2.5 pb-2">
                    {filteredRequisitions.map((r) => {
                      const disp = getRequisitionDisplayInfo(r);
                      const isDeletedByHm = disp.isDeleted;

                      return (
                        <div
                          key={`mobile-${r.id}`}
                          onClick={() => handleViewRequisition(r)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isDeletedByHm
                              ? 'bg-rose-50/30 border-rose-200/80'
                              : 'bg-white/70 border-white/80 shadow-3xs hover:bg-white/90'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                                {r.title || 'Untitled Requisition'}
                              </h4>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                {r.ref || `REQ #${r.id.slice(0, 8)}`} • {r.department || 'Engineering'}
                              </div>
                            </div>
                            {isDeletedByHm ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 text-rose-800 border border-rose-300 shrink-0">
                                <Trash2 size={10} className="text-rose-600" />
                                Deleted
                              </span>
                            ) : (
                              <StatusBadge status={disp.isRejected ? 'Restructuring' : disp.isPending ? 'Pending Approval' : disp.status} />
                            )}
                          </div>

                          {/* Sign-off badge & stats */}
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2.5 pt-2 border-t border-black/[0.04]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {disp.isApproved ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 size={10} className="text-emerald-600" />
                                  Approved
                                </span>
                              ) : disp.isPending ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <Clock size={10} className="text-amber-600" />
                                  Sign-off Pending
                                </span>
                              ) : disp.isRejected ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  <X size={10} className="text-rose-600" />
                                  Revision Required
                                </span>
                              ) : null}
                              <span>•</span>
                              <span>{candidatesByRequisition[r.id] || 0} candidate(s)</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {disp.isPending && !isDeletedByHm ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenRejectModal(r, e)}
                                    disabled={approvingId === r.id}
                                    className="px-2 py-1 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleApproveRequisition(r.id, e)}
                                    disabled={approvingId === r.id}
                                    className="px-2.5 py-1 rounded-lg bg-black hover:bg-gray-900 text-white text-[10px] font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {approvingId === r.id ? '...' : 'Approve'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleViewRequisition(r, e)}
                                  className="text-[11px] font-semibold text-gray-500 hover:text-black cursor-pointer"
                                >
                                  View →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column: 4 Metric Stat Cards */}
        <div className="order-1 lg:order-2 w-full lg:w-44 xl:w-48 shrink-0 flex flex-row lg:flex-col gap-2 sm:gap-2.5 overflow-x-auto lg:overflow-visible pb-1.5 lg:pb-0 snap-x no-scrollbar lg:sticky lg:top-4 self-start">
          {/* Stat Card 1: Total Requisitions */}
          <div
            onClick={() => {
              setActiveTab('requisitions');
              setStatusFilter('ALL');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[66px] sm:h-[72px] lg:h-[102px] w-[122px] sm:w-[136px] lg:w-full shrink-0 snap-start cursor-pointer active:scale-95 transition-all ${activeTab === 'requisitions' && statusFilter === 'ALL'
                ? 'bg-white/85 border-black/40 ring-1 ring-black/15 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            title="View All Requisitions"
          >
            <div className="flex items-center justify-between">
              <div className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Briefcase size={14} className="sm:w-[15px] sm:h-[15px]" />
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-gray-100 text-gray-700 border border-gray-200/80">
                Total
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {requisitions.length}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5">
                Total Requisitions
              </div>
            </div>
          </div>

          {/* Stat Card 2: Pending Sign-off */}
          <div
            onClick={() => {
              setActiveTab('requisitions');
              setStatusFilter('PENDING');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[66px] sm:h-[72px] lg:h-[102px] w-[122px] sm:w-[136px] lg:w-full shrink-0 snap-start cursor-pointer active:scale-95 transition-all ${statusFilter === 'PENDING'
                ? 'bg-white/85 border-amber-400/60 ring-1 ring-amber-400/30 shadow-sm'
                : pendingApprovalsList.length > 0
                  ? 'bg-white/40 border-amber-300/80 ring-1 ring-amber-400/20 hover:bg-white/60'
                  : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            title="Filter by Pending Sign-off"
          >
            <div className="flex items-center justify-between">
              <div className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                <Clock size={14} className="sm:w-[15px] sm:h-[15px]" />
              </div>
              {pendingApprovalsList.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Sign-off
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-gray-100 text-gray-500 border border-gray-200/80">
                  Clear
                </span>
              )}
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {pendingApprovalsList.length}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5">
                Pending Sign-off
              </div>
            </div>
          </div>

          {/* Stat Card 3: Approved Requisitions */}
          <div
            onClick={() => {
              setActiveTab('requisitions');
              setStatusFilter('APPROVED');
            }}
            className={`backdrop-blur-2xl border rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[66px] sm:h-[72px] lg:h-[102px] w-[122px] sm:w-[136px] lg:w-full shrink-0 snap-start cursor-pointer active:scale-95 transition-all ${statusFilter === 'APPROVED'
                ? 'bg-white/85 border-emerald-400/60 ring-1 ring-emerald-400/30 shadow-sm'
                : 'bg-white/40 border-white/70 hover:bg-white/60'
              }`}
            title="Filter by Approved Requisitions"
          >
            <div className="flex items-center justify-between">
              <div className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                <CheckCircle2 size={14} className="sm:w-[15px] sm:h-[15px]" />
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {approvedList.length}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5">
                Approved
              </div>
            </div>
          </div>

          {/* Stat Card 4: Shortlisted Candidates */}
          <div
            className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[66px] sm:h-[72px] lg:h-[102px] w-[122px] sm:w-[136px] lg:w-full shrink-0 snap-start"
          >
            <div className="flex items-center justify-between">
              <div className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center text-gray-700 shadow-2xs shrink-0">
                <Users size={14} className="sm:w-[15px] sm:h-[15px]" />
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                Profiles
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg lg:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {candidates.length}
              </div>
              <div className="text-[9.5px] sm:text-[10px] font-semibold text-gray-500 mt-0.5">
                Shortlisted
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewModalLoading && (
        <div role="status" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="rounded-2xl bg-white p-6 shadow-xl">Loading requisition criteria…</div>
        </div>
      )}
      {/* DEDICATED DIRECTOR REQUISITION DETAILS MODAL */}
      {selectedRequisitionForView && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
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
                  {(() => {
                    const disp = getRequisitionDisplayInfo(selectedRequisitionForView);
                    const appDate = selectedRequisitionForView.director_approved_at || selectedRequisitionForView.approved_at || disp.approvedAt;
                    if (disp.isApproved && appDate) {
                      return (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-md">
                            Approval Date: {formatDate(appDate)}
                          </span>
                        </>
                      );
                    }
                    return null;
                  })()}
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
                  const approvalDate = selectedRequisitionForView.director_approved_at || selectedRequisitionForView.approved_at || disp.approvedAt || selectedRequisitionForView.updated_at;
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
                          Approved by {selectedRequisitionForView.director_approved_by || selectedRequisitionForView.approved_by || 'Director'} on {formatDate(approvalDate)}. Active for vendor submissions.
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-emerald-800 border border-emerald-300 shadow-2xs">
                          <Check size={13} className="text-emerald-600" />
                          <span>Published & Live</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-800">
                          Approval Date: {formatDate(approvalDate)}
                        </span>
                      </div>
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
                const disp = getRequisitionDisplayInfo(selectedRequisitionForView);
                const sr = selectedRequisitionForView.structured_role || {};
                const skillsList = (() => {
                  if (Array.isArray(sr.must_have_skills)) return sr.must_have_skills;
                  if (Array.isArray(sr.skills)) return sr.skills;
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
                    {/* Timeline & Approval History Card */}
                    <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-700" />
                        <span>Timeline & Approval History</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Created Date</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">
                            {formatDate(selectedRequisitionForView.created_at)}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Submitted by Hiring Manager</div>
                        </div>
                        <div className={`p-3 rounded-xl border shadow-2xs ${disp.isApproved ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-gray-200/60'}`}>
                          <div className={`text-[10px] font-bold uppercase ${disp.isApproved ? 'text-emerald-700' : 'text-gray-400'}`}>
                            Approval Date
                          </div>
                          <div className={`font-extrabold mt-0.5 ${disp.isApproved ? 'text-emerald-900 text-sm' : 'text-gray-500'}`}>
                            {disp.isApproved
                              ? formatDate(selectedRequisitionForView.director_approved_at || selectedRequisitionForView.approved_at || disp.approvedAt || selectedRequisitionForView.updated_at)
                              : (disp.isRejected ? 'Rejected (Revision Required)' : 'Pending Director Approval')}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {disp.isApproved ? `Signed off by ${selectedRequisitionForView.director_approved_by || selectedRequisitionForView.approved_by || 'Director'}` : 'Director executive sign-off'}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Workflow Status</div>
                          <div className="font-extrabold text-gray-900 mt-0.5">
                            {disp.status}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Director Sign-off: {disp.signOffText}
                          </div>
                        </div>
                      </div>
                    </div>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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

              {/* ⚡ Quick Fill from Pre-Approved Preset */}
              <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-xs shadow-xs shrink-0">
                    ⚡
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                      <span>Quick-Fill from Pre-Approved Role Preset</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9.5px] font-bold">9 Standard Roles</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      Select a standardized role to instantly auto-populate all 4 sections below
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedPresetIdx}
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:outline-none focus:border-black cursor-pointer"
                  >
                    <option value="" disabled>⚡ Choose a Role Preset (9 Available)...</option>
                    {PRESET_ROLE_TEMPLATES.map((preset, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}. {preset.name}
                      </option>
                    ))}
                  </select>
                  {selectedPresetIdx !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPresetIdx('');
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
                      }}
                      className="px-2 py-1.5 text-[11px] text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

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
