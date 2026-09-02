const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'];

function rateBandText(rateBand) {
  if (!rateBand || !Array.isArray(rateBand) || rateBand.length < 2) return 'Not specified';
  const format = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return '—';
    const lakhs = num >= 100000 ? num / 100000 : num >= 100 ? num / 100 : num;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L`;
  };
  const left = format(rateBand[0]);
  const right = format(rateBand[1]);
  if (left === '—' && right === '—') return 'Not specified';
  if (left === '—') return `${right} p.a.`;
  if (right === '—') return `${left} p.a.`;
  if (left === right) return `${left} p.a.`;
  return `${left} – ${right} p.a.`;
}

function RateBandInput({ value, onChange }) {
  const min = value && value[0] != null ? value[0] : '';
  const max = value && value[1] != null ? value[1] : '';
  return (
    <div className="rate-band-input">
      <input
        type="number"
        min="0"
        placeholder="Min (INR p.a.)"
        value={min}
        onChange={(e) => {
          const m = e.target.value === '' ? null : Number(e.target.value);
          onChange([m, value && value[1] != null ? value[1] : null]);
        }}
      />
      <input
        type="number"
        min="0"
        placeholder="Max (INR p.a.)"
        value={max}
        onChange={(e) => {
          const mx = e.target.value === '' ? null : Number(e.target.value);
          onChange([value && value[0] != null ? value[0] : null, mx]);
        }}
      />
    </div>
  );
}

export default function StructuredRoleView({ role, editable, onChange }) {
  if (!role) return null;

  const set = (patch) => onChange({ ...role, ...patch });

  const skillsList = (skills, colorClass, label) => (
    <div className="role-field">
      <div className="role-label">{label}</div>
      {editable ? (
        <input
          className="auth-input"
          value={skills.join(', ')}
          placeholder="Comma-separated"
          onChange={(e) =>
            set({ [skills === role.must_have_skills ? 'must_have_skills' : 'nice_to_have_skills']: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
      ) : (
        <div className="chips">
          {skills.length ? (
            skills.map((s, i) => (
              <span key={i} className={`chip ${colorClass}`}>
                {s}
              </span>
            ))
          ) : (
            <span className="muted">None</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="role-view">
      <div className="role-title-row">
        <div>
          <h3 className="role-title">{editable ? <input className="auth-input" value={role.title} onChange={(e) => set({ title: e.target.value })} style={{ minWidth: '260px', fontWeight: 700 }} /> : role.title}</h3>
          <div className="role-meta">
            <span className="meta-item">{editable ? <select className="auth-input select-sm" value={role.seniority || ''} onChange={(e) => set({ seniority: e.target.value })}>{SENIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select> : role.seniority}</span>
            {role.location && <span className="meta-item">📍 {role.location}</span>}
            <span className="meta-item">Rate: {rateBandText(role.rate_band)}</span>
            {role.contract_duration && <span className="meta-item">Duration: {role.contract_duration}</span>}
          </div>
        </div>
        {role.confidence != null && (
          <div className="confidence-box">
            <span className="confidence-value">{Math.round(role.confidence * 100)}%</span>
            <span className="confidence-label">confidence</span>
          </div>
        )}
      </div>

      <div className="role-grid">
        {skillsList(role.must_have_skills, 'chip-primary', 'Must-have skills')}
        {skillsList(role.nice_to_have_skills, 'chip-neutral', 'Nice-to-have skills')}
      </div>

      {editable && (
        <div className="role-grid">
          <div className="role-field">
            <div className="role-label">Location</div>
            <input className="auth-input" value={role.location || ''} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Bangalore, Remote" />
          </div>
          <div className="role-field">
            <div className="role-label">Contract duration</div>
            <input className="auth-input" value={role.contract_duration || ''} onChange={(e) => set({ contract_duration: e.target.value })} placeholder="e.g. 6 months, Permanent" />
          </div>
        </div>
      )}

      {editable && (
        <div className="role-field">
          <div className="role-label">Rate band (INR per annum)</div>
          <RateBandInput value={role.rate_band} onChange={(v) => set({ rate_band: v })} />
        </div>
      )}

      {role.notes && (
        <div className="role-field">
          <div className="role-label">Notes</div>
          {editable ? (
            <textarea className="auth-input" rows="2" value={role.notes} onChange={(e) => set({ notes: e.target.value })} style={{ resize: 'none', fontFamily: 'inherit' }} />
          ) : (
            <p className="role-notes">{role.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
