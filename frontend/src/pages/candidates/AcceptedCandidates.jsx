import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

const DEFAULT_SOFTWARE = [
  { id: 'vpn', label: 'VPN access', enabled: false },
  { id: 'email', label: 'Company email', enabled: false },
  { id: 'github', label: 'GitHub / repo access', enabled: false },
  { id: 'slack', label: 'Slack / Teams', enabled: false },
  { id: 'client', label: 'Client / dept system', enabled: false },
];

const DEFAULT_TRAINING = [
  { id: 'posh', label: 'POSH training', enabled: false, mandatory: true },
  { id: 'codeofconduct', label: 'Code of conduct & data privacy', enabled: false, mandatory: true },
  { id: 'induction', label: 'Company induction', enabled: false, mandatory: false },
  { id: 'security', label: 'Security & data-handling awareness', enabled: false, mandatory: false },
  { id: 'nda', label: 'Client-specific NDA / compliance', enabled: false, mandatory: false },
];

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const STATUS_COLORS = {
  not_started: { bg: '#f1f5f9', color: '#64748b', label: '○ Not Started' },
  in_progress: { bg: '#fef3c7', color: '#92400e', label: '● In Progress' },
  completed: { bg: '#d1fae5', color: '#065f46', label: '✓ Completed' },
};

