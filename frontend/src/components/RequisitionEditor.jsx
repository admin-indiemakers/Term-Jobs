import { useState } from 'react';

const TABS = ['Role', 'Engagement', 'Commercials', 'Work setup', 'Compliance', 'Process'];
const ENGAGEMENT_TYPES = ['Contract'];
const WORK_MODES = ['Remote', 'Hybrid', 'Onsite'];
const EQUIPMENT_OPTIONS = ['Company-provided', 'Vendor-provided', 'BYOD'];
const CONTRACT_OPTIONS = ['Consultancy agreement', 'NDA-only', 'MSA-linked', 'Permanent offer'];
const PRIORITY_OPTIONS = ['High', 'Normal', 'Low'];
const BOOL_OPTIONS = ['Yes', 'No'];

function computeEndsOn(startDate, duration) {
  if (!startDate || !duration) return '';
  const months = { week: 1 / 4.345, weeks: 1 / 4.345, month: 1, months: 1, year: 12, years: 12 };
  const m = duration.toLowerCase().match(/(\d+)\s*(week|weeks|month|months|year|years)/);
  if (!m) return '';
  const addMonths = Number(m[1]) * months[m[2]];
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + Math.round(addMonths));
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

function computeEngagementValue(role) {
  if (!role) return '';
  const headcount = Number(role.headcount) || 1;
  const maxRate = role.range_vendors_see && role.range_vendors_see[1] != null ? Number(role.range_vendors_see[1]) : Number(role.ceiling_internal);
  if (!maxRate) return '';
  const months = role.duration ? (role.duration.toLowerCase().match(/(\d+)\s*(month|months|year|years)/) || []) : [];
  const total = months.length
    ? headcount * maxRate * (Number(months[1]) * (months[2].startsWith('year') ? 12 : 1)) / 12
    : headcount * maxRate;
  return `₹${Math.round(total).toLocaleString('en-IN')}`;
}

