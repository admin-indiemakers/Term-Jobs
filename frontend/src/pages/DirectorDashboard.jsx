import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, API_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Icons, StatCard, WelcomeBanner } from '../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function DirectorDashboard() {
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
  const templateFileRef = useRef(null);

  const loadTemplates = () => {
    request('/templates', { token })
      .then((res) => setTemplates(res || []))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
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
  }, [token]);

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
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Upload failed');
      }
      await response.json();
      setTemplateMsg(`Template "${file.name}" uploaded — hiring managers can now pick it in the New Requisition form.`);
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
    } catch (err) {
      setError(err.message);
    }
  };

  const published = requisitions.filter((r) => r.status === 'Published').length;
  const pending = requisitions.filter((r) => r.status === 'PendingApproval').length;
  const engagedVendors = vendors.filter((v) => v.engaged).length;

  const candidatesByRequisition = useMemo(() => {
    const map = {};
    (candidates || []).forEach((c) => {
      if (!c.requisition_id) return;
      map[c.requisition_id] = (map[c.requisition_id] || 0) + 1;
    });
    return map;
  }, [candidates]);

  return (
    <div className="page">
      <WelcomeBanner
        title="Executive Overview"
        subtitle={`${user.tenant_name} — read-only view of hiring activity across the company.`}
      />

      <div className="stat-grid">
        <StatCard label="Requisitions" value={requisitions.length} icon={Icons.briefcase} tint="tint-black" />
        <StatCard label="Pending Approval" value={pending} icon={Icons.clock} tint="tint-black" />
        <StatCard label="Published" value={published} icon={Icons.check} tint="tint-black" />
        <StatCard label="Shortlisted Candidates" value={candidates.length} icon={Icons.users} tint="tint-black" />
        <StatCard label="Partner Vendors" value={engagedVendors} icon={Icons.layers} tint="tint-black" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {templateMsg && <div className="alert alert-success">{templateMsg}</div>}

      <div className="glass-panel table-card" style={{ marginBottom: 24 }}>
        <div className="table-head">
          <div>
            <h2 className="card-title">Role Templates</h2>
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              Upload a JSON template (full role details) — hiring managers can select it to auto-fill the New Requisition form.
            </p>
          </div>
          <input
            ref={templateFileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleTemplateUpload}
            style={{ display: 'none' }}
          />
          <button type="button" className="glow-btn" onClick={() => templateFileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload JSON Template'}
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            No templates yet — upload a JSON file containing the role title, skills, engagement, commercials, work setup, compliance and process details.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Role Title</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="td-title">{t.name || 'Untitled template'}</td>
                  <td>{t.structured_role?.title || '—'}</td>
                  <td className="td-date">{formatDate(t.created_at)}</td>
                  <td className="td-action">
                    <button type="button" className="row-action-danger" onClick={() => handleTemplateDelete(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>Loading executive overview...</p>
      ) : (
        <>
          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Requisitions</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Read-only overview of all requisitions</p>
              </div>
            </div>
            {requisitions.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No requisitions in this workspace yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Shortlisted</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((r) => (
                    <tr key={r.id} onClick={() => navigate(`/dashboard/requisitions/${r.id}`)} className="clickable-row">
                      <td className="td-title">{r.title || 'Untitled'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{candidatesByRequisition[r.id] || 0}</td>
                      <td className="td-date">{formatDate(r.created_at)}</td>
                      <td className="td-action"><span className="row-action">View →</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Shortlisted Candidates</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Candidates shortlisted by your partner vendors</p>
              </div>
            </div>
            {candidates.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No shortlisted candidates yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role</th>
                    <th>Vendor</th>
                    <th>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 20).map((c) => (
                    <tr key={c.id}>
                      <td className="td-title">{c.candidate_name || '—'}</td>
                      <td>{c.requisition_title || '—'}</td>
                      <td className="td-company">{c.vendor_name || '—'}</td>
                      <td>{c.match_score != null ? `${Math.round(c.match_score)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="glass-panel table-card">
            <div className="table-head">
              <div>
                <h2 className="card-title">Partner Vendors</h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Consultancies your company works with</p>
              </div>
            </div>
            {vendors.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No consultancy vendors onboarded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Location</th>
                    <th>Industry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id}>
                      <td className="td-title">{v.name}</td>
                      <td>{v.location || '—'}</td>
                      <td>{v.industry || '—'}</td>
                      <td>
                        <span className={`rec-badge ${v.engaged ? 'rec-strong' : 'rec-low'}`}>
                          {v.engaged ? 'Engaged' : 'Not engaged'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
