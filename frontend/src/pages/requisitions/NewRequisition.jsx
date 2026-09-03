import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
  FileText,
  Clock,
  Briefcase,
  DollarSign,
  MapPin,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  Check,
  BookOpen
} from 'lucide-react';

const TABS = [
  { id: 'role', label: 'Role', icon: Briefcase },
  { id: 'engagement', label: 'Engagement', icon: Clock },
  { id: 'commercials', label: 'Commercials', icon: DollarSign },
  { id: 'work_setup', label: 'Work setup', icon: MapPin },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'process', label: 'Process', icon: Calendar },
];

const ENGAGEMENT_TYPES = ['Contract', 'Contract-to-Hire', 'Full-time'];
const WORK_MODES = ['Remote', 'Hybrid', 'Onsite'];
const EQUIPMENT_OPTIONS = ['Company-provided', 'Vendor-provided', 'BYOD'];
const CONTRACT_OPTIONS = ['Consultancy agreement', 'NDA-only', 'MSA-linked', 'Permanent offer'];
const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'];
const PRIORITY_OPTIONS = ['High', 'Normal', 'Low'];
const BOOL_OPTIONS = ['Yes', 'No'];

const toISODate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDuration = (duration, startDate) => {
  const m = String(duration || '').match(/(\d+)\s*(day|week|month|year)s?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const base = startDate ? new Date(startDate) : new Date();
  const d = new Date(base);
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'week') d.setDate(d.getDate() + n * 7);
  else if (unit === 'month') d.setMonth(d.getMonth() + n);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  return toISODate(d);
};

const WORKFLOW_STEPS = [
  { id: 'Draft', label: 'Draft', num: '1', active: true },
  { id: 'Intake', label: 'AI Intake', num: '2' },
  { id: 'Structuring', label: 'Structuring', num: '3' },
  { id: 'PendingApproval', label: 'Approval', num: '4' },
  { id: 'Published', label: 'Published', num: '5' },
];