function fmtLpa(n) {
  if (n == null || n === '') return 'Not set';
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 'Not set';
  const lakhs = num >= 100000 ? num / 100000 : num >= 100 ? num / 100 : num;
  return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L p.a.`;
}

function Field({ label, hint, children }) {
  return (
    <div className="editor-field">
      <label className="editor-label">{label}</label>
      {children}
      {hint && <p className="editor-hint">{hint}</p>}
    </div>
  );
}

function TextField({ value, editable, onChange, placeholder, type, min, className }) {
  if (!editable) {
    return value ? <p className="editor-value">{value}</p> : <p className="editor-value editor-value-muted">Not set</p>;
  }
  return (
    <input
      className={`auth-input ${className || ''}`}
      type={type || 'text'}
      min={min}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function SelectField({ value, options, editable, onChange, placeholder }) {
  if (!editable) {
    return value ? <p className="editor-value">{value}</p> : <p className="editor-value editor-value-muted">{placeholder || 'Not set'}</p>;
  }
  return (
    <select className="auth-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || 'Select…'}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function RangeField({ value, editable, onChange, placeholder }) {
  const min = value && value[0] != null ? value[0] : '';
  const max = value && value[1] != null ? value[1] : '';
  if (!editable) {
    const text = value && min !== '' && max !== ''
      ? `${fmtLpa(min)} – ${fmtLpa(max)}`
      : value && min !== ''
        ? `${fmtLpa(min)} – open`
        : 'Not set';
    return <p className={`editor-value${!value ? ' editor-value-muted' : ''}`}>{text}</p>;
  }
  return (
    <div className="rate-band-input">
      <input
        className="auth-input"
        type="number"
        min="0"
        placeholder={placeholder ? `${placeholder} min` : 'Min (INR p.a.)'}
        value={min}
        onChange={(e) => {
          const m = e.target.value === '' ? null : Number(e.target.value);
          onChange([m, value && value[1] != null ? value[1] : null]);
        }}
      />
      <input
        className="auth-input"
        type="number"
        min="0"
        placeholder={placeholder ? `${placeholder} max` : 'Max (INR p.a.)'}
        value={max}
        onChange={(e) => {
          const mx = e.target.value === '' ? null : Number(e.target.value);
          onChange([value && value[0] != null ? value[0] : null, mx]);
        }}
      />
    </div>
  );
}

function ChipInput({ value, editable, onChange, placeholder }) {
  const [text, setText] = useState('');

  if (!editable) {
    return value && value.length ? (
      <div className="chips">
        {value.map((s, i) => (
          <span key={i} className="chip chip-tag">{s}</span>
        ))}
      </div>
    ) : (
      <p className="editor-value editor-value-muted">None</p>
    );
  }

  const list = value || [];
  const add = () => {
    const v = text.trim();
    if (v) {
      onChange([...list, v]);
      setText('');
    }
  };

  return (
    <div className="chips-input-row">
      {list.map((s, i) => (
        <span key={i} className="chip-tag">
          {s}
          <button
            type="button"
            className="chip-tag-remove"
            aria-label={`Remove ${s}`}
            onClick={() => onChange(list.filter((_, idx) => idx !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="chip-adder"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder || '+ add'}
      />
    </div>
  );
}

function VarianceWarning({ role }) {
  const ceiling = role.ceiling_internal;
  const cap = role.rate_card_cap;
  if (!ceiling || !cap || Number(ceiling) <= Number(cap)) return null;
  if (role.variance_approved) {
    return (
      <div className="variance-approved">
        <span className="source-banner-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <p className="variance-warning-text">
          <strong>Rate-card variance approved</strong> — ceiling {fmtLpa(ceiling)} above cap {fmtLpa(cap)}. HR sign-off recorded.
        </p>
      </div>
    );
  }
  return (
    <div className="variance-warning">
      <span className="variance-warning-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </span>
      <p className="variance-warning-text">
        <strong>Your ceiling is above the agreed rate card</strong> for {role.title || 'this role'}, {role.seniority || 'this level'}, {role.location || 'your location'}, which caps at {fmtLpa(cap)}. HR will need to approve the variance.
      </p>
    </div>
  );
}

function BudgetApproved({ value, editable, onChange, reference, onReference }) {
  if (editable) {
    return (
      <div className="editor-row" style={{ gap: 8 }}>
        <select
          className="auth-input"
          value={value ? 'Yes' : 'No'}
          onChange={(e) => onChange(e.target.value === 'Yes')}
          style={{ flex: '0 0 auto' }}
        >
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
        <input
          className="auth-input"
          type="text"
          value={reference || ''}
          onChange={(e) => onReference(e.target.value)}
          placeholder="PO / reference…"
          disabled={!value}
        />
      </div>
    );
  }
  return value ? (
    <span className="editor-value-row">
      <span className="check-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="editor-value">{reference ? `Yes · ${reference}` : 'Yes'}</span>
    </span>
  ) : (
    <p className="editor-value editor-value-muted">Pending</p>
  );
}

export default function RequisitionEditor({ role, editable = false, onChange, sourceLabel, onReplace }) {
  const [active, setActive] = useState(TABS[0]);
  if (!role) return null;

  const set = (patch) => onChange({ ...role, ...patch });

  const lockIcon = (
    <span className="lock-badge" title="Restricted — visible only to internal HR">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </span>
  );

  const renderTab = () => {
    switch (active) {
      case 'Role':
        return (
          <>
            <section className="editor-section">
              <h3 className="editor-section-title">Role definition</h3>
              <div className="editor-row">
                <Field label="Job title" required>
                  <TextField value={role.title} editable={editable} onChange={(v) => set({ title: v })} placeholder="e.g. Senior Backend Engineer" />
                </Field>
                <Field label="Job family" required>
                  <TextField value={role.job_family} editable={editable} onChange={(v) => set({ job_family: v })} placeholder="e.g. Engineering / Platform" />
                </Field>
              </div>
            </section>

            <section className="editor-section">
              <h3 className="editor-section-title">Skills & scope</h3>
              <Field label="Must-have skills" required>
                <ChipInput value={role.must_have_skills} editable={editable} onChange={(v) => set({ must_have_skills: v })} placeholder="+ add" />
              </Field>
              <div style={{ height: 16 }} />
              <Field label="Experience" hint="e.g. 5–8 years" required>
                <TextField value={role.experience} editable={editable} onChange={(v) => set({ experience: v })} placeholder="5–8 years" />
              </Field>
              <div style={{ height: 16 }} />
              <Field label="Certifications" required>
                <ChipInput value={role.certifications} editable={editable} onChange={(v) => set({ certifications: v })} placeholder="+ add" />
              </Field>
              <div className="editor-row" style={{ marginTop: 18 }}>
                <Field label="Headcount" required>
                  <TextField type="number" min="1" value={role.headcount} editable={editable} onChange={(v) => set({ headcount: v === '' ? 1 : Number(v) })} placeholder="1" />
                </Field>
              </div>
            </section>
          </>
        );

      case 'Engagement':
        return (
          <section className="editor-section">
            <h3 className="editor-section-title">Engagement terms</h3>
            <div className="editor-row-3">
              <Field label="Engagement type" required>
                <SelectField value={role.engagement_type} options={ENGAGEMENT_TYPES} editable={editable} onChange={(v) => set({ engagement_type: v })} placeholder="Select…" />
              </Field>
              <Field label="Duration" hint="e.g. 6 months" required>
                <TextField
                  value={role.duration}
                  editable={editable}
                  onChange={(v) => {
                    const patch = { duration: v };
                    if (v && role.start_date && !role.ends_on) patch.ends_on = computeEndsOn(role.start_date, v);
                    set(patch);
                  }}
                  placeholder="e.g. 6 months"
                />
              </Field>
              <Field label="Start date" required>
                <TextField
                  type="date"
                  value={role.start_date}
                  editable={editable}
                  onChange={(v) => {
                    const patch = { start_date: v };
                    if (v && !role.ends_on) patch.ends_on = computeEndsOn(v, role.duration);
                    set(patch);
                  }}
                />
              </Field>
            </div>
            <div className="editor-row-3" style={{ marginTop: 18 }}>
              <Field label="Ends on" hint={editable && !role.ends_on ? 'Auto-calculated from start + duration when left blank.' : undefined} required>
                <TextField type="date" value={role.ends_on} editable={editable} onChange={(v) => set({ ends_on: v })} />
              </Field>
              <Field label="Extension likely" required>
                <SelectField value={role.extension_likely ? 'Yes' : 'No'} options={BOOL_OPTIONS} editable={editable} onChange={(v) => set({ extension_likely: v === 'Yes' })} placeholder="No" />
              </Field>
              <Field label="Max notice period" hint="e.g. 30 days" required>
                <TextField value={role.max_notice_period} editable={editable} onChange={(v) => set({ max_notice_period: v })} placeholder="e.g. 30 days" />
              </Field>
            </div>
          </section>
        );

      case 'Commercials':
        return (
          <>
            <section className="editor-section">
              <h3 className="editor-section-title">Commercials</h3>
              <div className="editor-row">
                <Field label="Your ceiling — internal" hint="Only visible to internal HR; vendors see the range below." required>
                  <div className="editor-ceiling">
                    <TextField type="number" min="0" value={role.ceiling_internal ?? role.internal_ceiling} editable={editable} onChange={(v) => set({ ceiling_internal: v === '' ? null : Number(v) })} placeholder="INR p.a." />
                    {lockIcon}
                  </div>
                </Field>
                <Field label="Range vendors will see" hint="Min–Max INR p.a." required>
                  <RangeField value={role.range_vendors_see} editable={editable} onChange={(v) => set({ range_vendors_see: v })} placeholder="INR p.a." />
                </Field>
              </div>
              <VarianceWarning role={role} />
              <div className="editor-row-3" style={{ marginTop: 18 }}>
                <Field label="Total engagement value" hint={editable ? 'Auto-calculated from headcount × rate × duration — editable override.' : undefined} required>
                  <TextField value={role.total_engagement_value} editable={editable} onChange={(v) => set({ total_engagement_value: v })} placeholder={computeEngagementValue(role) || 'e.g. ₹36,00,000'} />
                </Field>
                <Field label="Cost centre" hint="e.g. ENG-4102" required>
                  <TextField value={role.cost_centre} editable={editable} onChange={(v) => set({ cost_centre: v })} placeholder="ENG-4102" />
                </Field>
                <Field label="Budget approved" required>
                  <BudgetApproved value={role.budget_approved} editable={editable} onChange={(v) => set({ budget_approved: v })} reference={role.budget_reference} onReference={(v) => set({ budget_reference: v })} />
                </Field>
              </div>
            </section>
          </>
        );

case 'Work setup':
        return (
          <section className="editor-section">
            <h3 className="editor-section-title">Work setup</h3>
            <div className="editor-row-3">
              <Field label="Work mode" required>
                <SelectField value={role.work_mode} options={WORK_MODES} editable={editable} onChange={(v) => set({ work_mode: v })} placeholder="Select…" />
              </Field>
              <Field label="Location(s)" required>
                <ChipInput value={role.work_locations} editable={editable} onChange={(v) => set({ work_locations: v })} placeholder="+ add city / region" />
              </Field>
              <Field label="Equipment provisioning" required>
                <SelectField value={role.equipment_provisioning} options={EQUIPMENT_OPTIONS} editable={editable} onChange={(v) => set({ equipment_provisioning: v })} placeholder="Select…" />
              </Field>
            </div>
            <div className="editor-row" style={{ marginTop: 18 }}>
              <Field label="Working hours / shift" hint="e.g. IST business hours (9:30 – 18:30)" required>
                <TextField value={role.working_hours} editable={editable} onChange={(v) => set({ working_hours: v })} placeholder="IST business hours (9:30 – 18:30)" />
              </Field>
            </div>
          </section>
        );

      case 'Compliance':
        return (
          <section className="editor-section">
            <h3 className="editor-section-title">Compliance</h3>
            <div className="editor-row-3">
              <Field label="Background check required" required>
                <SelectField value={role.background_check_required ? 'Yes' : 'No'} options={BOOL_OPTIONS} editable={editable} onChange={(v) => set({ background_check_required: v === 'Yes' })} placeholder="No" />
              </Field>
              <Field label="Contract type" required>
                <SelectField value={role.nda_contract_type} options={CONTRACT_OPTIONS} editable={editable} onChange={(v) => set({ nda_contract_type: v })} placeholder="Select…" />
              </Field>
              <Field label="Work authorization notes" hint="Visa / authorization constraints" required>
                <TextField value={role.work_authorization} editable={editable} onChange={(v) => set({ work_authorization: v })} placeholder="e.g. Indian citizen / work visa required" />
              </Field>
            </div>
            <div className="editor-row" style={{ marginTop: 18 }}>
              <Field label="Client-site access needed" hint="Whether the role requires on-site access at client premises" required>
                <SelectField value={role.client_site_access ? 'Yes' : 'No'} options={BOOL_OPTIONS} editable={editable} onChange={(v) => set({ client_site_access: v === 'Yes' })} placeholder="No" />
              </Field>
            </div>
          </section>
        );

      case 'Process':
        return (
          <section className="editor-section">
            <h3 className="editor-section-title">Process</h3>
            <div className="editor-row-3">
              <Field label="Hiring manager" hint="e.g. Arjun Mehta" required>
                <TextField value={role.hiring_manager} editable={editable} onChange={(v) => set({ hiring_manager: v })} placeholder="Arjun Mehta" />
              </Field>
              <Field label="Submission deadline" required>
                <TextField type="date" value={role.submission_deadline} editable={editable} onChange={(v) => set({ submission_deadline: v })} />
              </Field>
              <Field label="Priority" required>
                {editable ? (
                  <SelectField value={role.priority} options={PRIORITY_OPTIONS} editable placeholder="Normal" onChange={(v) => set({ priority: v })} />
                ) : (
                  <p className={`editor-value ${role.priority === 'High' ? '' : 'editor-value-muted'}`} style={role.priority === 'High' ? { fontWeight: 700, color: '#0a0a0a' } : undefined}>
                    {role.priority || 'Normal'}
                  </p>
                )}
              </Field>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {sourceLabel && (
        <div className="source-banner">
          <span className="source-banner-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="source-banner-text">
            <strong>Company Background</strong> — Title, skills, experience and location prefilled below. Check them.
          </p>
          {editable && onReplace && (
            <button type="button" className="source-banner-replace" onClick={onReplace}>Replace</button>
          )}
        </div>
      )}

      {/* Fixed Sticky Sub-Tabs Header (Never Scrolls) */}
      <div className="editor-tabs" role="tablist" style={{ marginBottom: '16px', paddingBottom: '14px' }}>
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={active === t}
            type="button"
            className={`editor-tab ${active === t ? 'active' : ''}`}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* In-built Scrollable Body for Fields */}
      <div
        className="editor-tab-body overflow-y-auto pr-1.5 custom-scrollbar"
        style={{ maxHeight: '380px' }}
      >
        {renderTab()}
      </div>
    </div>
  );
}