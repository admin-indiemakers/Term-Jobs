import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../../api/client';
import { API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const ENGAGEMENT_TYPES = ['Contract'];
const WORK_MODES = ['Remote', 'Hybrid', 'Onsite'];
const EQUIPMENT_OPTIONS = ['Company-provided', 'Vendor-provided', 'BYOD'];
const CONTRACT_OPTIONS = ['Consultancy agreement', 'NDA-only', 'MSA-linked', 'Permanent offer'];
const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'];
const PRIORITY_OPTIONS = ['High', 'Normal', 'Low'];
const BOOL_OPTIONS = ['Yes', 'No'];

const Section = ({ title, children, expanded, onToggle }) => (
  <div className="intake-section" style={{ marginTop: 24 }}>
    <div className="intake-section-head" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 className="intake-section-title" style={{ margin: 0 }}>{title}</h2>
      <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
    </div>
    {expanded && <div className="intake-grid" style={{ marginTop: 16 }}>{children}</div>}
  </div>
);

const Field = ({ label, hint, children, required }) => (
  <div className="intake-field">
    <label className="form-label">{label} {required && <span className="required">*</span>}</label>
    {children}
    {hint && <p className="field-hint">{hint}</p>}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type, min, ...props }) => (
  <input className="auth-input" type={type || 'text'} min={min} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} {...props} />
);

const SelectInput = ({ value, onChange, options, placeholder, ...props }) => (
  <select className="auth-input" value={value} onChange={(e) => onChange(e.target.value)} {...props}>
    <option value="">{placeholder || 'Select...'}</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

const ChipInput = ({ value, onChange, onRemove, placeholder }) => {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v) {
      onChange([...value, v]);
      setText('');
    }
  };
  return (
    <div className="chips-input-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {value.map((s, i) => (
        <span key={`${s}-${i}`} className="chip-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--chip-bg)', padding: '4px 8px', borderRadius: 999, fontSize: '0.8rem' }}>
          {s}
          <button type="button" className="chip-tag-remove" onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <input
        className="chip-adder auth-input" style={{ flex: 1, minWidth: 120 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }}}
        onBlur={add}
        placeholder={placeholder || '+ add'}
      />
    </div>
  );
};

const RangeInput = ({ minVal, maxVal, onMinChange, onMaxChange, placeholder }) => (
  <div className="rate-band-input" style={{ display: 'flex', gap: 10 }}>
    <input className="auth-input" type="number" min="0" placeholder={`${placeholder} min`} value={minVal} onChange={(e) => onMinChange(e.target.value === '' ? '' : Number(e.target.value))} />
    <input className="auth-input" type="number" min="0" placeholder={`${placeholder} max`} value={maxVal} onChange={(e) => onMaxChange(e.target.value === '' ? '' : Number(e.target.value))} />
  </div>
);

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

