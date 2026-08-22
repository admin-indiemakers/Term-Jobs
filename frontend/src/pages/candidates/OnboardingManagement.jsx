import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

const STATUS_COLORS = {
  not_started: { label: 'Not Started', color: '#64748b', bg: '#f1f5f9' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fef3c7' },
  completed: { label: 'Completed', color: '#059669', bg: '#d1fae5' },
};

const DEFAULT_SOFTWARE = [
  { id: 'vpn', label: 'VPN Access', enabled: true, note: '' },
  { id: 'email', label: 'Company Email', enabled: true, note: '' },
  { id: 'github', label: 'GitHub / Code Repositories', enabled: false, note: '' },
  { id: 'slack', label: 'Slack / Communication', enabled: true, note: '' },
  { id: 'client', label: 'Internal HR / Client Systems', enabled: false, note: '' },
];

const DEFAULT_TRAINING = [
  { id: 'posh', label: 'POSH Training', enabled: true, mandatory: true, note: '' },
  { id: 'codeofconduct', label: 'Code of Conduct & Privacy Policy', enabled: true, mandatory: true, note: '' },
  { id: 'induction', label: 'Company Induction', enabled: true, mandatory: false, note: '' },
  { id: 'security', label: 'Security & Data Protection', enabled: false, mandatory: false, note: '' },
];

export default function OnboardingManagement() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [onboardingMap, setOnboardingMap] = useState({});
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalCandidate, setModalCandidate] = useState(null);
  const [activeTab, setActiveTab] = useState('checklists');

  const loadData = async () => {
    setLoading(true);
    try {
      const [candsData, obListData, issuesData] = await Promise.all([
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
      ]);

      const cands = Array.isArray(candsData) ? candsData : candsData?.candidates || [];
      setCandidates(cands);

      const obMap = {};
      (Array.isArray(obListData) ? obListData : []).forEach((item) => {
        if (item.candidate_id) obMap[item.candidate_id] = item;
      });
      setOnboardingMap(obMap);
      setIssues(Array.isArray(issuesData) ? issuesData : []);
    } catch (err) {
      setError(err.message || 'Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleResolveIssue = async (issueId) => {
    try {
      await request(`/api/onboarding/issues/${issueId}/resolve`, {
        method: 'POST',
        token,
      });
      setIssues((prev) =>
        prev.map((iss) => (iss.id === issueId ? { ...iss, status: 'fixed', resolved_at: new Date().toISOString() } : iss))
      );
    } catch (err) {
      alert(err.message || 'Failed to resolve issue.');
    }
  };

  const openIssuesCount = issues.filter((i) => i.status === 'open').length;

  const stats = {
    total: candidates.length,
    started: Object.values(onboardingMap).filter((o) => o.status === 'in_progress').length,
    completed: Object.values(onboardingMap).filter((o) => o.status === 'completed').length,
    openIssues: openIssuesCount,
  };

  return (
    <div className="page candidate-page">
      <WelcomeBanner
        title="Candidate Onboarding Management"
        subtitle="Configure mandatory onboarding checklists and resolve issues reported by accepted candidates."
      />

      <div className="stat-grid" style={{ marginTop: '20px' }}>
        <StatCard label="Accepted Hires" value={stats.total} icon={Icons.users} tint="tint-green" />
        <StatCard label="Onboarding In Progress" value={stats.started} icon={Icons.briefcase} tint="tint-blue" />
        <StatCard label="Onboarding Complete" value={stats.completed} icon={Icons.check} tint="tint-violet" />
        <StatCard
          label="Open Candidate Issues"
          value={stats.openIssues}
          icon={Icons.layers}
          tint={stats.openIssues > 0 ? 'tint-amber' : 'tint-blue'}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('checklists')}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: '0.88rem',
            fontWeight: 700,
            border: activeTab === 'checklists' ? '2px solid #0f172a' : '1px solid #e2e8f0',
            background: activeTab === 'checklists' ? '#0f172a' : '#fff',
            color: activeTab === 'checklists' ? '#fff' : '#475569',
            cursor: 'pointer',
          }}
        >
          📋 Onboarding Checklists ({candidates.length})
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: '0.88rem',
            fontWeight: 700,
            border: activeTab === 'issues' ? '2px solid #d97706' : '1px solid #e2e8f0',
            background: activeTab === 'issues' ? '#fef3c7' : '#fff',
            color: activeTab === 'issues' ? '#92400e' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          🚩 Candidate Reported Issues
          {openIssuesCount > 0 && (
            <span style={{ background: '#dc2626', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
              {openIssuesCount}
            </span>
          )}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {activeTab === 'checklists' && (
        <div className="glass-panel table-card">
          <div className="shortlist-head">
            <h3 className="card-title">Accepted Candidate Onboarding</h3>
          </div>
          {loading ? (
            <p className="muted" style={{ padding: 24 }}>Loading candidate checklists...</p>
          ) : candidates.length === 0 ? (
            <div className="empty-state">
              <h3>No accepted candidates yet</h3>
              <p>Once an interview is completed and a candidate is accepted, they will appear here for onboarding setup.</p>
            </div>
          ) : (
            <table className="data-table cand-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Vendor</th>
                  <th>Requisition</th>
                  <th>Match Score</th>
                  <th>Onboarding Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const cid = c.submission_id || c.id;
                  const ob = onboardingMap[cid];
                  const obStatus = ob ? STATUS_COLORS[ob.status] || STATUS_COLORS.not_started : null;
                  const candidateHasIssue = issues.some((i) => i.candidate_id === cid && i.status === 'open');

                  return (
                    <tr key={cid}>
                      <td className="td-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{c.candidate_name}</span>
                          {candidateHasIssue && (
                            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                              ⚠️ Issue Reported
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{cid}</div>
                      </td>
                      <td className="td-company">{c.vendor_name || '—'}</td>
                      <td className="td-company">
                        {c.requisition_ref ? (
                          <div style={{ lineHeight: '1.3' }}>
                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>{c.requisition_ref}</span>
                            {c.requisition_title && <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{c.requisition_title}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: c.match_score >= 70 ? '#059669' : c.match_score >= 40 ? '#d97706' : '#dc2626' }}>
                          {c.match_score != null ? `${Math.round(c.match_score)}%` : '—'}
                        </span>
                      </td>
                      <td>
                        {obStatus ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: obStatus.bg, color: obStatus.color }}>
                            {obStatus.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Not set up</span>
                        )}
                      </td>
                      <td className="td-action">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {ob ? (
                            <button
                              onClick={() => setModalCandidate(c)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer' }}
                            >
                              📋 Edit Setup
                            </button>
                          ) : (
                            <button
                              onClick={() => setModalCandidate(c)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer' }}
                            >
                              🚀 Setup Onboarding
                            </button>
                          )}
                          {c.requisition_id && (
                            <Link
                              to={`/dashboard/requisitions/${c.requisition_id}/candidates/${cid}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', textDecoration: 'none' }}
                            >
                              View →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="glass-panel table-card">
          <div className="shortlist-head">
            <h3 className="card-title">Candidate Reported Onboarding Issues</h3>
          </div>
          {loading ? (
            <p className="muted" style={{ padding: 24 }}>Loading reported issues...</p>
          ) : issues.length === 0 ? (
            <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
              <h3>No candidate issues reported</h3>
              <p>All candidates are currently onboarding smoothly without active complaints or missing access reports.</p>
            </div>
          ) : (
            <table className="data-table cand-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Category</th>
                  <th>Description / Details</th>
                  <th>Reported Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((iss) => (
                  <tr key={iss.id}>
                    <td className="td-title">
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{iss.candidate_name || 'Candidate'}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', fontFamily: 'monospace' }}>{iss.candidate_id}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 6 }}>
                        {iss.category_label || iss.category}
                      </span>
                    </td>
                    <td style={{ maxWidth: 320, lineHeight: 1.4 }}>
                      <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>{iss.description || 'No description provided.'}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {iss.created_at ? new Date(iss.created_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      {iss.status === 'fixed' ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', background: '#d1fae5', padding: '4px 10px', borderRadius: 999 }}>
                          ✓ Fixed
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: 999 }}>
                          ● Open Issue
                        </span>
                      )}
                    </td>
                    <td className="td-action">
                      {iss.status !== 'fixed' ? (
                        <button
                          onClick={() => handleResolveIssue(iss.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Mark as Fixed
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalCandidate && (
        <OnboardingModal
          candidate={modalCandidate}
          token={token}
          existing={onboardingMap[modalCandidate.submission_id || modalCandidate.id]}
          onClose={(updated) => {
            if (updated) {
              setOnboardingMap((prev) => ({ ...prev, [modalCandidate.submission_id || modalCandidate.id]: updated }));
            }
            setModalCandidate(null);
          }}
        />
      )}
    </div>
  );
}

function OnboardingModal({ candidate, token, existing, onClose }) {
  const cid = candidate.submission_id || candidate.id;
  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        laptop_required: existing.laptop_required || false,
        laptop_spec: existing.laptop_spec || 'Standard build',
        badge_required: existing.badge_required || false,
        software: existing.software?.length ? existing.software : DEFAULT_SOFTWARE.map((s) => ({ ...s })),
        training: existing.training?.length ? existing.training : DEFAULT_TRAINING.map((t) => ({ ...t })),
        custom_items: existing.custom_items || [],
        notes: existing.notes || '',
      };
    }
    return {
      laptop_required: false,
      laptop_spec: 'Standard build',
      badge_required: false,
      software: DEFAULT_SOFTWARE.map((s) => ({ ...s })),
      training: DEFAULT_TRAINING.map((t) => ({ ...t })),
      custom_items: [],
      notes: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [newItemName, setNewItemName] = useState('');

  const updateSoftware = (id, enabled) => {
    setForm((f) => ({ ...f, software: f.software.map((s) => (s.id === id ? { ...s, enabled } : s)) }));
  };

  const updateTraining = (id, enabled) => {
    setForm((f) => ({ ...f, training: f.training.map((t) => (t.id === id ? { ...t, enabled } : t)) }));
  };

  const addCustomItem = () => {
    if (!newItemName.trim() || !addingTo) return;
    const newItem = { id: `custom_${Date.now()}`, label: newItemName.trim(), section: addingTo, enabled: true, note: '' };
    setForm((f) => ({ ...f, custom_items: [...f.custom_items, newItem] }));
    setNewItemName('');
    setAddingTo(null);
  };

  const removeCustomItem = (id) => {
    setForm((f) => ({ ...f, custom_items: f.custom_items.filter((ci) => ci.id !== id) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!existing) {
        await request(`/api/onboarding/${cid}`, { method: 'POST', token }).catch(() => {});
      }
      const body = {
        ...form,
        candidate_name: candidate.candidate_name || '',
        candidate_email: candidate.candidate_email || '',
        requisition_id: candidate.requisition_id || '',
        requisition_title: candidate.requisition_title || candidate.requisition_ref || '',
        company_name: candidate.company_name || '',
        vendor_name: candidate.vendor_name || '',
      };
      const updated = await request(`/api/onboarding/${cid}`, { method: 'PUT', token, body });
      setToast('✓ Onboarding setup saved!');
      setTimeout(() => { onClose(updated); }, 600);
    } catch (err) {
      console.error(err);
      setToast('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    setGenerating(true);
    try {
      const result = await request('/api/onboarding/generate', {
        method: 'POST',
        token,
        body: {
          role_title: candidate.requisition_title || '',
          company_name: candidate.company_name || '',
          tech_stack: [],
        },
      });
      setForm((f) => ({
        ...f,
        laptop_required: result.laptop_required ?? f.laptop_required,
        laptop_spec: result.laptop_spec || f.laptop_spec,
        badge_required: result.badge_required ?? f.badge_required,
        software: result.software?.length ? result.software : f.software,
        training: result.training?.length ? result.training : f.training,
      }));
      setToast('✓ Generated with AI!');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      console.error(err);
      setToast('AI generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Onboarding Checklist Setup</h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>Configure required equipment, software, and training for {candidate.candidate_name}.</p>
          </div>
          <button onClick={() => onClose()} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {toast && <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 16, fontWeight: 600 }}>{toast}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            type="button"
            onClick={handleAIGenerate}
            disabled={generating}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}
          >
            {generating ? '✨ Generating...' : '✨ AI Generate Checklist'}
          </button>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 12 }}>💻 Equipment & Access Cards</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.laptop_required} onChange={(e) => setForm({ ...form, laptop_required: e.target.checked })} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Provision Laptop</span>
          </label>
          {form.laptop_required && (
            <div style={{ marginLeft: 26, marginBottom: 12 }}>
              <input
                type="text"
                value={form.laptop_spec}
                onChange={(e) => setForm({ ...form, laptop_spec: e.target.value })}
                placeholder="Laptop Specification (e.g. MacBook Pro M3 Max)"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.badge_required} onChange={(e) => setForm({ ...form, badge_required: e.target.checked })} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Building ID / Security Badge</span>
          </label>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 12 }}>🔑 Software Accounts & Permissions</div>
          {form.software.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={s.enabled} onChange={(e) => updateSoftware(s.id, e.target.checked)} />
              <span style={{ fontSize: '0.85rem', color: '#334155' }}>{s.label}</span>
            </label>
          ))}
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 12 }}>🎓 Compliance & Training</div>
          {form.training.map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={t.enabled} onChange={(e) => updateTraining(t.id, e.target.checked)} />
              <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                {t.label} {t.mandatory && <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>(Mandatory)</span>}
              </span>
            </label>
          ))}
        </div>

        {form.custom_items.length > 0 && (
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 12 }}>✨ Additional Custom Tasks</div>
            {form.custom_items.map((ci) => (
              <div key={ci.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', color: '#334155' }}>• {ci.label}</span>
                <button type="button" onClick={() => removeCustomItem(ci.id)} style={{ color: '#dc2626', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem' }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {addingTo ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Task name"
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
            />
            <button type="button" onClick={addCustomItem} style={{ padding: '6px 12px', borderRadius: 6, background: '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Add</button>
            <button type="button" onClick={() => setAddingTo(null)} style={{ padding: '6px 12px', borderRadius: 6, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingTo('custom')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px dashed #cbd5e1', background: '#fff', fontSize: '0.78rem', fontWeight: 600, color: '#475569', cursor: 'pointer', marginBottom: 16 }}>+ Add Custom Task</button>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={() => onClose()} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save & Publish Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}