export default function AcceptedCandidates() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [onboardingMap, setOnboardingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalCandidate, setModalCandidate] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      request('/candidates?status=Accepted', { token }).catch(() => []),
      request('/api/interviews/company', { token }).catch(() => []),
    ])
      .then(([data, invs]) => {
        const cands = Array.isArray(data) ? data : data?.candidates || [];
        setCandidates(cands);
        setInterviews(Array.isArray(invs) ? invs : invs?.interviews || []);
        // Load onboarding status for each candidate
        cands.forEach((c) => {
          const cid = c.submission_id || c.id;
          request(`/api/onboarding/${cid}`, { token })
            .then((ob) => setOnboardingMap((prev) => ({ ...prev, [cid]: ob })))
            .catch(() => {});
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const stats = useMemo(() => {
    const started = Object.values(onboardingMap).filter((o) => o.status === 'in_progress' || o.status === 'completed').length;
    const completed = Object.values(onboardingMap).filter((o) => o.status === 'completed').length;
    return {
      total: candidates.length,
      started,
      completed,
    };
  }, [candidates, onboardingMap]);

  const interviewFor = (c) => {
    const cid = c.submission_id || c.id;
    return interviews.find((inv) => inv.candidate_submission_id === cid || inv.candidate_name === c.candidate_name);
  };

  return (
    <div className="page page-shortlisted">
      <WelcomeBanner
        title="Accepted Candidates"
        subtitle={`${stats.total} accepted · set up onboarding for each`}
      >
        <Link to="/dashboard/candidates" className="ghost-btn-link" style={{ color: '#dbeafe', fontSize: '0.88rem' }}>
          ← Shortlisted candidates
        </Link>
      </WelcomeBanner>

      <div className="stat-grid">
        <StatCard label="Accepted" value={stats.total} icon={Icons.check} tint="tint-green" />
        <StatCard label="Onboarding Started" value={stats.started} icon={Icons.briefcase} tint="tint-blue" />
        <StatCard label="Onboarding Complete" value={stats.completed} icon={Icons.users} tint="tint-violet" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="glass-panel table-card" style={{ marginTop: '20px' }}>
        <div className="shortlist-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Accepted Candidates</h3>
          <Link
            to="/dashboard/candidates/onboarding"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              background: '#0f172a',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            📋 Open Onboarding & Issues Hub →
          </Link>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading accepted candidates...</p>
        ) : candidates.length === 0 ? (
          <div className="empty-state">
            <h3>No accepted candidates yet</h3>
            <p>Once an interview meeting is over, mark the final decision as Accepted and the candidate will appear here.</p>
          </div>
        ) : (
          <table className="data-table cand-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Vendor</th>
                <th>Requisition</th>
                <th>Match Score</th>
                <th>Interview</th>
                <th>Onboarding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const cid = c.submission_id || c.id;
                const inv = interviewFor(c);
                const ob = onboardingMap[cid];
                const obStatus = ob ? STATUS_COLORS[ob.status] || STATUS_COLORS.not_started : null;
                return (
                  <tr key={cid}>
                    <td className="td-title">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{c.candidate_name}</span>
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
                      {inv ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                          {inv.interview_round || 'Interview'}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {obStatus ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: obStatus.bg, color: obStatus.color }}>
                          {obStatus.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Not set up</span>
                      )}
                    </td>
                    <td className="td-action">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ob ? (
                          <button
                            onClick={() => setModalCandidate(c)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer' }}
                          >
                            📋 Edit Setup
                          </button>
                        ) : (
                          <button
                            onClick={() => setModalCandidate(c)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer' }}
                          >
                            🚀 Setup Onboarding
                          </button>
                        )}
                        {c.requisition_id && (
                          <Link
                            to={`/dashboard/requisitions/${c.requisition_id}/candidates/${cid}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', textDecoration: 'none' }}
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

      {/* Onboarding Setup Modal */}
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
  const [addingTo, setAddingTo] = useState(null); // which section we're adding to
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

  const updateCustomItemNote = (id, note) => {
    setForm((f) => ({ ...f, custom_items: f.custom_items.map((ci) => (ci.id === id ? { ...ci, note } : ci)) }));
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
      setToast('✨ AI checklist generated!');
    } catch (err) {
      console.error(err);
      setToast('AI generation failed. Please set up manually.');
    } finally {
      setGenerating(false);
    }
  };

  const totalItems = form.software.filter((s) => s.enabled).length + form.training.filter((t) => t.enabled).length + form.custom_items.filter((ci) => ci.enabled).length + (form.laptop_required ? 1 : 0) + (form.badge_required ? 1 : 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f0ec', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Onboarding Setup</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{candidate.candidate_name} · {totalItems} items configured</div>
          </div>
          <button onClick={() => onClose(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px' }}>
          {/* AI Generate Button */}
          <button
            onClick={handleAIGenerate}
            disabled={generating}
            style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px dashed #7c3aed', background: '#faf5ff', color: '#7c3aed', fontSize: '0.85rem', fontWeight: 600, cursor: generating ? 'wait' : 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {generating ? '⏳ Generating...' : '✨ AI-Generate Checklist'}
          </button>

          {/* Equipment Section */}
          <Section title="Equipment" icon="💻">
            <ToggleRow label="Company laptop required" checked={form.laptop_required} onChange={(v) => setForm((f) => ({ ...f, laptop_required: v }))} />
            {form.laptop_required && (
              <div style={{ paddingLeft: 34, marginBottom: 10 }}>
                <select value={form.laptop_spec} onChange={(e) => setForm((f) => ({ ...f, laptop_spec: e.target.value }))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.82rem', background: '#fafafa' }}>
                  <option>Standard build</option>
                  <option>Developer build</option>
                  <option>Design build (GPU)</option>
                </select>
              </div>
            )}
            <ToggleRow label="Building badge / on-site access" checked={form.badge_required} onChange={(v) => setForm((f) => ({ ...f, badge_required: v }))} />
            {form.custom_items.filter((ci) => ci.section === 'equipment').map((ci) => (
              <CustomItemRow key={ci.id} item={ci} onRemove={removeCustomItem} onNoteChange={updateCustomItemNote} />
            ))}
            <AddMoreButton section="equipment" addingTo={addingTo} setAddingTo={setAddingTo} newItemName={newItemName} setNewItemName={setNewItemName} onAdd={addCustomItem} />
          </Section>

          {/* Software Section */}
          <Section title="Software & Access" icon="🔑">
            {form.software.map((s) => (
              <ToggleRow key={s.id} label={s.label} checked={s.enabled} onChange={(v) => updateSoftware(s.id, v)} />
            ))}
            {form.custom_items.filter((ci) => ci.section === 'software').map((ci) => (
              <CustomItemRow key={ci.id} item={ci} onRemove={removeCustomItem} onNoteChange={updateCustomItemNote} />
            ))}
            <AddMoreButton section="software" addingTo={addingTo} setAddingTo={setAddingTo} newItemName={newItemName} setNewItemName={setNewItemName} onAdd={addCustomItem} />
          </Section>

          {/* Training Section */}
          <Section title="Training" icon="🎓">
            {form.training.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f0ec' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>{t.label}</span>
                  {t.mandatory && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: '#d97706', background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>Global</span>}
                </div>
                {t.mandatory ? (
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '0.6rem' }}>🔒</span>
                  </div>
                ) : (
                  <Toggle checked={t.enabled} onChange={(v) => updateTraining(t.id, v)} />
                )}
              </div>
            ))}
            {form.custom_items.filter((ci) => ci.section === 'training').map((ci) => (
              <CustomItemRow key={ci.id} item={ci} onRemove={removeCustomItem} onNoteChange={updateCustomItemNote} />
            ))}
            <AddMoreButton section="training" addingTo={addingTo} setAddingTo={setAddingTo} newItemName={newItemName} setNewItemName={setNewItemName} onAdd={addCustomItem} />
          </Section>

          {/* Notes */}
          <div style={{ background: '#fafafa', border: '1px solid #e5e5e0', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Notes</div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Additional onboarding notes..."
              rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Toast */}
          {toast && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: toast.startsWith('✓') || toast.startsWith('✨') ? '#d1fae5' : '#fef2f2', color: toast.startsWith('✓') || toast.startsWith('✨') ? '#065f46' : '#dc2626', fontSize: '0.82rem', fontWeight: 500, marginBottom: 16 }}>
              {toast}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingBottom: 16 }}>
            <button onClick={() => onClose(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving...' : '✓ Save Onboarding Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: 4 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', padding: 2, cursor: 'pointer', background: checked ? '#059669' : '#d1d5db', display: 'flex', alignItems: checked ? 'center' : 'center', justifyContent: checked ? 'flex-end' : 'center', transition: 'background 0.2s' }}
    >
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
    </button>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f0ec' }}>
      <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function CustomItemRow({ item, onRemove, onNoteChange }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f0ec' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Toggle checked={item.enabled} onChange={() => onRemove(item.id)} />
        <span style={{ fontSize: '0.85rem', color: '#0f172a', flex: 1 }}>{item.label}</span>
        <span style={{ fontSize: '0.65rem', color: '#7c3aed', background: '#ede9fe', padding: '2px 6px', borderRadius: 4 }}>Custom</span>
        <button onClick={() => onRemove(item.id)} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: '#fef2f2', color: '#dc2626', fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
      </div>
      <input
        value={item.note || ''}
        onChange={(e) => onNoteChange(item.id, e.target.value)}
        placeholder="Note (optional)"
        style={{ width: '100%', marginTop: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.78rem' }}
      />
    </div>
  );
}

function AddMoreButton({ section, addingTo, setAddingTo, newItemName, setNewItemName, onAdd }) {
  if (addingTo === section) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="Item name"
          autoFocus
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.82rem' }}
        />
        <button onClick={onAdd} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Add</button>
        <button onClick={() => { setAddingTo(null); setNewItemName(''); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
      </div>
    );
  }
  return (
    <button onClick={() => setAddingTo(section)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0', border: 'none', background: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', marginTop: 4 }}>
      + Add {section === 'equipment' ? 'equipment' : section === 'software' ? 'software' : 'training'}
    </button>
  );
}