export default function NewRequisition() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [companyProfileId, setCompanyProfileId] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Template import state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Pre-fill structured role fields (all 6 tabs)
  const [prefill, setPrefill] = useState({
    // Role tab
    job_title: '',
    job_family: '',
    must_have_skills: [],
    nice_to_have_skills: [],
    seniority: '',
    experience: '',
    headcount: 1,
    certifications: [],
    // Engagement tab
    engagement_type: '',
    duration: '',
    start_date: '',
    ends_on: '',
    extension_likely: false,
    max_notice_period: '',
    // Commercials tab
    ceiling_internal: '',
    range_vendors_see_min: '',
    range_vendors_see_max: '',
    rate_card_cap: '',
    total_engagement_value: '',
    cost_centre: '',
    budget_approved: false,
    budget_reference: '',
    variance_approved: false,
    // Work setup tab
    work_mode: '',
    work_locations: [],
    working_hours: '',
    location_remote_policy: '',
    onsite_requirement: '',
    equipment_provisioning: '',
    // Compliance tab
    background_check: '',
    background_check_required: false,
    nda_contract_type: '',
    work_authorization: '',
    client_site_access: false,
    security_clearance_required: false,
    security_clearance_notes: '',
    // Process tab
    hiring_manager: user?.name || '',
    submission_deadline: '',
    priority: 'Normal',
  });

  const [expandedSections, setExpandedSections] = useState({
    role: true,
    engagement: true,
    commercials: true,
    workSetup: true,
    compliance: true,
    process: true,
  });

  const loadProfiles = () => {
    setLoading(true);
    request('/company-profiles', { token })
      .then((profiles) => {
        const own = (profiles || []).filter((p) => p.tenant_id === user.tenant_id);
        const list = own.length ? own : profiles || [];
        setCompanyProfileId((prev) => prev || (list[0]?.id || ''));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadProfiles, [token, user.tenant_id]);

  // Load requisitions with structured roles + director-uploaded templates for import
  const loadTemplates = async () => {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const [reqs, tpls] = await Promise.all([
        request('/requisitions', { token }),
        request('/templates', { token }),
      ]);
      const completed = (reqs || [])
        .filter((r) => r.structured_role && r.status !== 'Draft')
        .map((r) => ({ ...r, source: 'requisition' }));
      const roleTpls = (tpls || []).map((t) => ({
        ...t,
        source: 'template',
        status: 'Template',
        company_name: 'Director template',
      }));
      setTemplates([...roleTpls, ...completed]);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (token) loadTemplates();
  }, [token]);

  const autoCalculatedEnds = useRef(false);

  // Auto-set Start Date to today and compute Ends On from the duration.
  useEffect(() => {
    if (!prefill.duration) return;
    const start = prefill.start_date || toISODate(new Date());
    const end = addDuration(prefill.duration, start);
    setPrefill((prev) => {
      const updates = {};
      if (!prev.start_date) updates.start_date = start;
      if (end && (!prev.ends_on || autoCalculatedEnds.current)) {
        updates.ends_on = end;
        autoCalculatedEnds.current = true;
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [prefill.duration, prefill.start_date]);

  const handleEndsOnChange = (v) => {
    autoCalculatedEnds.current = false;
    handlePrefillChange('engagement', 'ends_on', v);
  };

  const handleImportTemplate = (templateId) => {
    if (!templateId) return;
    const item = templates.find((t) => t.id === templateId);
    if (!item || !item.structured_role) {
      setError('Template not found');
      return;
    }
    const role = item.structured_role;
        const range = Array.isArray(role.range_vendors_see) ? role.range_vendors_see : [role.range_vendors_see_min, role.range_vendors_see_max];
        setPrefill((prev) => ({
          ...prev,
          // Role tab
          job_title: role.title || '',
          job_family: role.job_family || '',
          must_have_skills: role.must_have_skills || [],
          nice_to_have_skills: role.nice_to_have_skills || [],
          seniority: role.seniority || '',
          experience: role.experience || '',
          headcount: role.headcount || 1,
          certifications: role.certifications || [],
          // Engagement
          engagement_type: role.engagement_type || 'Contract',
          duration: role.duration || '',
          start_date: role.start_date || '',
          ends_on: role.ends_on || '',
          extension_likely: role.extension_likely || false,
          max_notice_period: role.max_notice_period || '',
          // Commercials
          ceiling_internal: role.ceiling_internal ?? '',
          range_vendors_see_min: range[0] ?? '',
          range_vendors_see_max: range[1] ?? '',
          rate_card_cap: role.rate_card_cap ?? '',
          total_engagement_value: role.total_engagement_value || '',
          cost_centre: role.cost_centre || '',
          budget_approved: role.budget_approved || false,
          budget_reference: role.budget_reference || '',
          variance_approved: role.variance_approved || false,
          // Work setup
          work_mode: role.work_mode || '',
          work_locations: role.work_locations || [],
          working_hours: role.working_hours || '',
          location_remote_policy: role.location_remote_policy || '',
          onsite_requirement: role.onsite_requirement || '',
          equipment_provisioning: role.equipment_provisioning || '',
          // Compliance
          background_check: role.background_check || '',
          background_check_required: role.background_check_required || false,
          nda_contract_type: role.nda_contract_type || '',
          work_authorization: role.work_authorization || '',
          client_site_access: role.client_site_access || false,
          security_clearance_required: role.security_clearance_required || false,
          security_clearance_notes: role.security_clearance_notes || '',
          // Process
          hiring_manager: role.hiring_manager || prev.hiring_manager,
          submission_deadline: role.submission_deadline || '',
          priority: role.priority || 'Normal',
        }));
        setSelectedTemplateId('');
  };

  const roleTitle = prefill.job_title.trim();
  const canSubmit = Boolean(companyProfileId) && roleTitle.length > 0;

  const handlePrefillChange = (section, field, value) => {
    setPrefill((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleChipRemove = (field, index) => {
    setPrefill((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyProfileId) {
      setError('No company profile available. Please register a company workspace first.');
      return;
    }
    setSubmitting(true);
    try {
      const prefillData = { ...prefill };
      // Convert chip arrays from state
      const body = {
        company_profile_id: companyProfileId,
        title: roleTitle,
        tech_stack_hint: [...prefill.must_have_skills, ...prefill.nice_to_have_skills].filter(Boolean),
        intake_mode: 'guided',
        source_filename: '',
        prompt: '',
        created_by: user.id,
        prefill: prefillData,
        // Pass all prefill fields in intake_meta for the agent to use
        intake_meta: {
          intake_mode: 'guided',
          company_profile_id: companyProfileId,
          source_filename: '',
          // Pre-filled structured role fields
          prefill: prefillData,
        },
      };
      const req = await request('/requisitions', { method: 'POST', body, token });
      try {
        await request(`/requisitions/${req.id}/start`, { method: 'POST', token });
      } catch {
        // Draft-state fallback: the detail page offers "Run Agent" to retry.
      }
      navigate(`/dashboard/requisitions/${req.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const ToggleSection = (section) => () => setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">{roleTitle || 'New contract requirement'}</h1>
          <p className="page-subtitle">Draft saved just now · Review the role details before sending to HR.</p>
        </div>
        <div className="requisition-header-actions">
          <button type="button" className="ghost-btn">Save draft</button>
          <Link to="/dashboard/requisitions/drafted" className="ghost-btn-link">Back to list</Link>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading company profile...</p>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel form-card">
          {error && <div className="alert alert-error" style={{ margin: '20px 32px 0' }}>{error}</div>}

          <nav className="requisition-step-nav" aria-label="Requisition sections">
            {['Role', 'Engagement', 'Commercials', 'Work setup', 'Compliance', 'Process'].map((step, i) => (
              <span key={step} className={`requisition-step ${i === 0 ? 'active' : ''}`}>{step}</span>
            ))}
          </nav>

          {/* A. How should the AI draft this JD? */}
          <section className="intake-section">
            <div className="intake-section-head">
              <h2 className="intake-section-title">How should the AI draft this JD?</h2>
              <span className="intake-section-caption">Guided intake</span>
            </div>
            <p className="intake-mode-note">
              The agent will ask you a few targeted questions to fill any gaps, using your role brief and the company background from onboarding.
            </p>

            {/* Template Import Dropdown */}
            {templates.length > 0 && (
              <div className="intake-section" style={{ marginTop: 24 }}>
                <div className="intake-section-head">
                  <h2 className="intake-section-title">Import from Template</h2>
                  <span className="intake-section-caption">Select an existing requisition to pre-fill all fields as a starting point.</span>
                </div>
                <div className="template-selector" style={{ marginTop: 12 }}>
                  <label className="form-label">Select Template</label>
                  <select
                    className="auth-input"
                    value={selectedTemplateId}
                    onChange={(e) => handleImportTemplate(e.target.value)}
                    disabled={loadingTemplates}
                  >
                    <option value="">— Choose a requisition to import —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.title || 'Untitled'} — {t.company_name || 'Unknown'} ({t.status})
                      </option>
                    ))}
                  </select>
                  {loadingTemplates && <span className="field-hint">Loading templates...</span>}
                </div>
              </div>
            )}
          </section>

          {/* D. Pre-fill Structured Role Fields (Optional) */}
          <section className="intake-section">
            <div className="intake-section-head">
              <h2 className="intake-section-title">Role definition</h2>
              <span className="intake-section-caption">Fill any known fields now — the AI will ask only about gaps.</span>
            </div>

            <Section title="Role" expanded={expandedSections.role} onToggle={ToggleSection('role')}>
              <Field label="Job Title" hint="e.g. Senior Backend Engineer">
                <TextInput value={prefill.job_title} onChange={(v) => handlePrefillChange('role', 'job_title', v)} placeholder="Senior Backend Engineer" required />
              </Field>
              <Field label="Job Family" hint="e.g. Engineering / Platform">
                <TextInput value={prefill.job_family} onChange={(v) => handlePrefillChange('role', 'job_family', v)} placeholder="Engineering / Platform" />
              </Field>
              <Field label="Must-have Skills">
                <ChipInput
                  value={prefill.must_have_skills}
                  onChange={(v) => handlePrefillChange('role', 'must_have_skills', v)}
                  onRemove={(i) => handleChipRemove('must_have_skills', i)}
                  placeholder="+ add skill"
                />
              </Field>
              <Field label="Nice-to-have Skills">
                <ChipInput
                  value={prefill.nice_to_have_skills}
                  onChange={(v) => handlePrefillChange('role', 'nice_to_have_skills', v)}
                  onRemove={(i) => handleChipRemove('nice_to_have_skills', i)}
                  placeholder="+ add skill"
                />
              </Field>
              <div className="editor-row-3" style={{ marginTop: 18 }}>
                <Field label="Seniority Level">
                  <SelectInput value={prefill.seniority} onChange={(v) => handlePrefillChange('role', 'seniority', v)} options={SENIORITY_OPTIONS} placeholder="Select level…" />
                </Field>
                <Field label="Experience" hint="e.g. 5–8 years">
                  <TextInput value={prefill.experience} onChange={(v) => handlePrefillChange('role', 'experience', v)} placeholder="5–8 years" />
                </Field>
                <Field label="Headcount">
                  <TextInput type="number" min="1" value={prefill.headcount} onChange={(v) => handlePrefillChange('role', 'headcount', v === '' ? 1 : Number(v))} placeholder="1" />
                </Field>
              </div>
              <Field label="Certifications">
                <ChipInput
                  value={prefill.certifications}
                  onChange={(v) => handlePrefillChange('role', 'certifications', v)}
                  onRemove={(i) => handleChipRemove('certifications', i)}
                  placeholder="+ add certification"
                />
              </Field>
            </Section>

            <Section title="Engagement" expanded={expandedSections.engagement} onToggle={ToggleSection('engagement')}>
              <div className="editor-row-3">
                <Field label="Engagement Type">
                  <SelectInput value={prefill.engagement_type} onChange={(v) => handlePrefillChange('engagement', 'engagement_type', v)} options={ENGAGEMENT_TYPES} placeholder="Select…" />
                </Field>
                <Field label="Duration" hint="e.g. 6 months">
                  <TextInput value={prefill.duration} onChange={(v) => handlePrefillChange('engagement', 'duration', v)} placeholder="6 months" />
                </Field>
                <Field label="Start Date">
                  <TextInput type="date" value={prefill.start_date} onChange={(v) => handlePrefillChange('engagement', 'start_date', v)} />
                </Field>
              </div>
              <div className="editor-row-3" style={{ marginTop: 18 }}>
                <Field label="Ends On" hint="Auto-calculated from start + duration when left blank">
                  <TextInput type="date" value={prefill.ends_on} onChange={handleEndsOnChange} />
                </Field>
                <Field label="Extension Likely">
                  <SelectInput value={prefill.extension_likely ? 'Yes' : 'No'} onChange={(v) => handlePrefillChange('engagement', 'extension_likely', v === 'Yes')} options={BOOL_OPTIONS} placeholder="No" />
                </Field>
                <Field label="Max Notice Period" hint="e.g. 30 days">
                  <TextInput value={prefill.max_notice_period} onChange={(v) => handlePrefillChange('engagement', 'max_notice_period', v)} placeholder="30 days" />
                </Field>
              </div>
            </Section>

            <Section title="Commercials" expanded={expandedSections.commercials} onToggle={ToggleSection('commercials')}>
              <div className="editor-row" style={{ gap: 16 }}>
                <Field label="Your Ceiling — Internal" hint="Only visible to internal HR; vendors see the range below (INR p.a.)">
                  <TextInput type="number" min="0" value={prefill.ceiling_internal} onChange={(v) => handlePrefillChange('commercials', 'ceiling_internal', v === '' ? '' : Number(v))} placeholder="INR p.a." />
                </Field>
                <Field label="Range Vendors Will See" hint="Min–Max INR p.a.">
                  <RangeInput
                    minVal={prefill.range_vendors_see_min}
                    maxVal={prefill.range_vendors_see_max}
                    onMinChange={(v) => handlePrefillChange('commercials', 'range_vendors_see_min', v)}
                    onMaxChange={(v) => handlePrefillChange('commercials', 'range_vendors_see_max', v)}
                    placeholder="INR p.a."
                  />
                </Field>
              </div>
              <div className="editor-row-3" style={{ marginTop: 18 }}>
                <Field label="Rate Card Cap" hint="Agreed rate-card cap for variance checks (INR p.a.)">
                  <TextInput type="number" min="0" value={prefill.rate_card_cap} onChange={(v) => handlePrefillChange('commercials', 'rate_card_cap', v === '' ? '' : Number(v))} placeholder="INR p.a." />
                </Field>
                <Field label="Total Engagement Value" hint="Auto-calculated from headcount × rate × duration — editable override">
                  <TextInput value={prefill.total_engagement_value} onChange={(v) => handlePrefillChange('commercials', 'total_engagement_value', v)} placeholder="e.g. ₹36,00,000" />
                </Field>
                <Field label="Cost Centre" hint="e.g. ENG-4102">
                  <TextInput value={prefill.cost_centre} onChange={(v) => handlePrefillChange('commercials', 'cost_centre', v)} placeholder="ENG-4102" />
                </Field>
              </div>
              <div className="editor-row-3" style={{ marginTop: 18 }}>
                <Field label="Budget Approved">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <SelectInput value={prefill.budget_approved ? 'Yes' : 'No'} onChange={(v) => handlePrefillChange('commercials', 'budget_approved', v === 'Yes')} options={BOOL_OPTIONS} placeholder="No" style={{ width: '80px' }} />
                    <TextInput value={prefill.budget_reference} onChange={(v) => handlePrefillChange('commercials', 'budget_reference', v)} placeholder="PO / reference…" disabled={!prefill.budget_approved} />
                  </div>
                </Field>
                <Field label="HR Approved Variance">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={prefill.variance_approved} onChange={(e) => handlePrefillChange('commercials', 'variance_approved', e.target.checked)} />
                    <span>HR approved the rate-card variance</span>
                  </label>
                </Field>
              </div>
            </Section>

            <Section title="Work Setup" expanded={expandedSections.workSetup} onToggle={ToggleSection('workSetup')}>
              <div className="editor-row-3">
                <Field label="Work Mode">
                  <SelectInput value={prefill.work_mode} onChange={(v) => handlePrefillChange('workSetup', 'work_mode', v)} options={WORK_MODES} placeholder="Select…" />
                </Field>
                <Field label="Location(s)">
                  <ChipInput
                    value={prefill.work_locations}
                    onChange={(v) => handlePrefillChange('workSetup', 'work_locations', v)}
                    onRemove={(i) => handleChipRemove('work_locations', i)}
                    placeholder="+ add city / region"
                  />
                </Field>
                <Field label="Equipment Provisioning">
                  <SelectInput value={prefill.equipment_provisioning} onChange={(v) => handlePrefillChange('workSetup', 'equipment_provisioning', v)} options={EQUIPMENT_OPTIONS} placeholder="Select…" />
                </Field>
              </div>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Working Hours / Shift" hint="e.g. IST business hours (9:30 – 18:30)">
                  <TextInput value={prefill.working_hours} onChange={(v) => handlePrefillChange('workSetup', 'working_hours', v)} placeholder="IST business hours (9:30 – 18:30)" />
                </Field>
              </div>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Location Remote Policy">
                  <TextInput value={prefill.location_remote_policy} onChange={(v) => handlePrefillChange('workSetup', 'location_remote_policy', v)} placeholder="e.g. Remote-first, onsite quarterly" />
                </Field>
              </div>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Onsite Requirement">
                  <TextInput value={prefill.onsite_requirement} onChange={(v) => handlePrefillChange('workSetup', 'onsite_requirement', v)} placeholder="e.g. 2 days/week in Bangalore office" />
                </Field>
              </div>
            </Section>

            <Section title="Compliance" expanded={expandedSections.compliance} onToggle={ToggleSection('compliance')}>
              <div className="editor-row-3">
                <Field label="Background Check Required">
                  <SelectInput value={prefill.background_check_required ? 'Yes' : 'No'} onChange={(v) => handlePrefillChange('compliance', 'background_check_required', v === 'Yes')} options={BOOL_OPTIONS} placeholder="No" />
                </Field>
                <Field label="Contract Type">
                  <SelectInput value={prefill.nda_contract_type} onChange={(v) => handlePrefillChange('compliance', 'nda_contract_type', v)} options={CONTRACT_OPTIONS} placeholder="Select…" />
                </Field>
                <Field label="Client Site Access">
                  <SelectInput value={prefill.client_site_access ? 'Yes' : 'No'} onChange={(v) => handlePrefillChange('compliance', 'client_site_access', v === 'Yes')} options={BOOL_OPTIONS} placeholder="No" />
                </Field>
              </div>
              <div className="editor-row-3" style={{ marginTop: 18 }}>
                <Field label="Data / Security Clearance Required">
                  <SelectInput value={prefill.security_clearance_required ? 'Yes' : 'No'} onChange={(v) => handlePrefillChange('compliance', 'security_clearance_required', v === 'Yes')} options={BOOL_OPTIONS} placeholder="No" />
                </Field>
              </div>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Background Check Details" hint="e.g. Standard police + education verification">
                  <TextInput value={prefill.background_check} onChange={(v) => handlePrefillChange('compliance', 'background_check', v)} placeholder="Standard police + education verification" />
                </Field>
              </div>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Work Authorization" hint="Visa / authorization constraints">
                  <TextInput value={prefill.work_authorization} onChange={(v) => handlePrefillChange('compliance', 'work_authorization', v)} placeholder="Indian citizen / work visa required" />
                </Field>
              </div>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Security Clearance Notes" hint="Applies when clearance is required">
                  <TextInput value={prefill.security_clearance_notes} onChange={(v) => handlePrefillChange('compliance', 'security_clearance_notes', v)} placeholder="Govt client — background + screening" />
                </Field>
              </div>
            </Section>

            <Section title="Process" expanded={expandedSections.process} onToggle={ToggleSection('process')}>
              <div className="editor-row-3">
                <Field label="Hiring Manager" hint="e.g. Arjun Mehta">
                  <TextInput value={prefill.hiring_manager} onChange={(v) => handlePrefillChange('process', 'hiring_manager', v)} placeholder="Arjun Mehta" />
                </Field>
                <Field label="Submission Deadline">
                  <TextInput type="date" value={prefill.submission_deadline} onChange={(v) => handlePrefillChange('process', 'submission_deadline', v)} />
                </Field>
                <Field label="Priority">
                  <SelectInput value={prefill.priority} onChange={(v) => handlePrefillChange('process', 'priority', v)} options={PRIORITY_OPTIONS} placeholder="Normal" />
                </Field>
              </div>
            </Section>
          </section>

          {/* E. Submit */}
          <div className="intake-footer">
            <p className="intake-footer-note">
              Nothing auto-publishes — the draft lands in a review editor where you check every field first.
            </p>
            <button type="submit" className="glow-btn" disabled={submitting || !canSubmit}>
              {submitting ? 'Creating...' : 'Create & Start Agent'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
