import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PRESET_ROLE_TEMPLATES } from '../utils/presetRoleTemplates';
import {
  FileText,
  Sparkles,
  Plus,
  Upload,
  RefreshCw,
  Search,
  Building,
  CheckCircle2,
  Trash2,
  Briefcase,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Receipt,
  X,
  Clock,
  DollarSign,
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

export default function DirectorRoleTemplates() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [clientTenants, setClientTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(user?.tenant_id || '');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [seedingPresets, setSeedingPresets] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Create Template Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const [form, setForm] = useState({
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

  const fileInputRef = useRef(null);

  const activeTenantName = useMemo(() => {
    if (user?.role === 'Super Admin') {
      const matched = clientTenants.find((t) => t.id === selectedTenantId);
      return matched ? matched.name : (user?.tenant_name || 'Buyer Company');
    }
    return user?.tenant_name || 'Buyer Company';
  }, [user, clientTenants, selectedTenantId]);

  const loadTemplates = (overrideTenantId) => {
    setLoading(true);
    const tid = overrideTenantId !== undefined ? overrideTenantId : (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id);
    const tplUrl = tid ? `/templates?tenant_id=${tid}` : '/templates';

    Promise.all([
      request(tplUrl, { token }).catch(() => []),
      user?.role === 'Super Admin' ? request('/api/auth/tenants', { token }).catch(() => []) : Promise.resolve([]),
    ])
      .then(([templatesRes, tenantsRes]) => {
        const list = Array.isArray(templatesRes) ? templatesRes : (templatesRes?.templates || []);
        setTemplates(list);

        if (user?.role === 'Super Admin') {
          const allTenants = Array.isArray(tenantsRes) ? tenantsRes : (tenantsRes?.tenants || []);
          const clients = allTenants.filter((t) => t.tenant_type === 'client');
          setClientTenants(clients);
        }
        setError('');
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load role templates');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) {
      loadTemplates();
    }
  }, [token]);

  const handleTenantChange = (newTid) => {
    setSelectedTenantId(newTid);
    loadTemplates(newTid);
  };

  const handleSeedAllPresets = async () => {
    const targetTenant = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id) || '';
    setSeedingPresets(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await request(`/templates/seed-presets${targetTenant ? `?tenant_id=${targetTenant}` : ''}`, {
        method: 'POST',
        token,
      });
      setSuccessMsg(`Standard pre-approved role templates (${res?.total || 9} roles) successfully populated for ${activeTenantName}!`);
      loadTemplates(targetTenant);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err?.message || 'Failed to seed preset templates');
    } finally {
      setSeedingPresets(false);
    }
  };

  const handleSelectPreset = (presetIndexStr) => {
    const idx = parseInt(presetIndexStr, 10);
    if (isNaN(idx) || !PRESET_ROLE_TEMPLATES[idx]) return;
    const p = PRESET_ROLE_TEMPLATES[idx];
    setSelectedPresetIdx(presetIndexStr);
    setForm({
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
    setModalError('');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!form.name.trim()) {
      setModalError('Please enter a Template Name.');
      return;
    }
    if (!form.title.trim()) {
      setModalError('Please enter a Job Title.');
      return;
    }
    if (!form.must_have_skills.trim()) {
      setModalError('Please enter at least one Must-Have Skill.');
      return;
    }

    setSubmitting(true);
    try {
      const targetTenant = (user?.role === 'Super Admin' ? selectedTenantId : user?.tenant_id) || '';
      const payload = {
        name: form.name.trim(),
        title: form.title.trim(),
        job_family: form.job_family.trim(),
        priority: form.priority,
        must_have_skills: form.must_have_skills,
        nice_to_have_skills: form.nice_to_have_skills,
        experience: form.experience,
        headcount: parseInt(form.headcount, 10) || 1,
        certifications: form.certifications,
        engagement_type: form.engagement_type,
        duration: form.duration,
        rate_basis: form.rate_basis,
        budget_cap_currency: form.budget_cap_currency,
        vendor_floor: form.vendor_floor !== '' ? Number(form.vendor_floor) : null,
        vendor_cap: form.vendor_cap !== '' ? Number(form.vendor_cap) : null,
        ceiling_internal: form.ceiling_internal !== '' ? Number(form.ceiling_internal) : null,
        work_mode: form.work_mode,
        primary_location: form.primary_location.trim(),
        equipment_provided: form.equipment_provided,
        bgv_required: form.bgv_required,
        nda_required: form.nda_required,
        description: form.description.trim(),
        tenant_id: targetTenant,
      };

      await request('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        token,
      });

      setSuccessMsg(`Role template "${payload.name}" created successfully for ${activeTenantName}.`);
      setShowCreateModal(false);
      setSelectedPresetIdx('');
      setForm({
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
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setModalError(err?.message || 'Failed to create role template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSuccessMsg('');
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
      setSuccessMsg(`Template "${file.name}" uploaded successfully for ${activeTenantName}.`);
      loadTemplates(targetTenant);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTemplateDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this role template?')) return;
    setSuccessMsg('');
    setError('');
    try {
      await request(`/templates/${id}`, { method: 'DELETE', token });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSuccessMsg('Template deleted.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err?.message || 'Failed to delete template');
    }
  };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const q = searchTerm.toLowerCase().trim();
      const sr = t.structured_role || {};
      const tName = (t.name || '').toLowerCase();
      const rTitle = (sr.title || '').toLowerCase();
      const dept = (sr.department || sr.job_family || '').toLowerCase();
      const skills = Array.isArray(sr.must_have_skills) ? sr.must_have_skills.join(' ').toLowerCase() : '';

      const matchesSearch = !q || tName.includes(q) || rTitle.includes(q) || dept.includes(q) || skills.includes(q);
      if (!matchesSearch) return false;

      if (departmentFilter !== 'ALL') {
        return dept.includes(departmentFilter.toLowerCase());
      }
      return true;
    });
  }, [templates, searchTerm, departmentFilter]);

  // Aggregate stats
  const engineeringCount = templates.filter((t) => {
    const d = ((t.structured_role || {}).department || (t.structured_role || {}).job_family || '').toLowerCase();
    return d.includes('eng') || d.includes('tech') || d.includes('dev') || d.includes('software');
  }).length;

  const contractCount = templates.filter((t) => {
    const et = ((t.structured_role || {}).engagement_type || '').toLowerCase();
    return !et || et.includes('contract');
  }).length;

  return (
    <div className="w-full text-left space-y-4 max-w-7xl mx-auto pb-16">
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Executive Console · Role Templates
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <FileText className="w-3.5 h-3.5" />
              Pre-Approved Standards
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-1">
            Pre-Approved Role Templates
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeTenantName} · Standardized roles that Hiring Managers can use to structure and publish instant requisitions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => loadTemplates()}
            className="px-3.5 py-2 bg-white/70 hover:bg-white border border-white/90 text-xs font-bold text-gray-800 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalError('');
              setSelectedPresetIdx('');
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={13} />
            <span>Create Role Template</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/json,text/plain,application/octet-stream"
            onChange={handleTemplateUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Import existing JSON template file"
            className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white border border-white/90 text-gray-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Upload size={13} className="text-gray-500" />
            <span className="hidden sm:inline">{uploading ? 'Importing...' : 'Import JSON'}</span>
          </button>
        </div>
      </div>

      {/* Alert / Notification banners */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span className="font-semibold">{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-red-700 hover:text-red-900 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-4 items-start mt-5 sm:mt-6 pt-1">
        {/* Left: Templates Directory */}
        <div className="flex-1 w-full min-w-0 bg-white/40 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-gray-900">Standardized Templates</h2>
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
                Templates configured with pre-approved rate ceilings, durations, and compliance warrants.
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-xl focus:outline-none focus:border-black focus:bg-white transition-all shadow-2xs"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Product">Product</option>
                <option value="Data">Data & AI</option>
                <option value="Design">Design</option>
              </select>
            </div>
          </div>

          {/* Table or Empty State */}
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center bg-white/50 backdrop-blur-md rounded-2xl border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
                <Briefcase size={22} />
              </div>
              <p className="text-sm font-bold text-gray-800">
                {searchTerm || departmentFilter !== 'ALL' ? 'No matching templates found' : 'No role templates created yet'}
              </p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                {searchTerm || departmentFilter !== 'ALL'
                  ? 'Try clearing your search query or department filter.'
                  : 'Pre-approve role templates with standardized skill requirements and billing caps for Hiring Managers.'}
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setModalError('');
                    setSelectedPresetIdx('');
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Create Custom Template</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10.5px] font-extrabold text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 pl-2">Template & Role</th>
                    <th className="pb-3">Department / Skills</th>
                    <th className="pb-3">Rates / Commercials</th>
                    <th className="pb-3">Work Mode</th>
                    <th className="pb-3">Created</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/70">
                  {filteredTemplates.map((t) => {
                    const sr = t.structured_role || {};
                    const skills = Array.isArray(sr.must_have_skills) ? sr.must_have_skills : [];
                    const currency = sr.budget_cap_currency === 'USD' ? '$' : (sr.budget_cap_currency === 'EUR' ? '€' : (sr.budget_cap_currency === 'GBP' ? '£' : '₹'));
                    const rateStr = sr.vendor_cap || (sr.rate_band && sr.rate_band[1])
                      ? `${currency}${sr.vendor_floor || (sr.rate_band && sr.rate_band[0]) || 0} - ${currency}${sr.vendor_cap || (sr.rate_band && sr.rate_band[1])}/${sr.rate_basis === 'Annual' ? 'yr' : 'hr'}`
                      : (sr.ceiling_internal ? `Max ${currency}${sr.ceiling_internal}` : '—');

                    return (
                      <tr key={t.id} className="hover:bg-white/60 transition-colors group">
                        <td className="py-3.5 pl-2">
                          <div className="font-extrabold text-gray-900 group-hover:text-black">
                            {t.name || 'Untitled Template'}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium">
                            {sr.title || '—'}
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="text-gray-800 font-bold">
                            {sr.department || sr.job_family || 'Engineering'}
                          </div>
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {skills.slice(0, 3).map((s, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded-md bg-gray-100/80 text-gray-600 text-[10px] font-semibold border border-gray-200/50">
                                  {s}
                                </span>
                              ))}
                              {skills.length > 3 && (
                                <span className="text-[10px] text-gray-400 font-semibold">+{skills.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 font-bold text-gray-900">
                          {rateStr}
                          {sr.rate_basis && (
                            <span className="block text-[10px] font-normal text-gray-400">
                              {sr.rate_basis} rate basis
                            </span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10.5px] font-bold border border-sky-200">
                            {sr.work_mode || 'Remote'}
                          </span>
                        </td>
                        <td className="py-3.5 text-gray-400 font-medium text-[11px]">
                          {formatDate(t.created_at)}
                        </td>
                        <td className="py-3.5 pr-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleTemplateDelete(t.id)}
                            className="text-gray-400 hover:text-red-600 text-xs font-bold transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-red-50"
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

        {/* Right Column: Stat Cards */}
        <div className="w-full lg:w-52 shrink-0 flex flex-col gap-2.5 lg:sticky lg:top-4 self-start">
          {/* Card 1: Total Role Templates */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[105px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
                <FileText size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Total
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {templates.length}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Role Templates
              </div>
            </div>
          </div>

          {/* Card 2: Engineering Roles */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[105px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs shrink-0">
                <Briefcase size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Tech
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {engineeringCount}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Engineering Roles
              </div>
            </div>
          </div>

          {/* Card 3: Contract Engagements */}
          <div className="bg-white/40 backdrop-blur-2xl border border-white/70 rounded-2xl p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] flex flex-col justify-between h-[105px]">
            <div className="flex items-center justify-between">
              <div className="w-7.5 h-7.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                <CheckCircle2 size={15} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                C2C / Vendor
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-[22px] font-black text-gray-900 tracking-tight leading-none">
                {contractCount}
              </div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                Contract Engagements
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE ROLE TEMPLATE MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 text-left animate-in fade-in zoom-in-95 duration-150 overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">Create Pre-Approved Role Template</h3>
                  <p className="text-[11px] text-gray-500">
                    Defines standardized requirements & pre-authorized commercial ceilings for {activeTenantName}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Quick Preset Selector */}
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                    <Sparkles size={13} className="text-amber-600" />
                    <span>Quick Autofill with Pre-Approved Benchmark Role</span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-semibold">9 Standard Roles</span>
                </div>
                <select
                  value={selectedPresetIdx}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full bg-white border border-amber-300/80 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-black cursor-pointer shadow-2xs"
                >
                  <option value="">-- Choose a standard role benchmark to auto-fill --</option>
                  {PRESET_ROLE_TEMPLATES.map((p, idx) => (
                    <option key={idx} value={String(idx)}>
                      {p.name} ({p.title} · {p.job_family})
                    </option>
                  ))}
                </select>
              </div>

              {/* Group 1: Identity */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-800 font-extrabold text-xs">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Template & Role Identity</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Senior React Developer Benchmark"
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
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                      value={form.job_family}
                      onChange={(e) => setForm({ ...form, job_family: e.target.value })}
                      placeholder="e.g. Engineering / Frontend"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Priority Level
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical / Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Openings / Headcount
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.headcount}
                      onChange={(e) => setForm({ ...form, headcount: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Skills */}
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
                      value={form.must_have_skills}
                      onChange={(e) => setForm({ ...form, must_have_skills: e.target.value })}
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
                      value={form.nice_to_have_skills}
                      onChange={(e) => setForm({ ...form, nice_to_have_skills: e.target.value })}
                      placeholder="e.g. Next.js, Tailwind CSS, GraphQL, Docker"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Experience Level
                      </label>
                      <input
                        type="text"
                        value={form.experience}
                        onChange={(e) => setForm({ ...form, experience: e.target.value })}
                        placeholder="e.g. 5-8 years"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Certifications
                      </label>
                      <input
                        type="text"
                        value={form.certifications}
                        onChange={(e) => setForm({ ...form, certifications: e.target.value })}
                        placeholder="e.g. AWS Certified Developer"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Commercials */}
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
                      value={form.engagement_type}
                      onChange={(e) => setForm({ ...form, engagement_type: e.target.value })}
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
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      placeholder="e.g. 6 Months"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Rate Basis
                    </label>
                    <select
                      value={form.rate_basis}
                      onChange={(e) => setForm({ ...form, rate_basis: e.target.value })}
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
                      value={form.budget_cap_currency}
                      onChange={(e) => setForm({ ...form, budget_cap_currency: e.target.value })}
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
                      value={form.vendor_floor}
                      onChange={(e) => setForm({ ...form, vendor_floor: e.target.value })}
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
                      value={form.vendor_cap}
                      onChange={(e) => setForm({ ...form, vendor_cap: e.target.value })}
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
                      value={form.ceiling_internal}
                      onChange={(e) => setForm({ ...form, ceiling_internal: e.target.value })}
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
                      value={form.work_mode}
                      onChange={(e) => setForm({ ...form, work_mode: e.target.value })}
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
                      value={form.primary_location}
                      onChange={(e) => setForm({ ...form, primary_location: e.target.value })}
                      placeholder="e.g. Bangalore / Remote"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase tracking-wider">
                      Equipment Provisioning
                    </label>
                    <select
                      value={form.equipment_provided}
                      onChange={(e) => setForm({ ...form, equipment_provided: e.target.value })}
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
                      value={form.bgv_required}
                      onChange={(e) => setForm({ ...form, bgv_required: e.target.value })}
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
                      value={form.nda_required}
                      onChange={(e) => setForm({ ...form, nda_required: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="Yes">Yes (Standard NDA)</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating Template...' : 'Save Role Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