export default function NewRequisition() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('role');
  const [roleTitle, setRoleTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [rawJd, setRawJd] = useState('');
  const [templates, setTemplates] = useState([]);
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Skill input tags
  const [skillInput, setSkillInput] = useState('');
  const [niceSkillInput, setNiceSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');

  // 6-Section Requisition Prefill State (Clean empty state)
  const [prefill, setPrefill] = useState({
    // 1. Role
    job_family: '',
    seniority: '',
    experience_band: '',
    headcount: 1,
    vendor_candidate_limit: 1,
    must_have_skills: [],
    nice_to_have_skills: [],
    certifications: [],
    // 2. Engagement
    engagement_type: '',
    duration: '',
    start_date: '',
    ends_on: '',
    extension_likely: '',
    // 3. Commercials
    rate_basis: '',
    ceiling_internal: '',
    vendor_floor: '',
    vendor_cap: '',
    budget_cap_currency: 'INR',
    // 4. Work Setup
    work_mode: '',
    primary_location: '',
    timezone: '',
    shift_hours: '',
    equipment_provided: '',
    // 5. Compliance
    bgv_required: '',
    drug_test_required: '',
    nda_required: '',
    ip_assignment_required: '',
    contract_template: '',
    // 6. Process
    target_start_date: '',
    submission_deadline: '',
    interview_rounds: '',
    priority: '',
  });

  // Load Templates & Company Profiles
  useEffect(() => {
    let isMounted = true;

    // 1. Templates
    request('/api/templates', { token })
      .then((data) => {
        if (isMounted) {
          const list = Array.isArray(data) ? data : data?.templates || [];
          setTemplates(list);
        }
      })
      .catch(() => {
        request('/templates', { token })
          .then((data) => {
            if (isMounted) {
              const list = Array.isArray(data) ? data : data?.templates || [];
              setTemplates(list);
            }
          })
          .catch(() => {});
      });

    // 2. Company Profiles
    request('/company-profiles', { token })
      .then((data) => {
        if (isMounted) {
          const list = Array.isArray(data) ? data : data?.company_profiles || [];
          setCompanyProfiles(list);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handlePrefillChange = (section, field, value) => {
    setPrefill((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'duration' || field === 'start_date') {
        const newDur = field === 'duration' ? value : prev.duration;
        const newStart = field === 'start_date' ? value : prev.start_date;
        const ends = addDuration(newDur, newStart);
        if (ends) next.ends_on = ends;
      }
      return next;
    });
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setRoleTitle('');
      setDepartment('');
      setRawJd('');
      setPrefill({
        job_family: '',
        seniority: '',
        experience_band: '',
        headcount: 1,
        vendor_candidate_limit: 1,
        must_have_skills: [],
        nice_to_have_skills: [],
        certifications: [],
        engagement_type: '',
        duration: '',
        start_date: '',
        ends_on: '',
        extension_likely: '',
        rate_basis: '',
        ceiling_internal: '',
        vendor_floor: '',
        vendor_cap: '',
        budget_cap_currency: 'INR',
        work_mode: '',
        primary_location: '',
        timezone: '',
        shift_hours: '',
        equipment_provided: '',
        bgv_required: '',
        drug_test_required: '',
        nda_required: '',
        ip_assignment_required: '',
        contract_template: '',
        target_start_date: '',
        submission_deadline: '',
        interview_rounds: '',
        priority: '',
      });
      return;
    }

    const tpl = templates.find((t) => String(t.id) === String(templateId));
    if (!tpl) return;

    const sr = tpl.structured_role || tpl.parsed_template || {};
    const title = sr.title || sr.role_title || tpl.name || tpl.title || '';
    const dept = sr.department || sr.job_family || tpl.department || '';

    setRoleTitle(title);
    setDepartment(dept);
    if (tpl.description || tpl.raw_jd) setRawJd(tpl.description || tpl.raw_jd || '');

    setPrefill({
      job_family: sr.job_family || sr.department || dept || '',
      seniority: sr.seniority || sr.seniority_level || '',
      experience_band: sr.experience_band || sr.years_experience || sr.experience || '',
      headcount: sr.headcount || sr.openings || 1,
      vendor_candidate_limit: sr.vendor_candidate_limit || sr.headcount || 1,
      must_have_skills: Array.isArray(sr.must_have_skills) ? sr.must_have_skills : [],
      nice_to_have_skills: Array.isArray(sr.nice_to_have_skills) ? sr.nice_to_have_skills : [],
      certifications: Array.isArray(sr.certifications) ? sr.certifications : [],
      engagement_type: sr.engagement_type || '',
      duration: sr.duration || sr.contract_duration || '',
      start_date: sr.start_date || '',
      ends_on: sr.ends_on || '',
      extension_likely: sr.extension_likely || '',
      rate_basis: sr.rate_basis || '',
      ceiling_internal: sr.ceiling_internal || sr.rate_card_cap || '',
      vendor_floor: sr.vendor_floor || sr.rate_card_floor || '',
      vendor_cap: sr.vendor_cap || sr.rate_card_cap || '',
      budget_cap_currency: sr.budget_cap_currency || 'INR',
      work_mode: sr.work_mode || '',
      primary_location: sr.primary_location || sr.location || '',
      timezone: sr.timezone || '',
      shift_hours: sr.shift_hours || '',
      equipment_provided: sr.equipment_provided || '',
      bgv_required: sr.bgv_required || '',
      drug_test_required: sr.drug_test_required || '',
      nda_required: sr.nda_required || '',
      ip_assignment_required: sr.ip_assignment_required || '',
      contract_template: sr.contract_template || '',
      target_start_date: sr.target_start_date || '',
      submission_deadline: sr.submission_deadline || '',
      interview_rounds: sr.interview_rounds || '',
      priority: sr.priority || '',
    });
  };

  // Skill Add / Remove Handlers
  const addMustHaveSkill = () => {
    if (!skillInput.trim()) return;
    if (!prefill.must_have_skills.includes(skillInput.trim())) {
      setPrefill((prev) => ({
        ...prev,
        must_have_skills: [...prev.must_have_skills, skillInput.trim()],
      }));
    }
    setSkillInput('');
  };

  const removeMustHaveSkill = (index) => {
    setPrefill((prev) => ({
      ...prev,
      must_have_skills: prev.must_have_skills.filter((_, i) => i !== index),
    }));
  };

  const addNiceSkill = () => {
    if (!niceSkillInput.trim()) return;
    if (!prefill.nice_to_have_skills.includes(niceSkillInput.trim())) {
      setPrefill((prev) => ({
        ...prev,
        nice_to_have_skills: [...prev.nice_to_have_skills, niceSkillInput.trim()],
      }));
    }
    setNiceSkillInput('');
  };

  const removeNiceSkill = (index) => {
    setPrefill((prev) => ({
      ...prev,
      nice_to_have_skills: prev.nice_to_have_skills.filter((_, i) => i !== index),
    }));
  };

  const addCert = () => {
    if (!certInput.trim()) return;
    if (!prefill.certifications.includes(certInput.trim())) {
      setPrefill((prev) => ({
        ...prev,
        certifications: [...prev.certifications, certInput.trim()],
      }));
    }
    setCertInput('');
  };

  const removeCert = (index) => {
    setPrefill((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  // Dynamic Live Assistant Checklist & Readiness Score
  const checklist = useMemo(() => {
    const items = [
      {
        id: 'job_title',
        tab: 'role',
        label: 'Job Title',
        filled: Boolean(roleTitle.trim()),
        detail: roleTitle.trim() ? `"${roleTitle.slice(0, 16)}..."` : 'Required to create role',
        required: true,
      },
      {
        id: 'job_family',
        tab: 'role',
        label: 'Job Family / Dept',
        filled: Boolean(prefill.job_family.trim() || department.trim()),
        detail: prefill.job_family || department || 'Recommended for categorization',
        required: false,
      },
      {
        id: 'skills',
        tab: 'role',
        label: 'Must-have Skills',
        filled: prefill.must_have_skills.length > 0,
        detail: prefill.must_have_skills.length > 0 ? `${prefill.must_have_skills.length} skills added` : 'Add at least 1 key skill',
        required: true,
      },
      {
        id: 'duration',
        tab: 'engagement',
        label: 'Engagement Duration',
        filled: Boolean(prefill.duration),
        detail: prefill.duration || 'Contract length',
        required: true,
      },
      {
        id: 'commercials',
        tab: 'commercials',
        label: 'Ceiling Rate / Budget',
        filled: Boolean(prefill.ceiling_internal),
        detail: prefill.ceiling_internal ? `₹${prefill.ceiling_internal}` : 'Rate cap per month/hr',
        required: false,
      },
      {
        id: 'deadline',
        tab: 'process',
        label: 'Submission Deadline',
        filled: Boolean(prefill.submission_deadline),
        detail: prefill.submission_deadline ? prefill.submission_deadline : 'Target submission cutoff',
        required: true,
      },
    ];

    const filledCount = items.filter((i) => i.filled).length;
    const score = Math.round((filledCount / items.length) * 100);

    return { items, filledCount, total: items.length, score };
  }, [roleTitle, department, prefill]);

  const canSubmit = Boolean(roleTitle.trim() && prefill.submission_deadline);

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!roleTitle.trim()) {
      setError('Please provide a Job Title before proceeding.');
      setActiveTab('role');
      return;
    }
    if (!prefill.submission_deadline) {
      setError('Please provide a Submission Deadline in the Process tab.');
      setActiveTab('process');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Retrieve active company profile ID
      let profileId = companyProfiles[0]?.id;
      if (!profileId) {
        try {
          const profList = await request('/company-profiles', { token });
          if (Array.isArray(profList) && profList.length > 0) {
            profileId = profList[0].id;
          }
        } catch (e) {}
      }

      const payload = {
        company_profile_id: profileId || 'default',
        title: roleTitle.trim(),
        description: rawJd.trim() || `${roleTitle.trim()} contract requirement`,
        tech_stack_hint: prefill.must_have_skills || [],
        intake_mode: 'guided',
        prefill: {
          ...prefill,
          title: roleTitle.trim(),
          department: department.trim() || prefill.job_family || 'Engineering',
        },
      };

      const res = await request('/requisitions', {
        method: 'POST',
        body: payload,
        token,
      });

      const newId = res.id || res.requisition_id;
      if (newId) {
        // Automatically start AI intake
        try {
          await request(`/requisitions/${newId}/start`, { method: 'POST', token });
        } catch (e) {}
        navigate(`/dashboard/requisitions/${newId}`);
      } else {
        navigate('/dashboard/requisitions/drafted');
      }
    } catch (err) {
      console.error('Failed to create requisition draft:', err);
      setError(err.message || 'Failed to create requisition. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="w-full min-w-0 pb-16 space-y-4 text-left"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-gray-400 tracking-wider uppercase mb-1">
            <Link to="/dashboard/requisitions" className="hover:text-black transition-colors">
              Requisitions
            </Link>
            <span>•</span>
            <span>CONTRACT ROLE DRAFTING</span>
          </div>
          <h1 className="text-2xl sm:text-[1.65rem] font-extrabold text-gray-900 tracking-tight">
            New Contract Requirement
          </h1>
          <p className="text-xs text-gray-500 font-normal mt-0.5 max-w-2xl">
            Define role parameters and budget ceilings. The AI agent will auto-structure the JD and ask targeted intake questions.
          </p>

          {/* Workflow Step Indicator */}
          <div className="flex items-center gap-1.5 mt-3.5 flex-wrap">
            {WORKFLOW_STEPS.map((st, i) => (
              <div key={st.id} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    st.active
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-white border border-gray-200 text-gray-400'
                  }`}
                >
                  <span className="text-[10px]">{st.num}.</span>
                  <span>{st.label}</span>
                </span>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight size={12} className="text-gray-300 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/requisitions')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Back to list
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="px-4 py-2 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={13} />
            <span>{submitting ? 'Creating...' : 'Start AI Intake →'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Form (8 cols) + AI Guide & Assistant Copilot (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Form Sections (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Template Import Card */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-gray-900" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Import from Template (Optional)
                </h3>
              </div>
              <span className="text-[11px] text-gray-400">Pre-fill standard company fields</span>
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full bg-gray-50 hover:bg-gray-100/70 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-black transition-colors"
            >
              <option value="">— Choose an approved role template —</option>
              {templates.map((tpl) => {
                const label = tpl.name || tpl.title || tpl.role_title || (tpl.structured_role && (tpl.structured_role.title || tpl.structured_role.role_title)) || `Template #${tpl.id.slice(0, 8)}`;
                const dept = tpl.department || (tpl.structured_role && (tpl.structured_role.department || tpl.structured_role.job_family));
                return (
                  <option key={tpl.id} value={tpl.id}>
                    {label} {dept ? `(${dept})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Core Requisition Builder Card */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            {/* Tab Bar */}
            <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-black text-white shadow-xs'
                        : 'text-gray-600 hover:text-black hover:bg-white/60'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: ROLE */}
            {activeTab === 'role' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Job Family / Department
                    </label>
                    <input
                      type="text"
                      value={prefill.job_family}
                      onChange={(e) => handlePrefillChange('role', 'job_family', e.target.value)}
                      placeholder="e.g. Platform Engineering"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Seniority Level
                    </label>
                    <select
                      value={prefill.seniority}
                      onChange={(e) => handlePrefillChange('role', 'seniority', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select Seniority Level...</option>
                      {SENIORITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Experience Band
                    </label>
                    <input
                      type="text"
                      value={prefill.experience_band}
                      onChange={(e) => handlePrefillChange('role', 'experience_band', e.target.value)}
                      placeholder="e.g. 3-6 yrs"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Headcount Openings
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={prefill.headcount}
                      onChange={(e) => handlePrefillChange('role', 'headcount', parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-red-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Vendor Candidate Limit <span className="text-red-600 font-bold">*</span></span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200">IMPORTANT</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={prefill.vendor_candidate_limit ?? 1}
                      onChange={(e) => handlePrefillChange('role', 'vendor_candidate_limit', parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-red-50/40 border border-red-300 rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-red-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-500/20 transition-all font-mono"
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Must-have Skills Tag Input */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Must-Have Skills <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMustHaveSkill())}
                      placeholder="Type skill & press Enter (e.g. Python, FastApi, PostgreSQL)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={addMustHaveSkill}
                      className="px-3.5 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {prefill.must_have_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-900 text-xs font-bold"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeMustHaveSkill(idx)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {prefill.must_have_skills.length === 0 && (
                      <span className="text-[11px] text-gray-400 italic">No skills added yet.</span>
                    )}
                  </div>
                </div>

                {/* Nice-to-have skills */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Nice-to-Have Skills (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={niceSkillInput}
                      onChange={(e) => setNiceSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNiceSkill())}
                      placeholder="e.g. Docker, Redis, Kubernetes"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={addNiceSkill}
                      className="px-3.5 py-2 rounded-xl bg-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-300 transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {prefill.nice_to_have_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeNiceSkill(idx)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Job Description Raw Text (Optional) */}
                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Raw Job Brief / Past JD (Optional)
                  </label>
                  <textarea
                    rows="3"
                    value={rawJd}
                    onChange={(e) => setRawJd(e.target.value)}
                    placeholder="Paste rough notes, responsibilities, or an existing JD here. AI will extract and structure it automatically."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: ENGAGEMENT */}
            {activeTab === 'engagement' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Engagement Type
                    </label>
                    <select
                      value={prefill.engagement_type}
                      onChange={(e) => handlePrefillChange('engagement', 'engagement_type', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select Engagement Type...</option>
                      {ENGAGEMENT_TYPES.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Contract Duration
                    </label>
                    <input
                      type="text"
                      value={prefill.duration}
                      onChange={(e) => handlePrefillChange('engagement', 'duration', e.target.value)}
                      placeholder="e.g. 6 months / 1 year"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-red-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Start Date <span className="text-red-600 font-bold">*</span></span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200">MANDATORY</span>
                    </label>
                    <input
                      type="date"
                      value={prefill.start_date}
                      onChange={(e) => handlePrefillChange('engagement', 'start_date', e.target.value)}
                      className="w-full bg-red-50/40 border border-red-300 rounded-xl px-3.5 py-2 text-xs font-extrabold text-red-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-500/20 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-red-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Estimated End Date <span className="text-red-600 font-bold">*</span></span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200">MANDATORY</span>
                    </label>
                    <input
                      type="date"
                      value={prefill.ends_on}
                      onChange={(e) => handlePrefillChange('engagement', 'ends_on', e.target.value)}
                      className="w-full bg-red-50/40 border border-red-300 rounded-xl px-3.5 py-2 text-xs font-extrabold text-red-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-500/20 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-red-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Extension Likely? <span className="text-red-600 font-bold">*</span></span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200">MANDATORY</span>
                    </label>
                    <select
                      value={prefill.extension_likely}
                      onChange={(e) => handlePrefillChange('engagement', 'extension_likely', e.target.value)}
                      className="w-full bg-red-50/40 border border-red-300 rounded-xl px-3 py-2 text-xs font-extrabold text-red-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-500/20 transition-all"
                      required
                    >
                      <option value="">Select...</option>
                      {BOOL_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: COMMERCIALS */}
            {activeTab === 'commercials' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Rate Basis
                    </label>
                    <select
                      value={prefill.rate_basis}
                      onChange={(e) => handlePrefillChange('commercials', 'rate_basis', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="Monthly rate">Monthly rate (INR)</option>
                      <option value="Daily rate">Daily rate (INR)</option>
                      <option value="Hourly rate">Hourly rate (INR)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Internal Ceiling Cap (₹)
                    </label>
                    <input
                      type="text"
                      value={prefill.ceiling_internal}
                      onChange={(e) => handlePrefillChange('commercials', 'ceiling_internal', e.target.value)}
                      placeholder="e.g. 150000 / 18L"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Vendor Visible Floor (₹)
                    </label>
                    <input
                      type="text"
                      value={prefill.vendor_floor}
                      onChange={(e) => handlePrefillChange('commercials', 'vendor_floor', e.target.value)}
                      placeholder="e.g. 120000"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Vendor Visible Cap (₹)
                    </label>
                    <input
                      type="text"
                      value={prefill.vendor_cap}
                      onChange={(e) => handlePrefillChange('commercials', 'vendor_cap', e.target.value)}
                      placeholder="e.g. 150000"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: WORK SETUP */}
            {activeTab === 'work_setup' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Work Mode
                    </label>
                    <select
                      value={prefill.work_mode}
                      onChange={(e) => handlePrefillChange('work_setup', 'work_mode', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select Work Mode...</option>
                      {WORK_MODES.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Primary Location
                    </label>
                    <input
                      type="text"
                      value={prefill.primary_location}
                      onChange={(e) => handlePrefillChange('work_setup', 'primary_location', e.target.value)}
                      placeholder="e.g. Bangalore, India"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Timezone & Shift Hours
                    </label>
                    <input
                      type="text"
                      value={prefill.shift_hours}
                      onChange={(e) => handlePrefillChange('work_setup', 'shift_hours', e.target.value)}
                      placeholder="e.g. 9:30 AM – 6:30 PM IST"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Equipment Provision
                    </label>
                    <select
                      value={prefill.equipment_provided}
                      onChange={(e) => handlePrefillChange('work_setup', 'equipment_provided', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select Provision...</option>
                      {EQUIPMENT_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: COMPLIANCE */}
            {activeTab === 'compliance' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      BGV Verification Required?
                    </label>
                    <select
                      value={prefill.bgv_required}
                      onChange={(e) => handlePrefillChange('compliance', 'bgv_required', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select...</option>
                      {BOOL_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      NDA Execution Required?
                    </label>
                    <select
                      value={prefill.nda_required}
                      onChange={(e) => handlePrefillChange('compliance', 'nda_required', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select...</option>
                      {BOOL_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Contract Agreement Type
                    </label>
                    <select
                      value={prefill.contract_template}
                      onChange={(e) => handlePrefillChange('compliance', 'contract_template', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="">Select Agreement Type...</option>
                      {CONTRACT_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: PROCESS */}
            {activeTab === 'process' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-red-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Submission Deadline <span className="text-red-600 font-bold">*</span></span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200">MANDATORY</span>
                    </label>
                    <input
                      type="date"
                      value={prefill.submission_deadline}
                      onChange={(e) => handlePrefillChange('process', 'submission_deadline', e.target.value)}
                      className="w-full bg-red-50/40 border border-red-300 rounded-xl px-3.5 py-2 text-xs font-extrabold text-red-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-500/20 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Priority Level
                    </label>
                    <select
                      value={prefill.priority}
                      onChange={(e) => handlePrefillChange('process', 'priority', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                    >
                      {PRIORITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Interview Rounds Structure
                  </label>
                  <input
                    type="text"
                    value={prefill.interview_rounds}
                    onChange={(e) => handlePrefillChange('process', 'interview_rounds', e.target.value)}
                    placeholder="e.g. 2 rounds (Technical Screen + Hiring Manager Loop)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Copilot & Live Assistant Side Tab (4 cols) */}
        <div className="lg:col-span-4 space-y-3.5">
          {/* Main Assistant Card */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-3.5 sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                  <Sparkles size={13} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Requisition Copilot
                  </h3>
                  <p className="text-[10px] text-gray-400">Live draft readiness guide</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 text-[10px] font-extrabold">
                {checklist.score}% Ready
              </span>
            </div>

            {/* Readiness Progress Bar */}
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-black h-full rounded-full transition-all duration-300"
                style={{ width: `${checklist.score}%` }}
              />
            </div>

            {/* Step-by-Step Flow Instructions */}
            <div className="space-y-2 text-xs">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                What to do next
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 rounded-xl bg-gray-50/80 border border-gray-100">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 text-[11.5px]">Provide Role & Core Skills</div>
                    <div className="text-[10.5px] text-gray-500">
                      Fill in Job Title and at least one must-have skill in the Role tab.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-xl bg-gray-50/80 border border-gray-100">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 text-[11.5px]">Set Budget & Submission Deadline</div>
                    <div className="text-[10.5px] text-gray-500">
                      Configure duration and target submission cutoff date.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-xl bg-gray-50/80 border border-gray-100">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 text-[11.5px]">Launch AI Intake</div>
                    <div className="text-[10.5px] text-gray-500">
                      Click below to generate targeted screening questions and candidate matching criteria.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Missing Fields Interactive Checklist */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Field Checklist & Jump
              </div>

              <div className="space-y-1.5">
                {checklist.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab(item.tab)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          item.filled
                            ? 'bg-black text-white'
                            : item.required
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {item.filled ? '✓' : '•'}
                      </span>
                      <span className={item.filled ? 'font-bold text-gray-900' : 'text-gray-600'}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 max-w-[120px] truncate text-right">
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action CTA inside Side Tab */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="w-full py-2.5 px-3.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={13} />
                <span>{submitting ? 'Creating...' : 'Create & Start AI Intake →'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
