import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { LogOut, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

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
        position: 'relative', width: 40, height: 22, borderRadius: 11,
        background: disabled ? '#EDECE7' : checked ? '#059669' : '#D9D8D2',
        cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', padding: 0,
        flexShrink: 0, transition: 'background .15s',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left .15s', left: checked ? 21 : 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

function StatusBadge({ status }) {
  const styles = {
    not_started: { bg: '#f1f5f9', color: '#64748b', label: 'Not Started' },
    in_progress: { bg: '#fef3c7', color: '#92400e', label: 'In Progress' },
    completed: { bg: '#d1fae5', color: '#065f46', label: '✓ Completed' },
  };
  const s = styles[status] || styles.not_started;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem',
      fontWeight: 700, padding: '4px 12px', borderRadius: 999,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 20 }}>
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
    </div>
  );
}

function ItemRow({ label, note, checked, onChange, locked, badge }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', background: checked ? '#f0fdf4' : '#ffffff',
      border: `1px solid ${checked ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: 10, marginBottom: 8, transition: 'all .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem',
          fontWeight: 800, flexShrink: 0,
          background: checked ? '#059669' : '#e2e8f0',
          color: checked ? '#fff' : '#94a3b8',
        }}>
          {checked ? '✓' : ''}
        </span>
        <div>
          <span style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 500 }}>{label}</span>
          {note && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{note}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge && (
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#8a5a00', background: '#fff4e0', padding: '2px 6px', borderRadius: 999 }}>
            🔒 Required
          </span>
        )}
        {!locked && <Toggle checked={checked} onChange={onChange} />}
        {locked && (
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>✓ Done</span>
        )}
      </div>
    </div>
  );
}

function OnboardingChecklist({ checklist, toggleItem, isDone }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '24px 28px' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Onboarding Checklist</h2>
      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 8px 0' }}>
        Toggle each item once you've completed it. Your status updates automatically.
      </p>

      {/* Equipment */}
      <SectionTitle icon="💻" title="Equipment" />
      <ItemRow
        label="Company laptop"
        note={checklist.laptop?.spec || 'Standard build'}
        checked={isDone('laptop')}
        onChange={() => toggleItem('laptop')}
      />
      <ItemRow
        label="Building badge / on-site access"
        checked={isDone('badge')}
        onChange={() => toggleItem('badge')}
      />

      {/* Software */}
      <SectionTitle icon="🔑" title="Software & Access" />
      {Object.entries(SOFTWARE_LABELS).map(([key, label]) => {
        const sw = checklist.software?.[key];
        if (!sw?.enabled) return null;
        return (
          <ItemRow
            key={key}
            label={label}
            note={sw.note || undefined}
            checked={isDone(`software_${key}`)}
            onChange={() => toggleItem(`software_${key}`)}
          />
        );
      })}

      {/* Training */}
      <SectionTitle icon="📚" title="Training" />
      {Object.entries(MANDATORY_LABELS).map(([key, label]) => (
        <ItemRow
          key={key}
          label={label}
          checked={true}
          locked={true}
          badge={true}
        />
      ))}
      {Object.entries(OPTIONAL_LABELS).map(([key, label]) => {
        const tr = checklist.optional_training?.[key];
        if (!tr?.enabled) return null;
        return (
          <ItemRow
            key={key}
            label={label}
            checked={isDone(`training_${key}`)}
            onChange={() => toggleItem(`training_${key}`)}
          />
        );
      })}

      {/* Custom items */}
      {(checklist.custom_items || []).filter((ci) => ci.enabled).length > 0 && (
        <>
          <SectionTitle icon="📎" title="Additional Items" />
          {(checklist.custom_items || []).filter((ci) => ci.enabled).map((ci) => (
            <ItemRow
              key={ci.id}
              label={ci.label}
              note={ci.note || undefined}
              checked={isDone(`custom_${ci.id}`)}
              onChange={() => toggleItem(`custom_${ci.id}`)}
            />
          ))}
        </>
      )}

      {/* Notes from hiring manager */}
      {checklist.notes && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>💬 Note from your hiring manager</div>
          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>{checklist.notes}</div>
        </div>
      )}
    </div>
  );
}

export default function CandidatePortal() {
  const { user, token, logout } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!token) return;
    request('/candidates?status=Accepted', { token })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.candidates || [];
        const mine = list.filter(
          (c) => c.candidate_email?.toLowerCase() === user?.email?.toLowerCase()
        );
        setCandidates(mine);
        if (mine.length > 0) {
          const cid = mine[0].submission_id || mine[0].id;
          request(`/api/onboarding/${cid}`, { token })
            .then((doc) => setChecklist(doc))
            .catch(() => setChecklist(null));
        }
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [token, user]);

  const c = candidates[0];
  const cid = c ? (c.submission_id || c.id) : null;

  const progress = useMemo(() => {
    if (!checklist) return { done: 0, total: 0, pct: 0 };
    const completed = new Set(checklist.completed_items || []);
    let total = 0;
    let done = 0;
    if (checklist.laptop?.required) { total++; if (completed.has('laptop')) done++; }
    if (checklist.badge) { total++; if (completed.has('badge')) done++; }
    Object.entries(checklist.software || {}).forEach(([k, v]) => {
      if (v.enabled) { total++; if (completed.has(`software_${k}`)) done++; }
    });
    Object.entries(checklist.optional_training || {}).forEach(([k, v]) => {
      if (v.enabled) { total++; if (completed.has(`training_${k}`)) done++; }
    });
    (checklist.custom_items || []).forEach((ci) => {
      if (ci.enabled) { total++; if (completed.has(`custom_${ci.id}`)) done++; }
    });
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [checklist]);

  const toggleItem = async (itemId) => {
    if (!cid || !checklist) return;
    const current = new Set(checklist.completed_items || []);
    if (current.has(itemId)) {
      current.delete(itemId);
    } else {
      current.add(itemId);
    }
    const newCompleted = Array.from(current);
    setChecklist((prev) => ({ ...prev, completed_items: newCompleted }));
    setSaving(true);
    try {
      const body = { completed_items: newCompleted };
      const data = await request(`/api/onboarding/${cid}`, {
        token,
        method: 'PUT',
        body,
      });
      setChecklist(data);
      setToast(data.status === 'completed' ? '🎉 Onboarding complete!' : '✓ Saved');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setChecklist((prev) => ({ ...prev, completed_items: checklist.completed_items }));
    } finally {
      setSaving(false);
    }
  };

  const isDone = (itemId) => (checklist?.completed_items || []).includes(itemId);
  const onboardingComplete = checklist?.status === 'completed';

  // ── Onboarding gate: must complete before seeing dashboard ──
  const showOnboarding = checklist && !onboardingComplete;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>TJ</div>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>TermJobs</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Candidate Portal</div>
          </div>
        </div>
        {onboardingComplete && (
          <button onClick={logout} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={14} /> Sign out
          </button>
        )}
      </header>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: '#059669', color: '#fff',
          padding: '10px 20px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
          zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : !c ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>No submission found</h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>Your recruiter will add your details soon.</p>
          </div>
        ) : !checklist ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🚀</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Onboarding not set up yet</h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>Your hiring manager is preparing your onboarding checklist. Check back soon.</p>
          </div>
        ) : showOnboarding ? (
          /* ─── ONBOARDING GATE — must complete before dashboard ─── */
          <div>
            {/* Progress header */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(c.candidate_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>Welcome, {c.candidate_name}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 2 }}>Complete your onboarding to access your dashboard</div>
                    <div style={{ marginTop: 8 }}>
                      <StatusBadge status={checklist.status} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>{progress.pct}%</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{progress.done}/{progress.total} done</div>
                  </div>
                </div>
              </div>
              <div style={{ height: 6, background: '#e2e8f0' }}>
                <div style={{
                  height: '100%', transition: 'width .3s',
                  width: `${progress.pct}%`,
                  background: progress.pct === 100 ? '#059669' : '#2563eb',
                }} />
              </div>
            </div>

            <OnboardingChecklist checklist={checklist} toggleItem={toggleItem} isDone={isDone} />

            {/* Reminder */}
            <div style={{ marginTop: 16, padding: '14px 18px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color="#c2410c" />
              <span style={{ fontSize: '0.85rem', color: '#9a3412', fontWeight: 500 }}>
                You must complete all items above before accessing your candidate dashboard.
              </span>
            </div>
          </div>
        ) : (
          /* ─── DASHBOARD — shown after onboarding is complete ─── */
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                Welcome, {user?.name || c.candidate_name}
              </h1>
              <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0 }}>
                Your onboarding is complete. Here's your profile.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Onboarding complete card */}
              <div style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: 16, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={24} color="#059669" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#065f46' }}>Onboarding Complete</div>
                  <div style={{ fontSize: '0.85rem', color: '#059669', marginTop: 2 }}>
                    All {progress.total} items completed. You're ready to start!
                  </div>
                </div>
                <StatusBadge status={checklist.status} />
              </div>

              {/* Profile Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {(c.candidate_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{c.candidate_name}</div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 2 }}>{c.candidate_email || ''}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 }}>
                  {[
                    { label: 'Company', value: c.company_name },
                    { label: 'Role', value: c.requisition_title },
                    { label: 'Vendor', value: c.vendor_name },
                    { label: 'Requisition', value: c.requisition_ref },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1e293b' }}>{item.value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign out */}
              <button onClick={logout} style={{ width: '100%', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', padding: '12px', borderRadius: 10, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
