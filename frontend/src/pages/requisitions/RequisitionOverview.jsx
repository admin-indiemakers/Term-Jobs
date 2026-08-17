import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import JdPreview from '../../components/JdPreview';
import { Icons } from '../../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusClass(status) {
  return `hm-row-status-${(status || 'Draft').replace(/\s+/g, '').toLowerCase()}`;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const toLakhsNum = (n) => {
  if (n === null || n === undefined || n === '') return null;
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 100000) return num / 100000;
  if (num >= 100) return num / 100;
  return num;
};

const fmtLakhs = (n) => {
  const lakhs = toLakhsNum(n);
  if (lakhs === null) return '—';
  return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L`;
};

const pairText = (pair) => {
  if (!pair || !Array.isArray(pair) || pair.length < 2) return '—';
  const left = fmtLakhs(pair[0]);
  const right = fmtLakhs(pair[1]);
  if (left === '—' && right === '—') return '—';
  if (left === '—') return right;
  if (right === '—') return left;
  if (left === right) return left;
  return `${left} – ${right}`;
};

function Field({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  let display = value;
  if (Array.isArray(value)) display = value.length ? value.join(', ') : null;
  if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
  if (display === null) return null;
  return (
    <div className="hm-detail-item">
      <span className="hm-detail-label">{label}</span>
      <span className="hm-detail-value">{display}</span>
    </div>
  );
}

function RequisitionDetails({ id, initialData, token }) {
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setData((prev) => (prev ? { ...prev, ...initialData, structured_role: { ...prev.structured_role, ...initialData.structured_role } } : initialData));
    }
    request(`/requisitions/${id}`, { token })
      .then((d) => {
        setData((prev) => {
          if (!prev) return d;
          return {
            ...d,
            structured_role: {
              ...(prev.structured_role || {}),
              ...(d.structured_role || {}),
              ceiling_internal: d.structured_role?.ceiling_internal ?? prev.structured_role?.ceiling_internal ?? d.structured_role?.internal_ceiling ?? prev.structured_role?.internal_ceiling,
              rate_card_cap: d.structured_role?.rate_card_cap ?? prev.structured_role?.rate_card_cap ?? d.structured_role?.cap ?? prev.structured_role?.cap,
            },
          };
        });
        setError('');
      })
      .catch((err) => {
        if (!initialData) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) return <p className="muted" style={{ padding: 12 }}>Loading full details…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const role = data.structured_role || {};
  const intake = data.intake_meta || {};

  return (
    <div className="hm-detail-panel">
      <div className="hm-detail-meta">
        <Field label="Status" value={data.status} />
        <Field label="Company" value={data.company?.name} />
        <Field label="Created" value={data.created_at ? formatDate(data.created_at) : null} />
        <Field label="Approved by" value={data.approved_by} />
        <Field label="Approved at" value={data.approved_at ? formatDate(data.approved_at) : null} />
        <Field label="Source file" value={intake.source_filename} />
      </div>

      <h4 className="hm-detail-section-title">Role</h4>
      <div className="hm-detail-grid">
        <Field label="Title" value={role.title} />
        <Field label="Seniority" value={role.seniority} />
        <Field label="Job family" value={role.job_family} />
        <Field label="Headcount" value={role.headcount} />
        <Field label="Experience" value={role.experience} />
        <Field label="Location" value={role.location} />
        <Field label="Must-have skills" value={role.must_have_skills} />
        <Field label="Nice-to-have skills" value={role.nice_to_have_skills} />
        <Field label="Certifications" value={role.certifications} />
        <Field label="Contract duration" value={role.contract_duration} />
      </div>

      <h4 className="hm-detail-section-title">Engagement</h4>
      <div className="hm-detail-grid">
        <Field label="Engagement type" value={role.engagement_type} />
        <Field label="Duration" value={role.duration} />
        <Field label="Start date" value={role.start_date} />
        <Field label="Ends on" value={role.ends_on} />
        <Field label="Extension likely" value={role.extension_likely} />
        <Field label="Max notice period" value={role.max_notice_period} />
      </div>

      <h4 className="hm-detail-section-title">Commercials</h4>
      <div className="hm-detail-grid">
        <Field label="Rate band" value={pairText(role.rate_band || role.range_vendors_see)} />
        <Field label="Ceiling (internal)" value={fmtLakhs(role.ceiling_internal ?? role.internal_ceiling)} />
        <Field label="Range vendors see" value={pairText(role.range_vendors_see || role.rate_band)} />
        <Field label="Rate-card cap" value={fmtLakhs(role.rate_card_cap ?? role.cap)} />
        <Field label="Total engagement value" value={role.total_engagement_value} />
        <Field label="Cost centre" value={role.cost_centre} />
        <Field label="Budget approved" value={role.budget_approved} />
        <Field label="Budget reference" value={role.budget_reference} />
        <Field label="Variance approved" value={role.variance_approved} />
      </div>

      <h4 className="hm-detail-section-title">Work setup</h4>
      <div className="hm-detail-grid">
        <Field label="Work mode" value={role.work_mode} />
        <Field label="Work locations" value={role.work_locations} />
        <Field label="Working hours" value={role.working_hours} />
        <Field label="Location / remote policy" value={role.location_remote_policy} />
        <Field label="Onsite requirement" value={role.onsite_requirement} />
        <Field label="Equipment provisioning" value={role.equipment_provisioning} />
      </div>

      <h4 className="hm-detail-section-title">Compliance</h4>
      <div className="hm-detail-grid">
        <Field label="Background check" value={role.background_check} />
        <Field label="Background check required" value={role.background_check_required} />
        <Field label="NDA / contract type" value={role.nda_contract_type} />
        <Field label="Work authorization" value={role.work_authorization} />
        <Field label="Client site access" value={role.client_site_access} />
        <Field label="Security clearance required" value={role.security_clearance_required} />
        <Field label="Security clearance notes" value={role.security_clearance_notes} />
      </div>

      <h4 className="hm-detail-section-title">Process</h4>
      <div className="hm-detail-grid">
        <Field label="Hiring manager" value={role.hiring_manager} />
        <Field label="Submission deadline" value={role.submission_deadline} />
        <Field label="Priority" value={role.priority} />
      </div>

      {data.intent && (
        <>
          <h4 className="hm-detail-section-title">Intent</h4>
          <div className="hm-detail-grid">
            <Field label="Requested title" value={data.intent?.title} />
            <Field label="Description" value={data.intent?.description} />
            <Field label="Prompt" value={data.intent?.prompt} />
            <Field label="Tech stack hint" value={data.intent?.tech_stack_hint} />
          </div>
        </>
      )}

      {data.intake_answers?.length > 0 && (
        <>
          <h4 className="hm-detail-section-title">Intake answers</h4>
          <ul className="log-list">
            {data.intake_answers.map((a, i) => (
              <li key={i} className="log-item">
                <span className="log-index">{i + 1}.</span>
                {a.question_id}: {a.value}
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="hm-detail-section-title">Generated JD</h4>
      <JdPreview markdown={data.generated_jd_markdown} />

      {data.refinement_log?.length > 0 && (
        <>
          <h4 className="hm-detail-section-title">Refinement history</h4>
          <ul className="log-list">
            {data.refinement_log.map((entry, i) => (
              <li key={i} className="log-item">
                <span className="log-index">{i + 1}.</span>
                {entry.instruction}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const SECTION_META = {
  drafted: {
    statuses: ['Draft', 'Intake', 'Structuring', 'PendingApproval'],
    title: 'Drafted',
    caption: 'Requisitions still in progress — run the agent, answer intake, or approve before publishing.',
    to: '/dashboard/requisitions/drafted',
  },
  published: {
    statuses: ['Published'],
    title: 'Published',
    caption: 'Live requisitions visible to your partner vendors. Cancel to close one and remove it from vendors.',
    to: '/dashboard/requisitions/published',
  },
  completed: {
    statuses: ['Closed'],
    title: 'Completed',
    caption: 'Finished requisitions that have been cancelled or closed.',
    to: '/dashboard/requisitions/completed',
  },
  history: {
    statuses: ['Draft', 'Intake', 'Structuring', 'PendingApproval', 'Published', 'Closed'],
    title: 'Requisition History',
    caption: 'Full audit history of all requisitions and complete field specifications including internal ceiling rates and rate card caps.',
    to: '/dashboard/requisitions/history',
  },
};

export default function RequisitionOverview({ section = 'drafted' }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const meta = SECTION_META[section] || SECTION_META.drafted;

  const load = () => {
    setLoading(true);
    Promise.all([
      request('/requisitions', { token }),
      request('/company-profiles', { token }),
    ])
      .then(([reqs, profiles]) => {
        const profileName = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
        const rows = (reqs || []).map((r) => ({ ...r, company_name: r.company_name || profileName[r.company_profile_id] || '—' }));
        setRequisitions(rows);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  useEffect(() => {
    setExpandedId(null);
  }, [section]);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const data = await request('/requisitions', { token });
      downloadJSON(data, `requisitions-export-${new Date().toISOString().split('T')[0]}.json`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingle = (req) => {
    downloadJSON(req, `requisition-${req.id}-${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleCancel = async (req) => {
    if (!window.confirm(`Cancel "${req.title}"? It will be closed and removed from the vendor portal.`)) return;
    setBusyId(req.id);
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${req.id}/close`, { method: 'POST', token });
      setInfo(`"${req.title}" cancelled — moved to Completed.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (req) => {
    if (!window.confirm(`Delete "${req.title}" permanently? This cannot be undone.`)) return;
    setBusyId(req.id);
    setError('');
    setInfo('');
    try {
      await request(`/requisitions/${req.id}`, { method: 'DELETE', token });
      setInfo(`"${req.title}" deleted.`);
      setExpandedId((prev) => (prev === req.id ? null : prev));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const counts = useMemo(() => ({
    total: requisitions.length,
    drafted: requisitions.filter((r) => SECTION_META.drafted.statuses.includes(r.status)).length,
    published: requisitions.filter((r) => r.status === 'Published').length,
    completed: requisitions.filter((r) => r.status === 'Closed').length,
    history: requisitions.length,
  }), [requisitions]);

  const rows = useMemo(
    () => requisitions
      .filter((r) => meta.statuses.includes(r.status))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [requisitions, meta]
  );

  const firstName = user?.name?.split(' ')[0] || 'there';

  const Row = ({ r }) => {
    const sr = r.structured_role || {};
    const ceilingVal = fmtLakhs(sr.ceiling_internal);
    const capVal = fmtLakhs(sr.rate_card_cap);
    return (
      <div className="hm-row-wrap">
        <div className="hm-row" onClick={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}>
          <div className="hm-row-main">
            <button
              type="button"
              className="hm-row-title-link"
              onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/requisitions/${r.id}`); }}
              title={`Open the workspace flow for ${r.title || 'this requisition'}`}
            >
              <span className="req-ref-pill">{r.ref || `REQ-${(r.id || '').slice(0, 6).toUpperCase()}`}</span>
              {r.title || 'Untitled'}
            </button>
            <span className="hm-row-company">{r.company_name}</span>
            {r.structured_role && (
              <div className="hm-row-commercials-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  Ceiling: <strong style={{ color: '#0f172a' }}>{ceilingVal}</strong>
                </span>
                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  Rate Cap: <strong style={{ color: '#0f172a' }}>{capVal}</strong>
                </span>
              </div>
            )}
          </div>
          <span className={`hm-row-status ${statusClass(r.status)}`}>
            <span className="hm-dot" />
            {r.status || 'Draft'}
          </span>
          <span className="hm-row-date">Created {formatDate(r.created_at)}</span>
          <div className="hm-row-actions">
            {section === 'published' && (
              <button
                type="button"
                className="ghost-btn hm-row-btn"
                disabled={busyId === r.id}
                onClick={(e) => { e.stopPropagation(); handleCancel(r); }}
                title="Cancel — close this requisition and remove it from vendors"
              >
                {busyId === r.id ? '…' : 'Cancel'}
              </button>
            )}
            <button
              type="button"
              className="hm-row-export"
              onClick={(e) => { e.stopPropagation(); handleExportSingle(r); }}
              title="Export this requisition as JSON"
            >
              {Icons.download}
            </button>
            <button
              type="button"
              className="hm-row-delete"
              disabled={busyId === r.id}
              onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
              title="Delete this requisition permanently"
            >
              Delete
            </button>
            <span className="hm-row-chevron">{expandedId === r.id ? '▲' : '▼'}</span>
          </div>
        </div>
        {expandedId === r.id && <RequisitionDetails id={r.id} initialData={r} token={token} />}
      </div>
    );
  };

  return (
    <div className="page hm-page">
      <header className="hm-header">
        <div className="hm-header-left">
          <p className="hm-eyebrow">{greeting()}, {firstName}</p>
          <h1 className="hm-title">{meta.title}</h1>
          <p className="hm-description">{meta.caption}</p>
          <p className="hm-context">
            Hiring Manager <span>·</span> {user?.tenant_name || 'Term Jobs'}
          </p>
        </div>
        <div className="hm-header-actions">
          <Link to="/dashboard/requisitions/new" className="glow-btn hm-header-cta">
            + New Requisition
          </Link>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {info && <div className="alert alert-success">{info}</div>}

      <div className="hm-strip">
        {[
          { key: 'drafted', label: 'Drafted' },
          { key: 'published', label: 'Published' },
          { key: 'completed', label: 'Completed' },
          { key: 'history', label: 'All History' },
        ].map((s) => (
          <Link
            key={s.key}
            to={SECTION_META[s.key].to}
            className={`hm-strip-seg ${s.key === section ? 'hm-strip-active' : ''}`}
          >
            <span className="hm-strip-value">{counts[s.key]}</span>
            <span className="hm-strip-label">{s.label}</span>
          </Link>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading requisitions...</p>
      ) : rows.length === 0 ? (
        <div className="hm-empty">
          <div className="hm-empty-icon">{Icons.layers}</div>
          <h3>Nothing here yet</h3>
          <p>{meta.caption}</p>
          {section === 'drafted' && (
            <Link to="/dashboard/requisitions/new" className="glow-btn hm-empty-cta">
              Create Requisition
            </Link>
          )}
        </div>
      ) : (
        <div className="hm-board-list">
          {rows.map((r) => <Row key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
