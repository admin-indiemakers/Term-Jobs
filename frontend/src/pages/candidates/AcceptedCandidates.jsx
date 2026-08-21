import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icons, StatCard, WelcomeBanner } from '../../components/Dashboard';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const SOFTWARE_LABELS = {
  vpn: 'VPN access',
  email: 'Company email',
  github: 'GitHub / repo access',
  slack: 'Slack / Teams',
  client: 'Client / dept system',
};

const MANDATORY_LABELS = {
  posh: 'POSH training',
  code_of_conduct: 'Code of conduct & data privacy',
};

const OPTIONAL_LABELS = {
  induction: 'Company induction',
  security: 'Security & data-handling awareness',
  nda: 'Client-specific NDA / compliance',
};

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 36, height: 20, borderRadius: 10,
        background: disabled ? '#EDECE7' : checked ? '#0A0A0A' : '#D9D8D2',
        cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left .15s', left: checked ? 18 : 2,
        }}
      />
    </button>
  );
}

function StatusBadge({ status }) {
  const styles = {
    not_started: { bg: '#f1f5f9', color: '#64748b', label: 'Not Started' },
    in_progress: { bg: '#fef3c7', color: '#92400e', label: 'In Progress' },
    completed: { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
  };
  const s = styles[status] || styles.not_started;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem',
      fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.color}22`,
    }}>
      {status === 'completed' ? '✓' : status === 'in_progress' ? '●' : '○'} {s.label}
    </span>
  );
}

// ─── Onboarding Form Modal ─────────────────────────────────────────────
function OnboardingModal({ candidate, onClose, authToken, onSave }) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const cid = candidate.submission_id || candidate.id;

  useEffect(() => {
    setLoading(true);
    setError('');
    request(`/api/onboarding/${cid}`, { token: authToken })
      .then((data) => { setChecklist(data); setLoading(false); })
      .catch(() => {
        request(`/api/onboarding/${cid}`, { token: authToken, method: 'POST' })
          .then((data) => { setChecklist(data); setLoading(false); })
          .catch((err) => { setError(err.message); setLoading(false); });
      });
  }, [cid, authToken]);

  const handleGenerateAI = async () => {
    setGenerating(true);
    setError('');
    try {
      const data = await request('/api/onboarding/generate', {
        token: authToken,
        method: 'POST',
        body: JSON.stringify({
          candidate_id: cid,
          role_title: candidate.requisition_title || '',
          company_name: candidate.company_name || candidate.requisition_ref || '',
          tech_stack: candidate.matched_skills || [],
        }),
      });
      setChecklist(data);
      setToast('✨ AI-generated onboarding checklist ready');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = { ...checklist };
      delete body._id;
      delete body.created_at;
      delete body.candidate_id;
      const data = await request(`/api/onboarding/${cid}`, {
        token: authToken,
        method: 'PUT',
        body,
      });
      setChecklist(data);
      setToast('✓ Saved');
      setTimeout(() => setToast(''), 3000);
      if (onSave) onSave(cid, data);
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (path, value) => {
    setChecklist((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const addCustomItem = (section, label) => {
    setChecklist((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.custom_items) next.custom_items = [];
      next.custom_items.push({ id: `ci_${Date.now()}`, label, section, enabled: true, note: '' });
      return next;
    });
  };

  const removeCustomItem = (itemId) => {
    setChecklist((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.custom_items = (next.custom_items || []).filter((ci) => ci.id !== itemId);
      return next;
    });
  };

  const toggleCustomItem = (itemId) => {
    setChecklist((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const item = (next.custom_items || []).find((ci) => ci.id === itemId);
      if (item) item.enabled = !item.enabled;
      return next;
    });
  };

  const updateCustomItemNote = (itemId, note) => {
    setChecklist((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const item = (next.custom_items || []).find((ci) => ci.id === itemId);
      if (item) item.note = note;
      return next;
    });
  };

  if (loading) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !checklist) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</p>
          <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
            <button onClick={onClose} style={styles.closeBtn}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {/* Toast */}
        {toast && <div style={styles.toast}>{toast}</div>}

        {/* Header */}
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Setup Onboarding
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              {candidate.candidate_name} · {candidate.requisition_title || '—'}
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* AI Generate */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px dashed #7c3aed',
              background: '#faf5ff', color: '#7c3aed', fontWeight: 600, fontSize: '0.82rem',
              cursor: generating ? 'wait' : 'pointer',
            }}
          >
            {generating ? '⏳ Generating...' : '✨ AI-Generate Checklist'}
          </button>
          {checklist?.notes && (
            <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
              💡 {checklist.notes}
            </p>
          )}
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', maxHeight: '55vh' }}>
          {/* Equipment */}
          <Section title="Equipment" icon="💻" onAdd={(l) => addCustomItem('equipment', l)} addLabel="Add equipment">
            <Row label="Company laptop required">
              <Toggle checked={checklist?.laptop?.required ?? true} onChange={(v) => updateField('laptop.required', v)} />
            </Row>
            {checklist?.laptop?.required && (
              <div style={{ padding: '4px 0 8px 24px' }}>
                <select value={checklist?.laptop?.spec || 'Standard build'} onChange={(e) => updateField('laptop.spec', e.target.value)} style={styles.select}>
                  <option>Standard build</option>
                  <option>Developer build</option>
                  <option>Design build (GPU)</option>
                </select>
              </div>
            )}
            <Row label="Building badge / on-site access">
              <Toggle checked={checklist?.badge ?? true} onChange={(v) => updateField('badge', v)} />
            </Row>
            {(checklist?.custom_items || []).filter((ci) => ci.section === 'equipment').map((ci) => (
              <CustomItemRow key={ci.id} item={ci} onToggle={() => toggleCustomItem(ci.id)} onRemove={() => removeCustomItem(ci.id)} onNoteChange={(n) => updateCustomItemNote(ci.id, n)} />
            ))}
          </Section>

          {/* Software */}
          <Section title="Software & Access" icon="🔑" onAdd={(l) => addCustomItem('software', l)} addLabel="Add software / access">
            {Object.entries(SOFTWARE_LABELS).map(([key, label]) => (
              <div key={key}>
                <Row label={label}>
                  <Toggle checked={checklist?.software?.[key]?.enabled ?? false} onChange={(v) => updateField(`software.${key}.enabled`, v)} />
                </Row>
                {key === 'client' && checklist?.software?.client?.enabled && (
                  <div style={{ padding: '4px 0 8px 24px' }}>
                    <input value={checklist?.software?.client?.note || ''} onChange={(e) => updateField('software.client.note', e.target.value)} placeholder="Which system? e.g. CRM, ERP" style={styles.input} />
                  </div>
                )}
              </div>
            ))}
            {(checklist?.custom_items || []).filter((ci) => ci.section === 'software').map((ci) => (
              <CustomItemRow key={ci.id} item={ci} onToggle={() => toggleCustomItem(ci.id)} onRemove={() => removeCustomItem(ci.id)} onNoteChange={(n) => updateCustomItemNote(ci.id, n)} />
            ))}
          </Section>

          {/* Mandatory Training */}
          <Section title="Mandatory Training" icon="🎓">
            {Object.entries(MANDATORY_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f0ec' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.88rem', color: '#0f172a' }}>{label}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#8a5a00', background: '#fff4e0', padding: '2px 6px', borderRadius: 999 }}>🔒 Global</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 20, borderRadius: 10, background: '#0A0A0A' }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                </span>
              </div>
            ))}
          </Section>

          {/* Optional Training */}
          <Section title="Optional Training" icon="📚" onAdd={(l) => addCustomItem('training', l)} addLabel="Add training item">
            {Object.entries(OPTIONAL_LABELS).map(([key, label]) => (
              <Row key={key} label={label}>
                <Toggle checked={checklist?.optional_training?.[key]?.enabled ?? false} onChange={(v) => updateField(`optional_training.${key}.enabled`, v)} />
              </Row>
            ))}
            {(checklist?.custom_items || []).filter((ci) => ci.section === 'training').map((ci) => (
              <CustomItemRow key={ci.id} item={ci} onToggle={() => toggleCustomItem(ci.id)} onRemove={() => removeCustomItem(ci.id)} onNoteChange={(n) => updateCustomItemNote(ci.id, n)} />
            ))}
          </Section>

          {/* Notes */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Notes for candidate</label>
            <textarea
              value={checklist?.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Instructions or notes for the candidate..."
              rows={3}
              style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit', maxWidth: '100%' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onClose} style={{ ...styles.saveBtn, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ ...styles.saveBtn, background: '#0f172a', color: '#fff' }}>
            {saving ? 'Saving...' : '✓ Save Onboarding Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, onAdd, addLabel }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const handleAdd = () => {
    if (newLabel.trim()) { onAdd(newLabel.trim()); setNewLabel(''); setAdding(false); }
  };
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{title}</h4>
      </div>
      {children}
      {onAdd && (
        adding ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <input autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); } }}
              placeholder="Item name..." style={{ flex: 1, maxWidth: 280, padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none' }} />
            <button onClick={handleAdd} style={{ padding: '5px 12px', borderRadius: 6, background: '#059669', color: '#fff', border: 'none', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Add</button>
            <button onClick={() => { setAdding(false); setNewLabel(''); }} style={{ padding: '5px 10px', borderRadius: 6, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', background: 'none', border: 'none', color: '#7c3aed', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> {addLabel || 'Add more'}
          </button>
        )
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f0ec' }}>
      <span style={{ fontSize: '0.85rem', color: '#334155' }}>{label}</span>
      {children}
    </div>
  );
}

function CustomItemRow({ item, onToggle, onRemove, onNoteChange }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #f1f0ec' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 500 }}>{item.label}</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed', background: '#faf5ff', padding: '1px 6px', borderRadius: 999, border: '1px solid #e9d5ff' }}>Custom</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle checked={item.enabled} onChange={onToggle} />
          <button onClick={onRemove} title="Remove" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.88rem', padding: '2px 4px', lineHeight: 1 }}>✕</button>
        </div>
      </div>
      {item.enabled && (
        <div style={{ padding: '4px 0 0' }}>
          <input value={item.note || ''} onChange={(e) => onNoteChange(e.target.value)} placeholder="Note (optional)"
            style={{ width: '100%', maxWidth: 320, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#fafaf9', outline: 'none' }} />
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '100%', maxHeight: '90vh',
    overflow: 'hidden', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  closeBtn: {
    background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32,
    fontSize: '0.88rem', cursor: 'pointer', color: '#64748b', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  toast: {
    position: 'absolute', top: 16, right: 16, background: '#059669', color: '#fff',
    padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
    zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  footer: {
    padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8,
  },
  saveBtn: {
    padding: '10px 20px', borderRadius: 8, border: 'none', fontSize: '0.85rem',
    fontWeight: 700, cursor: 'pointer', flex: 1,
  },
  select: {
    width: '100%', maxWidth: 260, padding: '6px 10px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: '0.82rem', background: '#fafaf9',
    color: '#0f172a', outline: 'none',
  },
  input: {
    width: '100%', maxWidth: 320, padding: '6px 10px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: '0.82rem', background: '#fafaf9',
    color: '#0f172a', outline: 'none',
  },
};

// ─── Main Component ─────────────────────────────────────────────────────
export default function AcceptedCandidates() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [onboardingMap, setOnboardingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onboardingCandidate, setOnboardingCandidate] = useState(null);

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
        cands.forEach((c) => {
          const cid = c.submission_id || c.id;
          request(`/api/onboarding/${cid}`, { token })
            .then((doc) => setOnboardingMap((prev) => ({ ...prev, [cid]: doc })))
            .catch(() => {});
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const handleOnboardingSave = (cid, data) => {
    setOnboardingMap((prev) => ({ ...prev, [cid]: data }));
  };

  const stats = useMemo(() => {
    const byRequisition = {};
    let onboardingCount = 0;
    let completedCount = 0;
    candidates.forEach((c) => {
      if (!c.requisition_id) return;
      byRequisition[c.requisition_id] = (byRequisition[c.requisition_id] || 0) + 1;
      const cid = c.submission_id || c.id;
      const ob = onboardingMap[cid];
      if (ob) onboardingCount++;
      if (ob?.status === 'completed') completedCount++;
    });
    return {
      total: candidates.length,
      requisitions: Object.keys(byRequisition).length,
      onboarding: onboardingCount,
      completed: completedCount,
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
        subtitle="Candidates whose interviews are over and received a final 'Accepted' decision. Set up their onboarding below."
      >
        <Link to="/dashboard/candidates" className="ghost-btn-link" style={{ color: '#dbeafe', fontSize: '0.88rem' }}>
          ← Shortlisted candidates
        </Link>
      </WelcomeBanner>

      <div className="stat-grid">
        <StatCard label="Accepted" value={stats.total} icon={Icons.check} tint="tint-green" />
        <StatCard label="Requisitions" value={stats.requisitions} icon={Icons.briefcase} tint="tint-blue" />
        <StatCard label="Onboarding Set Up" value={stats.onboarding} icon={Icons.users} tint="tint-violet" />
        <StatCard label="Completed" value={stats.completed} icon={Icons.check} tint="tint-green" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="glass-panel table-card" style={{ marginTop: 20 }}>
        <div className="shortlist-head">
          <h3 className="card-title">Accepted Candidates</h3>
          <span className="muted">{stats.total} accepted · set up onboarding for each</span>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: 24 }}>Loading...</p>
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
                        <div style={{ lineHeight: 1.3 }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>{c.requisition_ref}</span>
                          {c.requisition_title && <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{c.requisition_title}</div>}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: c.match_score >= 70 ? '#059669' : c.match_score >= 40 ? '#d97706' : '#dc2626' }}>
                        {c.match_score != null ? `${Math.round(c.match_score)}%` : '—'}
                      </span>
                    </td>
                    <td>
                      {inv ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                          {inv.interview_round || 'Interview'}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {ob ? (
                        <StatusBadge status={ob.status} />
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Not set up</span>
                      )}
                    </td>
                    <td className="td-action">
                      <button
                        onClick={() => setOnboardingCandidate(c)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: ob ? '#7c3aed' : '#0f172a',
                          color: '#fff', padding: '7px 14px', borderRadius: 8,
                          fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ob ? '📋 Edit Setup' : '🚀 Setup Onboarding'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {onboardingCandidate && (
        <OnboardingModal
          candidate={onboardingCandidate}
          onClose={() => setOnboardingCandidate(null)}
          authToken={token}
          onSave={handleOnboardingSave}
        />
      )}
    </div>
  );
}
